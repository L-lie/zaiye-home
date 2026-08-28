-- Durable Prompt-sharing credits. Daily free allowance is consumed first;
-- publication rewards and founder grants never expire.

alter table public.yucang_prompt_shares
  add column if not exists recipient_count integer not null default 1
    check (recipient_count between 1 and 1000),
  add column if not exists daily_free_charged integer not null default 1
    check (daily_free_charged between 0 and 1000),
  add column if not exists permanent_credits_charged integer not null default 0
    check (permanent_credits_charged between 0 and 1000),
  add constraint yucang_prompt_shares_charge_total_check
    check (daily_free_charged + permanent_credits_charged in (0, recipient_count));

create table if not exists public.yucang_share_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  delta integer not null check (delta <> 0 and abs(delta) <= 10000),
  event_type text not null
    check (event_type in ('publication_reward', 'founder_grant', 'share_debit')),
  event_key text not null unique check (char_length(event_key) between 1 and 200),
  request_id uuid,
  work_id uuid references public.yucang_works(id) on delete restrict,
  version_id uuid references public.yucang_versions(id) on delete restrict,
  share_id uuid references public.yucang_prompt_shares(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  note text not null default '' check (char_length(note) <= 200),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  check (
    (event_type = 'publication_reward' and delta = 1 and version_id is not null and work_id is not null)
    or (event_type = 'founder_grant' and delta > 0 and request_id is not null and actor_id is not null)
    or (event_type = 'share_debit' and delta < 0 and share_id is not null)
  )
);

create index if not exists yucang_share_credit_ledger_user_created_idx
  on public.yucang_share_credit_ledger(user_id, created_at desc);

alter table public.yucang_share_credit_ledger enable row level security;
revoke all on public.yucang_share_credit_ledger from public, anon, authenticated;

create or replace function private.yucang_reject_share_credit_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'share_credit_ledger_is_immutable';
end;
$$;

drop trigger if exists yucang_share_credit_ledger_immutable
  on public.yucang_share_credit_ledger;
create trigger yucang_share_credit_ledger_immutable
before update or delete on public.yucang_share_credit_ledger
for each row execute function private.yucang_reject_share_credit_ledger_mutation();

create or replace function private.yucang_share_credit_balance(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(entry.delta), 0)::integer
  from public.yucang_share_credit_ledger entry
  where entry.user_id = p_user_id;
$$;

