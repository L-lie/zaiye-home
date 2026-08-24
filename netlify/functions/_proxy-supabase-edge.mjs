const EDGE_BASE = "https://zbcdmtjmqpwtevjaewtl.supabase.co/functions/v1";

export function proxySupabaseEdge(functionName) {
  return async (request) => {
    const upstream = await fetch(`${EDGE_BASE}/${functionName}`, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
      duplex: "half",
    });
    const headers = new Headers(upstream.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    return new Response(upstream.body, { status: upstream.status, headers });
  };
}
