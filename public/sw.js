const CACHE_NAME = "bhw-pwa-shell-v10";
const APP_SHELL = [
  "/offline.html",
  "/offline.js",
  "/worker-offline-store.js",
  "/records-ui.css",
  "/offline-ui.css",
  "/online-required.html",
  "/manifest.webmanifest",
  "/favicon-bhw.png",
  "/icons/bhw-records-192.png",
  "/icons/bhw-records-512.png",
  "/icons/bhw-records-maskable-512.png",
  "/icons/bhw-records-apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("bhw-pwa-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache authenticated pages or API responses containing child records.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    const workerPage = url.pathname === "/" || url.pathname.startsWith("/records/") || url.pathname === "/offline.html";
    const fallback = async () => (await caches.match(workerPage ? "/offline.html" : "/online-required.html")) || Response.error();
    event.respondWith(
      fetch(request).then((response) => response.status >= 500 ? fallback() : response).catch(fallback),
    );
    return;
  }

  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
