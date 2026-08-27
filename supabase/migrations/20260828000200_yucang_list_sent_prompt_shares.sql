insert into public.yucang_staff_roles(user_id, role, active, granted_by, revoked_at)
select profile.id, 'admin', true, profile.id, null
from public.profiles profile
where profile.site_role = 'owner'
on conflict (user_id, role) do update
set active = true,
    revoked_at = null,
    granted_by = excluded.granted_by;

create or replace function public.yucang_list_sent_prompt_shares(p_limit integer default 50)
returns table (
  share_id uuid,
  target_kind text,
  recipient_id uuid,
  group_id uuid,
  target_display_name text,
  title text,
  prompt_text text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  return query
  select
    shared.id,
    shared.target_kind,
    shared.recipient_id,
    shared.group_id,
    case
      when shared.target_kind = 'group' then coalesce(nullif(trim(group_row.name), ''), '语藏小组')
      else coalesce(nullif(trim(creator.nickname), ''), nullif(trim(profile.display_name), ''), '语藏用户')
    end,
    shared.title,
    shared.prompt_text,
    shared.created_at
  from public.yucang_prompt_shares shared
  left join public.yucang_groups group_row on group_row.id = shared.group_id
  left join public.profiles profile on profile.id = shared.recipient_id
  left join public.yucang_creator_profiles creator on creator.user_id = shared.recipient_id
  where shared.sender_id = caller
  order by shared.created_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.yucang_list_sent_prompt_shares(integer) from public, anon;
grant execute on function public.yucang_list_sent_prompt_shares(integer) to authenticated;

comment on function public.yucang_list_sent_prompt_shares(integer) is
  'Returns only Prompt snapshots sent by the authenticated user; never reads Prompt Vault private storage.';

create or replace function public.yucang_get_collaboration_entitlement()
returns table (
  account_role text,
  share_unlimited boolean,
  remaining_free_shares integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  is_admin boolean;
  is_paid boolean;
  used_today integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  is_admin := private.yucang_has_staff_role('admin', caller);
  select exists (
    select 1
    from public.yucang_group_membership_periods period
    where period.user_id = caller
      and period.status = 'active'
      and period.starts_at <= now()
      and period.ends_at > now()
  ) into is_paid;

  account_role := case when is_admin then 'admin' else 'member' end;
  share_unlimited := is_admin or is_paid;
  if share_unlimited then
    remaining_free_shares := null;
  else
    select count(*)::integer into used_today
    from public.yucang_prompt_shares shared
    where shared.sender_id = caller
      and (shared.created_at at time zone 'Asia/Shanghai')::date = (now() at time zone 'Asia/Shanghai')::date;
    remaining_free_shares := greatest(0, 3 - used_today);
  end if;
  return next;
end;
$$;

create or replace function public.yucang_share_prompt(
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
  p_source_item_id text default ''
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
  canonical jsonb;
  server_hash text;
  existing public.yucang_prompt_shares%rowtype;
  paid_member boolean;
  privileged boolean;
  unlimited_sharing boolean;
  used_today integer;
  clean_title text := trim(coalesce(p_title, ''));
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null or p_target_id is null then raise exception 'invalid_share_request'; end if;
  if p_target_kind not in ('friend', 'group') then raise exception 'invalid_share_target'; end if;
  if char_length(clean_title) < 1 or char_length(clean_title) > 200
    or char_length(coalesce(p_prompt_text, '')) < 1 or char_length(p_prompt_text) > 100000
    or jsonb_typeof(coalesce(p_variables, 'null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_parameters, 'null'::jsonb)) <> 'object'
    or cardinality(coalesce(p_tags, '{}')) > 30 then
    raise exception 'invalid_share_payload';
  end if;

  if p_target_kind = 'friend' then
    recipient := p_target_id;
    if not exists (
      select 1 from public.yucang_friend_requests request
      where request.pair_low = least(caller, recipient)
        and request.pair_high = greatest(caller, recipient)
        and request.status = 'accepted'
    ) then raise exception 'friend_not_available'; end if;
  else
    target_group := p_target_id;
    if not exists (
      select 1 from public.yucang_groups group_row
      join public.yucang_group_members member_row on member_row.group_id = group_row.id
      where group_row.id = target_group and group_row.status = 'active'
        and member_row.user_id = caller and member_row.status = 'active'
        and (select count(*) from public.yucang_group_members active_member
             where active_member.group_id = group_row.id and active_member.status = 'active') >= 3
    ) then raise exception 'group_not_available'; end if;
  end if;

  canonical := jsonb_build_object(
    'title', clean_title,
    'prompt', p_prompt_text,
    'project', coalesce(p_project, ''),
    'category', coalesce(p_category, ''),
    'contentType', coalesce(p_content_type, 'prompt'),
    'tags', to_jsonb(coalesce(p_tags, '{}')),
    'variables', coalesce(p_variables, '[]'::jsonb),
    'model', coalesce(p_model_name, ''),
    'modelVersion', coalesce(p_model_version, ''),
    'parameters', coalesce(p_parameters, '{}'::jsonb),
    'license', coalesce(p_license_code, ''),
    'negative', coalesce(p_negative_prompt, ''),
    'usageInstruction', coalesce(p_usage_instruction, ''),
    'sourceItemId', coalesce(p_source_item_id, '')
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
    if existing.target_kind <> p_target_kind
      or existing.recipient_id is distinct from recipient
      or existing.group_id is distinct from target_group
      or existing.payload_hash <> server_hash then
      raise exception 'idempotency_conflict';
    end if;
    share_id := existing.id;
    result_status := 'already_shared';
    if unlimited_sharing then
      remaining_free_shares := null;
    else
      select count(*)::integer into used_today from public.yucang_prompt_shares
      where sender_id = caller
        and (created_at at time zone 'Asia/Shanghai')::date = (now() at time zone 'Asia/Shanghai')::date;
      remaining_free_shares := greatest(0, 3 - used_today);
    end if;
    return next;
    return;
  end if;

  select count(*)::integer into used_today from public.yucang_prompt_shares
  where sender_id = caller
    and (created_at at time zone 'Asia/Shanghai')::date = (now() at time zone 'Asia/Shanghai')::date;
  if not unlimited_sharing and used_today >= 3 then raise exception 'daily_share_limit_reached'; end if;

  insert into public.yucang_prompt_shares(
    sender_id, request_id, target_kind, recipient_id, group_id,
    title, prompt_text, project, category, content_type, tags, variables,
    model_name, model_version, parameters, license_code, negative_prompt,
    usage_instruction, source_item_id, payload_hash
  ) values (
    caller, p_request_id, p_target_kind, recipient, target_group,
    clean_title, p_prompt_text, coalesce(p_project, ''), coalesce(p_category, ''),
    coalesce(p_content_type, 'prompt'), coalesce(p_tags, '{}'), coalesce(p_variables, '[]'::jsonb),
    coalesce(p_model_name, ''), coalesce(p_model_version, ''), coalesce(p_parameters, '{}'::jsonb),
    coalesce(p_license_code, ''), coalesce(p_negative_prompt, ''),
    coalesce(p_usage_instruction, ''), coalesce(p_source_item_id, ''), server_hash
  ) returning id into share_id;
  result_status := 'shared';
  remaining_free_shares := case when unlimited_sharing then null else greatest(0, 2 - used_today) end;
  return next;
end;
$$;

revoke all on function public.yucang_get_collaboration_entitlement() from public, anon;
grant execute on function public.yucang_get_collaboration_entitlement() to authenticated;

revoke all on function public.yucang_share_prompt(uuid, text, uuid, text, text, text, text, text, text[], jsonb, text, text, jsonb, text, text, text, text) from public, anon;
grant execute on function public.yucang_share_prompt(uuid, text, uuid, text, text, text, text, text, text[], jsonb, text, text, jsonb, text, text, text, text) to authenticated;

comment on function public.yucang_get_collaboration_entitlement() is
  'Returns the authenticated account collaboration role and server-enforced sharing quota without exposing account identifiers.';
