-- Yucang Prompt Community MVP Slice 1.
-- Additive only: this migration does not modify existing portfolio or private notebook data.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.yucang_creator_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 1 and 40),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  bio text not null default '' check (char_length(bio) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index yucang_creator_profiles_slug_unique
  on public.yucang_creator_profiles (lower(slug));

create table public.yucang_creator_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('active', 'revoked')),
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((status = 'active' and revoked_at is null) or status = 'revoked')
);

create table public.yucang_staff_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('reviewer', 'admin')),
  active boolean not null default true,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, role),
  check ((active and revoked_at is null) or not active)
);

create table public.yucang_works (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  origin_kind text not null default 'site_direct'
    check (origin_kind in ('site_direct', 'vault_handoff', 'official')),
  status text check (status in ('active', 'withdrawn', 'restricted')),
  current_public_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status is distinct from 'active' or current_public_version_id is not null)
);

create table public.yucang_versions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.yucang_works(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  author_nickname text not null check (char_length(trim(author_nickname)) between 1 and 40),
  version_no integer not null check (version_no > 0),
  revision bigint not null default 1 check (revision > 0),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'changes_requested', 'rejected', 'approved')),
  title text not null default '' check (char_length(title) <= 120),
  summary text not null default '' check (char_length(summary) <= 300),
  content_type text not null default 'image'
    check (content_type in ('image', 'video', 'text_office', 'programming')),
  prompt_text text not null default '' check (char_length(prompt_text) <= 50000),
  variables jsonb not null default '[]'::jsonb check (jsonb_typeof(variables) = 'array'),
  model_name text not null default '' check (char_length(model_name) <= 120),
  model_version text not null default '' check (char_length(model_version) <= 120),
  parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
  tags text[] not null default '{}',
  license_code text not null default 'personal'
    check (license_code in ('personal', 'commercial', 'commercial_client')),
  content_hash text,
  was_public boolean not null default false,
  submitted_at timestamptz,
  published_at timestamptz,
  workflow_closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, version_no),
  check (author_id is not null),
  check (not was_public or status = 'approved'),
  check ((status = 'approved' and published_at is not null and content_hash is not null) or status <> 'approved')
);

alter table public.yucang_works
  add constraint yucang_works_current_public_version_fk
  foreign key (current_public_version_id)
  references public.yucang_versions(id)
  on delete restrict
  deferrable initially deferred;

create unique index yucang_one_open_version_per_work
  on public.yucang_versions(work_id)
  where status in ('draft', 'pending_review', 'changes_requested')
    and workflow_closed_at is null;

create index yucang_versions_work_version_idx
  on public.yucang_versions(work_id, version_no desc);

create index yucang_versions_review_queue_idx
  on public.yucang_versions(status, submitted_at)
  where status = 'pending_review';

create table public.yucang_review_submissions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.yucang_versions(id) on delete restrict,
  attempt_no integer not null check (attempt_no > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  content_hash text not null,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  unique (version_id, attempt_no)
);

create table public.yucang_review_actions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.yucang_review_submissions(id) on delete restrict,
  action text not null check (action in ('withdrawn', 'changes_requested', 'rejected', 'approved')),
  reason text not null default '' check (char_length(reason) <= 2000),
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index yucang_review_terminal_action_unique
  on public.yucang_review_actions(submission_id)
  where action in ('changes_requested', 'rejected', 'approved');

