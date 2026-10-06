const CACHE = "maths-quest-everyone-v28";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./adventure.js",
  "./adventure.css",
  "./cloud-config.js",
  "./cloud.js",
  "./vendor/supabase.js",
  "./manifest.webmanifest",
  "./assets/avatars/fox.png",
  "./assets/avatars/panda.png",
  "./assets/avatars/cat.png",
  "./assets/avatars/dog.png",
  "./assets/avatars/unicorn.png",
  "./assets/avatars/owl.png",
  "./assets/avatars/turtle.png",
  "./assets/avatars/shark.png",
  "./assets/avatars/badger.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Auth/API responses and private photos must never enter the app-shell cache.
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has("code") || url.searchParams.has("error")) return;
  const assets = new Set(APP_SHELL.map(path => new URL(path, self.location.href).pathname));
  if (!assets.has(url.pathname)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fresh = fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
