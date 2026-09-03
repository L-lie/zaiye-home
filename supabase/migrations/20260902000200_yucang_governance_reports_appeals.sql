-- Yucang community governance: public reports, staff disposition, and owner appeals.
-- Private Prompt data is not referenced by this migration.

create table public.yucang_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  contact_email text not null default '' check (char_length(contact_email) <= 254),
  target_type text not null check (target_type in ('work', 'comment', 'account', 'official_resource')),
  target_id uuid,
  target_ref text not null default '' check (char_length(target_ref) <= 160),
  reason_code text not null check (reason_code in ('copyright', 'harassment', 'spam', 'illegal', 'misleading', 'privacy', 'other')),
  details text not null check (char_length(trim(details)) between 10 and 3000),
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'actioned', 'dismissed')),
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((target_type = 'official_resource' and target_id is null and target_ref <> '')
    or (target_type <> 'official_resource' and target_id is not null and target_ref = ''))
);

create index yucang_reports_queue_idx on public.yucang_reports(status, created_at);
create index yucang_reports_target_idx on public.yucang_reports(target_type, target_id, target_ref, created_at desc);
create index yucang_reports_reporter_idx on public.yucang_reports(reporter_id, created_at desc)
  where reporter_id is not null;

create table public.yucang_report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.yucang_reports(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('submitted', 'reviewing', 'dismissed', 'restrict_work', 'hide_comment', 'account_warning', 'no_action')),
  notes text not null default '' check (char_length(notes) <= 3000),
  created_at timestamptz not null default now()
);

create index yucang_report_events_report_idx on public.yucang_report_events(report_id, created_at, id);

create table public.yucang_appeals (
  id uuid primary key default gen_random_uuid(),
  appellant_id uuid not null references auth.users(id) on delete restrict,
  report_id uuid references public.yucang_reports(id) on delete restrict,
  target_type text not null check (target_type in ('work', 'comment', 'account')),
  target_id uuid not null,
  body text not null check (char_length(trim(body)) between 20 and 3000),
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'upheld', 'denied')),
  resolution_notes text not null default '' check (char_length(resolution_notes) <= 3000),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index yucang_appeals_queue_idx on public.yucang_appeals(status, created_at);
create index yucang_appeals_owner_idx on public.yucang_appeals(appellant_id, created_at desc);

alter table public.yucang_reports enable row level security;
alter table public.yucang_report_events enable row level security;
alter table public.yucang_appeals enable row level security;

revoke all on public.yucang_reports from anon, authenticated;
revoke all on public.yucang_report_events from anon, authenticated;
revoke all on public.yucang_appeals from anon, authenticated;
revoke all on sequence public.yucang_report_events_id_seq from anon, authenticated;

create trigger yucang_report_events_append_only
  before update or delete on public.yucang_report_events
  for each row execute procedure private.yucang_block_append_only_mutation();

