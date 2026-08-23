(function initializePortfolioPublication(global) {
  const CACHE_KEY = "zaiye-portfolio-publication-v2";
  const EDITOR_PREVIEW_KEY = "zaiye-portfolio-editor-preview-v1";
  const CACHE_MAX_AGE = 5 * 60 * 1000;

  function normalizeContent(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (!Array.isArray(value.items) || !Array.isArray(value.projects)) return null;
    return {
      version: 1,
      projects: value.projects,
      items: value.items,
      pageElements: value.pageElements && typeof value.pageElements === "object" && !Array.isArray(value.pageElements)
        ? value.pageElements
        : {},
      media: value.media && typeof value.media === "object" && !Array.isArray(value.media)
        ? value.media
        : {},
    };
  }

  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY));
      const content = normalizeContent(value?.content);
      if (!content) return null;
      return { ...value, content };
    } catch {
      return null;
    }
  }

  function writeCache(publication) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        revision: publication.revision,
        cachedAt: Date.now(),
        content: publication.content,
      }));
    } catch {
      // Storage can be unavailable in private browsing; the live response still works.
    }
  }

  async function fetchPublication() {
    const client = global.ZaiyeSupabase?.getClient();
    if (!client) return null;
    const result = await client
      .from("portfolio_publications")
      .select("content, revision")
      .eq("id", "main")
      .maybeSingle();
    if (result.error) throw result.error;
    const content = normalizeContent(result.data?.content);
    if (!content) return null;
    const publication = { content, revision: result.data.revision || 0 };
    writeCache(publication);
    return publication;
  }

  async function fetchStatic(indexUrl, mediaUrl, projectsUrl) {
    const [indexResponse, mediaResponse, projectsResponse] = await Promise.all([
      fetch(indexUrl),
      fetch(mediaUrl),
      projectsUrl ? fetch(projectsUrl) : Promise.resolve(null),
    ]);
    if (!indexResponse.ok) throw new Error("作品索引读取失败");
    const items = await indexResponse.json();
    const mediaDocument = mediaResponse.ok ? await mediaResponse.json() : { items: {} };
    const projectDocument = projectsResponse?.ok ? await projectsResponse.json() : { items: [] };
    return {
      source: "static",
      revision: 0,
      content: {
        version: 1,
        projects: Array.isArray(projectDocument.items) ? projectDocument.items : [],
        pageElements: projectDocument.pageElements && typeof projectDocument.pageElements === "object" && !Array.isArray(projectDocument.pageElements)
          ? projectDocument.pageElements
          : {},
        items,
        media: mediaDocument.items || {},
      },
    };
  }

  async function load(indexUrl, mediaUrl, projectsUrl) {
    if (/(?:^|[?&])editor=1(?:&|$)/.test(global.location?.search || "")) {
      try {
        const content = normalizeContent(JSON.parse(localStorage.getItem(EDITOR_PREVIEW_KEY))?.content);
        if (content) return { source: "editor", revision: 0, content };
      } catch {
        // A malformed local preview falls back to the published static content.
      }
    }
    if (!global.ZaiyeSupabase?.isConfigured) return fetchStatic(indexUrl, mediaUrl, projectsUrl);
    const cached = readCache();
    if (cached && Date.now() - cached.cachedAt < CACHE_MAX_AGE) {
      fetchPublication().catch(() => {});
      return { source: "cache", revision: cached.revision, content: cached.content };
    }
    try {
      const publication = await fetchPublication();
      if (publication) return { source: "supabase", ...publication };
    } catch {
      if (cached) return { source: "cache", revision: cached.revision, content: cached.content };
    }
    return fetchStatic(indexUrl, mediaUrl, projectsUrl);
  }

  global.PortfolioPublication = Object.freeze({ load });
})(window);
