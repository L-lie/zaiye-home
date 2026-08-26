-- Shared Yucang / Prompt Vault account profile.
-- Avatar binaries live in Storage; only public URLs are stored in profile rows and auth metadata.

alter table public.profiles
  add column if not exists avatar_url text not null default ''
    check (char_length(avatar_url) <= 1000);

alter table public.yucang_creator_profiles
  add column if not exists avatar_url text not null default ''
    check (char_length(avatar_url) <= 1000);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'yucang-avatars',
  'yucang-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads Yucang avatars" on storage.objects;
create policy "Public reads Yucang avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'yucang-avatars');

drop policy if exists "Users upload own Yucang avatar" on storage.objects;
create policy "Users upload own Yucang avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'yucang-avatars'
    and name = auth.uid()::text || '/avatar.webp'
  );

drop policy if exists "Users update own Yucang avatar" on storage.objects;
create policy "Users update own Yucang avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'yucang-avatars'
    and name = auth.uid()::text || '/avatar.webp'
  )
  with check (
    bucket_id = 'yucang-avatars'
    and name = auth.uid()::text || '/avatar.webp'
  );

drop policy if exists "Users delete own Yucang avatar" on storage.objects;
create policy "Users delete own Yucang avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'yucang-avatars'
    and name = auth.uid()::text || '/avatar.webp'
  );

create or replace function public.yucang_get_my_profile()
returns table (
  nickname text,
  avatar_url text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  return query
  select
    coalesce(nullif(trim(creator.nickname), ''), nullif(trim(profile.display_name), ''), '语藏用户'),
    coalesce(nullif(creator.avatar_url, ''), nullif(profile.avatar_url, ''), '')
  from (select 1) seed
  left join public.profiles profile on profile.id = caller
  left join public.yucang_creator_profiles creator on creator.user_id = caller;
end;
$$;

create or replace function public.yucang_update_my_profile(
  p_nickname text,
  p_avatar_url text default ''
)
returns table (
  nickname text,
  avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  clean_name text := trim(coalesce(p_nickname, ''));
  clean_avatar text := trim(coalesce(p_avatar_url, ''));
  changed_at timestamptz := now();
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if char_length(clean_name) < 1 or char_length(clean_name) > 40 then
    raise exception 'invalid_display_name';
  end if;
  if char_length(clean_avatar) > 1000 then
    raise exception 'invalid_avatar_url';
  end if;
  if clean_avatar <> '' and (
    clean_avatar !~ '^https://'
    or position('/storage/v1/object/public/yucang-avatars/' || caller::text || '/avatar.webp' in clean_avatar) = 0
  ) then
    raise exception 'invalid_avatar_url';
  end if;

  insert into public.profiles(id, display_name, avatar_url, updated_at)
  values (caller, clean_name, clean_avatar, changed_at)
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = excluded.updated_at;

  insert into public.yucang_creator_profiles(user_id, nickname, slug, avatar_url, updated_at)
  values (
    caller,
    clean_name,
    'member-' || replace(caller::text, '-', ''),
    clean_avatar,
    changed_at
  )
  on conflict (user_id) do update set
    nickname = excluded.nickname,
    avatar_url = excluded.avatar_url,
    updated_at = excluded.updated_at;

  return query select clean_name, clean_avatar;
end;
$$;

revoke all on function public.yucang_get_my_profile() from public, anon;
revoke all on function public.yucang_update_my_profile(text, text) from public, anon;
grant execute on function public.yucang_get_my_profile() to authenticated;
grant execute on function public.yucang_update_my_profile(text, text) to authenticated;

comment on function public.yucang_update_my_profile(text, text) is
  'Updates the signed-in account display name and public avatar URL across site and Yucang public profile rows.';
