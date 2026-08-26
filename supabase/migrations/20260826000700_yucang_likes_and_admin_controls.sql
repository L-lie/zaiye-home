-- Real per-account likes and reversible administrator restriction.

create table if not exists public.yucang_resource_likes (
  resource_key text not null check (resource_key ~ '^[a-z0-9:_-]{1,180}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (resource_key, user_id)
);

alter table public.yucang_resource_likes enable row level security;
revoke all on public.yucang_resource_likes from public, anon, authenticated;

create or replace function public.yucang_get_like_counts(p_resource_keys text[])
returns table (resource_key text, like_count bigint, liked_by_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with requested as (
    select distinct key
    from unnest(coalesce(p_resource_keys, array[]::text[])) key
    where key ~ '^[a-z0-9:_-]{1,180}$'
    limit 100
  )
  select requested.key,
    count(likes.user_id),
    bool_or(likes.user_id = auth.uid())
  from requested
  left join public.yucang_resource_likes likes on likes.resource_key = requested.key
  group by requested.key;
$$;

create or replace function public.yucang_toggle_like(p_resource_key text)
returns table (resource_key text, like_count bigint, liked boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  now_liked boolean;
begin
  if caller is null then raise exception 'authentication_required'; end if;
  if p_resource_key is null or p_resource_key !~ '^[a-z0-9:_-]{1,180}$' then
    raise exception 'invalid_resource_key';
  end if;
  if exists (
    select 1 from public.yucang_resource_likes
    where yucang_resource_likes.resource_key = p_resource_key and user_id = caller
  ) then
    delete from public.yucang_resource_likes
    where yucang_resource_likes.resource_key = p_resource_key and user_id = caller;
    now_liked := false;
  else
    insert into public.yucang_resource_likes(resource_key, user_id)
    values (p_resource_key, caller)
    on conflict do nothing;
    now_liked := true;
  end if;
  return query select p_resource_key,
    (select count(*) from public.yucang_resource_likes where yucang_resource_likes.resource_key = p_resource_key),
    now_liked;
end;
$$;

create or replace function public.yucang_admin_set_work_restricted(p_work_id uuid, p_restricted boolean, p_reason text default '')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null or not private.yucang_has_staff_role('admin', caller) then
    raise exception 'admin_required';
  end if;
  if p_restricted and length(trim(coalesce(p_reason, ''))) < 2 then
    raise exception 'restriction_reason_required';
  end if;
  update public.yucang_works
  set status = case when p_restricted then 'restricted' else 'active' end
  where id = p_work_id;
  if not found then raise exception 'work_not_found'; end if;
  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id, details)
  values (caller,
    case when p_restricted then 'restrict_work' else 'restore_work' end,
    'work', p_work_id,
    jsonb_build_object('reason', trim(coalesce(p_reason, ''))));
  return true;
end;
$$;

revoke all on function public.yucang_get_like_counts(text[]) from public;
revoke all on function public.yucang_toggle_like(text) from public, anon;
revoke all on function public.yucang_admin_set_work_restricted(uuid, boolean, text) from public, anon;
grant execute on function public.yucang_get_like_counts(text[]) to anon, authenticated;
grant execute on function public.yucang_toggle_like(text) to authenticated;
grant execute on function public.yucang_admin_set_work_restricted(uuid, boolean, text) to authenticated;
