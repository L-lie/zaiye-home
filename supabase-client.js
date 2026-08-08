(function initializeZaiyeSupabase(global) {
  const config = global.ZAIYE_SUPABASE_CONFIG || {};
  const isConfigured = Boolean(
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url || "")
      && /^sb_publishable_/i.test(config.publishableKey || ""),
  );
  let client = null;

  function getClient() {
    if (!isConfigured) return null;
    if (!global.supabase?.createClient) {
      throw new Error("Supabase 浏览器客户端没有加载");
    }
    if (!client) {
      client = global.supabase.createClient(config.url, config.publishableKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
    }
    return client;
  }

  global.ZaiyeSupabase = Object.freeze({
    config,
    isConfigured,
    getClient,
  });
})(window);
