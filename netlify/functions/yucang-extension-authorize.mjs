import { proxySupabaseEdge } from "./_proxy-supabase-edge.mjs";

export default proxySupabaseEdge("yucang-extension-authorize");

export const config = { path: "/api/auth/extension/authorize" };
