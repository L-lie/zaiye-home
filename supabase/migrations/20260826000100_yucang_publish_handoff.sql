-- Yucang MVP: one selected Prompt Vault item -> one website publication draft.
-- This is a publication handoff, not cloud sync. It exposes no private-library read API.

alter table public.yucang_versions
  add column negative_prompt_text text not null default ''
    check (char_length(negative_prompt_text) <= 20000),
  add column dependencies jsonb not null default '[]'::jsonb
    check (jsonb_typeof(dependencies) = 'array'),
  add column instructions text not null default ''
    check (char_length(instructions) <= 10000);

create table private.yucang_handoff_receipts (
  author_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  handoff_id uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  target_work_id uuid references public.yucang_works(id) on delete restrict,
  work_id uuid not null references public.yucang_works(id) on delete restrict,
  version_id uuid not null references public.yucang_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (author_id, request_id),
  unique (author_id, handoff_id)
);

revoke all on private.yucang_handoff_receipts from public, anon, authenticated;

create or replace function private.yucang_snapshot(p_version public.yucang_versions)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', 2,
    'workId', p_version.work_id,
    'versionId', p_version.id,
    'versionNo', p_version.version_no,
    'title', p_version.title,
    'summary', p_version.summary,
    'contentType', p_version.content_type,
    'prompt', p_version.prompt_text,
    'negativePrompt', p_version.negative_prompt_text,
    'variables', p_version.variables,
    'model', p_version.model_name,
    'modelVersion', p_version.model_version,
    'parameters', p_version.parameters,
    'dependencies', p_version.dependencies,
    'tags', to_jsonb(p_version.tags),
    'licenseCode', p_version.license_code,
    'instructions', p_version.instructions,
    'authorId', p_version.author_id,
    'authorNickname', p_version.author_nickname,
    'originKind', (select w.origin_kind from public.yucang_works w where w.id = p_version.work_id)
  );
$$;

revoke all on function private.yucang_snapshot(public.yucang_versions) from public, anon, authenticated;

create or replace function private.yucang_block_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  content_changed boolean;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' or old.was_public then
      raise exception 'non-draft Yucang versions are immutable';
    end if;
    return old;
  end if;

  content_changed := row(
    new.title, new.summary, new.content_type, new.prompt_text, new.negative_prompt_text,
    new.variables, new.model_name, new.model_version, new.parameters, new.dependencies,
    new.tags, new.license_code, new.instructions, new.work_id, new.author_id,
    new.author_nickname, new.version_no
  ) is distinct from row(
    old.title, old.summary, old.content_type, old.prompt_text, old.negative_prompt_text,
    old.variables, old.model_name, old.model_version, old.parameters, old.dependencies,
    old.tags, old.license_code, old.instructions, old.work_id, old.author_id,
    old.author_nickname, old.version_no
  );

  if content_changed and (old.status <> 'draft' or old.workflow_closed_at is not null) then
    raise exception 'only an open draft may change version content';
  end if;
  if old.status = 'approved' and new.status <> 'approved' then
    raise exception 'approved status is immutable';
  end if;
  if old.was_public and (
    not new.was_public
    or new.content_hash is distinct from old.content_hash
    or new.published_at is distinct from old.published_at
  ) then
    raise exception 'published version metadata is immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.yucang_create_work_v2(
  p_title text, p_summary text, p_content_type text, p_prompt_text text,
  p_negative_prompt_text text, p_variables jsonb, p_model_name text,
  p_model_version text, p_parameters jsonb, p_dependencies jsonb,
  p_tags text[], p_license_code text, p_instructions text
)
returns table (work_id uuid, version_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_work uuid;
  new_version uuid;
  creator_nickname text;
begin
  if caller is null or not private.yucang_is_creator(caller) then
    raise exception 'active creator grant required';
  end if;
  select nickname into creator_nickname
  from public.yucang_creator_profiles where user_id = caller;
  if creator_nickname is null then raise exception 'creator public profile required'; end if;

  insert into public.yucang_works(author_id, origin_kind)
  values (caller, 'site_direct') returning id into new_work;
  insert into public.yucang_versions(
    work_id, author_id, author_nickname, version_no, title, summary, content_type,
    prompt_text, negative_prompt_text, variables, model_name, model_version,
    parameters, dependencies, tags, license_code, instructions
  ) values (
    new_work, caller, creator_nickname, 1, trim(p_title), trim(p_summary), p_content_type,
    p_prompt_text, coalesce(p_negative_prompt_text, ''), coalesce(p_variables, '[]'::jsonb),
    trim(coalesce(p_model_name, '')), trim(coalesce(p_model_version, '')),
    coalesce(p_parameters, '{}'::jsonb), coalesce(p_dependencies, '[]'::jsonb),
    coalesce(p_tags, '{}'), p_license_code, coalesce(p_instructions, '')
  ) returning id into new_version;
  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id)
  values (caller, 'create_work_draft', 'version', new_version);
  return query select new_work, new_version;
