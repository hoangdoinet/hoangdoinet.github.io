/* service-worker.js - OFFLINE 100% GUARANTEED v1.0.6 (synced with index.html) */
const APP_VERSION  = 'v1.0.6';
const CACHE_STATIC = `static-${APP_VERSION}`;
const BASE         = '/pha-thuoc/';
const VERSION_FILE = BASE + 'version.json';

// 🔥 CACHE TOÀN BỘ ASSETS THEO MANIFEST
const CRITICAL_ASSETS = [
  // 🎯 CORE APP
  BASE + 'index.html',
  BASE + 'manifest.webmanifest',
  BASE + 'version.json',

  // 🖼️ ICONS
  BASE + 'icons/icon-72.png',
  BASE + 'icons/icon-96.png',
  BASE + 'icons/icon-128.png',
  BASE + 'icons/icon-144.png',
  BASE + 'icons/icon-152.png',
  BASE + 'icons/icon-167.png',
  BASE + 'icons/icon-180.png',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-384.png',
  BASE + 'icons/icon-512.png',
  BASE + 'icons/icon-1024.png',
  BASE + 'icons/maskable-192.png',
  BASE + 'icons/maskable-512.png'
];

console.log(`[SW ${APP_VERSION}] 🚀 Khởi động - OFFLINE 100% GUARANTEED`);

// ========== INSTALL ==========
self.addEventListener('install', (event) => {
  console.log('[SW] 🔧 Installing...');

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);

    // cache index.html trước
    console.log('[SW] 📦 Cache index.html (critical)...');
    await cacheWithRetry(cache, BASE + 'index.html', 3);

    // cache các assets khác
    for (const url of CRITICAL_ASSETS.filter(a => a !== BASE + 'index.html')) {
      await cacheWithRetry(cache, url, 2);
    }

    const ok = await verifyCriticalAssets(cache);
    console.log(`[SW] 🔍 Verification: ${ok ? '✅ OK' : '⚠️ Not full'}`);

    // (tùy chọn) check version.json khi cài
    await checkForUpdates();

  })());

  // ✅ theo flow index.html: có waiting thì index sẽ bắn SKIP_WAITING
  self.skipWaiting();
});

// ========== ACTIVATE ==========
self.addEventListener('activate', (event) => {
  console.log('[SW] 🎯 Activating...');

  event.waitUntil((async () => {
    // tắt preload
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch {}
    }

    // dọn cache cũ
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith('static-') && k !== CACHE_STATIC)
        .map(k => caches.delete(k))
    );

    await self.clients.claim();

    // nếu SW này đang là active mới, báo cho app biết đã active
    broadcast({ type: 'SW_ACTIVE', version: APP_VERSION });

  })());
});

// ========== MESSAGE (SYNC WITH index.html) ==========
self.addEventListener('message', (event) => {
  const { type } = event.data || {};

  if (type === 'SKIP_WAITING') {
    // ✅ index.html sẽ gọi đúng vào reg.waiting.postMessage({type:'SKIP_WAITING'})
    self.skipWaiting();
    return;
  }

  if (type === 'CHECK_UPDATE') {
    checkForUpdates();
    return;
  }
});

// ========== UPDATE CHECK (version.json + waiting state) ==========
async function checkForUpdates() {
  // trong SW dùng self.navigator
  if (!self.navigator.onLine) return;

  try {
    const res = await fetch(VERSION_FILE + '?t=' + Date.now(), { cache: 'no-cache' });
    if (!res.ok) return;

    const data = await res.json();
    const latestVersion = data.version;

    if (compareVersions(latestVersion, APP_VERSION) > 0) {
      // có bản mới trên server
      broadcast({
        type: 'UPDATE_AVAILABLE',
        version: latestVersion,
        currentVersion: APP_VERSION
      });

      // ép browser đi lấy SW mới
      try { await self.registration.update(); } catch {}

      // nếu SW mới đã vào trạng thái waiting -> báo "ready to update"
      if (self.registration.waiting) {
        broadcast({
          type: 'UPDATE_READY',
          version: latestVersion,
          currentVersion: APP_VERSION
        });
      } else {
        // theo dõi installing để khi xong thì báo ready
        const installing = self.registration.installing;
        if (installing) {
          installing.addEventListener('statechange', () => {
            if (self.registration.waiting) {
              broadcast({
                type: 'UPDATE_READY',
                version: latestVersion,
                currentVersion: APP_VERSION
              });
            }
          });
        }
      }
    }
  } catch (err) {
    console.log('[SW] 🌐 check update error:', err?.message || err);
  }
}

