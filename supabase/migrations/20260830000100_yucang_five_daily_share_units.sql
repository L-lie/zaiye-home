-- Raise the ordinary account daily friend/group sharing allowance from three to five.

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
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  is_admin := private.yucang_has_staff_role('admin', caller);

  account_role := case when is_admin then 'admin' else 'member' end;
  share_unlimited := is_admin;
  daily_free_limit := 5;
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
  p_source_item_id text default '',
  p_image text default '',
  p_examples jsonb default '[]'::jsonb,
  p_references jsonb default '[]'::jsonb
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
  share_charge_units integer := 1;
  canonical jsonb;
  server_hash text;
  existing public.yucang_prompt_shares%rowtype;
  privileged boolean;
  used_today integer;
  free_remaining integer;
  free_charge integer;
  permanent_charge integer;
  permanent_balance integer;
  clean_title text := trim(coalesce(p_title, ''));
  clean_image text := coalesce(p_image, '');
  clean_examples jsonb := coalesce(p_examples, '[]'::jsonb);
  clean_references jsonb := coalesce(p_references, '[]'::jsonb);
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null or p_target_id is null then raise exception 'invalid_share_request'; end if;
  if p_target_kind not in ('friend', 'group') then raise exception 'invalid_share_target'; end if;
  if char_length(clean_title) < 1 or char_length(clean_title) > 200
    or char_length(coalesce(p_prompt_text, '')) < 1 or char_length(p_prompt_text) > 100000
    or jsonb_typeof(coalesce(p_variables, 'null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_parameters, 'null'::jsonb)) <> 'object'
    or cardinality(coalesce(p_tags, '{}')) > 30
    or not private.yucang_share_image_is_safe(clean_image)
    or not private.yucang_share_image_array_is_safe(clean_examples)
    or not private.yucang_share_image_array_is_safe(clean_references)
  then raise exception 'invalid_share_payload'; end if;

  if (case when clean_image = '' then 0 else 1 end)
      + jsonb_array_length(clean_examples) + jsonb_array_length(clean_references) > 4
    or private.yucang_share_media_size(clean_image, clean_examples, clean_references) > 14 * 1024 * 1024
  then raise exception 'invalid_share_payload'; end if;

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
    'negative', coalesce(p_negative_prompt, ''), 'usageInstruction', coalesce(p_usage_instruction, ''),
    'sourceItemId', coalesce(p_source_item_id, ''), 'image', clean_image,
    'examples', clean_examples, 'references', clean_references
  );
  server_hash := encode(extensions.digest(convert_to(canonical::text, 'utf8'), 'sha256'), 'hex');

  privileged := private.yucang_has_staff_role('admin', caller);

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text, 927402));
  select * into existing from public.yucang_prompt_shares
  where sender_id = caller and request_id = p_request_id for update;
  if existing.id is not null then
    if existing.target_kind <> p_target_kind or existing.recipient_id is distinct from recipient
      or existing.group_id is distinct from target_group or existing.payload_hash <> server_hash
    then raise exception 'idempotency_conflict'; end if;
    share_id := existing.id;
    result_status := 'already_shared';
    select coalesce(sum(shared.daily_free_charged), 0)::integer into used_today
    from public.yucang_prompt_shares shared where shared.sender_id = caller
      and (shared.created_at at time zone 'Asia/Shanghai')::date =
          (now() at time zone 'Asia/Shanghai')::date;
    remaining_free_shares := case when privileged then null else greatest(0, 5 - used_today) end;
    return next;
    return;
  end if;

  select coalesce(sum(shared.daily_free_charged), 0)::integer into used_today
  from public.yucang_prompt_shares shared where shared.sender_id = caller
    and (shared.created_at at time zone 'Asia/Shanghai')::date =
        (now() at time zone 'Asia/Shanghai')::date;
  free_remaining := greatest(0, 5 - used_today);
  if privileged then
    free_charge := 0;
    permanent_charge := 0;
  else
    free_charge := least(share_charge_units, free_remaining);
    permanent_charge := share_charge_units - free_charge;
    permanent_balance := private.yucang_share_credit_balance(caller);
    if permanent_balance < permanent_charge then raise exception 'insufficient_share_credits'; end if;
  end if;

  insert into public.yucang_prompt_shares(
    sender_id, request_id, target_kind, recipient_id, group_id, title, prompt_text,
    project, category, content_type, tags, variables, model_name, model_version,
    parameters, license_code, negative_prompt, usage_instruction, source_item_id,
    image, examples, reference_images, payload_hash, recipient_count, charge_units,
    daily_free_charged, permanent_credits_charged
  ) values (
    caller, p_request_id, p_target_kind, recipient, target_group, clean_title, p_prompt_text,
    coalesce(p_project, ''), coalesce(p_category, ''), coalesce(p_content_type, 'prompt'),
    coalesce(p_tags, '{}'), coalesce(p_variables, '[]'::jsonb), coalesce(p_model_name, ''),
    coalesce(p_model_version, ''), coalesce(p_parameters, '{}'::jsonb), coalesce(p_license_code, ''),
    coalesce(p_negative_prompt, ''), coalesce(p_usage_instruction, ''), coalesce(p_source_item_id, ''),
    clean_image, clean_examples, clean_references, server_hash,
    target_recipient_count, share_charge_units, free_charge, permanent_charge
  ) returning id into share_id;

  if permanent_charge > 0 then
    insert into public.yucang_share_credit_ledger(
      user_id, delta, event_type, event_key, request_id, share_id, actor_id, details
    ) values (
      caller, -permanent_charge, 'share_debit', 'share:' || share_id::text,
      p_request_id, share_id, caller,
      jsonb_build_object('recipientCount', target_recipient_count, 'chargeUnits', share_charge_units,
        'dailyFreeCharged', free_charge, 'permanentCreditsCharged', permanent_charge)
    );
  end if;
  result_status := 'shared';
  remaining_free_shares := case when privileged then null else greatest(0, free_remaining - free_charge) end;
  return next;
end;
$$;
comment on function public.yucang_get_share_credit_entitlement() is
  'Returns five daily share units plus durable publication/founder credits; only admins are unlimited.';
