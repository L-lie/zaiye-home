if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("portfolio-sw.js?v=20260802d").catch(() => {});
}
