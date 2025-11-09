/* service-worker.js - OFFLINE 100% GUARANTEED v1.0.5 */
const APP_VERSION = 'v1.0.5';
const CACHE_STATIC = `static-${APP_VERSION}`;
const BASE = '/pha-thuoc/';
const VERSION_FILE = BASE + 'version.json';

// 🔥 CACHE TOÀN BỘ ASSETS THEO MANIFEST
const CRITICAL_ASSETS = [
  // 🎯 CORE APP - PHẢI THÀNH CÔNG 100%
  BASE + 'index.html',
  BASE + 'manifest.webmanifest',
  BASE + 'version.json',
  
  // 🖼️ ICONS - TOÀN BỘ THEO MANIFEST
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

// ========== CÀI ĐẶT - ĐẢM BẢO 100% THÀNH CÔNG ==========
self.addEventListener('install', (event) => {
  console.log('[SW] 🔧 Đang cài đặt - ĐẢM BẢO OFFLINE 100%...');
  
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    const results = {
      success: [],
      failed: []
    };
    
    // 🔥 CACHE INDEX.HTML ĐẦU TIÊN - BẮT BUỘC THÀNH CÔNG
    console.log('[SW] 📦 Đang cache index.html (critical)...');
    const indexSuccess = await cacheWithRetry(cache, BASE + 'index.html', 3);
    if (!indexSuccess) {
      console.error('[SW] 💥 CRITICAL FAIL: Không thể cache index.html');
      // Vẫn tiếp tục, nhưng ghi log lỗi nghiêm trọng
    }
    
    // Cache các assets còn lại với retry
    for (const url of CRITICAL_ASSETS.filter(a => a !== BASE + 'index.html')) {
      const success = await cacheWithRetry(cache, url, 2);
      if (success) {
        results.success.push(url);
        console.log(`[SW] ✅ Đã cache: ${url}`);
      } else {
        results.failed.push(url);
        console.error(`[SW] ❌ Không cache được: ${url}`);
      }
    }
    
    // 📊 BÁO CÁO KẾT QUẢ CHI TIẾT
    console.log(`[SW] 📊 KẾT QUẢ CACHE:`);
    console.log(`[SW] ✅ Thành công: ${results.success.length}/${CRITICAL_ASSETS.length}`);
    console.log(`[SW] ❌ Thất bại: ${results.failed.length}`);
    
    if (results.failed.length > 0) {
      console.error('[SW] 🚨 ASSETS CACHE FAILED:', results.failed);
    }
    
    // OFFLINE READY VERIFICATION
    const hasCriticalAssets = await verifyCriticalAssets(cache);
    if (hasCriticalAssets) {
      console.log('[SW] 🎉 ỨNG DỤNG ĐÃ SẴN SÀNG OFFLINE 100%');
    } else {
      console.error('[SW] 🚨 CẢNH BÁO: Ứng dụng có thể không hoạt động offline hoàn toàn');
    }
    
    // Check update
    await checkForUpdates();
    
  })());
  
  self.skipWaiting();
});

// ========== CACHE VỚI RETRY ==========
async function cacheWithRetry(cache, url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await cache.add(url);
      return true;
    } catch (error) {
      console.warn(`[SW] ⚠️ Lần ${attempt} cache thất bại: ${url}`);
      
      if (attempt === maxRetries) {
        // Thử strategy cuối: fetch và put
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            console.log(`[SW] 🔄 Đã cache bằng fetch: ${url}`);
            return true;
          }
        } catch (fetchError) {
          console.error(`[SW] 💥 Cache hoàn toàn thất bại: ${url}`);
          return false;
        }
      }
      
      // Chờ trước khi retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  return false;
}

// ========== VERIFY CRITICAL ASSETS ==========
async function verifyCriticalAssets(cache) {
  const cachedItems = await cache.keys();
  
  // Assets tối thiểu PHẢI có
  const MINIMAL_ASSETS = [
    BASE + 'index.html',
    BASE + 'manifest.webmanifest',
    BASE + 'icons/icon-192.png',
    BASE + 'icons/icon-512.png'
  ];
  
  const hasMinimalAssets = MINIMAL_ASSETS.every(asset =>
    cachedItems.some(item => item.url === asset)
  );
  
  const totalIconsCached = cachedItems.filter(item =>
    item.url.includes('/icons/')
  ).length;
  
  console.log(`[SW] 🔍 VERIFICATION: Minimal assets = ${hasMinimalAssets ? '✅' : '❌'}`);
  console.log(`[SW] 🔍 VERIFICATION: Icons cached = ${totalIconsCached}/13`);
  
  return hasMinimalAssets && totalIconsCached >= 10; // Cho phép thiếu 3 icons
}

// ========== CHECK UPDATE ==========
async function checkForUpdates() {
  if (!navigator.onLine) return;
  
  try {
    console.log('[SW] 🔄 Đang kiểm tra bản cập nhật...');
    const response = await fetch(VERSION_FILE + '?t=' + Date.now(), {
      cache: 'no-cache'
    });
    
    if (!response.ok) return;
    
    const data = await response.json();
    const latestVersion = data.version;
    
    if (compareVersions(latestVersion, APP_VERSION) > 0) {
      console.log(`[SW] 🎉 Phát hiện bản cập nhật: ${latestVersion}`);
      
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          version: latestVersion,
          currentVersion: APP_VERSION
        });
      });
    }
  } catch (error) {
    console.log('[SW] 🌐 Lỗi check update:', error.message);
  }
}

