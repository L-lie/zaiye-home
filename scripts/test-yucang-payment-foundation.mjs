import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const migration = read("supabase/migrations/20260827000300_yucang_payment_foundation.sql");
const contract = read("supabase/functions/_shared/yucang-payment-contract.ts");
const createOrder = read("supabase/functions/yucang-create-payment-order/index.ts");
const webhook = read("supabase/functions/yucang-payment-webhook/index.ts");
const orderQuery = read("supabase/functions/yucang-payment-order/index.ts");
const contractModule = await import("../supabase/functions/_shared/yucang-payment-contract.ts");

for (const [sku, price, points] of [
  ["ai_credits_1000", "990", "1000"],
  ["ai_credits_3200", "2900", "3200"],
  ["ai_credits_8000", "6900", "8000"],
]) {
  assert.match(migration, new RegExp(`'${sku}'.*${price}.*${points}`), `${sku} must be server-priced`);
  assert.match(contract, new RegExp(`${sku}: \\{ amountCents: ${price}.*points: ${points}`), `${sku} contract must match SQL`);
}
assert.match(migration, /'group_membership_monthly'.*600.*null, 30/s, "group membership must be CNY 6 for 30 days");
assert.doesNotMatch(migration, /cloud[_ -]?storage/i, "cloud storage must not be sold");
assert.match(migration, /accountDailyLimit"\s*:\s*3/, "free friend and group sharing limit must be reserved");
assert.match(migration, /uiImplemented"\s*:\s*false/, "collaboration UI must remain unimplemented");

assert.match(migration, /unique \(user_id, idempotency_key\)/, "order creation must be idempotent per user");
assert.match(migration, /unique \(provider, provider_event_id\)/, "provider events must be idempotent");
assert.match(migration, /credit_ledger_is_immutable/, "credit ledger mutations must be rejected");
assert.match(migration, /before update or delete on public\.yucang_credit_ledger/, "immutable trigger must cover update and delete");
assert.match(migration, /for update/, "fulfillment must lock mutable account/order state");
assert.match(migration, /grant execute on function private\.yucang_fulfill_verified_payment.*service_role/s, "fulfillment must be service-only");
assert.doesNotMatch(migration, /grant (insert|update|delete).*authenticated/i, "clients must not write billing state");

assert.match(createOrder, /configuredProvider\(\)/, "checkout must stop when provider is not configured");
assert.doesNotMatch(createOrder, /status:\s*["']paid["']|\.insert\(/, "checkout must never fake a paid order");
assert.match(webhook, /provider adapter must verify the provider signature/i, "webhook must require provider-specific signature verification");
assert.match(webhook, /configuredProvider\(\)/, "unconfigured webhook must remain disabled");
assert.match(contract, /provider_not_configured/, "disabled provider must have a stable error");
assert.match(contract, /validateVerifiedPaymentEvent/, "normalized verified-event contract must exist");
assert.match(orderQuery, /\.eq\("id", input\.orderId\)/, "order query must request only one order");
assert.match(orderQuery, /Bearer \$\{token\}/, "order query must use the user's JWT so RLS enforces ownership");

const requestId = "123e4567-e89b-42d3-a456-426614174000";
assert.deepEqual(
  contractModule.validateCreateOrderBody({ sku: "ai_credits_1000", idempotencyKey: requestId }),
  { sku: "ai_credits_1000", idempotencyKey: requestId },
  "valid allowlisted SKU must pass",
);
assert.throws(
  () => contractModule.validateCreateOrderBody({ sku: "cloud_storage", idempotencyKey: requestId }),
  (error) => error?.code === "sku_not_available",
  "cloud storage must be rejected",
);
assert.throws(
  () => contractModule.validateCreateOrderBody({ sku: "ai_credits_1000", idempotencyKey: requestId, amountCents: 1 }),
  (error) => error?.code === "invalid_request",
  "client-controlled price fields must be rejected",
);
assert.equal(
  contractModule.validateVerifiedPaymentEvent({
    provider: "wechat_native",
    providerEventId: "event-1",
    orderId: requestId,
    providerOrderId: "wechat-order-1",
    eventType: "payment.succeeded",
    amountCents: 990,
    currency: "CNY",
    payloadHash: "a".repeat(64),
  }).amountCents,
  990,
  "verified normalized event must preserve the server-checked amount",
);

console.log("Yucang payment foundation contract tests passed.");
