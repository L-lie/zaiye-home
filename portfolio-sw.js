const CACHE_NAME = "zaiye-site-images-v2";
const GENERATED_IMAGE_PATH = "/assets/portfolio/generated/";
const CACHED_IMAGE_PATHS = new Set([
  "/assets/prompt-vault-desktop.webp",
  "/assets/prompt-vault-mobile.webp",
]);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => (
          key.startsWith("zaiye-portfolio-images-")
          || key.startsWith("zaiye-site-images-")
        ) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET"
    || url.origin !== self.location.origin
    || (
      !url.pathname.includes(GENERATED_IMAGE_PATH)
      && !CACHED_IMAGE_PATHS.has(url.pathname)
    )
  ) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        try {
          await cache.put(request, response.clone());
        } catch {
          // A full or unavailable cache must never block the image response.
        }
      }
      return response;
    }),
  );
});
