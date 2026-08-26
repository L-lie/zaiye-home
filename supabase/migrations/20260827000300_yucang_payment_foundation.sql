-- Provider-neutral payment, credit, and entitlement foundation.
-- No provider adapter or checkout is enabled by this migration.

create table if not exists public.yucang_billing_skus (
  code text primary key,
  product_kind text not null check (product_kind in ('ai_credits', 'group_membership')),
  display_name text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'CNY' check (currency = 'CNY'),
  credit_points integer check (credit_points is null or credit_points > 0),
  duration_days integer check (duration_days is null or duration_days > 0),
  entitlements jsonb not null default '{}'::jsonb check (jsonb_typeof(entitlements) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (product_kind = 'ai_credits' and credit_points is not null and duration_days is null)
    or (product_kind = 'group_membership' and credit_points is null and duration_days is not null)
  )
);

insert into public.yucang_billing_skus(
  code, product_kind, display_name, amount_cents, credit_points, duration_days, entitlements
) values
  ('ai_credits_1000', 'ai_credits', '语藏 AI 1000 点', 990, 1000, null, '{"hostedAiCredits":1000}'::jsonb),
  ('ai_credits_3200', 'ai_credits', '语藏 AI 3200 点', 2900, 3200, null, '{"hostedAiCredits":3200}'::jsonb),
  ('ai_credits_8000', 'ai_credits', '语藏 AI 8000 点', 6900, 8000, null, '{"hostedAiCredits":8000}'::jsonb),
  ('group_membership_monthly', 'group_membership', '语藏小组会员 1 个月', 600, null, 30,
    '{"groupMembership":true,"autoRenew":false}'::jsonb)
on conflict (code) do update set
  product_kind = excluded.product_kind,
  display_name = excluded.display_name,
  amount_cents = excluded.amount_cents,
  currency = excluded.currency,
  credit_points = excluded.credit_points,
  duration_days = excluded.duration_days,
  entitlements = excluded.entitlements,
  active = excluded.active,
  updated_at = now();

