-- Private account backup for Prompt Vault libraries.
-- The payload is account-scoped and never used as a public/community source.

create table if not exists public.prompt_vault_account_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  schema_version integer not null default 1 check (schema_version = 1),
  payload jsonb not null,
  last_device_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'object'),
  check (jsonb_typeof(payload -> 'prompts') = 'array'),
  check (jsonb_typeof(payload -> 'tombstones') = 'object'),
  check (octet_length(payload::text) <= 25165824)
);

comment on table public.prompt_vault_account_backups is
  'Private Prompt Vault account backups. This table is not a publication, sharing, AI, or analytics source.';

alter table public.prompt_vault_account_backups enable row level security;
revoke all on public.prompt_vault_account_backups from anon, authenticated;

create policy prompt_vault_account_backups_select_own
  on public.prompt_vault_account_backups
  for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

grant select on public.prompt_vault_account_backups to authenticated;

create or replace function public.prompt_vault_read_backup()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.prompt_vault_account_backups%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into v_row
  from public.prompt_vault_account_backups
  where user_id = v_user_id;

  if not found then
    return jsonb_build_object('exists', false, 'revision', 0, 'payload', null, 'updated_at', null);
  end if;

  return jsonb_build_object(
    'exists', true,
    'revision', v_row.revision,
    'payload', v_row.payload,
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.prompt_vault_write_backup(
  p_base_revision bigint,
  p_payload jsonb,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.prompt_vault_account_backups%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_base_revision is null or p_base_revision < 0 then
    raise exception 'invalid_base_revision' using errcode = '22023';
  end if;
  if p_device_id is null then
    raise exception 'invalid_device_id' using errcode = '22023';
  end if;
  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or coalesce((p_payload ->> 'schemaVersion')::integer, 0) <> 1
    or jsonb_typeof(p_payload -> 'prompts') <> 'array'
    or jsonb_typeof(p_payload -> 'tombstones') <> 'object'
    or octet_length(p_payload::text) > 25165824 then
    raise exception 'invalid_backup_payload' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select * into v_row
  from public.prompt_vault_account_backups
  where user_id = v_user_id
  for update;

  if not found then
    if p_base_revision <> 0 then
      return jsonb_build_object('success', false, 'revision', 0, 'payload', null, 'updated_at', null);
    end if;
    insert into public.prompt_vault_account_backups (
      user_id, revision, schema_version, payload, last_device_id
    ) values (
      v_user_id, 1, 1, p_payload, p_device_id
    ) returning * into v_row;
  else
    if v_row.revision <> p_base_revision then
      return jsonb_build_object(
        'success', false,
        'revision', v_row.revision,
        'payload', v_row.payload,
        'updated_at', v_row.updated_at
      );
    end if;
    update public.prompt_vault_account_backups
    set revision = revision + 1,
        payload = p_payload,
        last_device_id = p_device_id,
        updated_at = now()
    where user_id = v_user_id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'success', true,
    'revision', v_row.revision,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.prompt_vault_read_backup() from public;
revoke all on function public.prompt_vault_write_backup(bigint, jsonb, uuid) from public;
grant execute on function public.prompt_vault_read_backup() to authenticated;
grant execute on function public.prompt_vault_write_backup(bigint, jsonb, uuid) to authenticated;

