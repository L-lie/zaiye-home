-- Read-only verification for the portfolio Storage policies.
-- This file changes no database data or configuration.

with expected(policyname, command_name) as (
  values
    ('Site owner reads portfolio storage', 'SELECT'),
    ('Site owner uploads portfolio storage', 'INSERT'),
    ('Site owner updates portfolio storage', 'UPDATE'),
    ('Site owner deletes portfolio storage', 'DELETE')
),
actual as (
  select
    policyname,
    cmd,
    roles,
    coalesce(qual, '') as using_expression,
    coalesce(with_check, '') as check_expression
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
)
select
  expected.policyname,
  expected.command_name,
  actual.roles,
  actual.using_expression,
  actual.check_expression,
  actual.policyname is not null as policy_exists,
  (
    actual.using_expression like '%portfolio-originals%'
    or actual.check_expression like '%portfolio-originals%'
  ) as covers_originals,
  (
    actual.using_expression like '%portfolio-public%'
    or actual.check_expression like '%portfolio-public%'
  ) as covers_public,
  (
    actual.using_expression like '%is_site_owner%'
    or actual.check_expression like '%is_site_owner%'
  ) as checks_owner,
  (
    actual.using_expression like '%foldername%'
    or actual.check_expression like '%foldername%'
  ) as checks_owner_folder
from expected
left join actual
  on actual.policyname = expected.policyname
 and actual.cmd = expected.command_name
order by expected.command_name;
