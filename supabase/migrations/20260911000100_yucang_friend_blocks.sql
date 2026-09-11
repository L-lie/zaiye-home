-- User-controlled friendship removal, blocking, unblock, and explicit block notices.

create table if not exists public.yucang_friend_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists yucang_friend_blocks_blocked_idx
  on public.yucang_friend_blocks(blocked_id, created_at desc);

alter table public.yucang_friend_blocks enable row level security;
revoke all on table public.yucang_friend_blocks from public, anon, authenticated;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.yucang_system_messages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%message_type%'
  loop
    execute format(
      'alter table public.yucang_system_messages drop constraint %I',
      constraint_row.conname
    );
  end loop;
end
$$;

alter table public.yucang_system_messages
  add constraint yucang_system_messages_message_type_check
  check (message_type in ('feedback_reply', 'broadcast', 'friend_blocked'));

alter table public.yucang_system_messages
  add constraint yucang_system_messages_shape_check
  check (
    (message_type = 'feedback_reply' and feedback_id is not null and recipient_id is not null and expires_at is null)
    or (message_type = 'broadcast' and feedback_id is null and recipient_id is null)
    or (message_type = 'friend_blocked' and feedback_id is null and recipient_id is not null and expires_at is null)
  );

drop policy if exists yucang_system_messages_read on public.yucang_system_messages;
create policy yucang_system_messages_read
on public.yucang_system_messages for select to authenticated
using (
  private.yucang_has_staff_role('admin', auth.uid())
  or (
    revoked_at is null
    and (
      (message_type in ('feedback_reply', 'friend_blocked') and recipient_id = auth.uid())
      or (message_type = 'broadcast' and (expires_at is null or expires_at > now()))
    )
  )
);

create or replace function public.yucang_friend_block_state(p_other_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_other_user_id is null or p_other_user_id = caller then raise exception 'account_not_available'; end if;
  if exists (
    select 1 from public.yucang_friend_blocks block
    where block.blocker_id = caller and block.blocked_id = p_other_user_id
  ) then return 'blocked_by_me'; end if;
  if exists (
    select 1 from public.yucang_friend_blocks block
    where block.blocker_id = p_other_user_id and block.blocked_id = caller
  ) then return 'blocked_by_them'; end if;
  return 'none';
end;
$$;

create or replace function public.yucang_block_friend(
  p_blocked_user_id uuid,
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  blocker_name text;
  notice_body text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_blocked_user_id is null or p_blocked_user_id = caller or p_request_id is null
     or not exists (select 1 from auth.users where id = p_blocked_user_id) then
    raise exception 'account_not_available';
  end if;

  insert into public.yucang_friend_blocks(blocker_id, blocked_id)
  values (caller, p_blocked_user_id)
  on conflict (blocker_id, blocked_id) do nothing;
  if not found then return false; end if;

  update public.yucang_friend_requests request
  set status = 'removed', updated_at = now()
  where request.pair_low = least(caller, p_blocked_user_id)
    and request.pair_high = greatest(caller, p_blocked_user_id)
    and request.status in ('pending', 'accepted');

  select coalesce(nullif(trim(creator.nickname), ''), nullif(trim(profile.display_name), ''), '该用户')
  into blocker_name
  from auth.users account
  left join public.profiles profile on profile.id = account.id
  left join public.yucang_creator_profiles creator on creator.user_id = account.id
  where account.id = caller;

  notice_body := '你已被“' || coalesce(blocker_name, '该用户') || '”拉黑，暂时无法向该用户发送好友申请或直接分享 Prompt。';
  insert into public.yucang_system_messages(
    message_type, feedback_id, recipient_id, body, created_by, request_id, payload_hash
  ) values (
    'friend_blocked', null, p_blocked_user_id, notice_body, caller, p_request_id,
    encode(extensions.digest('friend_blocked' || E'\n' || p_blocked_user_id::text || E'\n' || notice_body, 'sha256'), 'hex')
  );
  return true;
end;
$$;

create or replace function public.yucang_unblock_friend(p_blocked_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  delete from public.yucang_friend_blocks block
  where block.blocker_id = caller and block.blocked_id = p_blocked_user_id;
  return found;
end;
$$;

create or replace function public.yucang_list_my_blocked_accounts()
returns table (
  account_id uuid,
  nickname text,
  avatar_url text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    block.blocked_id,
    coalesce(nullif(trim(creator.nickname), ''), nullif(trim(profile.display_name), ''), '语藏用户'),
    coalesce(nullif(creator.avatar_url, ''), nullif(profile.avatar_url, ''), ''),
    block.created_at
  from public.yucang_friend_blocks block
  left join public.profiles profile on profile.id = block.blocked_id
  left join public.yucang_creator_profiles creator on creator.user_id = block.blocked_id
  where auth.uid() is not null and block.blocker_id = auth.uid()
  order by block.created_at desc;
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
  if exists (
    select 1 from public.yucang_friend_blocks block
    where block.blocker_id = target and block.blocked_id = p_requester_id
  ) then raise exception 'friend_blocked_by_target'; end if;
  if exists (
    select 1 from public.yucang_friend_blocks block
    where block.blocker_id = p_requester_id and block.blocked_id = target
  ) then raise exception 'friend_block_active'; end if;

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

create or replace function public.yucang_list_my_system_messages(p_limit integer default 50)
returns table (
  message_id uuid,
  message_type text,
  feedback_id uuid,
  feedback_title text,
  body text,
  created_at timestamptz,
  expires_at timestamptz
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
    message.id,
    message.message_type,
    message.feedback_id,
    feedback.title,
    message.body,
    message.created_at,
    message.expires_at
  from public.yucang_system_messages message
  left join public.yucang_feedback feedback on feedback.id = message.feedback_id
  where message.revoked_at is null
    and (
      (message.message_type in ('feedback_reply', 'friend_blocked') and message.recipient_id = caller)
      or (message.message_type = 'broadcast' and (message.expires_at is null or message.expires_at > now()))
    )
  order by message.created_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.yucang_friend_block_state(uuid) from public, anon;
revoke all on function public.yucang_block_friend(uuid, uuid) from public, anon;
revoke all on function public.yucang_unblock_friend(uuid) from public, anon;
revoke all on function public.yucang_list_my_blocked_accounts() from public, anon;
revoke all on function public.yucang_request_friend_by_email(uuid, text) from public, anon, authenticated;
revoke all on function public.yucang_list_my_system_messages(integer) from public, anon;

grant execute on function public.yucang_friend_block_state(uuid) to authenticated;
grant execute on function public.yucang_block_friend(uuid, uuid) to authenticated;
grant execute on function public.yucang_unblock_friend(uuid) to authenticated;
grant execute on function public.yucang_list_my_blocked_accounts() to authenticated;
grant execute on function public.yucang_request_friend_by_email(uuid, text) to service_role;
grant execute on function public.yucang_list_my_system_messages(integer) to authenticated;

comment on table public.yucang_friend_blocks is
  'Private user block relationships. Only controlled security-definer functions expose the caller-owned block list.';
