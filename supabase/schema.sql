-- Supabase data and access-control foundation for zaiye.art.
-- This file intentionally contains no project secrets.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  site_role text not null default 'member'
    check (site_role in ('member', 'owner')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.private_notebooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  is_listed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.private_canvases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  is_listed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notebook_share_links (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.private_notebooks(id) on delete cascade,
  token_hash text not null unique,
  password_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists notebooks_set_updated_at on public.private_notebooks;
create trigger notebooks_set_updated_at
  before update on public.private_notebooks
  for each row execute procedure public.set_updated_at();

drop trigger if exists canvases_set_updated_at on public.private_canvases;
create trigger canvases_set_updated_at
  before update on public.private_canvases
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.private_notebooks enable row level security;
alter table public.private_canvases enable row level security;
alter table public.notebook_share_links enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Owners manage their own notebooks" on public.private_notebooks;
create policy "Owners manage their own notebooks"
  on public.private_notebooks for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners manage their own canvases" on public.private_canvases;
create policy "Owners manage their own canvases"
  on public.private_canvases for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Notebook owners manage share links" on public.notebook_share_links;
create policy "Notebook owners manage share links"
  on public.notebook_share_links for all
  to authenticated
  using (
    exists (
      select 1
      from public.private_notebooks notebook
      where notebook.id = notebook_share_links.notebook_id
        and notebook.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.private_notebooks notebook
      where notebook.id = notebook_share_links.notebook_id
        and notebook.owner_id = auth.uid()
    )
  );

-- Keep notebook share links private at the database layer.
-- A later server endpoint should validate a raw token, password, expiry,
-- and revocation state before returning notebook content.