create or replace function private.yucang_reward_publication_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and new.was_public and new.published_at is not null then
    insert into public.yucang_share_credit_ledger(
      user_id, delta, event_type, event_key, work_id, version_id, actor_id, details
    ) values (
      new.author_id, 1, 'publication_reward', 'publication-version:' || new.id::text,
      new.work_id, new.id, new.author_id,
      jsonb_build_object('workId', new.work_id, 'versionId', new.id)
    ) on conflict (event_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists yucang_reward_publication_version on public.yucang_versions;
create trigger yucang_reward_publication_version
after insert or update of status, was_public, published_at on public.yucang_versions
for each row execute function private.yucang_reward_publication_version();

-- Reward already-public versions exactly once when the ledger is introduced.
insert into public.yucang_share_credit_ledger(
  user_id, delta, event_type, event_key, work_id, version_id, actor_id, details
)
select
  version.author_id, 1, 'publication_reward', 'publication-version:' || version.id::text,
  version.work_id, version.id, version.author_id,
  jsonb_build_object('workId', version.work_id, 'versionId', version.id, 'backfilled', true)
from public.yucang_versions version
where version.status = 'approved' and version.was_public and version.published_at is not null
on conflict (event_key) do nothing;

create or replace function public.yucang_get_share_credit_entitlement()
returns table (
  account_role text,
  share_unlimited boolean,
  daily_free_limit integer,
  daily_free_used integer,
  daily_free_remaining integer,
  permanent_credit_balance integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  is_admin boolean;
  is_paid boolean;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  is_admin := private.yucang_has_staff_role('admin', caller);
  select exists (
    select 1 from public.yucang_group_membership_periods period
    where period.user_id = caller and period.status = 'active'
      and period.starts_at <= now() and period.ends_at > now()
  ) into is_paid;

  account_role := case when is_admin then 'admin' else 'member' end;
  share_unlimited := is_admin or is_paid;
  daily_free_limit := 3;
  select coalesce(sum(shared.daily_free_charged), 0)::integer into daily_free_used
  from public.yucang_prompt_shares shared
  where shared.sender_id = caller
    and (shared.created_at at time zone 'Asia/Shanghai')::date =
        (now() at time zone 'Asia/Shanghai')::date;
  daily_free_remaining := greatest(0, daily_free_limit - daily_free_used);
  permanent_credit_balance := private.yucang_share_credit_balance(caller);
  return next;
end;
$$;

create or replace function public.yucang_list_my_share_credit_ledger(p_limit integer default 50)
returns table (
  ledger_id uuid,
  delta integer,
  event_type text,
  request_id uuid,
  work_id uuid,
  version_id uuid,
  share_id uuid,
  note text,
  details jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select entry.id, entry.delta, entry.event_type, entry.request_id,
    entry.work_id, entry.version_id, entry.share_id, entry.note,
    entry.details, entry.created_at
  from public.yucang_share_credit_ledger entry
  where auth.uid() is not null and entry.user_id = auth.uid()
  order by entry.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.yucang_admin_grant_share_credits(
  p_target_user_id uuid,
  p_amount integer,
  p_request_id uuid,
  p_note text default ''
)
returns table (
  ledger_id uuid,
  result_status text,
  target_user_id uuid,
  amount integer,
  permanent_credit_balance integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  existing public.yucang_share_credit_ledger%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if not private.yucang_has_staff_role('admin', caller) then raise exception 'admin_required'; end if;
  if p_target_user_id is null or p_request_id is null or p_amount not between 1 and 10000
    or char_length(coalesce(p_note, '')) > 200 then raise exception 'invalid_grant'; end if;
  if not exists (select 1 from auth.users account where account.id = p_target_user_id) then
    raise exception 'account_not_available';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_target_user_id::text, 927403));
  select * into existing from public.yucang_share_credit_ledger entry
  where entry.event_key = 'founder-grant:' || caller::text || ':' || p_request_id::text;
  if existing.id is not null then
    if existing.user_id <> p_target_user_id or existing.delta <> p_amount
      or existing.note <> trim(coalesce(p_note, '')) then raise exception 'idempotency_conflict'; end if;
    ledger_id := existing.id;
    result_status := 'already_granted';
  else
    insert into public.yucang_share_credit_ledger(
      user_id, delta, event_type, event_key, request_id, actor_id, note, details
    ) values (
      p_target_user_id, p_amount, 'founder_grant',
      'founder-grant:' || caller::text || ':' || p_request_id::text,
      p_request_id, caller, trim(coalesce(p_note, '')),
      jsonb_build_object('amount', p_amount)
    ) returning id into ledger_id;
    result_status := 'granted';
  end if;
  target_user_id := p_target_user_id;
  amount := p_amount;
  permanent_credit_balance := private.yucang_share_credit_balance(p_target_user_id);
  return next;
end;
$$;

create or replace function public.yucang_get_collaboration_entitlement()
returns table (
  account_role text,
  share_unlimited boolean,
  remaining_free_shares integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select entitlement.account_role, entitlement.share_unlimited,
    entitlement.daily_free_remaining
  from public.yucang_get_share_credit_entitlement() entitlement;
$$;

create or replace function public.yucang_share_prompt(
  p_request_id uuid,
  p_target_kind text,
  p_target_id uuid,
  p_title text,
  p_prompt_text text,
  p_project text default '',
  p_category text default '',
  p_content_type text default 'prompt',
  p_tags text[] default '{}',
  p_variables jsonb default '[]'::jsonb,
  p_model_name text default '',
  p_model_version text default '',
  p_parameters jsonb default '{}'::jsonb,
  p_license_code text default '',
  p_negative_prompt text default '',
  p_usage_instruction text default '',
  p_source_item_id text default ''
)
returns table (share_id uuid, result_status text, payload_hash text, remaining_free_shares integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  recipient uuid;
  target_group uuid;
  target_recipient_count integer := 1;
  canonical jsonb;
  server_hash text;
  existing public.yucang_prompt_shares%rowtype;
  paid_member boolean;
  privileged boolean;
  unlimited_sharing boolean;
  used_today integer;
  free_remaining integer;
  free_charge integer;
  permanent_charge integer;
  permanent_balance integer;
  clean_title text := trim(coalesce(p_title, ''));
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null or p_target_id is null then raise exception 'invalid_share_request'; end if;
  if p_target_kind not in ('friend', 'group') then raise exception 'invalid_share_target'; end if;
  if char_length(clean_title) < 1 or char_length(clean_title) > 200
    or char_length(coalesce(p_prompt_text, '')) < 1 or char_length(p_prompt_text) > 100000
    or jsonb_typeof(coalesce(p_variables, 'null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_parameters, 'null'::jsonb)) <> 'object'
    or cardinality(coalesce(p_tags, '{}')) > 30 then raise exception 'invalid_share_payload'; end if;

  if p_target_kind = 'friend' then
    recipient := p_target_id;
    if not exists (
      select 1 from public.yucang_friend_requests request
      where request.pair_low = least(caller, recipient)
        and request.pair_high = greatest(caller, recipient)
        and request.status = 'accepted'
    ) then raise exception 'friend_not_available'; end if;
  else
    target_group := p_target_id;
    if not exists (
      select 1 from public.yucang_groups group_row
      join public.yucang_group_members member_row on member_row.group_id = group_row.id
      where group_row.id = target_group and group_row.status = 'active'
        and member_row.user_id = caller and member_row.status = 'active'
    ) then raise exception 'group_not_available'; end if;
    select count(*)::integer into target_recipient_count
    from public.yucang_group_members member_row
    where member_row.group_id = target_group and member_row.status = 'active'
      and member_row.user_id <> caller;
    if target_recipient_count < 2 then raise exception 'group_not_available'; end if;
  end if;

  canonical := jsonb_build_object(
    'title', clean_title, 'prompt', p_prompt_text, 'project', coalesce(p_project, ''),
    'category', coalesce(p_category, ''), 'contentType', coalesce(p_content_type, 'prompt'),
    'tags', to_jsonb(coalesce(p_tags, '{}')), 'variables', coalesce(p_variables, '[]'::jsonb),
    'model', coalesce(p_model_name, ''), 'modelVersion', coalesce(p_model_version, ''),
    'parameters', coalesce(p_parameters, '{}'::jsonb), 'license', coalesce(p_license_code, ''),
    'negative', coalesce(p_negative_prompt, ''),
    'usageInstruction', coalesce(p_usage_instruction, ''),
    'sourceItemId', coalesce(p_source_item_id, '')
  );
  server_hash := encode(extensions.digest(convert_to(canonical::text, 'utf8'), 'sha256'), 'hex');

  privileged := private.yucang_has_staff_role('admin', caller);
  select exists (
    select 1 from public.yucang_group_membership_periods period
    where period.user_id = caller and period.status = 'active'
      and period.starts_at <= now() and period.ends_at > now()
  ) into paid_member;
  unlimited_sharing := privileged or paid_member;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text, 927402));
  select * into existing from public.yucang_prompt_shares
  where sender_id = caller and request_id = p_request_id for update;
  if existing.id is not null then
    if existing.target_kind <> p_target_kind
      or existing.recipient_id is distinct from recipient
      or existing.group_id is distinct from target_group
      or existing.payload_hash <> server_hash then raise exception 'idempotency_conflict'; end if;
    share_id := existing.id;
    result_status := 'already_shared';
    select coalesce(sum(shared.daily_free_charged), 0)::integer into used_today
    from public.yucang_prompt_shares shared
    where shared.sender_id = caller
      and (shared.created_at at time zone 'Asia/Shanghai')::date =
          (now() at time zone 'Asia/Shanghai')::date;
    remaining_free_shares := case when unlimited_sharing then null else greatest(0, 3 - used_today) end;
    return next;
    return;
  end if;

  select coalesce(sum(shared.daily_free_charged), 0)::integer into used_today
  from public.yucang_prompt_shares shared
  where shared.sender_id = caller
    and (shared.created_at at time zone 'Asia/Shanghai')::date =
        (now() at time zone 'Asia/Shanghai')::date;
  free_remaining := greatest(0, 3 - used_today);
  if unlimited_sharing then
    free_charge := 0;
    permanent_charge := 0;
  else
    free_charge := least(target_recipient_count, free_remaining);
    permanent_charge := target_recipient_count - free_charge;
    permanent_balance := private.yucang_share_credit_balance(caller);
    if permanent_balance < permanent_charge then raise exception 'insufficient_share_credits'; end if;
  end if;

  insert into public.yucang_prompt_shares(
    sender_id, request_id, target_kind, recipient_id, group_id,
    title, prompt_text, project, category, content_type, tags, variables,
    model_name, model_version, parameters, license_code, negative_prompt,
    usage_instruction, source_item_id, payload_hash,
    recipient_count, daily_free_charged, permanent_credits_charged
  ) values (
    caller, p_request_id, p_target_kind, recipient, target_group,
    clean_title, p_prompt_text, coalesce(p_project, ''), coalesce(p_category, ''),
    coalesce(p_content_type, 'prompt'), coalesce(p_tags, '{}'), coalesce(p_variables, '[]'::jsonb),
    coalesce(p_model_name, ''), coalesce(p_model_version, ''), coalesce(p_parameters, '{}'::jsonb),
    coalesce(p_license_code, ''), coalesce(p_negative_prompt, ''),
    coalesce(p_usage_instruction, ''), coalesce(p_source_item_id, ''), server_hash,
    target_recipient_count, free_charge, permanent_charge
  ) returning id into share_id;

  if permanent_charge > 0 then
    insert into public.yucang_share_credit_ledger(
      user_id, delta, event_type, event_key, request_id, share_id, actor_id, details
    ) values (
      caller, -permanent_charge, 'share_debit', 'share:' || share_id::text,
      p_request_id, share_id, caller,
      jsonb_build_object('recipientCount', target_recipient_count,
        'dailyFreeCharged', free_charge, 'permanentCreditsCharged', permanent_charge)
    );
  end if;
  result_status := 'shared';
  remaining_free_shares := case when unlimited_sharing then null else greatest(0, free_remaining - free_charge) end;
  return next;
end;
$$;

revoke all on function private.yucang_reject_share_credit_ledger_mutation() from public, anon, authenticated;
revoke all on function private.yucang_share_credit_balance(uuid) from public, anon, authenticated;
revoke all on function private.yucang_reward_publication_version() from public, anon, authenticated;
revoke all on function public.yucang_get_share_credit_entitlement() from public, anon;
revoke all on function public.yucang_list_my_share_credit_ledger(integer) from public, anon;
revoke all on function public.yucang_admin_grant_share_credits(uuid, integer, uuid, text) from public, anon;

grant execute on function public.yucang_get_share_credit_entitlement() to authenticated;
grant execute on function public.yucang_list_my_share_credit_ledger(integer) to authenticated;
grant execute on function public.yucang_admin_grant_share_credits(uuid, integer, uuid, text) to authenticated;

comment on table public.yucang_share_credit_ledger is
  'Immutable permanent Prompt-sharing credit ledger. Positive credits never expire; daily free allowance is stored on each share, not in this ledger.';
comment on function public.yucang_get_share_credit_entitlement() is
  'Returns server-enforced role, unlimited entitlement, daily free usage, and permanent Prompt-sharing credit balance for auth.uid().';
comment on function public.yucang_admin_grant_share_credits(uuid, integer, uuid, text) is
  'Admin-only idempotent grant of permanent Prompt-sharing credits to one exact auth user id.';
comment on function public.yucang_share_prompt(uuid, text, uuid, text, text, text, text, text, text[], jsonb, text, text, jsonb, text, text, text, text) is
  'Atomically shares one Prompt snapshot. Cost equals recipient count; daily free items are consumed first, then permanent credits. Admin and active paid members are unlimited.';

notify pgrst, 'reload schema';
