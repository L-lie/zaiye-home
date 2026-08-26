-- Yucang MVP now allows every authenticated member to create and submit free Prompts.
-- Review approval is still required before anything becomes public.

create or replace function private.yucang_is_creator(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and p_user_id = auth.uid();
$$;

create or replace function private.yucang_ensure_member_creator_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  public_nickname text;
begin
  public_nickname := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    '语藏用户'
  ), 40);

  insert into public.yucang_creator_profiles(user_id, nickname, slug)
  values (
    new.id,
    public_nickname,
    'user-' || left(replace(new.id::text, '-', ''), 16)
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists yucang_ensure_member_creator_profile on auth.users;
create trigger yucang_ensure_member_creator_profile
after insert on auth.users
for each row execute function private.yucang_ensure_member_creator_profile();

insert into public.yucang_creator_profiles(user_id, nickname, slug)
select
  member.id,
  left(coalesce(
    nullif(trim(member.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(member.raw_user_meta_data ->> 'name'), ''),
    '语藏用户'
  ), 40),
  'user-' || left(replace(member.id::text, '-', ''), 16)
from auth.users member
on conflict (user_id) do nothing;

comment on function private.yucang_is_creator(uuid) is
  'Compatibility predicate: every authenticated member may create and submit free Yucang Prompts.';

