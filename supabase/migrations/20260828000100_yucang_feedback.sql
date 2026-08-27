-- Authenticated, user-initiated feedback with database-enforced privacy,
-- idempotency, rate limiting, and staff review boundaries.

create table public.yucang_feedback (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  feedback_type text not null check (feedback_type in ('bug', 'suggestion', 'experience', 'other')),
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 4000),
  reproduction_steps text not null default '' check (char_length(reproduction_steps) <= 3000),
  expected_result text not null default '' check (char_length(expected_result) <= 2000),
  extension_version text not null check (char_length(extension_version) between 1 and 40),
  surface text not null check (char_length(surface) between 1 and 64),
  locale text not null check (char_length(locale) between 1 and 32),
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'resolved', 'closed', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  review_notes text not null default '' check (char_length(review_notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, request_id)
);

create index yucang_feedback_author_created_idx on public.yucang_feedback(author_id, created_at desc);
create index yucang_feedback_review_queue_idx on public.yucang_feedback(status, created_at asc);

alter table public.yucang_feedback enable row level security;
revoke all on public.yucang_feedback from public, anon, authenticated;
grant select on public.yucang_feedback to authenticated;

create policy yucang_feedback_owner_or_staff_read
  on public.yucang_feedback for select to authenticated
  using (author_id = auth.uid() or private.yucang_can_review());

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

  select * into existing from public.yucang_feedback
  where author_id = caller and request_id = p_request_id;
  if found then
    if existing.payload_hash <> p_payload_hash then raise exception 'idempotency_conflict'; end if;
    return query select existing.id, 'already_created'::text, existing.status, existing.created_at;
    return;
  end if;

  if (select count(*) from public.yucang_feedback
      where author_id = caller and created_at >= now() - interval '1 hour') >= 10 then
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

create or replace function public.yucang_list_my_feedback(p_limit integer default 50)
returns table(
  feedback_id uuid, feedback_type text, title text, status text,
  review_notes text, created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'authentication_required'; end if;
  return query
  select f.id, f.feedback_type, f.title, f.status, f.review_notes, f.created_at, f.updated_at
  from public.yucang_feedback f
  where f.author_id = caller
  order by f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

create or replace function public.yucang_admin_update_feedback(
  p_feedback_id uuid,
  p_status text,
  p_review_notes text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare caller uuid := auth.uid();
begin
  if caller is null or not private.yucang_can_review() then raise exception 'forbidden'; end if;
  if p_status not in ('submitted', 'in_review', 'resolved', 'closed', 'rejected') then raise exception 'invalid_status'; end if;
  if char_length(coalesce(p_review_notes, '')) > 2000 then raise exception 'review_notes_too_long'; end if;
  update public.yucang_feedback
  set status = p_status, review_notes = coalesce(p_review_notes, ''),
      reviewed_by = caller, updated_at = now()
  where id = p_feedback_id;
  return found;
end;
$$;

revoke all on function public.yucang_submit_feedback(uuid, text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.yucang_list_my_feedback(integer) from public, anon;
revoke all on function public.yucang_admin_update_feedback(uuid, text, text) from public, anon;
grant execute on function public.yucang_submit_feedback(uuid, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.yucang_list_my_feedback(integer) to authenticated;
grant execute on function public.yucang_admin_update_feedback(uuid, text, text) to authenticated;

comment on table public.yucang_feedback is
  'One explicit feedback submission per user action. Never stores Prompt content, images, clipboard, private-library data, or browsing history.';
