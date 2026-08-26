import {
  configuredProvider,
  PaymentError,
  paymentJson,
} from "../_shared/yucang-payment-contract.ts";

Deno.serve((request) => {
  try {
    if (request.method !== "POST") throw new PaymentError(405, "method_not_allowed", "POST is required.");
    if (Number(request.headers.get("content-length") || 0) > 262_144) {
      throw new PaymentError(413, "payload_too_large", "Webhook payload is too large.");
    }
    // A future provider adapter must verify the provider signature and decrypt
    // the payload before it may call the service-only fulfillment RPC.
    configuredProvider();
    return paymentJson(500, { ok: false, error: "unreachable" });
  } catch (error) {
    const item = error instanceof PaymentError ? error : new PaymentError(400, "invalid_webhook", "Unable to process payment webhook.");
    return paymentJson(item.status, { ok: false, error: item.code, message: item.message });
  }
});
