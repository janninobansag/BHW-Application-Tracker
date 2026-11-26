import { workerRoute } from "/offline-routing.js";
const CACHE_NAME = "bhw-pwa-shell-v34";
const APP_SHELL = [
  "/offline.html",
  "/offline.js",
  "/worker-offline-store.js",
  "/offline-routing.js",
  "/offline-workspace.js",
  "/offline-households.js",
  "/household-options.js",
  "/height-conversion.js",
  "/numeric-field.js",
  "/household-summary.js",
  "/child-name.js",
  "/dashboard-ui.css",
  "/page-skeleton.css",
  "/records-ui.css",
  "/civic-workspace.css",
  "/offline-ui.css",
  "/timbang-ui.css",
  "/household-ui.css",
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
    const workerPage = !!workerRoute(url);
    const fallback = async () => {
      return (await caches.match(workerPage ? "/offline.html" : "/online-required.html")) || Response.error();
    };
    event.respondWith(
      fetch(request).then((response) => response.status >= 500 ? fallback() : response).catch(fallback),
    );
    return;
  }

  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
