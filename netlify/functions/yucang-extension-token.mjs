import { proxySupabaseEdge } from "./_proxy-supabase-edge.mjs";

export default proxySupabaseEdge("yucang-extension-token");

export const config = { path: "/api/auth/extension/token" };