create table if not exists public.yucang_entitlement_policies (
  code text primary key,
  rules jsonb not null check (jsonb_typeof(rules) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.yucang_entitlement_policies(code, rules) values
  ('free_friend_group_sharing', '{"accountDailyLimit":3,"scope":"friend_and_group_total","uiImplemented":false}'::jsonb)
on conflict (code) do update set rules = excluded.rules, updated_at = now();

create table if not exists public.yucang_payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  sku_code text not null references public.yucang_billing_skus(code) on delete restrict,
  provider text not null check (length(provider) between 1 and 40),
  provider_order_id text,
  idempotency_key uuid not null,
  status text not null default 'created'
    check (status in ('created', 'pending', 'paid', 'failed', 'expired', 'refund_pending', 'refunded')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency = 'CNY'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  expired_at timestamptz,
  refunded_at timestamptz,
  unique (user_id, idempotency_key),
  unique (provider, provider_order_id)
);

create index if not exists yucang_payment_orders_user_created_idx
  on public.yucang_payment_orders(user_id, created_at desc);

create table if not exists public.yucang_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  order_id uuid not null references public.yucang_payment_orders(id) on delete restrict,
  event_type text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table if not exists public.yucang_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.yucang_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid references public.yucang_payment_orders(id) on delete restrict,
  entry_type text not null check (entry_type in ('purchase', 'usage', 'grant', 'refund', 'adjustment')),
  points_delta integer not null check (points_delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  external_key text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, external_key)
);

create unique index if not exists yucang_credit_ledger_purchase_order_idx
  on public.yucang_credit_ledger(order_id)
  where entry_type = 'purchase';

create index if not exists yucang_credit_ledger_user_created_idx
  on public.yucang_credit_ledger(user_id, created_at desc);

create table if not exists public.yucang_group_membership_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid not null unique references public.yucang_payment_orders(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null default 'active' check (status in ('active', 'expired', 'refunded')),
  created_at timestamptz not null default now()
);

create or replace function private.yucang_reject_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'credit_ledger_is_immutable';
end;
$$;

drop trigger if exists yucang_credit_ledger_immutable on public.yucang_credit_ledger;
create trigger yucang_credit_ledger_immutable
before update or delete on public.yucang_credit_ledger
for each row execute function private.yucang_reject_ledger_mutation();

create or replace function private.yucang_create_payment_order(
  p_user_id uuid,
  p_sku_code text,
  p_provider text,
  p_idempotency_key uuid
)
returns table(order_id uuid, result_status text, amount_cents integer, currency text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  sku public.yucang_billing_skus%rowtype;
  existing public.yucang_payment_orders%rowtype;
begin
  if p_user_id is null or p_idempotency_key is null or p_provider is null
    or length(p_provider) not between 1 and 40 then
    raise exception 'invalid_order_request';
  end if;
  select * into sku from public.yucang_billing_skus where code = p_sku_code and active;
  if sku.code is null then raise exception 'sku_not_available'; end if;

  select * into existing from public.yucang_payment_orders
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if existing.id is not null then
    if existing.sku_code <> p_sku_code or existing.provider <> p_provider then
      raise exception 'idempotency_conflict';
    end if;
    return query select existing.id, 'already_created'::text, existing.amount_cents, existing.currency;
    return;
  end if;

  insert into public.yucang_payment_orders(
    user_id, sku_code, provider, idempotency_key, amount_cents, currency
  ) values (
    p_user_id, sku.code, p_provider, p_idempotency_key, sku.amount_cents, sku.currency
  ) returning id into order_id;
  result_status := 'created';
  amount_cents := sku.amount_cents;
  currency := sku.currency;
  return next;
end;
$$;

create or replace function private.yucang_fulfill_verified_payment(
  p_provider text,
  p_provider_event_id text,
  p_order_id uuid,
  p_provider_order_id text,
  p_event_type text,
  p_amount_cents integer,
  p_currency text,
  p_payload_hash text
)
returns table(result_status text, order_status text, credit_balance integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_event public.yucang_payment_events%rowtype;
  target_order public.yucang_payment_orders%rowtype;
  sku public.yucang_billing_skus%rowtype;
  current_balance integer;
  membership_start timestamptz;
begin
  if p_event_type <> 'payment.succeeded' then raise exception 'unsupported_payment_event'; end if;
  if p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_payload_hash'; end if;

  select * into existing_event from public.yucang_payment_events
  where provider = p_provider and provider_event_id = p_provider_event_id;
  if existing_event.id is not null then
    if existing_event.order_id <> p_order_id or existing_event.payload_hash <> p_payload_hash then
      raise exception 'idempotency_conflict';
    end if;
    select status into order_status from public.yucang_payment_orders where id = p_order_id;
    select balance into credit_balance from public.yucang_credit_accounts
      where user_id = (select user_id from public.yucang_payment_orders where id = p_order_id);
    result_status := 'already_processed';
    return next;
    return;
  end if;

  select * into target_order from public.yucang_payment_orders where id = p_order_id for update;
  if target_order.id is null then raise exception 'order_not_found'; end if;
  if target_order.provider <> p_provider then raise exception 'provider_mismatch'; end if;
  if target_order.amount_cents <> p_amount_cents or target_order.currency <> p_currency then
    raise exception 'payment_amount_mismatch';
  end if;
  if target_order.status not in ('created', 'pending', 'paid') then raise exception 'order_not_payable'; end if;

  insert into public.yucang_payment_events(
    provider, provider_event_id, order_id, event_type, payload_hash, processing_status
  ) values (
    p_provider, p_provider_event_id, p_order_id, p_event_type, p_payload_hash, 'received'
  );

  if target_order.status <> 'paid' then
    update public.yucang_payment_orders set
      status = 'paid', provider_order_id = p_provider_order_id,
      paid_at = now(), updated_at = now()
    where id = p_order_id;

    select * into sku from public.yucang_billing_skus where code = target_order.sku_code;
    if sku.product_kind = 'ai_credits' then
      insert into public.yucang_credit_accounts(user_id, balance)
      values (target_order.user_id, 0)
      on conflict (user_id) do nothing;
      select balance into current_balance from public.yucang_credit_accounts
      where user_id = target_order.user_id for update;
      current_balance := current_balance + sku.credit_points;
      update public.yucang_credit_accounts set balance = current_balance, updated_at = now()
      where user_id = target_order.user_id;
      insert into public.yucang_credit_ledger(
        user_id, order_id, entry_type, points_delta, balance_after, external_key, details
      ) values (
        target_order.user_id, target_order.id, 'purchase', sku.credit_points,
        current_balance, 'purchase:' || target_order.id::text,
        jsonb_build_object('sku', sku.code, 'provider', p_provider)
      );
    else
      select greatest(now(), coalesce(max(ends_at), now())) into membership_start
      from public.yucang_group_membership_periods
      where user_id = target_order.user_id and status = 'active';
      insert into public.yucang_group_membership_periods(
        user_id, order_id, starts_at, ends_at
      ) values (
        target_order.user_id, target_order.id, membership_start,
        membership_start + make_interval(days => sku.duration_days)
      );
    end if;
  end if;

  update public.yucang_payment_events set processing_status = 'processed', processed_at = now()
  where provider = p_provider and provider_event_id = p_provider_event_id;
  select status into order_status from public.yucang_payment_orders where id = p_order_id;
  select balance into credit_balance from public.yucang_credit_accounts where user_id = target_order.user_id;
  result_status := 'processed';
  return next;
end;
$$;

alter table public.yucang_billing_skus enable row level security;
alter table public.yucang_entitlement_policies enable row level security;
alter table public.yucang_payment_orders enable row level security;
alter table public.yucang_payment_events enable row level security;
alter table public.yucang_credit_accounts enable row level security;
alter table public.yucang_credit_ledger enable row level security;
alter table public.yucang_group_membership_periods enable row level security;

create policy yucang_billing_skus_public_read on public.yucang_billing_skus
for select using (active);
create policy yucang_entitlement_policies_public_read on public.yucang_entitlement_policies
for select using (true);
create policy yucang_payment_orders_owner_read on public.yucang_payment_orders
for select to authenticated using (user_id = auth.uid());
create policy yucang_credit_accounts_owner_read on public.yucang_credit_accounts
for select to authenticated using (user_id = auth.uid());
create policy yucang_credit_ledger_owner_read on public.yucang_credit_ledger
for select to authenticated using (user_id = auth.uid());
create policy yucang_group_memberships_owner_read on public.yucang_group_membership_periods
for select to authenticated using (user_id = auth.uid());

revoke all on public.yucang_billing_skus, public.yucang_entitlement_policies,
  public.yucang_payment_orders, public.yucang_payment_events,
  public.yucang_credit_accounts, public.yucang_credit_ledger,
  public.yucang_group_membership_periods from public, anon, authenticated;
grant select on public.yucang_billing_skus, public.yucang_entitlement_policies to anon, authenticated;
grant select on public.yucang_payment_orders, public.yucang_credit_accounts,
  public.yucang_credit_ledger, public.yucang_group_membership_periods to authenticated;

revoke all on function private.yucang_create_payment_order(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function private.yucang_fulfill_verified_payment(text, text, uuid, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function private.yucang_reject_ledger_mutation() from public, anon, authenticated;
grant execute on function private.yucang_create_payment_order(uuid, text, text, uuid) to service_role;
grant execute on function private.yucang_fulfill_verified_payment(text, text, uuid, text, text, integer, text, text) to service_role;

comment on table public.yucang_credit_ledger is
  'Append-only AI credit ledger. Updates and deletes are rejected; paid webhooks append through a service-only transaction.';
comment on table public.yucang_entitlement_policies is
  'Data-contract reservation only. Collaboration UI and enforcement are not implemented by this migration.';
comment on function private.yucang_fulfill_verified_payment(text, text, uuid, text, text, integer, text, text) is
  'Accepts only an event already authenticated by a future provider adapter; atomically records and fulfills it once.';

notify pgrst, 'reload schema';
