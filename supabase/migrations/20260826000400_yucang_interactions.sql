-- Yucang MVP Slice 3: public work comments, author questions, one-level replies,
-- and the minimum in-site notification loop.

create table public.yucang_comments (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.yucang_works(id) on delete restrict,
  public_version_id uuid not null references public.yucang_versions(id) on delete restrict,
  author_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('comment', 'question', 'reply')),
  parent_id uuid references public.yucang_comments(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind in ('comment', 'question') and parent_id is null)
    or (kind = 'reply' and parent_id is not null)
  )
);

create index yucang_comments_public_thread_idx
  on public.yucang_comments(work_id, public_version_id, created_at, id)
  where status = 'active';

create index yucang_comments_author_rate_idx
  on public.yucang_comments(author_id, created_at desc);

create table public.yucang_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (
    event_type in ('work_comment', 'work_question', 'comment_reply', 'question_author_reply')
  ),
  work_id uuid not null references public.yucang_works(id) on delete cascade,
  public_version_id uuid not null references public.yucang_versions(id) on delete restrict,
  source_comment_id uuid not null references public.yucang_comments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_type, recipient_id, source_comment_id)
);

create index yucang_notifications_recipient_unread_idx
  on public.yucang_notifications(recipient_id, created_at desc)
  where read_at is null;

alter table public.yucang_comments enable row level security;
alter table public.yucang_notifications enable row level security;

revoke all on public.yucang_comments from anon, authenticated;
revoke all on public.yucang_notifications from anon, authenticated;

create or replace function public.yucang_list_comments(p_work_id uuid)
returns table (
  comment_id uuid,
  work_id uuid,
  public_version_id uuid,
  author_id uuid,
  author_nickname text,
  kind text,
  parent_id uuid,
  body text,
  created_at timestamptz,
  is_work_author boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.work_id,
    c.public_version_id,
    c.author_id,
    coalesce(nullif(trim(creator.nickname), ''), nullif(trim(profile.display_name), ''), '语藏用户'),
    c.kind,
    c.parent_id,
    c.body,
    c.created_at,
    c.author_id = w.author_id
  from public.yucang_works w
  join public.yucang_versions v on v.id = w.current_public_version_id
  join public.yucang_comments c
    on c.work_id = w.id
   and c.public_version_id = v.id
   and c.status = 'active'
  left join public.profiles profile on profile.id = c.author_id
  left join public.yucang_creator_profiles creator on creator.user_id = c.author_id
  where w.id = p_work_id
    and w.status = 'active'
    and v.status = 'approved'
    and v.was_public
  order by coalesce(c.parent_id, c.id), (c.parent_id is not null), c.created_at, c.id;
$$;

create or replace function public.yucang_create_comment(
  p_work_id uuid,
  p_kind text,
  p_body text,
  p_parent_id uuid default null
)
returns table (
  comment_id uuid,
  public_version_id uuid,
  kind text,
  parent_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  work_row public.yucang_works%rowtype;
  parent_row public.yucang_comments%rowtype;
  created_row public.yucang_comments%rowtype;
  notify_recipient uuid;
  notify_event text;
  clean_body text := trim(coalesce(p_body, ''));
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;
  if p_kind not in ('comment', 'question', 'reply') then
    raise exception 'invalid_comment_kind';
  end if;
  if char_length(clean_body) < 1 or char_length(clean_body) > 2000 then
    raise exception 'invalid_comment_body';
  end if;

  -- Serialize the per-account rate check so parallel requests cannot race it.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller::text, 794621)
  );

  select w.* into work_row
  from public.yucang_works w
  join public.yucang_versions v on v.id = w.current_public_version_id
  where w.id = p_work_id
    and w.status = 'active'
    and v.status = 'approved'
    and v.was_public
  for update of w;
  if not found then
    raise exception 'public_work_not_found';
  end if;

  if (
    select count(*)
    from public.yucang_comments c
    where c.author_id = caller
      and c.created_at >= now() - interval '1 minute'
  ) >= 10 then
    raise exception 'rate_limited';
  end if;

  if p_kind = 'reply' then
    if p_parent_id is null then
      raise exception 'reply_parent_required';
    end if;
    select c.* into parent_row
    from public.yucang_comments c
    where c.id = p_parent_id
      and c.work_id = work_row.id
      and c.public_version_id = work_row.current_public_version_id
      and c.parent_id is null
      and c.kind in ('comment', 'question')
      and c.status = 'active';
    if not found then
      raise exception 'invalid_reply_parent';
    end if;
  elsif p_parent_id is not null then
    raise exception 'root_comment_cannot_have_parent';
  end if;

  insert into public.yucang_comments(
    work_id, public_version_id, author_id, kind, parent_id, body
  ) values (
    work_row.id, work_row.current_public_version_id, caller, p_kind, p_parent_id, clean_body
  ) returning * into created_row;

  if p_kind = 'comment' then
    notify_recipient := work_row.author_id;
    notify_event := 'work_comment';
  elsif p_kind = 'question' then
    notify_recipient := work_row.author_id;
    notify_event := 'work_question';
  else
    notify_recipient := parent_row.author_id;
    notify_event := case
      when parent_row.kind = 'question' and caller = work_row.author_id
        then 'question_author_reply'
      else 'comment_reply'
    end;
  end if;

  if notify_recipient is distinct from caller then
    insert into public.yucang_notifications(
      recipient_id, actor_id, event_type, work_id, public_version_id, source_comment_id
    ) values (
      notify_recipient, caller, notify_event, work_row.id,
      work_row.current_public_version_id, created_row.id
    ) on conflict do nothing;
  end if;

  return query select
    created_row.id,
    created_row.public_version_id,
    created_row.kind,
    created_row.parent_id,
    created_row.created_at;
