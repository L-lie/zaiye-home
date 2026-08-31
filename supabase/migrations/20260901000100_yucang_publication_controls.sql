-- Creators can withdraw or remove their own publications. Administrators can
-- remove any work. Removal is soft so immutable publication and audit history
-- remains available for abuse investigations.

alter table public.yucang_works
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete restrict,
  add column if not exists deletion_reason text;

create or replace function private.yucang_block_deleted_work_version_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.yucang_works work
    where work.id = old.work_id and work.deleted_at is not null
  ) then
    raise exception 'work_deleted';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists yucang_deleted_work_version_guard on public.yucang_versions;
create trigger yucang_deleted_work_version_guard
  before update or delete on public.yucang_versions
  for each row execute procedure private.yucang_block_deleted_work_version_change();

create or replace function public.yucang_set_my_work_public(p_work_id uuid, p_public boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  work_row public.yucang_works%rowtype;
  approved_version uuid;
begin
  if caller is null then raise exception 'authentication_required'; end if;
  select * into work_row from public.yucang_works
  where id = p_work_id for update;
  if work_row.id is null or work_row.author_id <> caller then raise exception 'work_not_found'; end if;
  if work_row.deleted_at is not null then raise exception 'work_deleted'; end if;
  if work_row.status = 'restricted' then raise exception 'work_restricted'; end if;

  if p_public then
    select version.id into approved_version
    from public.yucang_versions version
    where version.work_id = p_work_id
      and version.status = 'approved'
      and version.was_public
    order by version.version_no desc
    limit 1;
    if approved_version is null then raise exception 'approved_version_not_found'; end if;
    update public.yucang_works set
      status = 'active', current_public_version_id = approved_version
    where id = p_work_id;
  else
    update public.yucang_works set
      status = 'withdrawn', current_public_version_id = null
    where id = p_work_id;
  end if;

  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id)
  values (caller, case when p_public then 'republish_work' else 'make_work_private' end, 'work', p_work_id);
  return case when p_public then 'public' else 'private' end;
end;
$$;

create or replace function public.yucang_delete_work(p_work_id uuid, p_reason text default '')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  work_row public.yucang_works%rowtype;
  is_admin boolean := false;
  clean_reason text := trim(coalesce(p_reason, ''));
begin
  if caller is null then raise exception 'authentication_required'; end if;
  select * into work_row from public.yucang_works
  where id = p_work_id for update;
  if work_row.id is null or work_row.deleted_at is not null then raise exception 'work_not_found'; end if;
  is_admin := private.yucang_has_staff_role('admin', caller);
  if work_row.author_id <> caller and not is_admin then raise exception 'work_not_found'; end if;
  if work_row.author_id <> caller and length(clean_reason) < 2 then
    raise exception 'deletion_reason_required';
  end if;

  update public.yucang_works set
    status = 'withdrawn', current_public_version_id = null,
    deleted_at = now(), deleted_by = caller,
    deletion_reason = nullif(clean_reason, '')
  where id = p_work_id;

  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id, details)
  values (caller, case when work_row.author_id = caller then 'delete_own_work' else 'admin_delete_work' end,
    'work', p_work_id, jsonb_build_object('reason', clean_reason, 'authorId', work_row.author_id));
  return true;
end;
$$;

create or replace function public.yucang_list_my_publications()
returns table (
  work_id uuid, work_status text, current_public_version_id uuid,
  version_id uuid, version_no integer, version_status text,
  title text, summary text, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select work.id, work.status, work.current_public_version_id,
    version.id, version.version_no, version.status, version.title, version.summary, version.updated_at
  from public.yucang_works work
  join public.yucang_versions version on version.work_id = work.id
  where work.author_id = auth.uid() and work.deleted_at is null
  order by work.updated_at desc, version.version_no desc;
$$;

revoke all on function public.yucang_set_my_work_public(uuid, boolean) from public, anon;
revoke all on function public.yucang_delete_work(uuid, text) from public, anon;
grant execute on function public.yucang_set_my_work_public(uuid, boolean) to authenticated;
grant execute on function public.yucang_delete_work(uuid, text) to authenticated;

comment on column public.yucang_works.deleted_at is
  'Soft deletion marker. Public and creator list RPCs exclude deleted works while immutable audit history remains.';

notify pgrst, 'reload schema';