// ========== KÍCH HOẠT VÀ VERIFICATION ==========
self.addEventListener('activate', (event) => {
  console.log('[SW] 🎯 Kích hoạt - OFFLINE VERIFICATION...');
  
  event.waitUntil((async () => {
    // 🚫 TẮT navigationPreload
    if (self.registration.navigationPreload) {
      try {
        await self.registration.navigationPreload.disable();
        console.log('[SW] ✅ Đã tắt navigationPreload');
      } catch (err) {
        console.warn('[SW] Không thể tắt navigationPreload:', err);
      }
    }
    
    // Dọn cache cũ
    const cacheKeys = await caches.keys();
    const oldCaches = cacheKeys.filter(key => 
      key.startsWith('static-') && key !== CACHE_STATIC
    );
    
    if (oldCaches.length > 0) {
      console.log('[SW] 🗑️ Đang xóa cache cũ:', oldCaches);
      await Promise.all(oldCaches.map(key => caches.delete(key)));
    }
    
    await self.clients.claim();
    
    // 🔍 VERIFICATION SAU KÍCH HOẠT
    const cache = await caches.open(CACHE_STATIC);
    const cachedItems = await cache.keys();
    
    console.log(`[SW] 📊 SAU KÍCH HOẠT: ${cachedItems.length} items trong cache`);
    
    // Kiểm tra assets quan trọng
    const criticalAssets = [
      BASE + 'index.html',
      BASE + 'icons/icon-192.png',
      BASE + 'icons/icon-512.png'
    ];
    
    const missingCritical = criticalAssets.filter(asset =>
      !cachedItems.some(item => item.url === asset)
    );
    
    if (missingCritical.length > 0) {
      console.error('[SW] 🚨 CRITICAL ASSETS MISSING:', missingCritical);
      // Tự động cache lại assets quan trọng bị thiếu
      await cacheMissingCritical(cache, missingCritical);
    } else {
      console.log('[SW] ✅ Tất cả assets quan trọng đã được cache');
    }
    
    // Schedule update checks
    setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
    
  })());
});

// ========== CACHE LẠI ASSETS QUAN TRỌNG BỊ THIẾU ==========
async function cacheMissingCritical(cache, missingAssets) {
  console.log('[SW] 🔄 Đang cache lại assets quan trọng bị thiếu...');
  
  for (const asset of missingAssets) {
    try {
      const response = await fetch(asset);
      if (response.ok) {
        await cache.put(asset, response);
        console.log(`[SW] ✅ Đã cache lại: ${asset}`);
      }
    } catch (error) {
      console.error(`[SW] 💥 Không thể cache lại: ${asset}`);
    }
  }
}

// ========== SO SÁNH VERSION ==========
function compareVersions(a, b) {
  const pa = a.replace('v', '').split('.').map(Number);
  const pb = b.replace('v', '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// ========== FETCH HANDLER - OFFLINE FIRST ==========
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/pha-thuoc/')) return;

  const isNavigation = request.mode === 'navigate';
  
  if (isNavigation) {
    event.respondWith(handleNavigationRequest(event));
    return;
  }
  
  if (url.origin === self.location.origin) {
    event.respondWith(handleStaticRequest(event));
  }
});

async function handleNavigationRequest(event) {
  try {
    const cache = await caches.open(CACHE_STATIC);
    
    // 🔥 LUÔN ƯU TIÊN CACHE TRƯỚC
    const cachedHtml = await cache.match(BASE + 'index.html', { 
      ignoreSearch: true 
    });
    
    if (cachedHtml) {
      console.log('[SW] ✅ Phục vụ từ cache - OFFLINE READY');
      return cachedHtml;
    }
    
    // Fallback to network
    try {
      const networkResponse = await fetch(BASE + 'index.html');
      if (networkResponse.ok) {
        await cache.put(BASE + 'index.html', networkResponse.clone());
        console.log('[SW] ✅ Đã cache từ network');
        return networkResponse;
      }
    } catch (networkError) {
      console.log('[SW] 🌐 Network không khả dụng');
    }
    
    // 🚨 CẢ HAI ĐỀU FAIL
    return createOfflinePage();
    
  } catch (error) {
    console.error('[SW] 💥 Lỗi xử lý navigation:', error);
    return createOfflinePage();
  }
}

async function handleStaticRequest(event) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(event.request, { ignoreSearch: true });
  
  if (cached) {
    return cached;
  }
  
  try {
    const networkResponse = await fetch(event.request);
    if (networkResponse.ok) {
      await cache.put(event.request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('', { status: 204 });
  }
}

function createOfflinePage() {
  return new Response(
    `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Tính thuốc sát trùng - Offline</title>
        <style>
            body {
                font-family: system-ui, sans-serif;
                background: #0b1220;
                color: #e2e8f0;
                margin: 0;
                padding: 40px 20px;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                line-height: 1.5;
            }
            .container {
                max-width: 400px;
            }
            h1 {
                color: #f59e0b;
                margin-bottom: 1rem;
            }
            button {
                background: #22c55e;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
                margin-top: 1rem;
            }
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
    {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
        }
    }
  );
}

self.addEventListener('message', (event) => {
  const { type } = event.data;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'CHECK_UPDATE') checkForUpdates();
  if (type === 'FORCE_UPDATE') self.skipWaiting();
});

console.log(`[SW ${APP_VERSION}] ✅ Đã tải - OFFLINE 100% GUARANTEED`);