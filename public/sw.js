// Basit servis çalışanı: uygulama kabuğu önbelleğe alınır; veri ağ-öncelikli, ağ yoksa son başarılı kopya.
const SHELL = "kabuk-v1";
const DATA = "veri-v1";
const FILES = ["./", "index.html", "styles.css", "app.js", "js/lib.js", "manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![SHELL, DATA].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.includes("/data/")) {
    e.respondWith(networkFirstData(req));
    return;
  }
  // Kabuk ve CDN kütüphaneleri: önbellek-öncelikli, arkada tazele
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") caches.open(SHELL).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});

async function networkFirstData(req) {
  const cache = await caches.open(DATA);
  try {
    const res = await fetch(req);
    if (!res.ok) throw new Error("HTTP " + res.status);
    cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (!hit) throw err;
    const headers = new Headers(hit.headers);
    headers.set("X-From-Cache", "1");
    return new Response(await hit.blob(), { status: 200, headers });
  }
}
