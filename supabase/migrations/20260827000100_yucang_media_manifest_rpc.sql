-- Attach publication media through a narrowly scoped service-role RPC.

create or replace function private.yucang_attach_version_media(
  p_author_id uuid,
  p_version_id uuid,
  p_manifest jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  attached integer := 0;
  item_position integer;
  item_path text;
  item_mime text;
  item_size integer;
begin
  if p_author_id is null or p_version_id is null
    or jsonb_typeof(p_manifest) <> 'array'
    or jsonb_array_length(p_manifest) not between 1 and 4 then
    raise exception 'invalid_media_manifest';
  end if;

  if not exists (
    select 1
    from public.yucang_versions version
    where version.id = p_version_id
      and version.author_id = p_author_id
      and version.status = 'draft'
      and version.workflow_closed_at is null
  ) then
    raise exception 'media_version_not_editable';
  end if;

  for item in select value from jsonb_array_elements(p_manifest)
  loop
    if jsonb_typeof(item) <> 'object'
      or exists (
        select 1
        from jsonb_object_keys(item) key
        where key not in ('storage_path', 'mime_type', 'byte_size', 'position')
      ) then
      raise exception 'invalid_media_manifest';
    end if;

    item_path := item ->> 'storage_path';
    item_mime := item ->> 'mime_type';
    item_size := (item ->> 'byte_size')::integer;
    item_position := (item ->> 'position')::integer;

    if item_path !~ ('^' || p_author_id::text || '/[0-9a-f-]{36}/[0-3]\\.(jpg|png|webp)$')
      or item_mime not in ('image/jpeg', 'image/png', 'image/webp')
      or item_size not between 1 and 5242880
      or item_position not between 0 and 3 then
      raise exception 'invalid_media_manifest';
    end if;

    insert into public.yucang_version_media(
      version_id, author_id, storage_path, mime_type, byte_size, position
    ) values (
      p_version_id, p_author_id, item_path, item_mime, item_size, item_position
    )
    on conflict (version_id, position) do update set
      storage_path = excluded.storage_path,
      mime_type = excluded.mime_type,
      byte_size = excluded.byte_size;
    attached := attached + 1;
  end loop;

  return attached;
end;
$$;

revoke all on function private.yucang_attach_version_media(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function private.yucang_attach_version_media(uuid, uuid, jsonb) to service_role;

comment on function private.yucang_attach_version_media(uuid, uuid, jsonb) is
  'Service-only, idempotent attachment of a validated media manifest to one editable Yucang draft version.';

notify pgrst, 'reload schema';
