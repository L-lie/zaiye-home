-- Run after 20260825000100_yucang_slice1.sql in a local/test Supabase database.
-- Read-only contract assertions; no test records are created.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'yucang_creator_profiles', 'yucang_creator_grants', 'yucang_staff_roles',
    'yucang_works', 'yucang_versions', 'yucang_review_submissions',
    'yucang_review_actions', 'yucang_audit_events'
  ] loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'missing table: %', table_name;
    end if;
    if not exists (
      select 1 from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = table_name
        and relation.relrowsecurity
    ) then
      raise exception 'RLS is not enabled: %', table_name;
    end if;
  end loop;

  foreach table_name in array array[
    'yucang_creator_profiles', 'yucang_creator_grants', 'yucang_staff_roles',
    'yucang_works', 'yucang_versions', 'yucang_review_submissions',
    'yucang_review_actions', 'yucang_audit_events'
  ] loop
    if has_table_privilege('anon', 'public.' || table_name, 'select') then
      raise exception 'anon must not select base table: %', table_name;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.yucang_versions', 'update') then
    raise exception 'authenticated must not directly update versions';
  end if;
  if has_table_privilege('authenticated', 'public.yucang_works', 'update') then
    raise exception 'authenticated must not directly switch current pointer';
  end if;
  if not has_function_privilege('anon', 'public.yucang_list_public_works()', 'execute') then
    raise exception 'anon public list RPC is not executable';
  end if;
  if has_function_privilege('anon', 'public.yucang_create_work(text,text,text,text,jsonb,text,text,jsonb,text[],text)', 'execute') then
    raise exception 'anon must not execute creator write RPCs';
  end if;
  if has_function_privilege('anon', 'public.yucang_review_submission(uuid,text,text)', 'execute') then
    raise exception 'anon must not execute review RPCs';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'yucang_one_open_version_per_work'
      and indexdef like '%pending_review%'
      and indexdef like '%changes_requested%'
  ) then
    raise exception 'single open version constraint is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'yucang_versions_guard' and not tgisinternal
  ) then
    raise exception 'version immutability trigger is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'yucang_works_current_pointer_guard' and not tgisinternal
  ) then
    raise exception 'current pointer trigger is missing';
  end if;
end;
$$;

select 'Yucang Slice 1 database contract passed' as result;
