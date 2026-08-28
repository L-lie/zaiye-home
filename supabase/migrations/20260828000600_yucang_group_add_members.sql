-- Add members to an existing Yucang group without exposing account discovery.
-- The Edge Function resolves exact emails with service_role; this RPC is never
-- granted to browser roles. Existing group invitations remain the only inbox.

create table if not exists private.yucang_group_member_invite_receipts (
  actor_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  group_id uuid not null references public.yucang_groups(id) on delete cascade,
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  primary key (actor_id, request_id)
);

revoke all on private.yucang_group_member_invite_receipts from public, anon, authenticated;

create or replace function public.yucang_invite_group_members_by_accounts(
  p_actor_id uuid,
  p_request_id uuid,
  p_group_id uuid,
  p_friend_account_ids uuid[] default '{}',
  p_emails text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  group_row public.yucang_groups%rowtype;
  normalized_emails text[];
  normalized_friend_ids uuid[];
  email_target_ids uuid[];
  target_ids uuid[];
  invalid_friend_count integer;
  reserved_count integer;
  new_count integer;
  invited_count integer := 0;
  already_invited_count integer := 0;
  already_member_count integer := 0;
  target_id uuid;
  existing_status text;
  request_hash text;
  receipt_row private.yucang_group_member_invite_receipts%rowtype;
  result jsonb;
  is_admin boolean := false;
begin
  if p_actor_id is null or p_request_id is null or p_group_id is null then
    raise exception 'invalid_group_member_request';
  end if;

  select coalesce(array_agg(distinct item order by item), '{}'::uuid[])
  into normalized_friend_ids
  from unnest(coalesce(p_friend_account_ids, '{}'::uuid[])) item;

  select coalesce(array_agg(distinct lower(trim(item)) order by lower(trim(item))), '{}'::text[])
  into normalized_emails
  from unnest(coalesce(p_emails, '{}'::text[])) item
  where trim(item) <> '' and char_length(trim(item)) <= 254;

  if cardinality(normalized_friend_ids) + cardinality(normalized_emails) < 1
    or cardinality(normalized_friend_ids) + cardinality(normalized_emails) > 49 then
    raise exception 'invalid_group_members';
  end if;

  request_hash := encode(extensions.digest(convert_to(
    jsonb_build_object(
      'groupId', p_group_id,
      'friendAccountIds', to_jsonb(normalized_friend_ids),
      'emails', to_jsonb(normalized_emails)
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::text || ':' || p_request_id::text, 0)
  );

  select * into receipt_row
  from private.yucang_group_member_invite_receipts
  where actor_id = p_actor_id and request_id = p_request_id;
  if receipt_row.actor_id is not null then
    if receipt_row.request_hash <> request_hash then raise exception 'idempotency_conflict'; end if;
    return receipt_row.response;
  end if;

  select * into group_row
  from public.yucang_groups
  where id = p_group_id and status <> 'closed'
  for update;
  if group_row.id is null then raise exception 'group_not_available'; end if;

  is_admin := private.yucang_has_staff_role('admin', p_actor_id);
  if group_row.owner_id <> p_actor_id and not is_admin then raise exception 'group_permission_denied'; end if;

  if p_actor_id = any(normalized_friend_ids) then raise exception 'member_not_available'; end if;

  select count(*)::integer into invalid_friend_count
  from unnest(normalized_friend_ids) friend_id
  where not exists (
    select 1
    from public.yucang_friend_requests friendship
    where friendship.pair_low = least(p_actor_id, friend_id)
      and friendship.pair_high = greatest(p_actor_id, friend_id)
      and friendship.status = 'accepted'
  );
  if invalid_friend_count > 0 then raise exception 'member_not_available'; end if;

  select coalesce(array_agg(user_row.id order by user_row.id), '{}'::uuid[])
  into email_target_ids
  from auth.users user_row
  where lower(user_row.email) = any(normalized_emails)
    and user_row.id <> p_actor_id;
  if cardinality(email_target_ids) <> cardinality(normalized_emails) then
    raise exception 'member_not_available';
  end if;

  select coalesce(array_agg(distinct item order by item), '{}'::uuid[])
  into target_ids
  from unnest(normalized_friend_ids || email_target_ids) item;
  if cardinality(target_ids) < 1 then raise exception 'member_not_available'; end if;

  select count(*)::integer into reserved_count
  from public.yucang_group_members member_row
  where member_row.group_id = p_group_id and member_row.status in ('active', 'invited');
  select count(*)::integer into new_count
  from unnest(target_ids) item
  where not exists (
    select 1 from public.yucang_group_members member_row
    where member_row.group_id = p_group_id and member_row.user_id = item
      and member_row.status in ('active', 'invited')
  );
  if reserved_count + new_count > 50 then raise exception 'group_member_limit_reached'; end if;

  foreach target_id in array target_ids loop
    select status into existing_status
    from public.yucang_group_members
    where group_id = p_group_id and user_id = target_id;
    if existing_status = 'active' then
      already_member_count := already_member_count + 1;
    elsif existing_status = 'invited' then
      already_invited_count := already_invited_count + 1;
    else
      insert into public.yucang_group_members(group_id, user_id, invited_by)
      values (p_group_id, target_id, p_actor_id)
      on conflict (group_id, user_id) do update set
        invited_by = excluded.invited_by,
        role = 'member',
        status = 'invited',
        invited_at = now(),
        joined_at = null,
        updated_at = now();
      invited_count := invited_count + 1;
    end if;
  end loop;

  result := jsonb_build_object(
    'status', case when invited_count > 0 then 'invited' else 'already_invited' end,
    'groupId', p_group_id,
    'requestedCount', cardinality(target_ids),
    'invitedCount', invited_count,
    'alreadyInvitedCount', already_invited_count,
    'alreadyMemberCount', already_member_count,
    'memberLimit', 50,
    'reservedMemberCount', reserved_count + new_count
  );
  insert into private.yucang_group_member_invite_receipts(
    actor_id, request_id, request_hash, group_id, response
  ) values (p_actor_id, p_request_id, request_hash, p_group_id, result);
  return result;
end;
$$;

revoke all on function public.yucang_invite_group_members_by_accounts(uuid, uuid, uuid, uuid[], text[])
  from public, anon, authenticated;
grant execute on function public.yucang_invite_group_members_by_accounts(uuid, uuid, uuid, uuid[], text[])
  to service_role;

comment on function public.yucang_invite_group_members_by_accounts(uuid, uuid, uuid, uuid[], text[]) is
  'Atomically invites exact accounts to an existing group. Owner/admin only, max 50 reserved members, service_role only, idempotent by actor and request ID.';
