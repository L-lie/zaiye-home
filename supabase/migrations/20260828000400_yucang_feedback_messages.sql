create table if not exists public.yucang_system_messages (
  id uuid primary key default gen_random_uuid(),
  message_type text not null check (message_type in ('feedback_reply', 'broadcast')),
  feedback_id uuid references public.yucang_feedback(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  unique (created_by, request_id),
  check (
    (message_type = 'feedback_reply' and feedback_id is not null and recipient_id is not null and expires_at is null)
    or
    (message_type = 'broadcast' and feedback_id is null and recipient_id is null)
  )
);

create index if not exists yucang_system_messages_recipient_created_idx
  on public.yucang_system_messages(recipient_id, created_at desc);
create index if not exists yucang_system_messages_broadcast_created_idx
  on public.yucang_system_messages(created_at desc)
  where message_type = 'broadcast';

alter table public.yucang_system_messages enable row level security;
revoke all on table public.yucang_system_messages from public, anon, authenticated;
grant select on table public.yucang_system_messages to authenticated;

drop policy if exists yucang_system_messages_read on public.yucang_system_messages;
create policy yucang_system_messages_read
on public.yucang_system_messages for select to authenticated
using (
  private.yucang_has_staff_role('admin', auth.uid())
  or (
    revoked_at is null
    and (
      (message_type = 'feedback_reply' and recipient_id = auth.uid())
      or (message_type = 'broadcast' and (expires_at is null or expires_at > now()))
    )
  )
);

create or replace function private.yucang_feedback_message_body(p_body text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  clean_body text := trim(coalesce(p_body, ''));
begin
  if char_length(clean_body) < 1 or char_length(clean_body) > 2000 then
    raise exception 'invalid_message_body';
  end if;
  if clean_body ~ '[<>]' or clean_body ~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]' then
    raise exception 'invalid_message_body';
  end if;
  return clean_body;
end;
$$;

revoke all on function private.yucang_feedback_message_body(text) from public, anon, authenticated;

create or replace function public.yucang_admin_reply_feedback(
  p_feedback_id uuid,
  p_body text,
  p_request_id uuid
)
returns table (
  message_id uuid,
  result_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  clean_body text;
  recipient uuid;
  expected_hash text;
  existing public.yucang_system_messages%rowtype;
  created public.yucang_system_messages%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if not private.yucang_has_staff_role('admin', caller) then raise exception 'forbidden'; end if;
  if p_feedback_id is null or p_request_id is null then raise exception 'invalid_request'; end if;

  clean_body := private.yucang_feedback_message_body(p_body);
  expected_hash := encode(digest(p_feedback_id::text || E'\n' || clean_body, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(caller::text || ':' || p_request_id::text, 0));

  select * into existing
  from public.yucang_system_messages row
  where row.created_by = caller and row.request_id = p_request_id;

  if found then
    if existing.message_type <> 'feedback_reply'
       or existing.feedback_id is distinct from p_feedback_id
       or existing.payload_hash <> expected_hash then
      raise exception 'idempotency_conflict';
    end if;
    return query select existing.id, 'already_created'::text, existing.created_at;
    return;
  end if;

  select feedback.author_id into recipient
  from public.yucang_feedback feedback
  where feedback.id = p_feedback_id;
  if recipient is null then raise exception 'feedback_not_found'; end if;

  insert into public.yucang_system_messages(
    message_type, feedback_id, recipient_id, body, created_by, request_id, payload_hash
  ) values (
    'feedback_reply', p_feedback_id, recipient, clean_body, caller, p_request_id, expected_hash
  ) returning * into created;

  update public.yucang_feedback
  set status = case when status = 'submitted' then 'in_review' else status end,
      reviewed_by = caller,
      updated_at = now()
  where id = p_feedback_id;

  return query select created.id, 'created'::text, created.created_at;
end;
$$;

create or replace function public.yucang_admin_broadcast_system_message(
  p_body text,
  p_request_id uuid,
  p_expires_at timestamptz default null
)
returns table (
  message_id uuid,
  result_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  clean_body text;
  expected_hash text;
  existing public.yucang_system_messages%rowtype;
  created public.yucang_system_messages%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if not private.yucang_has_staff_role('admin', caller) then raise exception 'forbidden'; end if;
  if p_request_id is null or (p_expires_at is not null and p_expires_at <= now()) then
    raise exception 'invalid_request';
  end if;

  clean_body := private.yucang_feedback_message_body(p_body);
  expected_hash := encode(digest(clean_body || E'\n' || coalesce(p_expires_at::text, ''), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(caller::text || ':' || p_request_id::text, 0));

  select * into existing
  from public.yucang_system_messages row
  where row.created_by = caller and row.request_id = p_request_id;

  if found then
    if existing.message_type <> 'broadcast' or existing.payload_hash <> expected_hash then
      raise exception 'idempotency_conflict';
    end if;
    return query select existing.id, 'already_created'::text, existing.created_at;
    return;
  end if;

  insert into public.yucang_system_messages(
    message_type, body, created_by, request_id, payload_hash, expires_at
  ) values (
    'broadcast', clean_body, caller, p_request_id, expected_hash, p_expires_at
  ) returning * into created;

  return query select created.id, 'created'::text, created.created_at;
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
      (message.message_type = 'feedback_reply' and message.recipient_id = caller)
      or (message.message_type = 'broadcast' and (message.expires_at is null or message.expires_at > now()))
    )
  order by message.created_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.yucang_admin_reply_feedback(uuid, text, uuid) from public, anon;
revoke all on function public.yucang_admin_broadcast_system_message(text, uuid, timestamptz) from public, anon;
revoke all on function public.yucang_list_my_system_messages(integer) from public, anon;
grant execute on function public.yucang_admin_reply_feedback(uuid, text, uuid) to authenticated;
grant execute on function public.yucang_admin_broadcast_system_message(text, uuid, timestamptz) to authenticated;
grant execute on function public.yucang_list_my_system_messages(integer) to authenticated;

comment on table public.yucang_system_messages is
  'Admin-authored plain-text feedback replies and system broadcasts. Ordinary users can read only their own replies and active broadcasts.';
