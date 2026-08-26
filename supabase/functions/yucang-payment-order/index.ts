import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import {
  bearerToken,
  PaymentError,
  paymentCors,
  paymentJson,
  validateOrderQueryBody,
} from "../_shared/yucang-payment-contract.ts";

Deno.serve(async (request) => {
  let headers: HeadersInit = {};
  try {
    headers = paymentCors(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") throw new PaymentError(405, "method_not_allowed", "POST is required.");
    const token = bearerToken(request);
    const input = validateOrderQueryBody(await request.json());
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) throw new PaymentError(401, "invalid_session", "The website session is invalid or expired.");
    const { data, error } = await client
      .from("yucang_payment_orders")
      .select("id,sku_code,status,amount_cents,currency,created_at,paid_at,expired_at,refunded_at")
      .eq("id", input.orderId)
      .maybeSingle();
    if (error) throw new PaymentError(500, "order_query_failed", "Unable to read payment order.");
    if (!data) throw new PaymentError(404, "order_not_found", "Payment order was not found.");
    return paymentJson(200, { ok: true, order: data }, headers);
  } catch (error) {
    const item = error instanceof PaymentError ? error : new PaymentError(400, "invalid_request", "Unable to read payment order.");
    return paymentJson(item.status, { ok: false, error: item.code, message: item.message }, headers);
  }
});
