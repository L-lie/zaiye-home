import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import {
  bearerToken,
  configuredProvider,
  PaymentError,
  paymentCors,
  paymentJson,
  validateCreateOrderBody,
} from "../_shared/yucang-payment-contract.ts";

Deno.serve(async (request) => {
  let headers: HeadersInit = {};
  try {
    headers = paymentCors(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") throw new PaymentError(405, "method_not_allowed", "POST is required.");
    const token = bearerToken(request);
    const input = validateCreateOrderBody(await request.json());
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) throw new PaymentError(401, "invalid_session", "The website session is invalid or expired.");

    // Deliberately stops before order creation until a signature-verifying
    // provider adapter is implemented and configured.
    configuredProvider();
    return paymentJson(500, { ok: false, error: "unreachable", sku: input.sku }, headers);
  } catch (error) {
    const item = error instanceof PaymentError ? error : new PaymentError(400, "invalid_request", "Unable to create payment order.");
    return paymentJson(item.status, { ok: false, error: item.code, message: item.message }, headers);
  }
});
