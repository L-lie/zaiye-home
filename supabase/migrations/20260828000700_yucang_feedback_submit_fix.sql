-- Qualify feedback columns inside the submit RPC so they cannot conflict with
-- TABLE return parameter names such as created_at at PL/pgSQL runtime.

create or replace function public.yucang_submit_feedback(
  p_request_id uuid,
  p_payload_hash text,
  p_feedback_type text,
  p_title text,
  p_description text,
  p_reproduction_steps text default '',
  p_expected_result text default '',
  p_extension_version text default '',
  p_surface text default '',
  p_locale text default ''
)
returns table(feedback_id uuid, result_status text, feedback_status text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  caller uuid := auth.uid();
  existing public.yucang_feedback%rowtype;
  created public.yucang_feedback%rowtype;
begin
  if caller is null then raise exception 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtext('yucang_feedback:' || caller::text));

  select feedback.* into existing
  from public.yucang_feedback feedback
  where feedback.author_id = caller and feedback.request_id = p_request_id;
  if found then
    if existing.payload_hash <> p_payload_hash then raise exception 'idempotency_conflict'; end if;
    return query select existing.id, 'already_created'::text, existing.status, existing.created_at;
    return;
  end if;

  if (select count(*)
      from public.yucang_feedback feedback
      where feedback.author_id = caller
        and feedback.created_at >= now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited';
  end if;

  insert into public.yucang_feedback(
    author_id, request_id, payload_hash, feedback_type, title, description,
    reproduction_steps, expected_result, extension_version, surface, locale
  ) values (
    caller, p_request_id, p_payload_hash, p_feedback_type, p_title, p_description,
    coalesce(p_reproduction_steps, ''), coalesce(p_expected_result, ''),
    p_extension_version, p_surface, p_locale
  ) returning * into created;

  return query select created.id, 'created'::text, created.status, created.created_at;
end;
$$;

revoke all on function public.yucang_submit_feedback(uuid, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.yucang_submit_feedback(uuid, text, text, text, text, text, text, text, text, text) to authenticated;
