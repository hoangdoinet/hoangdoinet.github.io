/* sw.js — PWA offline cho TÍNH CÂN LÚA */
const APP_CACHE = "can-lua-v1.0.0";         // 🟢 bump khi phát hành phiên bản mới
const RUNTIME_CACHE = "can-lua-runtime-v1";
const ROOT = "/can-lua";

/* ============ Danh sách cần precache ngay khi cài ============ */
const PRECACHE_ASSETS = [
  `${ROOT}/`,
  `${ROOT}/index.html`,
  `${ROOT}/offline.html`,
  `${ROOT}/changelog.html`,
  `${ROOT}/manifest.webmanifest`,
  `${ROOT}/version.json`,
  // Icons
  `${ROOT}/icons/icon-32.png`,
  `${ROOT}/icons/icon-192.png`,
  `${ROOT}/icons/icon-512.png`,
  `${ROOT}/icons/apple-icon-180.png`,
  `${ROOT}/icons/apple-icon-152.png`,
];

/* ============ INSTALL ============ */
self.addEventListener("install", (event) => {
  // Kích hoạt bản SW mới ngay
  self.skipWaiting();
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(APP_CACHE);
      // cache fresh (cache:'reload') để tránh dính bản cũ từ HTTP cache
      await cache.addAll(PRECACHE_ASSETS.map(u => new Request(u, { cache: "reload" })));
    } catch (e) {
      // im lặng: một số file có thể 404 trong dev
      console.warn("[SW] Precache error:", e);
    }
  })());
});

/* ============ ACTIVATE ============ */
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Bật navigation preload nếu trình duyệt hỗ trợ
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (_) {}
    }
    // Xóa cache cũ
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== APP_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* ============ Helpers ============ */
const isSameOrigin = (url) => url.origin === self.location.origin;
const isHTML = (req) => req.headers.get("accept")?.includes("text/html");

/* Network-first cho version.json để kiểm tra cập nhật tốt hơn */
async function handleVersionJSON(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const fresh = await fetch(req, { cache: "no-store" });
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response(JSON.stringify({ version: "offline", notes: [] }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}

/* Stale-while-revalidate cho tệp tĩnh */
async function handleStatic(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);

  // Trả cache trước, song song cập nhật
  return cached || networkPromise || new Response("", { status: 504 });
}

/* ============ FETCH ============ */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Điều hướng (SPA) → trả index.html từ cache, nếu lỗi dùng offline.html
  if (req.mode === "navigate" || (req.method === "GET" && isHTML(req))) {
    event.respondWith((async () => {
      const appCache = await caches.open(APP_CACHE);

      // 1) Dùng navigation preload nếu có
      const preload = await event.preloadResponse;
      if (preload) return preload;

      // 2) Cache-first cho index.html
      const cachedIndex = await appCache.match(`${ROOT}/index.html`);
      if (cachedIndex) return cachedIndex;

      // 3) Thử mạng lấy index.html (không lưu vào HTTP cache)
      try {
        const fresh = await fetch(`${ROOT}/index.html`, { cache: "no-store" });
        if (fresh && fresh.ok) appCache.put(`${ROOT}/index.html`, fresh.clone());
        return fresh;
      } catch {
        // 4) Fallback offline
        const offline = await appCache.match(`${ROOT}/offline.html`);
        return offline || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  // Phiên bản/metadata: version.json → network-first
  if (isSameOrigin(url) && url.pathname === `${ROOT}/version.json`) {
    event.respondWith(handleVersionJSON(req));
    return;
  }

  // Tài nguyên tĩnh cùng origin → stale-while-revalidate
  if (isSameOrigin(url) && req.method === "GET") {
    event.respondWith(handleStatic(req));
    return;
  }

  // Mặc định: để trình duyệt tự xử lý (CORS/cross-origin…)
});

/* ============ MESSAGE: cập nhật & reload ============ */
self.addEventListener("message", (event) => {
  if (event?.data?.type === "CHECK_UPDATE_AND_RELOAD") {
    (async () => {
      try {
        await self.skipWaiting();
        const clis = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const c of clis) c.navigate(c.url);
      } catch (e) {
        console.error("[SW] reload failed:", e);
      }
    })();
  }
});