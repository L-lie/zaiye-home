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
  expected_hash := encode(
    extensions.digest(convert_to(p_feedback_id::text || E'\n' || clean_body, 'utf8'), 'sha256'),
    'hex'
  );
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
  expected_hash := encode(
    extensions.digest(convert_to(clean_body || E'\n' || coalesce(p_expires_at::text, ''), 'utf8'), 'sha256'),
    'hex'
  );
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

revoke all on function public.yucang_admin_reply_feedback(uuid, text, uuid) from public, anon;
revoke all on function public.yucang_admin_broadcast_system_message(text, uuid, timestamptz) from public, anon;
grant execute on function public.yucang_admin_reply_feedback(uuid, text, uuid) to authenticated;
grant execute on function public.yucang_admin_broadcast_system_message(text, uuid, timestamptz) to authenticated;
