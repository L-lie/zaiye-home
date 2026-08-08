-- Owner-only portfolio editing and public publication foundation for zaiye.art.
-- Run supabase/schema.sql first. This file contains no project secrets.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_site_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and site_role = 'owner'
  );
$$;

revoke all on function private.is_site_owner() from public, anon;
grant execute on function private.is_site_owner() to authenticated;

create table if not exists public.portfolio_drafts (
  id text primary key default 'main' check (id = 'main'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null default '{"version":1,"projects":[],"items":[],"media":{}}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(content) = 'object'),
  check (jsonb_typeof(content -> 'projects') = 'array'),
  check (jsonb_typeof(content -> 'items') = 'array'),
  check (jsonb_typeof(content -> 'media') = 'object')
);

create table if not exists public.portfolio_publications (
  id text primary key default 'main' check (id = 'main'),
  content jsonb not null,
  revision bigint not null check (revision > 0),
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  check (jsonb_typeof(content) = 'object'),
  check (jsonb_typeof(content -> 'projects') = 'array'),
  check (jsonb_typeof(content -> 'items') = 'array'),
  check (jsonb_typeof(content -> 'media') = 'object')
);

create table if not exists public.portfolio_publication_history (
  id bigint generated always as identity primary key,
  publication_id text not null default 'main' check (publication_id = 'main'),
  revision bigint not null check (revision > 0),
  content jsonb not null,
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  unique (publication_id, revision)
);

create table if not exists public.portfolio_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  original_path text not null unique,
  preview_path text not null unique,
  display_path text not null unique,
  source_mime text not null check (source_mime in ('image/jpeg', 'image/png', 'image/webp')),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now(),
  check (position('..' in original_path) = 0),
  check (position('..' in preview_path) = 0),
  check (position('..' in display_path) = 0)
);

drop trigger if exists portfolio_drafts_set_updated_at on public.portfolio_drafts;
create trigger portfolio_drafts_set_updated_at
  before update on public.portfolio_drafts
  for each row execute procedure public.set_updated_at();

alter table public.portfolio_drafts enable row level security;
alter table public.portfolio_publications enable row level security;
alter table public.portfolio_publication_history enable row level security;
alter table public.portfolio_assets enable row level security;

grant select, insert, update, delete on public.portfolio_drafts to authenticated;
grant select, insert, update, delete on public.portfolio_publications to authenticated;
grant select on public.portfolio_publications to anon;
grant select, insert on public.portfolio_publication_history to authenticated;
grant usage, select on sequence public.portfolio_publication_history_id_seq to authenticated;
grant select, insert, update, delete on public.portfolio_assets to authenticated;

drop policy if exists "Public can read the published portfolio" on public.portfolio_publications;
create policy "Public can read the published portfolio"
  on public.portfolio_publications for select
  to anon, authenticated
  using (id = 'main');

drop policy if exists "Site owner manages portfolio drafts" on public.portfolio_drafts;
create policy "Site owner manages portfolio drafts"
  on public.portfolio_drafts for all
  to authenticated
  using (private.is_site_owner() and owner_id = (select auth.uid()))
  with check (private.is_site_owner() and owner_id = (select auth.uid()));

drop policy if exists "Site owner manages portfolio publications" on public.portfolio_publications;
create policy "Site owner manages portfolio publications"
  on public.portfolio_publications for all
  to authenticated
  using (private.is_site_owner())
  with check (private.is_site_owner() and published_by = (select auth.uid()));

drop policy if exists "Site owner reads portfolio history" on public.portfolio_publication_history;
create policy "Site owner reads portfolio history"
  on public.portfolio_publication_history for select
  to authenticated
  using (private.is_site_owner());

drop policy if exists "Site owner adds portfolio history" on public.portfolio_publication_history;
create policy "Site owner adds portfolio history"
  on public.portfolio_publication_history for insert
  to authenticated
  with check (private.is_site_owner() and published_by = (select auth.uid()));

drop policy if exists "Site owner manages portfolio assets" on public.portfolio_assets;
create policy "Site owner manages portfolio assets"
  on public.portfolio_assets for all
  to authenticated
  using (private.is_site_owner() and owner_id = (select auth.uid()))
  with check (private.is_site_owner() and owner_id = (select auth.uid()));

create or replace function public.publish_portfolio()
returns table (published_revision bigint, publication_time timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  draft_record public.portfolio_drafts%rowtype;
  next_time timestamptz := now();
begin
  if not private.is_site_owner() then
    raise exception 'owner access required';
  end if;

  select * into strict draft_record
  from public.portfolio_drafts
  where id = 'main'
    and owner_id = (select auth.uid());

  insert into public.portfolio_publications (
    id, content, revision, published_by, published_at
  ) values (
    'main', draft_record.content, draft_record.revision, (select auth.uid()), next_time
  )
  on conflict (id) do update set
    content = excluded.content,
    revision = excluded.revision,
    published_by = excluded.published_by,
    published_at = excluded.published_at;

  insert into public.portfolio_publication_history (
    publication_id, revision, content, published_by, published_at
  ) values (
    'main', draft_record.revision, draft_record.content, (select auth.uid()), next_time
  )
  on conflict (publication_id, revision) do nothing;

  return query select draft_record.revision, next_time;
end;
$$;

revoke all on function public.publish_portfolio() from public, anon;
grant execute on function public.publish_portfolio() to authenticated;

-- Storage buckets must be created in Dashboard, not by editing storage tables:
-- 1. portfolio-originals: private; image/jpeg,image/png,image/webp; 30 MB.
-- 2. portfolio-public: public; image/webp; 10 MB.

drop policy if exists "Site owner reads portfolio storage" on storage.objects;
create policy "Site owner reads portfolio storage"
  on storage.objects for select
  to authenticated
  using (
    private.is_site_owner()
    and bucket_id in ('portfolio-originals', 'portfolio-public')
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Site owner uploads portfolio storage" on storage.objects;
create policy "Site owner uploads portfolio storage"
  on storage.objects for insert
  to authenticated
  with check (
    private.is_site_owner()
    and bucket_id in ('portfolio-originals', 'portfolio-public')
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Site owner updates portfolio storage" on storage.objects;
create policy "Site owner updates portfolio storage"
  on storage.objects for update
  to authenticated
  using (
    private.is_site_owner()
    and bucket_id in ('portfolio-originals', 'portfolio-public')
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    private.is_site_owner()
    and bucket_id in ('portfolio-originals', 'portfolio-public')
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Site owner deletes portfolio storage" on storage.objects;
create policy "Site owner deletes portfolio storage"
  on storage.objects for delete
  to authenticated
  using (
    private.is_site_owner()
    and bucket_id in ('portfolio-originals', 'portfolio-public')
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
