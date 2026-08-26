export const YUCANG_PAYMENT_ORIGIN = "https://zaiye.art";
export const PAYMENT_SKUS = Object.freeze({
  ai_credits_1000: { amountCents: 990, currency: "CNY", kind: "ai_credits", points: 1000 },
  ai_credits_3200: { amountCents: 2900, currency: "CNY", kind: "ai_credits", points: 3200 },
  ai_credits_8000: { amountCents: 6900, currency: "CNY", kind: "ai_credits", points: 8000 },
  group_membership_monthly: { amountCents: 600, currency: "CNY", kind: "group_membership", durationDays: 30 },
} as const);

export class PaymentError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new PaymentError(422, "invalid_request", "Request contains unsupported fields.");
  }
}

export function paymentCors(request: Request) {
  const origin = request.headers.get("origin") || "";
  if (origin !== YUCANG_PAYMENT_ORIGIN) throw new PaymentError(403, "origin_not_allowed", "Request origin is not allowed.");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function bearerToken(request: Request) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") || "");
  if (!match) throw new PaymentError(401, "authentication_required", "A signed-in website session is required.");
  return match[1];
}

export function validateCreateOrderBody(value: unknown) {
  if (!object(value)) throw new PaymentError(400, "invalid_request", "A JSON object is required.");
  exactKeys(value, ["sku", "idempotencyKey"]);
  if (typeof value.sku !== "string" || !(value.sku in PAYMENT_SKUS)) {
    throw new PaymentError(422, "sku_not_available", "SKU is not available.");
  }
  if (typeof value.idempotencyKey !== "string" || !UUID.test(value.idempotencyKey)) {
    throw new PaymentError(422, "invalid_idempotency_key", "idempotencyKey must be a UUID.");
  }
  return { sku: value.sku as keyof typeof PAYMENT_SKUS, idempotencyKey: value.idempotencyKey };
}

export function validateOrderQueryBody(value: unknown) {
  if (!object(value)) throw new PaymentError(400, "invalid_request", "A JSON object is required.");
  exactKeys(value, ["orderId"]);
  if (typeof value.orderId !== "string" || !UUID.test(value.orderId)) {
    throw new PaymentError(422, "invalid_order_id", "orderId must be a UUID.");
  }
  return { orderId: value.orderId };
}

// This validates only a normalized event produced after a provider-specific
// signature verifier. It must never be used directly on an untrusted webhook body.
export function validateVerifiedPaymentEvent(value: unknown) {
  if (!object(value)) throw new PaymentError(400, "invalid_event", "A verified payment event is required.");
  exactKeys(value, ["provider", "providerEventId", "orderId", "providerOrderId", "eventType", "amountCents", "currency", "payloadHash"]);
  if (value.eventType !== "payment.succeeded") throw new PaymentError(422, "unsupported_payment_event", "Payment event is not supported.");
  if (typeof value.provider !== "string" || !/^[a-z0-9_-]{1,40}$/.test(value.provider)) throw new PaymentError(422, "invalid_event", "provider is invalid.");
  if (typeof value.providerEventId !== "string" || !value.providerEventId || value.providerEventId.length > 160) throw new PaymentError(422, "invalid_event", "providerEventId is invalid.");
  if (typeof value.providerOrderId !== "string" || !value.providerOrderId || value.providerOrderId.length > 160) throw new PaymentError(422, "invalid_event", "providerOrderId is invalid.");
  if (typeof value.orderId !== "string" || !UUID.test(value.orderId)) throw new PaymentError(422, "invalid_event", "orderId is invalid.");
  if (!Number.isSafeInteger(value.amountCents) || Number(value.amountCents) <= 0) throw new PaymentError(422, "invalid_event", "amountCents is invalid.");
  if (value.currency !== "CNY") throw new PaymentError(422, "invalid_event", "currency is invalid.");
  if (typeof value.payloadHash !== "string" || !HASH.test(value.payloadHash)) throw new PaymentError(422, "invalid_event", "payloadHash is invalid.");
  return value;
}

export function configuredProvider() {
  const provider = Deno.env.get("YUCANG_PAYMENT_PROVIDER") || "";
  if (!provider) throw new PaymentError(503, "provider_not_configured", "Payment is not open yet.");
  throw new PaymentError(503, "provider_adapter_not_implemented", "The configured payment provider adapter is not implemented.");
}

export function paymentJson(status: number, body: Record<string, unknown>, headers: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