end;
$$;

create or replace function public.yucang_list_notifications(p_limit integer default 20)
returns table (
  notification_id uuid,
  event_type text,
  work_id uuid,
  work_title text,
  comment_id uuid,
  comment_excerpt text,
  actor_nickname text,
  created_at timestamptz,
  read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;
  return query
  select
    n.id,
    n.event_type,
    n.work_id,
    v.title,
    n.source_comment_id,
    left(c.body, 120),
    coalesce(nullif(trim(creator.nickname), ''), nullif(trim(profile.display_name), ''), '语藏用户'),
    n.created_at,
    n.read_at
  from public.yucang_notifications n
  join public.yucang_works w on w.id = n.work_id and w.status = 'active'
  join public.yucang_versions v
    on v.id = w.current_public_version_id
   and v.status = 'approved'
   and v.was_public
  join public.yucang_comments c on c.id = n.source_comment_id and c.status = 'active'
  left join public.profiles profile on profile.id = n.actor_id
  left join public.yucang_creator_profiles creator on creator.user_id = n.actor_id
  where n.recipient_id = caller
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

create or replace function public.yucang_notification_unread_count()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  result_count integer;
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;
  select count(*)::integer into result_count
  from public.yucang_notifications n
  join public.yucang_works w on w.id = n.work_id and w.status = 'active'
  join public.yucang_versions v
    on v.id = w.current_public_version_id
   and v.status = 'approved'
   and v.was_public
  join public.yucang_comments c on c.id = n.source_comment_id and c.status = 'active'
  where n.recipient_id = caller and n.read_at is null;
  return result_count;
end;
$$;

create or replace function public.yucang_mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;
  update public.yucang_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_id = caller;
  return found;
end;
$$;

create or replace function public.yucang_mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  affected integer;
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;
  update public.yucang_notifications
  set read_at = now()
  where recipient_id = caller and read_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.yucang_list_comments(uuid) from public;
revoke all on function public.yucang_create_comment(uuid, text, text, uuid) from public, anon;
revoke all on function public.yucang_list_notifications(integer) from public, anon;
revoke all on function public.yucang_notification_unread_count() from public, anon;
revoke all on function public.yucang_mark_notification_read(uuid) from public, anon;
revoke all on function public.yucang_mark_all_notifications_read() from public, anon;

grant execute on function public.yucang_list_comments(uuid) to anon, authenticated;
grant execute on function public.yucang_create_comment(uuid, text, text, uuid) to authenticated;
grant execute on function public.yucang_list_notifications(integer) to authenticated;
grant execute on function public.yucang_notification_unread_count() to authenticated;
grant execute on function public.yucang_mark_notification_read(uuid) to authenticated;
grant execute on function public.yucang_mark_all_notifications_read() to authenticated;

comment on table public.yucang_comments is
  'Public discussion on the currently approved version of an active work. Mutations are RPC-only.';
comment on table public.yucang_notifications is
  'Minimum in-site interaction notifications. No marketing, follow, or private-message events.';
comment on function public.yucang_create_comment(uuid, text, text, uuid) is
  'Creates a logged-in public comment, author question, or one-level reply and its notification atomically.';
