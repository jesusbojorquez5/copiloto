/* Copiloto service worker.
   HTML = red primero (siempre trae la versión nueva si hay internet, cae a caché sin red).
   Assets versionados = caché primero (rápido). Así el ícono guardado se actualiza solo. */
const CACHE = "copiloto-v6";
const SHELL = [
  "./",
  "index.html",
  "style.css?v=6",
  "app.js?v=6",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // mapa/clima/YouTube van directo a la red

  const isDoc = e.request.mode === "navigate" || e.request.destination === "document";
  if (isDoc) {
    // Red primero para el HTML: garantiza la última versión.
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then((h) => h || caches.match("index.html")))
    );
    return;
  }

  // Resto (assets versionados): caché primero, con respaldo de red.
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit ||
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("index.html"))
    )
  );
});