create table public.yucang_audit_events (
  id bigint generated always as identity primary key,
  request_id uuid not null default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function private.yucang_is_creator(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.yucang_creator_grants grant_row
    where grant_row.user_id = p_user_id
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
  );
$$;

create or replace function private.yucang_has_staff_role(p_role text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.yucang_staff_roles role_row
    where role_row.user_id = p_user_id
      and role_row.role = p_role
      and role_row.active
      and role_row.revoked_at is null
  );
$$;

create or replace function private.yucang_can_review(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.yucang_has_staff_role('reviewer', p_user_id)
      or private.yucang_has_staff_role('admin', p_user_id);
$$;

revoke all on function private.yucang_is_creator(uuid) from public, anon;
revoke all on function private.yucang_has_staff_role(text, uuid) from public, anon;
revoke all on function private.yucang_can_review(uuid) from public, anon;
grant execute on function private.yucang_is_creator(uuid) to authenticated;
grant execute on function private.yucang_has_staff_role(text, uuid) to authenticated;
grant execute on function private.yucang_can_review(uuid) to authenticated;

create or replace function private.yucang_snapshot(p_version public.yucang_versions)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'workId', p_version.work_id,
    'versionId', p_version.id,
    'versionNo', p_version.version_no,
    'title', p_version.title,
    'summary', p_version.summary,
    'contentType', p_version.content_type,
    'prompt', p_version.prompt_text,
    'variables', p_version.variables,
    'model', p_version.model_name,
    'modelVersion', p_version.model_version,
    'parameters', p_version.parameters,
    'tags', to_jsonb(p_version.tags),
    'licenseCode', p_version.license_code,
    'authorId', p_version.author_id,
    'authorNickname', p_version.author_nickname
  );
$$;

create or replace function private.yucang_snapshot_hash(p_snapshot jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(digest(convert_to(p_snapshot::text, 'UTF8'), 'sha256'), 'hex');
$$;

revoke all on function private.yucang_snapshot(public.yucang_versions) from public, anon, authenticated;
revoke all on function private.yucang_snapshot_hash(jsonb) from public, anon, authenticated;

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
    new.title, new.summary, new.content_type, new.prompt_text, new.variables,
    new.model_name, new.model_version, new.parameters, new.tags, new.license_code,
    new.work_id, new.author_id, new.author_nickname, new.version_no
  ) is distinct from row(
    old.title, old.summary, old.content_type, old.prompt_text, old.variables,
    old.model_name, old.model_version, old.parameters, old.tags, old.license_code,
    old.work_id, old.author_id, old.author_nickname, old.version_no
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

create trigger yucang_versions_guard
  before update or delete on public.yucang_versions
  for each row execute procedure private.yucang_block_version_mutation();

create or replace function private.yucang_validate_current_pointer()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  pointed public.yucang_versions%rowtype;
begin
  if new.current_public_version_id is not null then
    select * into pointed
    from public.yucang_versions
    where id = new.current_public_version_id;

    if pointed.id is null
      or pointed.work_id <> new.id
      or pointed.status <> 'approved'
      or not pointed.was_public then
      raise exception 'current public version must be an approved public version of the same work';
    end if;
  end if;

  if new.status = 'active' and new.current_public_version_id is null then
    raise exception 'active work requires a current public version';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger yucang_works_current_pointer_guard
  before insert or update on public.yucang_works
  for each row execute procedure private.yucang_validate_current_pointer();

create or replace function private.yucang_block_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Yucang review and audit records are append-only';
end;
$$;

create trigger yucang_review_submissions_append_only
  before update or delete on public.yucang_review_submissions
  for each row execute procedure private.yucang_block_append_only_mutation();

create trigger yucang_review_actions_append_only
  before update or delete on public.yucang_review_actions
  for each row execute procedure private.yucang_block_append_only_mutation();

create trigger yucang_audit_events_append_only
  before update or delete on public.yucang_audit_events
  for each row execute procedure private.yucang_block_append_only_mutation();

alter table public.yucang_creator_profiles enable row level security;
alter table public.yucang_creator_grants enable row level security;
alter table public.yucang_staff_roles enable row level security;
alter table public.yucang_works enable row level security;
alter table public.yucang_versions enable row level security;
alter table public.yucang_review_submissions enable row level security;
alter table public.yucang_review_actions enable row level security;
alter table public.yucang_audit_events enable row level security;

revoke all on public.yucang_creator_profiles from anon, authenticated;
revoke all on public.yucang_creator_grants from anon, authenticated;
revoke all on public.yucang_staff_roles from anon, authenticated;
revoke all on public.yucang_works from anon, authenticated;
revoke all on public.yucang_versions from anon, authenticated;
revoke all on public.yucang_review_submissions from anon, authenticated;
revoke all on public.yucang_review_actions from anon, authenticated;
revoke all on public.yucang_audit_events from anon, authenticated;

grant select on public.yucang_creator_profiles to authenticated;
grant select on public.yucang_creator_grants to authenticated;
grant select on public.yucang_staff_roles to authenticated;
grant select on public.yucang_works to authenticated;
grant select on public.yucang_versions to authenticated;
grant select on public.yucang_review_submissions to authenticated;
grant select on public.yucang_review_actions to authenticated;

create policy yucang_creator_profile_owner_or_staff_read
  on public.yucang_creator_profiles for select to authenticated
  using (user_id = auth.uid() or private.yucang_can_review());

create policy yucang_creator_grant_owner_or_staff_read
  on public.yucang_creator_grants for select to authenticated
  using (user_id = auth.uid() or private.yucang_can_review());

create policy yucang_staff_role_self_or_admin_read
  on public.yucang_staff_roles for select to authenticated
  using (user_id = auth.uid() or private.yucang_has_staff_role('admin'));

create policy yucang_work_author_or_staff_read
  on public.yucang_works for select to authenticated
  using (author_id = auth.uid() or private.yucang_can_review());

create policy yucang_version_author_or_staff_read
  on public.yucang_versions for select to authenticated
  using (author_id = auth.uid() or private.yucang_can_review());

create policy yucang_submission_author_or_staff_read
  on public.yucang_review_submissions for select to authenticated
  using (
    submitted_by = auth.uid()
    or private.yucang_can_review()
  );

create policy yucang_action_author_or_staff_read
  on public.yucang_review_actions for select to authenticated
  using (
    private.yucang_can_review()
    or exists (
      select 1
      from public.yucang_review_submissions submission
      where submission.id = yucang_review_actions.submission_id
        and submission.submitted_by = auth.uid()
    )
  );

create or replace function public.yucang_get_my_access()
returns table (
  user_id uuid,
  is_creator boolean,
  is_reviewer boolean,
  is_admin boolean,
  nickname text,
  slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid(),
    private.yucang_is_creator(),
    private.yucang_has_staff_role('reviewer'),
    private.yucang_has_staff_role('admin'),
    creator.nickname,
    creator.slug
  from (select 1) seed
  left join public.yucang_creator_profiles creator on creator.user_id = auth.uid()
  where auth.uid() is not null;
$$;

create or replace function public.yucang_bootstrap_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtext('yucang_bootstrap_admin'));
  if exists (select 1 from public.yucang_staff_roles where role = 'admin' and active) then
    raise exception 'Yucang admin already initialized';
  end if;
  if not exists (
    select 1 from public.profiles where id = caller and site_role = 'owner'
  ) then
    raise exception 'only the existing site owner can initialize Yucang admin';
  end if;
  insert into public.yucang_staff_roles(user_id, role, active, granted_by)
  values (caller, 'admin', true, caller);
  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id)
  values (caller, 'bootstrap_admin', 'user', caller);
  return true;
end;
$$;

create or replace function public.yucang_admin_grant_creator(
  p_email text,
  p_nickname text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_user uuid;
begin
  if not private.yucang_has_staff_role('admin', caller) then
    raise exception 'admin access required';
  end if;
  select id into target_user from auth.users where lower(email) = lower(trim(p_email));
  if target_user is null then raise exception 'user not found'; end if;

  insert into public.yucang_creator_profiles(user_id, nickname, slug)
  values (target_user, trim(p_nickname), lower(trim(p_slug)))
  on conflict (user_id) do update set
    nickname = excluded.nickname,
    slug = excluded.slug,
    updated_at = now();

  insert into public.yucang_creator_grants(user_id, status, granted_by, granted_at, revoked_at)
  values (target_user, 'active', caller, now(), null)
  on conflict (user_id) do update set
    status = 'active',
    granted_by = caller,
    granted_at = now(),
    revoked_at = null;

  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id)
  values (caller, 'grant_creator', 'user', target_user);
  return target_user;
end;
$$;

create or replace function public.yucang_create_work(
  p_title text,
  p_summary text,
  p_content_type text,
  p_prompt_text text,
  p_variables jsonb,
  p_model_name text,
  p_model_version text,
  p_parameters jsonb,
  p_tags text[],
  p_license_code text
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
  if creator_nickname is null then
    raise exception 'creator public profile required';
  end if;

  insert into public.yucang_works(author_id, origin_kind)
  values (caller, 'site_direct') returning id into new_work;

  insert into public.yucang_versions(
    work_id, author_id, author_nickname, version_no, title, summary, content_type, prompt_text,
    variables, model_name, model_version, parameters, tags, license_code
  ) values (
    new_work, caller, creator_nickname, 1, trim(p_title), trim(p_summary), p_content_type, p_prompt_text,
    coalesce(p_variables, '[]'::jsonb), trim(p_model_name), trim(p_model_version),
    coalesce(p_parameters, '{}'::jsonb), coalesce(p_tags, '{}'), p_license_code
  ) returning id into new_version;

  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id)
  values (caller, 'create_work_draft', 'version', new_version);
  return query select new_work, new_version;
end;
$$;

create or replace function public.yucang_update_draft(
  p_version_id uuid,
  p_expected_revision bigint,
  p_title text,
  p_summary text,
  p_content_type text,
  p_prompt_text text,
  p_variables jsonb,
  p_model_name text,
  p_model_version text,
  p_parameters jsonb,
  p_tags text[],
  p_license_code text
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
    prompt_text = p_prompt_text, variables = coalesce(p_variables, '[]'::jsonb),
    model_name = trim(p_model_name), model_version = trim(p_model_version),
    parameters = coalesce(p_parameters, '{}'::jsonb), tags = coalesce(p_tags, '{}'),
    license_code = p_license_code, revision = revision + 1
  where id = p_version_id
    and author_id = caller
    and status = 'draft'
    and workflow_closed_at is null
    and revision = p_expected_revision
  returning revision into next_revision;

  if next_revision is null then
    raise exception 'draft not found, not editable, or revision conflict';
  end if;
  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id)
  values (caller, 'update_draft', 'version', p_version_id);
  return next_revision;
end;
$$;

create or replace function public.yucang_get_my_version(p_version_id uuid)
returns table (
  version_id uuid, work_id uuid, version_no integer, revision bigint, status text,
  title text, summary text, content_type text, prompt_text text, variables jsonb,
  model_name text, model_version text, parameters jsonb, tags text[], license_code text,
  submitted_at timestamptz, published_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id, v.work_id, v.version_no, v.revision, v.status, v.title, v.summary,
    v.content_type, v.prompt_text, v.variables, v.model_name, v.model_version,
    v.parameters, v.tags, v.license_code, v.submitted_at, v.published_at
  from public.yucang_versions v
  where v.id = p_version_id and (v.author_id = auth.uid() or private.yucang_can_review());
$$;

create or replace function public.yucang_prepare_preview(p_version_id uuid)
returns table (snapshot jsonb, content_hash text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  version_row public.yucang_versions%rowtype;
  built jsonb;
begin
  select * into version_row from public.yucang_versions
  where id = p_version_id and author_id = caller and status = 'draft' and workflow_closed_at is null;
  if version_row.id is null then raise exception 'editable draft not found'; end if;
  if trim(version_row.title) = '' or trim(version_row.prompt_text) = '' then
    raise exception 'title and prompt are required';
  end if;
  built := private.yucang_snapshot(version_row);
  return query select built, private.yucang_snapshot_hash(built);
end;
$$;

create or replace function public.yucang_submit_for_review(p_version_id uuid, p_expected_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  version_row public.yucang_versions%rowtype;
  built jsonb;
  built_hash text;
  next_attempt integer;
  submission_id uuid;
begin
  if caller is null or not private.yucang_is_creator(caller) then
    raise exception 'active creator grant required';
  end if;
  select * into version_row from public.yucang_versions
  where id = p_version_id for update;
  if version_row.id is null or version_row.author_id <> caller
    or version_row.status <> 'draft' or version_row.workflow_closed_at is not null then
    raise exception 'editable draft not found';
  end if;
  built := private.yucang_snapshot(version_row);
  built_hash := private.yucang_snapshot_hash(built);
  if built_hash <> p_expected_hash then raise exception 'preview changed; review again'; end if;

  select coalesce(max(attempt_no), 0) + 1 into next_attempt
  from public.yucang_review_submissions where version_id = p_version_id;
  insert into public.yucang_review_submissions(
    version_id, attempt_no, snapshot, content_hash, submitted_by
  ) values (p_version_id, next_attempt, built, built_hash, caller)
  returning id into submission_id;

  update public.yucang_versions set
    status = 'pending_review', content_hash = built_hash, submitted_at = now()
  where id = p_version_id;
  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id)
  values (caller, 'submit_for_review', 'submission', submission_id);
  return submission_id;
end;
$$;

create or replace function public.yucang_withdraw_review(p_version_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  active_submission uuid;
begin
  select s.id into active_submission
  from public.yucang_review_submissions s
  join public.yucang_versions v on v.id = s.version_id
  where v.id = p_version_id and v.author_id = caller and v.status = 'pending_review'
    and not exists (select 1 from public.yucang_review_actions a where a.submission_id = s.id)
  order by s.attempt_no desc limit 1 for update of v;
  if active_submission is null then raise exception 'review cannot be withdrawn'; end if;
  -- append-only submission rows keep the frozen review input; withdrawal is an action.
  insert into public.yucang_review_actions(submission_id, action, actor_id)
  values (active_submission, 'withdrawn', caller);
  update public.yucang_versions set status = 'draft', content_hash = null, submitted_at = null
  where id = p_version_id;
  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id)
  values (caller, 'withdraw_review', 'version', p_version_id);
  return true;
end;
$$;

create or replace function public.yucang_reopen_changes(p_version_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid();
begin
  update public.yucang_versions set status = 'draft', content_hash = null, submitted_at = null
  where id = p_version_id and author_id = caller and status = 'changes_requested';
  if not found then raise exception 'changes-requested version not found'; end if;
  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id)
  values (caller, 'reopen_changes', 'version', p_version_id);
  return true;
end;
$$;

create or replace function public.yucang_list_my_publications()
returns table (
  work_id uuid, work_status text, current_public_version_id uuid,
  version_id uuid, version_no integer, version_status text,
  title text, summary text, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select w.id, w.status, w.current_public_version_id,
    v.id, v.version_no, v.status, v.title, v.summary, v.updated_at
  from public.yucang_works w
  join public.yucang_versions v on v.work_id = w.id
  where w.author_id = auth.uid()
  order by w.updated_at desc, v.version_no desc;
$$;

create or replace function public.yucang_admin_list_pending()
returns table (
  submission_id uuid, version_id uuid, work_id uuid, version_no integer,
  author_id uuid, author_nickname text, title text, summary text,
  content_hash text, submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.yucang_can_review() then raise exception 'reviewer access required'; end if;
  return query
  select s.id, v.id, v.work_id, v.version_no, v.author_id, v.author_nickname,
    v.title, v.summary, s.content_hash, s.submitted_at
  from public.yucang_review_submissions s
  join public.yucang_versions v on v.id = s.version_id
  where v.status = 'pending_review'
    and s.attempt_no = (
      select max(latest.attempt_no)
      from public.yucang_review_submissions latest
      where latest.version_id = v.id
    )
    and not exists (
      select 1 from public.yucang_review_actions a
      where a.submission_id = s.id
    )
  order by s.submitted_at;
end;
$$;

create or replace function public.yucang_admin_get_submission(p_submission_id uuid)
returns table (
  submission_id uuid, version_id uuid, work_id uuid, version_no integer,
  author_id uuid, author_nickname text, snapshot jsonb,
  content_hash text, submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.yucang_can_review() then raise exception 'reviewer access required'; end if;
  return query
  select s.id, v.id, v.work_id, v.version_no, v.author_id, v.author_nickname,
    s.snapshot, s.content_hash, s.submitted_at
  from public.yucang_review_submissions s
  join public.yucang_versions v on v.id = s.version_id
  where s.id = p_submission_id;
end;
$$;

create or replace function public.yucang_review_submission(
  p_submission_id uuid,
  p_action text,
  p_reason text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  submission_row public.yucang_review_submissions%rowtype;
  version_row public.yucang_versions%rowtype;
  current_snapshot jsonb;
begin
  if not private.yucang_can_review(caller) then raise exception 'reviewer access required'; end if;
  if p_action not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'unsupported review action';
  end if;
  if p_action <> 'approved' and trim(coalesce(p_reason, '')) = '' then
    raise exception 'review reason is required';
  end if;
  select * into submission_row from public.yucang_review_submissions
  where id = p_submission_id for update;
  if submission_row.id is null then raise exception 'submission not found'; end if;
  select * into version_row from public.yucang_versions
  where id = submission_row.version_id for update;
  if version_row.status <> 'pending_review' then raise exception 'version is not pending review'; end if;
  if submission_row.attempt_no <> (
    select max(latest.attempt_no)
    from public.yucang_review_submissions latest
    where latest.version_id = submission_row.version_id
  ) then raise exception 'submission is not the current review attempt'; end if;
  if exists (
    select 1 from public.yucang_review_actions
    where submission_id = p_submission_id
  ) then raise exception 'submission already closed'; end if;

  current_snapshot := private.yucang_snapshot(version_row);
  if private.yucang_snapshot_hash(current_snapshot) <> submission_row.content_hash
    or current_snapshot <> submission_row.snapshot then
    raise exception 'frozen submission no longer matches version';
  end if;

  insert into public.yucang_review_actions(submission_id, action, reason, actor_id)
  values (p_submission_id, p_action, trim(p_reason), caller);

  if p_action = 'approved' then
    update public.yucang_versions set
      status = 'approved', was_public = true, published_at = now(),
      content_hash = submission_row.content_hash
    where id = version_row.id;
    update public.yucang_works set
      current_public_version_id = version_row.id,
      status = 'active'
    where id = version_row.work_id;
  elsif p_action = 'changes_requested' then
    update public.yucang_versions set status = 'changes_requested'
    where id = version_row.id;
  else
    update public.yucang_versions set status = 'rejected', workflow_closed_at = now()
    where id = version_row.id;
  end if;

  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id, details)
  values (caller, 'review_' || p_action, 'submission', p_submission_id,
    jsonb_build_object('reason', trim(p_reason)));
  return true;
end;
$$;

create or replace function public.yucang_list_public_works()
returns table (
  work_id uuid, version_id uuid, version_no integer, title text, summary text,
  content_type text, prompt_text text, variables jsonb, model_name text,
  model_version text, parameters jsonb, tags text[], license_code text,
  author_id uuid, author_nickname text, author_slug text, published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, v.id, v.version_no, v.title, v.summary, v.content_type, v.prompt_text,
    v.variables, v.model_name, v.model_version, v.parameters, v.tags, v.license_code,
    v.author_id, v.author_nickname, creator.slug, v.published_at
  from public.yucang_works w
  join public.yucang_versions v on v.id = w.current_public_version_id
  join public.yucang_creator_profiles creator on creator.user_id = w.author_id
  where w.status = 'active' and v.status = 'approved' and v.was_public
  order by v.published_at desc;
$$;

create or replace function public.yucang_get_public_work(p_work_id uuid)
returns table (
  work_id uuid, version_id uuid, version_no integer, title text, summary text,
  content_type text, prompt_text text, variables jsonb, model_name text,
  model_version text, parameters jsonb, tags text[], license_code text,
  author_id uuid, author_nickname text, author_slug text, published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.yucang_list_public_works() item where item.work_id = p_work_id;
$$;

revoke all on function public.yucang_get_my_access() from public, anon;
revoke all on function public.yucang_bootstrap_admin() from public, anon;
revoke all on function public.yucang_admin_grant_creator(text, text, text) from public, anon;
revoke all on function public.yucang_create_work(text, text, text, text, jsonb, text, text, jsonb, text[], text) from public, anon;
revoke all on function public.yucang_update_draft(uuid, bigint, text, text, text, text, jsonb, text, text, jsonb, text[], text) from public, anon;
revoke all on function public.yucang_get_my_version(uuid) from public, anon;
revoke all on function public.yucang_prepare_preview(uuid) from public, anon;
revoke all on function public.yucang_submit_for_review(uuid, text) from public, anon;
revoke all on function public.yucang_withdraw_review(uuid) from public, anon;
revoke all on function public.yucang_reopen_changes(uuid) from public, anon;
revoke all on function public.yucang_list_my_publications() from public, anon;
revoke all on function public.yucang_admin_list_pending() from public, anon;
revoke all on function public.yucang_admin_get_submission(uuid) from public, anon;
revoke all on function public.yucang_review_submission(uuid, text, text) from public, anon;

grant execute on function public.yucang_get_my_access() to authenticated;
grant execute on function public.yucang_bootstrap_admin() to authenticated;
grant execute on function public.yucang_admin_grant_creator(text, text, text) to authenticated;
grant execute on function public.yucang_create_work(text, text, text, text, jsonb, text, text, jsonb, text[], text) to authenticated;
grant execute on function public.yucang_update_draft(uuid, bigint, text, text, text, text, jsonb, text, text, jsonb, text[], text) to authenticated;
grant execute on function public.yucang_get_my_version(uuid) to authenticated;
grant execute on function public.yucang_prepare_preview(uuid) to authenticated;
grant execute on function public.yucang_submit_for_review(uuid, text) to authenticated;
grant execute on function public.yucang_withdraw_review(uuid) to authenticated;
grant execute on function public.yucang_reopen_changes(uuid) to authenticated;
grant execute on function public.yucang_list_my_publications() to authenticated;
grant execute on function public.yucang_admin_list_pending() to authenticated;
grant execute on function public.yucang_admin_get_submission(uuid) to authenticated;
grant execute on function public.yucang_review_submission(uuid, text, text) to authenticated;

revoke all on function public.yucang_list_public_works() from public;
revoke all on function public.yucang_get_public_work(uuid) from public;
grant execute on function public.yucang_list_public_works() to anon, authenticated;
grant execute on function public.yucang_get_public_work(uuid) to anon, authenticated;

comment on table public.yucang_versions is
  'Yucang Slice 1 versions. Public access is only through filtered RPCs; pending and approved content are immutable.';
comment on function public.yucang_review_submission(uuid, text, text) is
  'Atomically validates the frozen submission, records the decision, approves the version, and switches current public version.';