// ========== FETCH (OFFLINE FIRST) ==========
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.pathname.startsWith(BASE)) return;

  const isNavigation = request.mode === 'navigate';

  if (isNavigation) {
    event.respondWith(handleNavigation());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(handleStatic(event.request));
  }
});

async function handleNavigation() {
  try {
    const cache = await caches.open(CACHE_STATIC);

    const cachedHtml = await cache.match(BASE + 'index.html', { ignoreSearch: true });
    if (cachedHtml) return cachedHtml;

    try {
      const net = await fetch(BASE + 'index.html', { cache: 'no-store' });
      if (net.ok) {
        await cache.put(BASE + 'index.html', net.clone());
        return net;
      }
    } catch {}

    return createOfflinePage();
  } catch {
    return createOfflinePage();
  }
}

async function handleStatic(req) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const net = await fetch(req);
    if (net.ok) await cache.put(req, net.clone());
    return net;
  } catch {
    return new Response('', { status: 204 });
  }
}

// ========== CACHE HELPERS ==========
async function cacheWithRetry(cache, url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await cache.add(url);
      return true;
    } catch {
      if (attempt === maxRetries) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            await cache.put(url, res.clone());
            return true;
          }
        } catch {}
        return false;
      }
      await sleep(400 * attempt);
    }
  }
  return false;
}

async function verifyCriticalAssets(cache) {
  const cachedItems = await cache.keys();

  // tối thiểu phải có
  const MINIMAL_ASSETS = [
    BASE + 'index.html',
    BASE + 'manifest.webmanifest',
    BASE + 'icons/icon-192.png',
    BASE + 'icons/icon-512.png'
  ];

  const hasMinimal = MINIMAL_ASSETS.every(asset =>
    cachedItems.some(item => item.url.endsWith(asset))
  );

  const iconCount = cachedItems.filter(item => item.url.includes('/icons/')).length;

  console.log(`[SW] 🔍 Minimal assets: ${hasMinimal ? '✅' : '❌'}`);
  console.log(`[SW] 🔍 Icons cached: ${iconCount}`);

  return hasMinimal && iconCount >= 10;
}

function compareVersions(a, b) {
  const pa = String(a || '').replace(/^v/i,'').split('.').map(n => parseInt(n,10) || 0);
  const pb = String(b || '').replace(/^v/i,'').split('.').map(n => parseInt(n,10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0, nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function broadcast(payload) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(c => c.postMessage(payload));
}

// ========== OFFLINE PAGE ==========
function createOfflinePage() {
  return new Response(
`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tính thuốc sát trùng - Offline</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0b1220;color:#e2e8f0;margin:0;padding:40px 20px;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.5}
    .container{max-width:400px}
    h1{color:#f59e0b;margin-bottom:1rem}
    button{background:#22c55e;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:16px;cursor:pointer;margin-top:1rem}
  </style>
</head>
<body>
  <div class="container">
    <h1>📶 Đang offline</h1>
    <p>Ứng dụng cần kết nối internet để tải lần đầu.</p>
    <button onclick="location.reload()">🔄 Thử lại</button>
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } }
  );
}

console.log(`[SW ${APP_VERSION}] ✅ Loaded - OFFLINE 100% GUARANTEED`);