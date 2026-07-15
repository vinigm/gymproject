// Estratégia: network-first com fallback pra cache.
// Em conexões normais, sempre busca a versão mais recente.
// Só recorre ao cache se a rede falhar (offline).
// Isso evita ficar "preso" em uma versão antiga após deploy.
const CACHE = "habitos-shell-v24";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Nunca interferir com o Firebase
  if (url.hostname.includes("googleapis.com") ||
      url.hostname.includes("firebaseio.com") ||
      url.hostname.includes("gstatic.com")) {
    return;
  }

  if (e.request.method !== "GET") return;

  // Network-first com fallback offline
  e.respondWith(
    fetch(e.request, { cache: "no-store" })
      .then(resp => {
        // copia pro cache em background pra usar offline depois
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