end;
$$;

create or replace function public.yucang_update_draft_v2(
  p_version_id uuid, p_expected_revision bigint, p_title text, p_summary text,
  p_content_type text, p_prompt_text text, p_negative_prompt_text text,
  p_variables jsonb, p_model_name text, p_model_version text, p_parameters jsonb,
  p_dependencies jsonb, p_tags text[], p_license_code text, p_instructions text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  next_revision bigint;
begin
  if caller is null or not private.yucang_is_creator(caller) then
    raise exception 'active creator grant required';
  end if;
  update public.yucang_versions set
    title = trim(p_title), summary = trim(p_summary), content_type = p_content_type,
    prompt_text = p_prompt_text, negative_prompt_text = coalesce(p_negative_prompt_text, ''),
    variables = coalesce(p_variables, '[]'::jsonb), model_name = trim(coalesce(p_model_name, '')),
    model_version = trim(coalesce(p_model_version, '')), parameters = coalesce(p_parameters, '{}'::jsonb),
    dependencies = coalesce(p_dependencies, '[]'::jsonb), tags = coalesce(p_tags, '{}'),
    license_code = p_license_code, instructions = coalesce(p_instructions, ''), revision = revision + 1
  where id = p_version_id and author_id = caller and status = 'draft'
    and workflow_closed_at is null and revision = p_expected_revision
  returning revision into next_revision;
  if next_revision is null then raise exception 'draft not found, not editable, or revision conflict'; end if;
  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id)
  values (caller, 'update_draft', 'version', p_version_id);
  return next_revision;
end;
$$;

