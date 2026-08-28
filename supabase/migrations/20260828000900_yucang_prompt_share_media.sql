-- Preserve the explicitly shared Prompt image snapshot across friend/group delivery.
-- This does not expose or enumerate Prompt Vault private storage.

create or replace function private.yucang_share_image_is_safe(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  matched text[];
  bytes bytea;
  mime text;
begin
  if coalesce(p_value, '') = '' then return true; end if;
  matched := regexp_match(p_value, '^data:(image/(png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$');
  if matched is null then return false; end if;
  mime := matched[1];
  begin bytes := decode(matched[3], 'base64'); exception when others then return false; end;
  if octet_length(bytes) < 3 or octet_length(bytes) > 5 * 1024 * 1024 then return false; end if;
  if mime = 'image/png' then
    return octet_length(bytes) >= 8 and substring(bytes from 1 for 8) = decode('89504E470D0A1A0A', 'hex');
  elsif mime = 'image/jpeg' then
    return substring(bytes from 1 for 3) = decode('FFD8FF', 'hex');
  end if;
  return octet_length(bytes) >= 12
    and convert_from(substring(bytes from 1 for 4), 'SQL_ASCII') = 'RIFF'
    and convert_from(substring(bytes from 9 for 4), 'SQL_ASCII') = 'WEBP';
end;
$$;

create or replace function private.yucang_share_image_array_is_safe(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare item jsonb;
begin
  if jsonb_typeof(p_value) <> 'array' then return false; end if;
  if jsonb_array_length(p_value) > 4 then return false; end if;
  for item in select value from jsonb_array_elements(p_value) loop
    if jsonb_typeof(item) <> 'string'
      or not private.yucang_share_image_is_safe(item #>> '{}') then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function private.yucang_share_media_size(p_image text, p_examples jsonb, p_references jsonb)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select octet_length(coalesce(p_image, ''))
    + octet_length(coalesce(p_examples, '[]'::jsonb)::text)
    + octet_length(coalesce(p_references, '[]'::jsonb)::text)
$$;

alter table public.yucang_prompt_shares
  add column if not exists image text not null default '',
  add column if not exists examples jsonb not null default '[]'::jsonb,
  add column if not exists reference_images jsonb not null default '[]'::jsonb;

alter table public.yucang_prompt_shares
  drop constraint if exists yucang_prompt_shares_image_safe,
  drop constraint if exists yucang_prompt_shares_examples_safe,
  drop constraint if exists yucang_prompt_shares_references_safe,
  drop constraint if exists yucang_prompt_shares_media_count,
  drop constraint if exists yucang_prompt_shares_media_size,
  add constraint yucang_prompt_shares_image_safe check (private.yucang_share_image_is_safe(image)),
  add constraint yucang_prompt_shares_examples_safe check (private.yucang_share_image_array_is_safe(examples)),
  add constraint yucang_prompt_shares_references_safe check (private.yucang_share_image_array_is_safe(reference_images)),
  add constraint yucang_prompt_shares_media_count check (
    (case when image = '' then 0 else 1 end) + jsonb_array_length(examples) + jsonb_array_length(reference_images) <= 4
  ),
  add constraint yucang_prompt_shares_media_size check (
    private.yucang_share_media_size(image, examples, reference_images) <= 14 * 1024 * 1024
  );

drop function if exists public.yucang_share_prompt(uuid, text, uuid, text, text, text, text, text, text[], jsonb, text, text, jsonb, text, text, text, text);

create function public.yucang_share_prompt(
  p_request_id uuid,
  p_target_kind text,
  p_target_id uuid,
  p_title text,
  p_prompt_text text,
  p_project text default '',
  p_category text default '',
  p_content_type text default 'prompt',
  p_tags text[] default '{}',
  p_variables jsonb default '[]'::jsonb,
  p_model_name text default '',
  p_model_version text default '',
  p_parameters jsonb default '{}'::jsonb,
  p_license_code text default '',
  p_negative_prompt text default '',
  p_usage_instruction text default '',
  p_source_item_id text default '',
  p_image text default '',
  p_examples jsonb default '[]'::jsonb,
  p_references jsonb default '[]'::jsonb
)
returns table (share_id uuid, result_status text, payload_hash text, remaining_free_shares integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  recipient uuid;
  target_group uuid;
  target_recipient_count integer := 1;
  canonical jsonb;
  server_hash text;
  existing public.yucang_prompt_shares%rowtype;
  paid_member boolean;
  privileged boolean;
  unlimited_sharing boolean;
  used_today integer;
  free_remaining integer;
  free_charge integer;
  permanent_charge integer;
  permanent_balance integer;
  clean_title text := trim(coalesce(p_title, ''));
  clean_image text := coalesce(p_image, '');
  clean_examples jsonb := coalesce(p_examples, '[]'::jsonb);
  clean_references jsonb := coalesce(p_references, '[]'::jsonb);
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null or p_target_id is null then raise exception 'invalid_share_request'; end if;
  if p_target_kind not in ('friend', 'group') then raise exception 'invalid_share_target'; end if;
  if char_length(clean_title) < 1 or char_length(clean_title) > 200
    or char_length(coalesce(p_prompt_text, '')) < 1 or char_length(p_prompt_text) > 100000
    or jsonb_typeof(coalesce(p_variables, 'null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_parameters, 'null'::jsonb)) <> 'object'
    or cardinality(coalesce(p_tags, '{}')) > 30
    or not private.yucang_share_image_is_safe(clean_image)
    or not private.yucang_share_image_array_is_safe(clean_examples)
    or not private.yucang_share_image_array_is_safe(clean_references)
  then raise exception 'invalid_share_payload'; end if;

  if (case when clean_image = '' then 0 else 1 end) + jsonb_array_length(clean_examples) + jsonb_array_length(clean_references) > 4
    or private.yucang_share_media_size(clean_image, clean_examples, clean_references) > 14 * 1024 * 1024
  then raise exception 'invalid_share_payload'; end if;

  if p_target_kind = 'friend' then
    recipient := p_target_id;
    if not exists (
      select 1 from public.yucang_friend_requests request
      where request.pair_low = least(caller, recipient)
        and request.pair_high = greatest(caller, recipient) and request.status = 'accepted'
    ) then raise exception 'friend_not_available'; end if;
  else
    target_group := p_target_id;
    if not exists (
      select 1 from public.yucang_groups group_row
      join public.yucang_group_members member_row on member_row.group_id = group_row.id
      where group_row.id = target_group and group_row.status = 'active'
        and member_row.user_id = caller and member_row.status = 'active'
    ) then raise exception 'group_not_available'; end if;
    select count(*)::integer into target_recipient_count
    from public.yucang_group_members member_row
    where member_row.group_id = target_group and member_row.status = 'active' and member_row.user_id <> caller;
    if target_recipient_count < 2 then raise exception 'group_not_available'; end if;
  end if;

  canonical := jsonb_build_object(
    'title', clean_title, 'prompt', p_prompt_text, 'project', coalesce(p_project, ''),
    'category', coalesce(p_category, ''), 'contentType', coalesce(p_content_type, 'prompt'),
    'tags', to_jsonb(coalesce(p_tags, '{}')), 'variables', coalesce(p_variables, '[]'::jsonb),
    'model', coalesce(p_model_name, ''), 'modelVersion', coalesce(p_model_version, ''),
    'parameters', coalesce(p_parameters, '{}'::jsonb), 'license', coalesce(p_license_code, ''),
    'negative', coalesce(p_negative_prompt, ''), 'usageInstruction', coalesce(p_usage_instruction, ''),
    'sourceItemId', coalesce(p_source_item_id, ''), 'image', clean_image,
    'examples', clean_examples, 'references', clean_references
  );
  server_hash := encode(extensions.digest(convert_to(canonical::text, 'utf8'), 'sha256'), 'hex');

  privileged := private.yucang_has_staff_role('admin', caller);
  select exists (
    select 1 from public.yucang_group_membership_periods period
    where period.user_id = caller and period.status = 'active'
      and period.starts_at <= now() and period.ends_at > now()
  ) into paid_member;
  unlimited_sharing := privileged or paid_member;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text, 927402));
  select * into existing from public.yucang_prompt_shares
  where sender_id = caller and request_id = p_request_id for update;
  if existing.id is not null then
    if existing.target_kind <> p_target_kind or existing.recipient_id is distinct from recipient
      or existing.group_id is distinct from target_group or existing.payload_hash <> server_hash
    then raise exception 'idempotency_conflict'; end if;
    share_id := existing.id;
    result_status := 'already_shared';
    select coalesce(sum(shared.daily_free_charged), 0)::integer into used_today
    from public.yucang_prompt_shares shared where shared.sender_id = caller
      and (shared.created_at at time zone 'Asia/Shanghai')::date = (now() at time zone 'Asia/Shanghai')::date;
    remaining_free_shares := case when unlimited_sharing then null else greatest(0, 3 - used_today) end;
    return next;
    return;
  end if;

  select coalesce(sum(shared.daily_free_charged), 0)::integer into used_today
  from public.yucang_prompt_shares shared where shared.sender_id = caller
    and (shared.created_at at time zone 'Asia/Shanghai')::date = (now() at time zone 'Asia/Shanghai')::date;
  free_remaining := greatest(0, 3 - used_today);
  if unlimited_sharing then free_charge := 0; permanent_charge := 0;
  else
    free_charge := least(target_recipient_count, free_remaining);
    permanent_charge := target_recipient_count - free_charge;
    permanent_balance := private.yucang_share_credit_balance(caller);
    if permanent_balance < permanent_charge then raise exception 'insufficient_share_credits'; end if;
  end if;

  insert into public.yucang_prompt_shares(
    sender_id, request_id, target_kind, recipient_id, group_id, title, prompt_text,
    project, category, content_type, tags, variables, model_name, model_version,
    parameters, license_code, negative_prompt, usage_instruction, source_item_id,
    image, examples, reference_images, payload_hash, recipient_count, daily_free_charged, permanent_credits_charged
  ) values (
    caller, p_request_id, p_target_kind, recipient, target_group, clean_title, p_prompt_text,
    coalesce(p_project, ''), coalesce(p_category, ''), coalesce(p_content_type, 'prompt'),
    coalesce(p_tags, '{}'), coalesce(p_variables, '[]'::jsonb), coalesce(p_model_name, ''),
    coalesce(p_model_version, ''), coalesce(p_parameters, '{}'::jsonb), coalesce(p_license_code, ''),
    coalesce(p_negative_prompt, ''), coalesce(p_usage_instruction, ''), coalesce(p_source_item_id, ''),
    clean_image, clean_examples, clean_references, server_hash,
    target_recipient_count, free_charge, permanent_charge
  ) returning id into share_id;

  if permanent_charge > 0 then
    insert into public.yucang_share_credit_ledger(
      user_id, delta, event_type, event_key, request_id, share_id, actor_id, details
    ) values (
      caller, -permanent_charge, 'share_debit', 'share:' || share_id::text,
      p_request_id, share_id, caller,
      jsonb_build_object('recipientCount', target_recipient_count,
        'dailyFreeCharged', free_charge, 'permanentCreditsCharged', permanent_charge)
    );
  end if;
  result_status := 'shared';
  remaining_free_shares := case when unlimited_sharing then null else greatest(0, free_remaining - free_charge) end;
  return next;
end;
$$;

drop function if exists public.yucang_list_received_prompt_shares(integer);
create function public.yucang_list_received_prompt_shares(p_limit integer default 50)
returns table (
  share_id uuid, sender_id uuid, sender_nickname text, sender_avatar_url text,
  target_kind text, group_id uuid, group_name text, title text, prompt_text text,
  project text, category text, content_type text, tags text[], variables jsonb,
  model_name text, model_version text, parameters jsonb, license_code text,
  negative_prompt text, usage_instruction text, source_item_id text,
  image text, examples jsonb, "references" jsonb, payload_hash text, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select shared.id, shared.sender_id,
    coalesce(nullif(trim(creator.nickname), ''), nullif(trim(profile.display_name), ''), '语藏用户'),
    coalesce(nullif(creator.avatar_url, ''), nullif(profile.avatar_url, ''), ''),
    shared.target_kind, shared.group_id, group_row.name, shared.title, shared.prompt_text,
    shared.project, shared.category, shared.content_type, shared.tags, shared.variables,
    shared.model_name, shared.model_version, shared.parameters, shared.license_code,
    shared.negative_prompt, shared.usage_instruction, shared.source_item_id,
    shared.image, shared.examples, shared.reference_images, shared.payload_hash, shared.created_at
  from public.yucang_prompt_shares shared
  left join public.yucang_groups group_row on group_row.id = shared.group_id
  left join public.profiles profile on profile.id = shared.sender_id
  left join public.yucang_creator_profiles creator on creator.user_id = shared.sender_id
  where auth.uid() is not null and (
    shared.recipient_id = auth.uid() or (shared.group_id is not null and exists (
      select 1 from public.yucang_group_members member_row
      where member_row.group_id = shared.group_id and member_row.user_id = auth.uid() and member_row.status = 'active'
    ))
  )
  order by shared.created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

drop function if exists public.yucang_list_sent_prompt_shares(integer);
create function public.yucang_list_sent_prompt_shares(p_limit integer default 50)
returns table (
  share_id uuid, target_kind text, recipient_id uuid, group_id uuid,
  target_display_name text, title text, prompt_text text,
  image text, examples jsonb, "references" jsonb, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare caller uuid := auth.uid(); safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  return query
  select shared.id, shared.target_kind, shared.recipient_id, shared.group_id,
    case when shared.target_kind = 'group' then coalesce(nullif(trim(group_row.name), ''), '语藏小组')
      else coalesce(nullif(trim(creator.nickname), ''), nullif(trim(profile.display_name), ''), '语藏用户') end,
    shared.title, shared.prompt_text, shared.image, shared.examples, shared.reference_images, shared.created_at
  from public.yucang_prompt_shares shared
  left join public.yucang_groups group_row on group_row.id = shared.group_id
  left join public.profiles profile on profile.id = shared.recipient_id
  left join public.yucang_creator_profiles creator on creator.user_id = shared.recipient_id
  where shared.sender_id = caller order by shared.created_at desc limit safe_limit;
end;
$$;

revoke all on function private.yucang_share_image_is_safe(text) from public, anon, authenticated;
revoke all on function private.yucang_share_image_array_is_safe(jsonb) from public, anon, authenticated;
revoke all on function private.yucang_share_media_size(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.yucang_share_prompt(uuid, text, uuid, text, text, text, text, text, text[], jsonb, text, text, jsonb, text, text, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.yucang_share_prompt(uuid, text, uuid, text, text, text, text, text, text[], jsonb, text, text, jsonb, text, text, text, text, text, jsonb, jsonb) to authenticated;
revoke all on function public.yucang_list_received_prompt_shares(integer) from public, anon;
grant execute on function public.yucang_list_received_prompt_shares(integer) to authenticated;
revoke all on function public.yucang_list_sent_prompt_shares(integer) from public, anon;
grant execute on function public.yucang_list_sent_prompt_shares(integer) to authenticated;

comment on function public.yucang_share_prompt(uuid, text, uuid, text, text, text, text, text, text[], jsonb, text, text, jsonb, text, text, text, text, text, jsonb, jsonb) is
  'Atomically shares one explicit Prompt snapshot and up to four embedded JPEG/PNG/WebP images; never reads Prompt Vault private storage.';

notify pgrst, 'reload schema';
