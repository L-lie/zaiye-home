-- Complete the remaining free-community MVP account and library surfaces.

create table if not exists public.yucang_resource_favorites (
  resource_key text not null check (resource_key ~ '^(official|work):[a-z0-9_-]{1,170}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (resource_key, user_id)
);

alter table public.yucang_resource_favorites enable row level security;
revoke all on public.yucang_resource_favorites from public, anon, authenticated;

create or replace function public.yucang_list_my_favorites()
returns table (resource_key text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select favorite.resource_key, favorite.created_at
  from public.yucang_resource_favorites favorite
  where favorite.user_id = auth.uid()
  order by favorite.created_at desc;
$$;

create or replace function public.yucang_toggle_favorite(p_resource_key text)
returns table (resource_key text, favorited boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  now_favorited boolean;
begin
  if caller is null then raise exception 'authentication_required'; end if;
  if p_resource_key is null or p_resource_key !~ '^(official|work):[a-z0-9_-]{1,170}$' then
    raise exception 'invalid_resource_key';
  end if;

  if exists (
    select 1 from public.yucang_resource_favorites favorite
    where favorite.resource_key = p_resource_key and favorite.user_id = caller
  ) then
    delete from public.yucang_resource_favorites favorite
    where favorite.resource_key = p_resource_key and favorite.user_id = caller;
    now_favorited := false;
  else
    insert into public.yucang_resource_favorites(resource_key, user_id)
    values (p_resource_key, caller)
    on conflict do nothing;
    now_favorited := true;
  end if;

  return query select p_resource_key, now_favorited;
end;
$$;

alter table public.yucang_creator_profiles
  add column if not exists is_public boolean not null default true;

drop function if exists public.yucang_get_my_access();
create function public.yucang_get_my_access()
returns table (
  user_id uuid,
  is_creator boolean,
  is_reviewer boolean,
  is_admin boolean,
  nickname text,
  slug text,
  profile_is_public boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid(),
    private.yucang_is_creator(),
    private.yucang_has_staff_role('reviewer'),
    private.yucang_has_staff_role('admin'),
    creator.nickname,
    creator.slug,
    coalesce(creator.is_public, true)
  from (select 1) seed
  left join public.yucang_creator_profiles creator on creator.user_id = auth.uid()
  where auth.uid() is not null;
$$;

create or replace function public.yucang_update_creator_settings(
  p_bio text default '',
  p_is_public boolean default true
)
returns table (bio text, is_public boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  clean_bio text := trim(coalesce(p_bio, ''));
begin
  if caller is null then raise exception 'authentication_required'; end if;
  if char_length(clean_bio) > 500 then raise exception 'bio_too_long'; end if;

  update public.yucang_creator_profiles creator set
    bio = clean_bio,
    is_public = coalesce(p_is_public, true),
    updated_at = now()
  where creator.user_id = caller;
  if not found then raise exception 'creator_profile_required'; end if;

  return query select clean_bio, coalesce(p_is_public, true);
end;
$$;

drop function if exists public.yucang_get_public_creator(text);
create function public.yucang_get_public_creator(p_slug text)
returns table (
  user_id uuid,
  nickname text,
  slug text,
  avatar_url text,
  bio text,
  is_public boolean,
  is_owner boolean,
  published_work_count bigint,
  latest_published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    creator.user_id,
    coalesce(nullif(trim(creator.nickname), ''), '语藏用户'),
    creator.slug,
    coalesce(nullif(trim(creator.avatar_url), ''), ''),
    creator.bio,
    creator.is_public,
    creator.user_id = auth.uid(),
    count(version.id),
    max(version.published_at)
  from public.yucang_creator_profiles creator
  left join public.yucang_works work
    on work.author_id = creator.user_id
    and work.status = 'active'
    and work.deleted_at is null
  left join public.yucang_versions version
    on version.id = work.current_public_version_id
    and version.status = 'approved'
    and version.was_public
  where lower(creator.slug) = lower(trim(coalesce(p_slug, '')))
    and trim(coalesce(p_slug, '')) ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'
    and (creator.is_public or creator.user_id = auth.uid())
  group by creator.user_id, creator.nickname, creator.slug, creator.avatar_url,
    creator.bio, creator.is_public
  having count(version.id) > 0 or creator.user_id = auth.uid();
$$;

create or replace function public.yucang_list_public_creators()
returns table (
  user_id uuid,
  nickname text,
  slug text,
  avatar_url text,
  bio text,
  published_work_count bigint,
  latest_published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    creator.user_id,
    coalesce(nullif(trim(creator.nickname), ''), '语藏用户'),
    creator.slug,
    coalesce(nullif(trim(creator.avatar_url), ''), ''),
    creator.bio,
    count(version.id),
    max(version.published_at)
  from public.yucang_creator_profiles creator
  join public.yucang_works work
    on work.author_id = creator.user_id
    and work.status = 'active'
    and work.deleted_at is null
  join public.yucang_versions version
    on version.id = work.current_public_version_id
    and version.status = 'approved'
    and version.was_public
  where creator.is_public
  group by creator.user_id, creator.nickname, creator.slug, creator.avatar_url, creator.bio
  order by max(version.published_at) desc, creator.nickname;
$$;

drop function if exists public.yucang_get_public_work(uuid);
drop function if exists public.yucang_list_public_works();
create function public.yucang_list_public_works()
returns table (
  work_id uuid, version_id uuid, version_no integer, title text, summary text,
  content_type text, prompt_text text, negative_prompt_text text, variables jsonb,
  model_name text, model_version text, parameters jsonb, dependencies jsonb,
  tags text[], license_code text, instructions text,
  author_id uuid, author_nickname text, author_slug text, published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select work.id, version.id, version.version_no, version.title, version.summary,
    version.content_type, version.prompt_text, version.negative_prompt_text, version.variables,
    version.model_name, version.model_version, version.parameters, version.dependencies,
    version.tags, version.license_code, version.instructions,
    version.author_id, version.author_nickname,
    case when creator.is_public or creator.user_id = auth.uid() then creator.slug else null end,
    version.published_at
  from public.yucang_works work
  join public.yucang_versions version on version.id = work.current_public_version_id
  join public.yucang_creator_profiles creator on creator.user_id = work.author_id
  where work.status = 'active' and work.deleted_at is null
    and version.status = 'approved' and version.was_public
  order by version.published_at desc;
$$;

create function public.yucang_get_public_work(p_work_id uuid)
returns table (
  work_id uuid, version_id uuid, version_no integer, title text, summary text,
  content_type text, prompt_text text, negative_prompt_text text, variables jsonb,
  model_name text, model_version text, parameters jsonb, dependencies jsonb,
  tags text[], license_code text, instructions text,
  author_id uuid, author_nickname text, author_slug text, published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.yucang_list_public_works() item where item.work_id = p_work_id;
$$;

create or replace function public.yucang_list_public_versions(p_work_id uuid)
returns table (
  version_id uuid,
  version_no integer,
  title text,
  summary text,
  published_at timestamptz,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select version.id, version.version_no, version.title, version.summary,
    version.published_at, version.id = work.current_public_version_id
  from public.yucang_works work
  join public.yucang_versions version on version.work_id = work.id
  where work.id = p_work_id
    and work.status = 'active'
    and work.deleted_at is null
    and version.status = 'approved'
    and version.was_public
  order by version.version_no desc;
$$;

create or replace function public.yucang_get_public_work_version(
  p_work_id uuid,
  p_version_id uuid
)
returns table (
  work_id uuid, version_id uuid, version_no integer, title text, summary text,
  content_type text, prompt_text text, negative_prompt_text text, variables jsonb,
  model_name text, model_version text, parameters jsonb, dependencies jsonb,
  tags text[], license_code text, instructions text,
  author_id uuid, author_nickname text, author_slug text, published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select work.id, version.id, version.version_no, version.title, version.summary,
    version.content_type, version.prompt_text, version.negative_prompt_text, version.variables,
    version.model_name, version.model_version, version.parameters, version.dependencies,
    version.tags, version.license_code, version.instructions,
    version.author_id, version.author_nickname,
    case when creator.is_public or creator.user_id = auth.uid() then creator.slug else null end,
    version.published_at
  from public.yucang_works work
  join public.yucang_versions version on version.work_id = work.id
  join public.yucang_creator_profiles creator on creator.user_id = work.author_id
  where work.id = p_work_id
    and version.id = p_version_id
    and work.status = 'active'
    and work.deleted_at is null
    and version.status = 'approved'
    and version.was_public;
$$;

create or replace function public.yucang_can_access_version_media(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.yucang_versions version
    join public.yucang_works work on work.id = version.work_id
    where version.id = p_version_id
      and work.deleted_at is null
      and (
        version.author_id = auth.uid()
        or private.yucang_can_review()
        or (
          version.status = 'approved'
          and version.was_public
          and work.status = 'active'
        )
      )
  );
$$;

revoke all on function public.yucang_list_my_favorites() from public, anon;
revoke all on function public.yucang_toggle_favorite(text) from public, anon;
revoke all on function public.yucang_get_my_access() from public, anon;
revoke all on function public.yucang_update_creator_settings(text, boolean) from public, anon;
revoke all on function public.yucang_get_public_creator(text) from public;
revoke all on function public.yucang_list_public_creators() from public;
revoke all on function public.yucang_list_public_works() from public;
revoke all on function public.yucang_get_public_work(uuid) from public;
revoke all on function public.yucang_list_public_versions(uuid) from public;
revoke all on function public.yucang_get_public_work_version(uuid, uuid) from public;

grant execute on function public.yucang_list_my_favorites() to authenticated;
grant execute on function public.yucang_toggle_favorite(text) to authenticated;
grant execute on function public.yucang_get_my_access() to authenticated;
grant execute on function public.yucang_update_creator_settings(text, boolean) to authenticated;
grant execute on function public.yucang_get_public_creator(text) to anon, authenticated;
grant execute on function public.yucang_list_public_creators() to anon, authenticated;
grant execute on function public.yucang_list_public_works() to anon, authenticated;
grant execute on function public.yucang_get_public_work(uuid) to anon, authenticated;
grant execute on function public.yucang_list_public_versions(uuid) to anon, authenticated;
grant execute on function public.yucang_get_public_work_version(uuid, uuid) to anon, authenticated;

comment on table public.yucang_resource_favorites is
  'Private website-native bookmarks. These records never read or modify Prompt Vault private data.';
comment on column public.yucang_creator_profiles.is_public is
  'Controls discovery and access to the creator profile page. Published work attribution remains public.';

notify pgrst, 'reload schema';
