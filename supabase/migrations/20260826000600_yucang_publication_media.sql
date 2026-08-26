-- Images attached to one explicitly selected Prompt Vault publication handoff.
-- Objects remain private; access is mediated by version state and signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'yucang-publication-media',
  'yucang-publication-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.yucang_version_media (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.yucang_versions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 5242880),
  position smallint not null check (position between 0 and 3),
  created_at timestamptz not null default now(),
  unique (version_id, position),
  unique (storage_path)
);

alter table public.yucang_version_media enable row level security;
revoke all on public.yucang_version_media from public, anon, authenticated;

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
      and (
        version.author_id = auth.uid()
        or private.yucang_can_review()
        or (
          version.status = 'approved'
          and version.was_public
          and work.status = 'active'
          and work.current_public_version_id = version.id
        )
      )
  );
$$;

create or replace function public.yucang_get_version_media_manifest(p_version_id uuid)
returns table (storage_path text, mime_type text, byte_size integer, position smallint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.yucang_can_access_version_media(p_version_id) then
    raise exception 'media_access_denied';
  end if;
  return query
  select media.storage_path, media.mime_type, media.byte_size, media.position
  from public.yucang_version_media media
  where media.version_id = p_version_id
  order by media.position;
end;
$$;

revoke all on function public.yucang_can_access_version_media(uuid) from public;
revoke all on function public.yucang_get_version_media_manifest(uuid) from public;
grant execute on function public.yucang_can_access_version_media(uuid) to anon, authenticated;
grant execute on function public.yucang_get_version_media_manifest(uuid) to anon, authenticated;

comment on table public.yucang_version_media is
  'Private storage manifest for images attached to one publication version. Access is mediated by version state and short-lived signed URLs.';
