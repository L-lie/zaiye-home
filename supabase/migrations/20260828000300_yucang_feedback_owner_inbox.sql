create or replace function public.yucang_list_admin_feedback_inbox(p_limit integer default 50)
returns table (
  message_id uuid,
  message_type text,
  feedback_type text,
  author_display_name text,
  title text,
  description text,
  reproduction_steps text,
  expected_result text,
  extension_version text,
  surface text,
  locale text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if not private.yucang_has_staff_role('admin', caller) then raise exception 'forbidden'; end if;

  return query
  select
    feedback.id,
    'feedback'::text,
    feedback.feedback_type,
    coalesce(nullif(trim(creator.nickname), ''), nullif(trim(profile.display_name), ''), '语藏用户'),
    feedback.title,
    feedback.description,
    feedback.reproduction_steps,
    feedback.expected_result,
    feedback.extension_version,
    feedback.surface,
    feedback.locale,
    feedback.status,
    feedback.created_at
  from public.yucang_feedback feedback
  left join public.profiles profile on profile.id = feedback.author_id
  left join public.yucang_creator_profiles creator on creator.user_id = feedback.author_id
  order by feedback.created_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.yucang_list_admin_feedback_inbox(integer) from public, anon;
grant execute on function public.yucang_list_admin_feedback_inbox(integer) to authenticated;

comment on function public.yucang_list_admin_feedback_inbox(integer) is
  'Returns explicit user feedback only to active Yucang admins for the collaboration message inbox.';