create or replace function public.yucang_submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason_code text,
  p_details text,
  p_contact_email text default '',
  p_target_ref text default ''
)
returns table (report_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  clean_email text := lower(trim(coalesce(p_contact_email, '')));
  clean_details text := trim(coalesce(p_details, ''));
  clean_target_ref text := trim(coalesce(p_target_ref, ''));
  created_id uuid;
  rate_key text;
begin
  if p_target_type not in ('work', 'comment', 'account', 'official_resource') then raise exception 'invalid_report_target'; end if;
  if p_reason_code not in ('copyright', 'harassment', 'spam', 'illegal', 'misleading', 'privacy', 'other') then raise exception 'invalid_report_reason'; end if;
  if char_length(clean_details) < 10 or char_length(clean_details) > 3000 then raise exception 'invalid_report_details'; end if;
  if caller is null and (clean_email = '' or clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'contact_email_required';
  end if;
  if char_length(clean_email) > 254 then raise exception 'invalid_contact_email'; end if;

  if p_target_type = 'work' and not exists (
    select 1 from public.yucang_works w where w.id = p_target_id and w.deleted_at is null
  ) then raise exception 'report_target_not_found'; end if;
  if p_target_type = 'comment' and not exists (
    select 1 from public.yucang_comments c where c.id = p_target_id
  ) then raise exception 'report_target_not_found'; end if;
  if p_target_type = 'account' and not exists (
    select 1 from auth.users u where u.id = p_target_id
  ) then raise exception 'report_target_not_found'; end if;
  if p_target_type = 'official_resource' and (p_target_id is not null or clean_target_ref !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{1,159}$') then
    raise exception 'report_target_not_found';
  end if;
  if p_target_type <> 'official_resource' and (p_target_id is null or clean_target_ref <> '') then raise exception 'invalid_report_target'; end if;

  rate_key := coalesce(caller::text, clean_email);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(rate_key, 902091));
  if caller is not null and (
    select count(*) from public.yucang_reports r
    where r.reporter_id = caller and r.created_at >= now() - interval '1 hour'
  ) >= 10 then raise exception 'rate_limited'; end if;
  if caller is null and (
    select count(*) from public.yucang_reports r
    where lower(r.contact_email) = clean_email and r.created_at >= now() - interval '1 hour'
  ) >= 3 then raise exception 'rate_limited'; end if;

  if exists (
    select 1 from public.yucang_reports r
    where r.target_type = p_target_type and r.target_id is not distinct from p_target_id and r.target_ref = clean_target_ref
      and r.status in ('submitted', 'reviewing')
      and ((caller is not null and r.reporter_id = caller)
        or (caller is null and r.reporter_id is null and lower(r.contact_email) = clean_email))
  ) then raise exception 'duplicate_open_report'; end if;

  insert into public.yucang_reports(reporter_id, contact_email, target_type, target_id, target_ref, reason_code, details)
  values (caller, clean_email, p_target_type, p_target_id, clean_target_ref, p_reason_code, clean_details)
  returning id into created_id;
  insert into public.yucang_report_events(report_id, actor_id, action)
  values (created_id, caller, 'submitted');
  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id, details)
  values (caller, 'submit_report', 'report', created_id, jsonb_build_object('target_type', p_target_type, 'target_id', p_target_id, 'target_ref', clean_target_ref));
  return query select created_id, 'submitted'::text;
end;
$$;

create or replace function public.yucang_list_my_reports()
returns table (
  report_id uuid, target_type text, target_id uuid, target_ref text, reason_code text,
  details text, status text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.target_type, r.target_id, r.target_ref, r.reason_code, r.details, r.status, r.created_at, r.updated_at
  from public.yucang_reports r
  where auth.uid() is not null and r.reporter_id = auth.uid()
  order by r.created_at desc limit 100;
$$;

create or replace function public.yucang_submit_appeal(
  p_target_type text,
  p_target_id uuid,
  p_body text,
  p_report_id uuid default null
)
returns table (appeal_id uuid, status text)
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  clean_body text := trim(coalesce(p_body, ''));
  created_id uuid;
  owns_target boolean := false;
begin
  if caller is null then raise exception 'authentication_required'; end if;
  if p_target_type not in ('work', 'comment', 'account') then raise exception 'invalid_appeal_target'; end if;
  if char_length(clean_body) < 20 or char_length(clean_body) > 3000 then raise exception 'invalid_appeal_body'; end if;

  if p_target_type = 'work' then
    select exists(select 1 from public.yucang_works w where w.id = p_target_id and w.author_id = caller and w.status = 'restricted') into owns_target;
  elsif p_target_type = 'comment' then
    select exists(select 1 from public.yucang_comments c where c.id = p_target_id and c.author_id = caller and c.status = 'hidden') into owns_target;
  else
    owns_target := p_target_id = caller;
  end if;
  if not owns_target then raise exception 'appeal_target_not_owned_or_not_actioned'; end if;
  if p_report_id is not null and not exists (
    select 1 from public.yucang_reports r
    where r.id = p_report_id and r.target_type = p_target_type and r.target_id = p_target_id and r.status = 'actioned'
  ) then raise exception 'invalid_appeal_report'; end if;
  if exists (
    select 1 from public.yucang_appeals a
    where a.appellant_id = caller and a.target_type = p_target_type and a.target_id = p_target_id
      and a.status in ('submitted', 'reviewing')
  ) then raise exception 'duplicate_open_appeal'; end if;

  insert into public.yucang_appeals(appellant_id, report_id, target_type, target_id, body)
  values (caller, p_report_id, p_target_type, p_target_id, clean_body)
  returning id into created_id;
  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id, details)
  values (caller, 'submit_appeal', 'appeal', created_id, jsonb_build_object('target_type', p_target_type, 'target_id', p_target_id));
  return query select created_id, 'submitted'::text;
end;
$$;

create or replace function public.yucang_list_my_appeals()
returns table (
  appeal_id uuid, report_id uuid, target_type text, target_id uuid, body text,
  status text, resolution_notes text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.report_id, a.target_type, a.target_id, a.body,
    a.status, a.resolution_notes, a.created_at, a.updated_at
  from public.yucang_appeals a
  where auth.uid() is not null and a.appellant_id = auth.uid()
  order by a.created_at desc limit 100;
$$;

create or replace function public.yucang_list_my_moderated_content()
returns table (
  target_type text, target_id uuid, target_label text, report_id uuid, actioned_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  with owned_targets as (
    select 'work'::text as target_type, w.id as target_id,
      coalesce(v.title, '作品 ' || w.id::text) as target_label
    from public.yucang_works w
    left join public.yucang_versions v on v.id = w.current_public_version_id
    where auth.uid() is not null and w.author_id = auth.uid() and w.status = 'restricted'
    union all
    select 'comment'::text, c.id, left(c.body, 80)
    from public.yucang_comments c
    where auth.uid() is not null and c.author_id = auth.uid() and c.status = 'hidden'
    union all
    select 'account'::text, auth.uid(), coalesce(cp.nickname, p.display_name, '当前账号')
    from (select auth.uid() as user_id) me
    left join public.yucang_creator_profiles cp on cp.user_id = me.user_id
    left join public.profiles p on p.id = me.user_id
    where me.user_id is not null and exists (
      select 1 from public.yucang_reports r
      join public.yucang_report_events e on e.report_id = r.id and e.action = 'account_warning'
      where r.target_type = 'account' and r.target_id = me.user_id and r.status = 'actioned'
    )
  )
  select owned.target_type, owned.target_id, owned.target_label, actioned.report_id, actioned.created_at
  from owned_targets owned
  left join lateral (
    select r.id as report_id, e.created_at
    from public.yucang_reports r
    join public.yucang_report_events e on e.report_id = r.id
    where r.target_type = owned.target_type and r.target_id = owned.target_id
      and r.status = 'actioned'
      and e.action in ('restrict_work', 'hide_comment', 'account_warning')
    order by e.created_at desc limit 1
  ) actioned on true
  order by actioned.created_at desc nulls last;
$$;

create or replace function public.yucang_admin_list_reports(p_status text default null)
returns table (
  report_id uuid, reporter_id uuid, contact_email text, target_type text, target_id uuid, target_ref text,
  target_label text, reason_code text, details text, status text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.reporter_id, r.contact_email, r.target_type, r.target_id, r.target_ref,
    case
      when r.target_type = 'work' then coalesce(v.title, '作品 ' || r.target_id::text)
      when r.target_type = 'comment' then coalesce(left(c.body, 80), '评论 ' || r.target_id::text)
      when r.target_type = 'official_resource' then '站方模板 ' || r.target_ref
      else coalesce(cp.nickname, p.display_name, '账号 ' || r.target_id::text)
    end,
    r.reason_code, r.details, r.status, r.created_at, r.updated_at
  from public.yucang_reports r
  left join public.yucang_works w on r.target_type = 'work' and w.id = r.target_id
  left join public.yucang_versions v on v.id = w.current_public_version_id
  left join public.yucang_comments c on r.target_type = 'comment' and c.id = r.target_id
  left join public.yucang_creator_profiles cp on r.target_type = 'account' and cp.user_id = r.target_id
  left join public.profiles p on r.target_type = 'account' and p.id = r.target_id
  where private.yucang_can_review()
    and (p_status is null or r.status = p_status)
  order by case r.status when 'submitted' then 0 when 'reviewing' then 1 else 2 end, r.created_at;
$$;

create or replace function public.yucang_admin_resolve_report(
  p_report_id uuid,
  p_action text,
  p_notes text
)
returns table (report_id uuid, status text)
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  report_row public.yucang_reports%rowtype;
  next_status text;
  clean_notes text := trim(coalesce(p_notes, ''));
begin
  if not private.yucang_can_review() then raise exception 'staff_required'; end if;
  if p_action not in ('reviewing', 'dismissed', 'restrict_work', 'hide_comment', 'account_warning', 'no_action') then raise exception 'invalid_report_action'; end if;
  if p_action <> 'reviewing' and char_length(clean_notes) < 5 then raise exception 'resolution_notes_required'; end if;
  select * into report_row from public.yucang_reports where id = p_report_id for update;
  if not found then raise exception 'report_not_found'; end if;
  if report_row.status in ('actioned', 'dismissed') then raise exception 'report_already_resolved'; end if;
  if p_action = 'restrict_work' and report_row.target_type <> 'work' then raise exception 'action_target_mismatch'; end if;
  if p_action = 'hide_comment' and report_row.target_type <> 'comment' then raise exception 'action_target_mismatch'; end if;
  if p_action = 'account_warning' and report_row.target_type <> 'account' then raise exception 'action_target_mismatch'; end if;

  if p_action = 'restrict_work' then
    update public.yucang_works set status = 'restricted', updated_at = now() where id = report_row.target_id and deleted_at is null;
    insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id, details)
    values (caller, 'restrict_work_from_report', 'work', report_row.target_id, jsonb_build_object('report_id', p_report_id, 'reason', clean_notes));
  elsif p_action = 'hide_comment' then
    update public.yucang_comments set status = 'hidden', updated_at = now() where id = report_row.target_id;
    insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id, details)
    values (caller, 'hide_comment_from_report', 'comment', report_row.target_id, jsonb_build_object('report_id', p_report_id, 'reason', clean_notes));
  elsif p_action = 'account_warning' then
    insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id, details)
    values (caller, 'warn_account_from_report', 'user', report_row.target_id, jsonb_build_object('report_id', p_report_id, 'reason', clean_notes));
  end if;

  next_status := case when p_action = 'reviewing' then 'reviewing' when p_action in ('dismissed', 'no_action') then 'dismissed' else 'actioned' end;
  update public.yucang_reports set status = next_status, assigned_to = caller,
    resolved_at = case when next_status in ('actioned', 'dismissed') then now() else null end,
    updated_at = now() where id = p_report_id;
  insert into public.yucang_report_events(report_id, actor_id, action, notes)
  values (p_report_id, caller, p_action, clean_notes);
  return query select p_report_id, next_status;
end;
$$;

create or replace function public.yucang_admin_list_appeals(p_status text default null)
returns table (
  appeal_id uuid, appellant_id uuid, report_id uuid, target_type text, target_id uuid,
  body text, status text, resolution_notes text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.appellant_id, a.report_id, a.target_type, a.target_id,
    a.body, a.status, a.resolution_notes, a.created_at, a.updated_at
  from public.yucang_appeals a
  where private.yucang_can_review() and (p_status is null or a.status = p_status)
  order by case a.status when 'submitted' then 0 when 'reviewing' then 1 else 2 end, a.created_at;
$$;

create or replace function public.yucang_admin_resolve_appeal(
  p_appeal_id uuid,
  p_decision text,
  p_notes text
)
returns table (appeal_id uuid, status text)
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  appeal_row public.yucang_appeals%rowtype;
  clean_notes text := trim(coalesce(p_notes, ''));
begin
  if not private.yucang_can_review() then raise exception 'staff_required'; end if;
  if p_decision not in ('reviewing', 'upheld', 'denied') then raise exception 'invalid_appeal_decision'; end if;
  if p_decision <> 'reviewing' and char_length(clean_notes) < 5 then raise exception 'resolution_notes_required'; end if;
  select * into appeal_row from public.yucang_appeals where id = p_appeal_id for update;
  if not found then raise exception 'appeal_not_found'; end if;
  if appeal_row.status in ('upheld', 'denied') then raise exception 'appeal_already_resolved'; end if;

  if p_decision = 'upheld' and appeal_row.target_type = 'work' then
    update public.yucang_works set status = 'active', updated_at = now()
    where id = appeal_row.target_id and status = 'restricted' and current_public_version_id is not null and deleted_at is null;
  elsif p_decision = 'upheld' and appeal_row.target_type = 'comment' then
    update public.yucang_comments set status = 'active', updated_at = now()
    where id = appeal_row.target_id and status = 'hidden';
  end if;

  update public.yucang_appeals set status = p_decision, resolution_notes = clean_notes,
    resolved_by = caller, resolved_at = case when p_decision in ('upheld', 'denied') then now() else null end,
    updated_at = now() where id = p_appeal_id;
  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id, details)
  values (caller, 'resolve_appeal_' || p_decision, 'appeal', p_appeal_id,
    jsonb_build_object('target_type', appeal_row.target_type, 'target_id', appeal_row.target_id, 'notes', clean_notes));
  return query select p_appeal_id, p_decision;
end;
$$;

revoke all on function public.yucang_submit_report(text, uuid, text, text, text, text) from public;
revoke all on function public.yucang_list_my_reports() from public;
revoke all on function public.yucang_submit_appeal(text, uuid, text, uuid) from public;
revoke all on function public.yucang_list_my_appeals() from public;
revoke all on function public.yucang_list_my_moderated_content() from public;
revoke all on function public.yucang_admin_list_reports(text) from public;
revoke all on function public.yucang_admin_resolve_report(uuid, text, text) from public;
revoke all on function public.yucang_admin_list_appeals(text) from public;
revoke all on function public.yucang_admin_resolve_appeal(uuid, text, text) from public;

grant execute on function public.yucang_submit_report(text, uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.yucang_list_my_reports() to authenticated;
grant execute on function public.yucang_submit_appeal(text, uuid, text, uuid) to authenticated;
grant execute on function public.yucang_list_my_appeals() to authenticated;
grant execute on function public.yucang_list_my_moderated_content() to authenticated;
grant execute on function public.yucang_admin_list_reports(text) to authenticated;
grant execute on function public.yucang_admin_resolve_report(uuid, text, text) to authenticated;
grant execute on function public.yucang_admin_list_appeals(text) to authenticated;
grant execute on function public.yucang_admin_resolve_appeal(uuid, text, text) to authenticated;

comment on table public.yucang_reports is 'Community reports. Contact email and reporter identity are staff-only via security-definer RPCs.';
comment on table public.yucang_report_events is 'Append-only report handling history.';
comment on table public.yucang_appeals is 'Appeals submitted by the owner of an actioned work, comment, or account.';
