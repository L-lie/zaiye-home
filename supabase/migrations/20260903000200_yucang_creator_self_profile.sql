-- Keep creator pages private until a creator publishes, while allowing the
-- signed-in creator to preview their own empty public profile.

create or replace function public.yucang_get_public_creator(p_slug text)
returns table (
  user_id uuid,
  nickname text,
  slug text,
  avatar_url text,
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
  group by creator.user_id, creator.nickname, creator.slug, creator.avatar_url
  having count(version.id) > 0 or creator.user_id = auth.uid();
$$;

revoke all on function public.yucang_get_public_creator(text) from public;
grant execute on function public.yucang_get_public_creator(text) to anon, authenticated;

comment on function public.yucang_get_public_creator(text) is
  'Returns creators with public work to everyone and also returns an empty profile to its signed-in owner.';