create or replace function public.yucang_get_my_version_v2(p_version_id uuid)
returns table (
  version_id uuid, work_id uuid, version_no integer, revision bigint, status text,
  title text, summary text, content_type text, prompt_text text, negative_prompt_text text,
  variables jsonb, model_name text, model_version text, parameters jsonb,
  dependencies jsonb, tags text[], license_code text, instructions text,
  submitted_at timestamptz, published_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id, v.work_id, v.version_no, v.revision, v.status, v.title, v.summary,
    v.content_type, v.prompt_text, v.negative_prompt_text, v.variables, v.model_name,
    v.model_version, v.parameters, v.dependencies, v.tags, v.license_code,
    v.instructions, v.submitted_at, v.published_at
  from public.yucang_versions v
  where v.id = p_version_id and (v.author_id = auth.uid() or private.yucang_can_review());
$$;

create or replace function public.yucang_create_draft_from_handoff(
  p_request_id uuid,
  p_handoff_id uuid,
  p_payload_hash text,
  p_target_work_id uuid,
  p_content jsonb
)
returns table (result_status text, work_id uuid, version_id uuid, revision bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  creator_nickname text;
  receipt private.yucang_handoff_receipts%rowtype;
  new_work uuid;
  new_version uuid;
  next_version integer;
  server_hash text;
  tags_value text[];
begin
  if caller is null then raise exception 'authentication_required'; end if;
  if not private.yucang_is_creator(caller) then raise exception 'creator_required'; end if;
  select nickname into creator_nickname from public.yucang_creator_profiles where user_id = caller;
  if creator_nickname is null then raise exception 'creator_profile_required'; end if;
  if p_request_id is null or p_handoff_id is null then raise exception 'invalid_request'; end if;
  if p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_payload_hash'; end if;
  if jsonb_typeof(p_content) <> 'object' then raise exception 'invalid_payload'; end if;

  server_hash := private.yucang_snapshot_hash(p_content);
  perform pg_advisory_xact_lock(hashtextextended(caller::text || ':' || p_handoff_id::text, 0));

  select * into receipt from private.yucang_handoff_receipts
  where author_id = caller and (request_id = p_request_id or handoff_id = p_handoff_id)
  order by (request_id = p_request_id) desc limit 1;
  if receipt.author_id is not null then
    if receipt.request_id <> p_request_id or receipt.handoff_id <> p_handoff_id
      or receipt.payload_hash <> p_payload_hash or receipt.content_hash <> server_hash
      or receipt.target_work_id is distinct from p_target_work_id then
      raise exception 'idempotency_conflict';
    end if;
    return query select 'already_created'::text, receipt.work_id, receipt.version_id, 1::bigint;
    return;
  end if;

  if (
    select count(*) from private.yucang_handoff_receipts
    where author_id = caller and created_at >= now() - interval '1 minute'
  ) >= 5 then
    raise exception 'rate_limited';
  end if;

  if p_target_work_id is null then
    insert into public.yucang_works(author_id, origin_kind)
    values (caller, 'vault_handoff') returning id into new_work;
    next_version := 1;
  else
    select id into new_work from public.yucang_works
    where id = p_target_work_id and author_id = caller for update;
    if new_work is null then raise exception 'target_work_not_found'; end if;
    if exists (
      select 1 from public.yucang_versions where work_id = new_work
        and status in ('draft', 'pending_review', 'changes_requested')
        and workflow_closed_at is null
    ) then raise exception 'open_version_exists'; end if;
    select coalesce(max(version_no), 0) + 1 into next_version
    from public.yucang_versions where work_id = new_work;
  end if;

  select coalesce(array_agg(value), '{}') into tags_value
  from jsonb_array_elements_text(coalesce(p_content->'tags', '[]'::jsonb));

  insert into public.yucang_versions(
    work_id, author_id, author_nickname, version_no, title, summary, content_type,
    prompt_text, negative_prompt_text, variables, model_name, model_version,
    parameters, dependencies, tags, license_code, instructions
  ) values (
    new_work, caller, creator_nickname, next_version, trim(p_content->>'title'),
    trim(p_content->>'summary'), p_content->>'contentType', p_content->>'prompt',
    coalesce(p_content->>'negativePrompt', ''), coalesce(p_content->'variables', '[]'::jsonb),
    trim(coalesce(p_content#>>'{model,name}', '')), trim(coalesce(p_content#>>'{model,version}', '')),
    coalesce(p_content->'parameters', '{}'::jsonb), coalesce(p_content->'dependencies', '[]'::jsonb),
    tags_value, p_content->>'licenseCode', coalesce(p_content->>'instructions', '')
  ) returning id into new_version;

  insert into private.yucang_handoff_receipts(
    author_id, request_id, handoff_id, payload_hash, content_hash,
    target_work_id, work_id, version_id
  ) values (
    caller, p_request_id, p_handoff_id, p_payload_hash, server_hash,
    p_target_work_id, new_work, new_version
  );
  insert into public.yucang_audit_events(request_id, actor_id, action, entity_type, entity_id, details)
  values (p_request_id, caller, 'create_handoff_draft', 'version', new_version,
    jsonb_build_object('handoffId', p_handoff_id, 'originKind', 'vault_handoff'));
  return query select 'created'::text, new_work, new_version, 1::bigint;
end;
$$;

revoke all on function public.yucang_create_work_v2(text,text,text,text,text,jsonb,text,text,jsonb,jsonb,text[],text,text) from public, anon;
revoke all on function public.yucang_update_draft_v2(uuid,bigint,text,text,text,text,text,jsonb,text,text,jsonb,jsonb,text[],text,text) from public, anon;
revoke all on function public.yucang_get_my_version_v2(uuid) from public, anon;
revoke all on function public.yucang_create_draft_from_handoff(uuid,uuid,text,uuid,jsonb) from public, anon;
grant execute on function public.yucang_create_work_v2(text,text,text,text,text,jsonb,text,text,jsonb,jsonb,text[],text,text) to authenticated;
grant execute on function public.yucang_update_draft_v2(uuid,bigint,text,text,text,text,text,jsonb,text,text,jsonb,jsonb,text[],text,text) to authenticated;
grant execute on function public.yucang_get_my_version_v2(uuid) to authenticated;
grant execute on function public.yucang_create_draft_from_handoff(uuid,uuid,text,uuid,jsonb) to authenticated;

comment on table private.yucang_handoff_receipts is
  'Private idempotency receipts for one explicitly selected Prompt Vault publication handoff. Contains no Prompt body or private-library identifier.';
comment on function public.yucang_create_draft_from_handoff(uuid,uuid,text,uuid,jsonb) is
  'Creates exactly one publication draft from one authenticated, explicit Prompt Vault handoff; exposes no private-library read capability.';
