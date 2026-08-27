-- Private, explicit single-Prompt sharing for Yucang friends and groups.
-- This migration does not enable cloud sync and exposes no Prompt-library browse API.

create table if not exists public.yucang_share_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share_code text not null unique default (
    'YC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ) check (share_code ~ '^YC-[A-F0-9]{12}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.yucang_friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  pair_low uuid generated always as (least(requester_id, addressee_id)) stored,
  pair_high uuid generated always as (greatest(requester_id, addressee_id)) stored,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'removed')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (pair_low, pair_high)
);

create index if not exists yucang_friend_requests_requester_idx
  on public.yucang_friend_requests(requester_id, status, updated_at desc);
create index if not exists yucang_friend_requests_addressee_idx
  on public.yucang_friend_requests(addressee_id, status, updated_at desc);

create table if not exists public.yucang_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 40),
  status text not null default 'forming' check (status in ('forming', 'active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.yucang_group_members (
  group_id uuid not null references public.yucang_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete restrict,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'invited' check (status in ('invited', 'active', 'declined', 'left')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id),
  check ((role = 'owner' and status = 'active') or role = 'member')
);

create index if not exists yucang_group_members_user_idx
  on public.yucang_group_members(user_id, status, updated_at desc);

create table if not exists public.yucang_prompt_shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  target_kind text not null check (target_kind in ('friend', 'group')),
  recipient_id uuid references auth.users(id) on delete restrict,
  group_id uuid references public.yucang_groups(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  prompt_text text not null check (char_length(prompt_text) between 1 and 100000),
  project text not null default '' check (char_length(project) <= 120),
  category text not null default '' check (char_length(category) <= 120),
  content_type text not null default 'prompt' check (char_length(content_type) between 1 and 40),
  tags text[] not null default '{}' check (cardinality(tags) <= 30),
  variables jsonb not null default '[]'::jsonb check (jsonb_typeof(variables) = 'array'),
  model_name text not null default '' check (char_length(model_name) <= 120),
  model_version text not null default '' check (char_length(model_version) <= 120),
  parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
  license_code text not null default '' check (char_length(license_code) <= 80),
  negative_prompt text not null default '' check (char_length(negative_prompt) <= 50000),
  usage_instruction text not null default '' check (char_length(usage_instruction) <= 10000),
  source_item_id text not null default '' check (char_length(source_item_id) <= 200),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (sender_id, request_id),
  check (
    (target_kind = 'friend' and recipient_id is not null and group_id is null)
    or (target_kind = 'group' and recipient_id is null and group_id is not null)
  ),
  check (recipient_id is null or recipient_id <> sender_id)
);

create index if not exists yucang_prompt_shares_sender_day_idx
  on public.yucang_prompt_shares(sender_id, created_at desc);
create index if not exists yucang_prompt_shares_recipient_idx
  on public.yucang_prompt_shares(recipient_id, created_at desc)
  where recipient_id is not null;
create index if not exists yucang_prompt_shares_group_idx
  on public.yucang_prompt_shares(group_id, created_at desc)
  where group_id is not null;

alter table public.yucang_share_identities enable row level security;
alter table public.yucang_friend_requests enable row level security;
alter table public.yucang_groups enable row level security;
alter table public.yucang_group_members enable row level security;
alter table public.yucang_prompt_shares enable row level security;

revoke all on public.yucang_share_identities, public.yucang_friend_requests,
  public.yucang_groups, public.yucang_group_members, public.yucang_prompt_shares
  from public, anon, authenticated;

create or replace function private.yucang_refresh_group_status(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
begin
  select count(*)::integer into active_count
  from public.yucang_group_members
  where group_id = p_group_id and status = 'active';

  update public.yucang_groups
  set status = case when active_count >= 3 then 'active' else 'forming' end,
      updated_at = now()
  where id = p_group_id and status <> 'closed';
end;
$$;

create or replace function public.yucang_get_my_share_identity()
returns table (share_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  insert into public.yucang_share_identities(user_id) values (caller)
  on conflict (user_id) do nothing;
  return query select identity.share_code
  from public.yucang_share_identities identity where identity.user_id = caller;
end;
$$;

create or replace function public.yucang_request_friend(p_share_code text)
returns table (request_id uuid, result_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target uuid;
  existing public.yucang_friend_requests%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select user_id into target from public.yucang_share_identities
  where share_code = upper(trim(coalesce(p_share_code, '')));
  if target is null or target = caller then raise exception 'account_not_available'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(least(caller, target)::text || ':' || greatest(caller, target)::text, 927401)
  );
  select * into existing from public.yucang_friend_requests
  where pair_low = least(caller, target) and pair_high = greatest(caller, target)
  for update;

  if existing.id is not null and existing.status = 'accepted' then
    return query select existing.id, 'already_friends'::text;
    return;
  end if;
  if existing.id is not null and existing.status = 'pending' then
    return query select existing.id, 'already_pending'::text;
    return;
  end if;

  if existing.id is null then
    insert into public.yucang_friend_requests(requester_id, addressee_id)
    values (caller, target)
    returning id into request_id;
  else
    update public.yucang_friend_requests set
      requester_id = caller, addressee_id = target, status = 'pending',
      responded_at = null, updated_at = now()
    where id = existing.id returning id into request_id;
  end if;
  result_status := 'request_sent';
  return next;
end;
$$;

create or replace function public.yucang_request_friend_by_email(
  p_requester_id uuid,
  p_email text
)
returns table (request_id uuid, result_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  existing public.yucang_friend_requests%rowtype;
  normalized_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_requester_id is null or normalized_email = '' or char_length(normalized_email) > 254 then
    raise exception 'account_not_available';
  end if;
  select id into target from auth.users where lower(email) = normalized_email limit 1;
  if target is null or target = p_requester_id then raise exception 'account_not_available'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(least(p_requester_id, target)::text || ':' || greatest(p_requester_id, target)::text, 927401)
  );
  select * into existing from public.yucang_friend_requests
  where pair_low = least(p_requester_id, target) and pair_high = greatest(p_requester_id, target)
  for update;

  if existing.id is not null and existing.status = 'accepted' then
    return query select existing.id, 'already_friends'::text;
    return;
  end if;
  if existing.id is not null and existing.status = 'pending' then
    return query select existing.id, 'already_pending'::text;
    return;
  end if;

  if existing.id is null then
    insert into public.yucang_friend_requests(requester_id, addressee_id)
    values (p_requester_id, target)
    returning id into request_id;
  else
    update public.yucang_friend_requests set
      requester_id = p_requester_id, addressee_id = target, status = 'pending',
      responded_at = null, updated_at = now()
    where id = existing.id returning id into request_id;
  end if;
  result_status := 'request_sent';
  return next;
end;
$$;

create or replace function public.yucang_respond_friend_request(
  p_request_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  request_row public.yucang_friend_requests%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into request_row from public.yucang_friend_requests
  where id = p_request_id and addressee_id = caller for update;
  if request_row.id is null then raise exception 'friend_request_not_found'; end if;
  if request_row.status <> 'pending' then return request_row.status; end if;
  update public.yucang_friend_requests set
    status = case when p_accept then 'accepted' else 'declined' end,
    responded_at = now(), updated_at = now()
  where id = request_row.id;
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;

create or replace function public.yucang_remove_friend(p_friend_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  update public.yucang_friend_requests set status = 'removed', updated_at = now()
  where pair_low = least(caller, p_friend_user_id)
    and pair_high = greatest(caller, p_friend_user_id)
    and status = 'accepted';
  return found;
end;
$$;

create or replace function public.yucang_list_my_friendships()
returns table (
  request_id uuid,
  direction text,
  status text,
  account_id uuid,
  nickname text,
  avatar_url text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    request.id,
    case when request.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
    request.status,
    case when request.requester_id = auth.uid() then request.addressee_id else request.requester_id end,
    coalesce(nullif(trim(creator.nickname), ''), nullif(trim(profile.display_name), ''), '语藏用户'),
    coalesce(nullif(creator.avatar_url, ''), nullif(profile.avatar_url, ''), ''),
    request.updated_at
  from public.yucang_friend_requests request
  left join public.profiles profile on profile.id = case
    when request.requester_id = auth.uid() then request.addressee_id else request.requester_id end
  left join public.yucang_creator_profiles creator on creator.user_id = case
    when request.requester_id = auth.uid() then request.addressee_id else request.requester_id end
  where auth.uid() is not null
    and (request.requester_id = auth.uid() or request.addressee_id = auth.uid())
    and request.status in ('pending', 'accepted')
  order by request.updated_at desc;
$$;

create or replace function public.yucang_create_group(p_name text)
returns table (group_id uuid, result_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  clean_name text := trim(coalesce(p_name, ''));
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if char_length(clean_name) < 1 or char_length(clean_name) > 40 then raise exception 'invalid_group_name'; end if;
  insert into public.yucang_groups(owner_id, name) values (caller, clean_name)
  returning id into group_id;
  insert into public.yucang_group_members(group_id, user_id, invited_by, role, status, joined_at)
  values (group_id, caller, caller, 'owner', 'active', now());
  result_status := 'forming';
  return next;
end;
$$;

create or replace function public.yucang_create_group_by_emails(
  p_owner_id uuid,
  p_name text,
  p_emails text[]
)
returns table (group_id uuid, result_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := trim(coalesce(p_name, ''));
  normalized_emails text[];
  target_ids uuid[];
  target_id uuid;
begin
  if p_owner_id is null or char_length(clean_name) < 1 or char_length(clean_name) > 40 then
    raise exception 'invalid_group_request';
  end if;
  select array_agg(distinct lower(trim(item))) into normalized_emails
  from unnest(coalesce(p_emails, '{}'::text[])) item
  where trim(item) <> '' and char_length(trim(item)) <= 254;
  if cardinality(coalesce(normalized_emails, '{}'::text[])) < 2
    or cardinality(normalized_emails) > 49 then
    raise exception 'group_accounts_not_available';
  end if;
  select array_agg(user_row.id order by user_row.id) into target_ids
  from auth.users user_row
  where lower(user_row.email) = any(normalized_emails) and user_row.id <> p_owner_id;
  if cardinality(coalesce(target_ids, '{}'::uuid[])) <> cardinality(normalized_emails) then
    raise exception 'group_accounts_not_available';
  end if;

  insert into public.yucang_groups(owner_id, name) values (p_owner_id, clean_name)
  returning id into group_id;
  insert into public.yucang_group_members(group_id, user_id, invited_by, role, status, joined_at)
  values (group_id, p_owner_id, p_owner_id, 'owner', 'active', now());
  foreach target_id in array target_ids loop
    insert into public.yucang_group_members(group_id, user_id, invited_by)
    values (group_id, target_id, p_owner_id);
  end loop;
  result_status := 'forming';
  return next;
end;
$$;

create or replace function public.yucang_invite_group_member(
  p_group_id uuid,
  p_share_code text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target uuid;
  group_row public.yucang_groups%rowtype;
  member_status text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into group_row from public.yucang_groups
  where id = p_group_id and owner_id = caller and status <> 'closed' for update;
  if group_row.id is null then raise exception 'group_not_available'; end if;
  select user_id into target from public.yucang_share_identities
  where share_code = upper(trim(coalesce(p_share_code, '')));
  if target is null or target = caller then raise exception 'account_not_available'; end if;

  select status into member_status from public.yucang_group_members
  where group_id = p_group_id and user_id = target;
  if member_status in ('invited', 'active') then return 'already_invited'; end if;

  insert into public.yucang_group_members(group_id, user_id, invited_by)
  values (p_group_id, target, caller)
  on conflict (group_id, user_id) do update set
    invited_by = excluded.invited_by, role = 'member', status = 'invited',
    invited_at = now(), joined_at = null, updated_at = now();
  return 'invited';
end;
$$;

create or replace function public.yucang_respond_group_invite(
  p_group_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  membership public.yucang_group_members%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into membership from public.yucang_group_members
  where group_id = p_group_id and user_id = caller and role = 'member' for update;
  if membership.group_id is null or membership.status <> 'invited' then raise exception 'group_invite_not_found'; end if;
  update public.yucang_group_members set
    status = case when p_accept then 'active' else 'declined' end,
    joined_at = case when p_accept then now() else null end,
    updated_at = now()
  where group_id = p_group_id and user_id = caller;
  perform private.yucang_refresh_group_status(p_group_id);
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;

create or replace function public.yucang_leave_group(p_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.yucang_groups where id = p_group_id and owner_id = caller) then
    raise exception 'owner_must_close_group';
  end if;
  update public.yucang_group_members set status = 'left', updated_at = now()
  where group_id = p_group_id and user_id = caller and status = 'active';
  if not found then return false; end if;
  perform private.yucang_refresh_group_status(p_group_id);
  return true;
end;
$$;

create or replace function public.yucang_close_group(p_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  update public.yucang_groups set status = 'closed', updated_at = now()
  where id = p_group_id and owner_id = caller and status <> 'closed';
  return found;
end;
$$;

create or replace function public.yucang_list_my_groups()
returns table (
  group_id uuid,
  group_name text,
  group_status text,
  membership_status text,
  member_role text,
  active_member_count integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    group_row.id,
    group_row.name,
    group_row.status,
    own.status,
    own.role,
    (select count(*)::integer from public.yucang_group_members member_row
      where member_row.group_id = group_row.id and member_row.status = 'active'),
    group_row.updated_at
  from public.yucang_groups group_row
  join public.yucang_group_members own
    on own.group_id = group_row.id and own.user_id = auth.uid()
  where auth.uid() is not null and own.status in ('invited', 'active')
  order by group_row.updated_at desc;
$$;

create or replace function public.yucang_list_group_members(p_group_id uuid)
returns table (
  account_id uuid,
  nickname text,
  avatar_url text,
  member_role text,
  membership_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.yucang_group_members
    where group_id = p_group_id and user_id = caller and status = 'active'
  ) then raise exception 'group_not_available'; end if;
  return query
  select
    member_row.user_id,
    coalesce(nullif(trim(creator.nickname), ''), nullif(trim(profile.display_name), ''), '语藏用户'),
    coalesce(nullif(creator.avatar_url, ''), nullif(profile.avatar_url, ''), ''),
    member_row.role,
    member_row.status
  from public.yucang_group_members member_row
  left join public.profiles profile on profile.id = member_row.user_id
  left join public.yucang_creator_profiles creator on creator.user_id = member_row.user_id
  where member_row.group_id = p_group_id and member_row.status = 'active'
  order by (member_row.role = 'owner') desc, member_row.joined_at, member_row.user_id;
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
    select count(*)::integer into used_today from public.yucang_prompt_shares
      where sender_id = caller
        and (created_at at time zone 'Asia/Shanghai')::date = (now() at time zone 'Asia/Shanghai')::date;
    remaining_free_shares := greatest(0, 3 - used_today);
    return next;
    return;
  end if;

  select exists (
    select 1 from public.yucang_group_membership_periods period
    where period.user_id = caller and period.status = 'active'
      and period.starts_at <= now() and period.ends_at > now()
  ) into paid_member;
  select count(*)::integer into used_today from public.yucang_prompt_shares
  where sender_id = caller
    and (created_at at time zone 'Asia/Shanghai')::date = (now() at time zone 'Asia/Shanghai')::date;
  if not paid_member and used_today >= 3 then raise exception 'daily_share_limit_reached'; end if;

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
  remaining_free_shares := case when paid_member then null else greatest(0, 2 - used_today) end;
  return next;
end;
$$;

create or replace function public.yucang_list_received_prompt_shares(p_limit integer default 50)
returns table (
  share_id uuid,
  sender_id uuid,
  sender_nickname text,
  sender_avatar_url text,
  target_kind text,
  group_id uuid,
  group_name text,
  title text,
  prompt_text text,
  project text,
  category text,
  content_type text,
  tags text[],
  variables jsonb,
  model_name text,
  model_version text,
  parameters jsonb,
  license_code text,
  negative_prompt text,
  usage_instruction text,
  source_item_id text,
  payload_hash text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    shared.id,
    shared.sender_id,
    coalesce(nullif(trim(creator.nickname), ''), nullif(trim(profile.display_name), ''), '语藏用户'),
    coalesce(nullif(creator.avatar_url, ''), nullif(profile.avatar_url, ''), ''),
    shared.target_kind,
    shared.group_id,
    group_row.name,
    shared.title,
    shared.prompt_text,
    shared.project,
    shared.category,
    shared.content_type,
    shared.tags,
    shared.variables,
    shared.model_name,
    shared.model_version,
    shared.parameters,
    shared.license_code,
    shared.negative_prompt,
    shared.usage_instruction,
    shared.source_item_id,
    shared.payload_hash,
    shared.created_at
  from public.yucang_prompt_shares shared
  left join public.yucang_groups group_row on group_row.id = shared.group_id
  left join public.profiles profile on profile.id = shared.sender_id
  left join public.yucang_creator_profiles creator on creator.user_id = shared.sender_id
  where auth.uid() is not null and (
    shared.recipient_id = auth.uid()
    or (
      shared.group_id is not null
      and exists (
        select 1 from public.yucang_group_members member_row
        where member_row.group_id = shared.group_id
          and member_row.user_id = auth.uid()
          and member_row.status = 'active'
      )
    )
  )
  order by shared.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function private.yucang_refresh_group_status(uuid) from public, anon, authenticated;
revoke all on function public.yucang_get_my_share_identity() from public, anon;
revoke all on function public.yucang_request_friend(text) from public, anon;
revoke all on function public.yucang_request_friend_by_email(uuid, text) from public, anon, authenticated;
revoke all on function public.yucang_respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.yucang_remove_friend(uuid) from public, anon;
revoke all on function public.yucang_list_my_friendships() from public, anon;
revoke all on function public.yucang_create_group(text) from public, anon;
revoke all on function public.yucang_create_group_by_emails(uuid, text, text[]) from public, anon, authenticated;
revoke all on function public.yucang_invite_group_member(uuid, text) from public, anon;
revoke all on function public.yucang_respond_group_invite(uuid, boolean) from public, anon;
revoke all on function public.yucang_leave_group(uuid) from public, anon;
revoke all on function public.yucang_close_group(uuid) from public, anon;
revoke all on function public.yucang_list_my_groups() from public, anon;
revoke all on function public.yucang_list_group_members(uuid) from public, anon;
revoke all on function public.yucang_share_prompt(uuid, text, uuid, text, text, text, text, text, text[], jsonb, text, text, jsonb, text, text, text, text) from public, anon;
revoke all on function public.yucang_list_received_prompt_shares(integer) from public, anon;

grant execute on function public.yucang_get_my_share_identity() to authenticated;
grant execute on function public.yucang_request_friend(text) to authenticated;
grant execute on function public.yucang_request_friend_by_email(uuid, text) to service_role;
grant execute on function public.yucang_respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.yucang_remove_friend(uuid) to authenticated;
grant execute on function public.yucang_list_my_friendships() to authenticated;
grant execute on function public.yucang_create_group(text) to authenticated;
grant execute on function public.yucang_create_group_by_emails(uuid, text, text[]) to service_role;
grant execute on function public.yucang_invite_group_member(uuid, text) to authenticated;
grant execute on function public.yucang_respond_group_invite(uuid, boolean) to authenticated;
grant execute on function public.yucang_leave_group(uuid) to authenticated;
grant execute on function public.yucang_close_group(uuid) to authenticated;
grant execute on function public.yucang_list_my_groups() to authenticated;
grant execute on function public.yucang_list_group_members(uuid) to authenticated;
grant execute on function public.yucang_share_prompt(uuid, text, uuid, text, text, text, text, text, text[], jsonb, text, text, jsonb, text, text, text, text) to authenticated;
grant execute on function public.yucang_list_received_prompt_shares(integer) to authenticated;

comment on table public.yucang_prompt_shares is
  'Immutable snapshots of one Prompt explicitly shared by its sender. This table is not a cloud-sync or private-library source.';
comment on function public.yucang_share_prompt(uuid, text, uuid, text, text, text, text, text, text[], jsonb, text, text, jsonb, text, text, text, text) is
  'Atomically shares one explicit Prompt snapshot to an accepted friend or active group; free accounts share at most three new items per Shanghai calendar day.';

notify pgrst, 'reload schema';

