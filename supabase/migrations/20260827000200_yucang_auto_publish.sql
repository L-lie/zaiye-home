-- Free publications become public immediately after the creator confirms the
-- frozen preview. Governance remains post-publication.

create or replace function public.yucang_submit_for_review(p_version_id uuid, p_expected_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  version_row public.yucang_versions%rowtype;
  built jsonb;
  built_hash text;
  next_attempt integer;
  submission_id uuid;
begin
  if caller is null or not private.yucang_is_creator(caller) then
    raise exception 'signed-in member required';
  end if;
  select * into version_row from public.yucang_versions
  where id = p_version_id for update;
  if version_row.id is null or version_row.author_id <> caller
    or version_row.status <> 'draft' or version_row.workflow_closed_at is not null then
    raise exception 'editable draft not found';
  end if;
  built := private.yucang_snapshot(version_row);
  built_hash := private.yucang_snapshot_hash(built);
  if built_hash <> p_expected_hash then raise exception 'preview changed; review again'; end if;

  select coalesce(max(attempt_no), 0) + 1 into next_attempt
  from public.yucang_review_submissions where version_id = p_version_id;
  insert into public.yucang_review_submissions(
    version_id, attempt_no, snapshot, content_hash, submitted_by
  ) values (p_version_id, next_attempt, built, built_hash, caller)
  returning id into submission_id;

  update public.yucang_versions set
    status = 'approved', was_public = true, content_hash = built_hash,
    submitted_at = now(), published_at = now()
  where id = p_version_id;
  update public.yucang_works set
    current_public_version_id = p_version_id,
    status = 'active'
  where id = version_row.work_id;
  insert into public.yucang_review_actions(submission_id, action, reason, actor_id)
  values (submission_id, 'approved', 'automatic publication after creator confirmation', caller);
  insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id, details)
  values (caller, 'auto_publish_after_confirmation', 'submission', submission_id,
    jsonb_build_object('moderationMode', 'post_publication'));
  return submission_id;
end;
$$;

-- Release frozen submissions that were already awaiting manual review.
with latest_pending as (
  select distinct on (submission.version_id)
    submission.id as submission_id,
    submission.version_id,
    submission.submitted_by,
    version.work_id
  from public.yucang_review_submissions submission
  join public.yucang_versions version on version.id = submission.version_id
  where version.status = 'pending_review'
    and not exists (
      select 1 from public.yucang_review_actions action
      where action.submission_id = submission.id
    )
  order by submission.version_id, submission.attempt_no desc
), closed as (
  insert into public.yucang_review_actions(submission_id, action, reason, actor_id)
  select submission_id, 'approved', 'automatic publication after policy change', submitted_by
  from latest_pending
  on conflict do nothing
  returning submission_id
), approved as (
  update public.yucang_versions version set
    status = 'approved', was_public = true,
    published_at = coalesce(version.published_at, now())
  from latest_pending pending
  where version.id = pending.version_id
  returning version.id, version.work_id
)
update public.yucang_works work set
  current_public_version_id = approved.id,
  status = 'active'
from approved
where work.id = approved.work_id;

insert into public.yucang_audit_events(actor_id, action, entity_type, entity_id, details)
select submission.submitted_by, 'auto_publish_existing_pending', 'submission', submission.id,
  jsonb_build_object('moderationMode', 'post_publication')
from public.yucang_review_submissions submission
join public.yucang_versions version on version.id = submission.version_id
where version.status = 'approved'
  and exists (
    select 1 from public.yucang_review_actions action
    where action.submission_id = submission.id
      and action.reason = 'automatic publication after policy change'
  );

comment on function public.yucang_submit_for_review(uuid, text) is
  'Verifies the frozen preview hash, preserves an immutable audit snapshot, and publishes immediately for post-publication moderation.';

notify pgrst, 'reload schema';
