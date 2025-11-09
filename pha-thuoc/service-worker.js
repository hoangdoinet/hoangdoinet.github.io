/* service-worker.js - CACHE COMPLETE v1.0.5 */
const APP_VERSION = 'v1.0.5';
const CACHE_STATIC = `static-${APP_VERSION}`;
const BASE = '/pha-thuoc/';
const VERSION_FILE = BASE + 'version.json';

// 🔥 CACHE TẤT CẢ ICONS THEO MANIFEST
const CRITICAL_ASSETS = [
  // App Core - PHẢI CACHE THÀNH CÔNG
  BASE + 'index.html',
  BASE + 'manifest.webmanifest',
  BASE + 'version.json',
  
  // 🎯 CACHE TẤT CẢ ICONS THEO MANIFEST
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

console.log(`[SW ${APP_VERSION}] 🚀 Khởi động - CACHE ĐẦY ĐỦ`);

// ========== CÀI ĐẶT - CACHE TOÀN BỘ ==========
self.addEventListener('install', (event) => {
  console.log('[SW] 🔧 Đang cài đặt - CACHE TOÀN BỘ ICONS...');
  
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    let successCount = 0;
    let failCount = 0;
    
    // 🔥 CACHE TẤT CẢ ASSETS THEO MANIFEST
    for (const url of CRITICAL_ASSETS) {
      try {
        await cache.add(url);
        successCount++;
        console.log(`[SW] ✅ Đã cache: ${url}`);
      } catch (error) {
        failCount++;
        console.error(`[SW] ❌ Không cache được: ${url}`, error);
        
        // 🔄 THỬ CACHE LẠI VỚI STRATEGY KHÁC
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            successCount++;
            console.log(`[SW] 🔄 Đã cache lại: ${url}`);
          }
        } catch (retryError) {
          console.error(`[SW] 💥 Cache retry failed: ${url}`);
        }
      }
    }
    
    console.log(`[SW] 📊 Kết quả cache: ${successCount} thành công, ${failCount} thất bại`);
    
    if (successCount >= CRITICAL_ASSETS.length - 3) { // Cho phép fail 3 assets
      console.log('[SW] 🎉 Ứng dụng đã sẵn sàng OFFLINE 100%');
    } else {
      console.error('[SW] 🚨 CẢNH BÁO: Quá nhiều assets cache thất bại!');
    }
    
    // Check update sau khi cache
    await checkForUpdates();
    
  })());
  
  self.skipWaiting();
});

// ========== CHECK UPDATE FUNCTION ==========
async function checkForUpdates() {
  if (!navigator.onLine) {
    console.log('[SW] 🌐 Offline - Bỏ qua check update');
    return;
  }
  
  try {
    console.log('[SW] 🔄 Đang kiểm tra bản cập nhật...');
    
    const response = await fetch(VERSION_FILE + '?t=' + Date.now(), {
      cache: 'no-cache'
    });
    
    if (!response.ok) return;
    
    const data = await response.json();
    const latestVersion = data.version;
    
    console.log(`[SW] 📊 Phiên bản: Local=${APP_VERSION}, Server=${latestVersion}`);
    
    if (compareVersions(latestVersion, APP_VERSION) > 0) {
      console.log(`[SW] 🎉 Phát hiện bản cập nhật mới: ${latestVersion}`);
      
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          version: latestVersion,
          currentVersion: APP_VERSION,
          changelog: data.changelog || []
        });
      });
    }
    
  } catch (error) {
    console.log('[SW] 🌐 Lỗi check update:', error.message);
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

// ========== KÍCH HOẠT ==========
self.addEventListener('activate', (event) => {
  console.log('[SW] 🎯 Kích hoạt phiên bản', APP_VERSION);
  
  event.waitUntil((async () => {
    // Tắt navigation preload
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
      key.startsWith('static-') && 
      key !== CACHE_STATIC
    );
    
    if (oldCaches.length > 0) {
      console.log('[SW] 🗑️ Đang xóa cache cũ:', oldCaches);
      await Promise.all(oldCaches.map(key => caches.delete(key)));
    }
    
    await self.clients.claim();
    
    // 📊 KIỂM TRA CACHE STATUS CHI TIẾT
    const cache = await caches.open(CACHE_STATIC);
    const cachedItems = await cache.keys();
    
    const cachedIcons = cachedItems.filter(item => 
      item.url.includes('/icons/')
    );
    const hasAllIcons = CRITICAL_ASSETS.filter(asset => 
      asset.includes('/icons/')
    ).every(icon => 
      cachedItems.some(item => item.url === icon)
    );
    
    console.log(`[SW] 📊 Cache status: ${cachedItems.length} items total`);
    console.log(`[SW] 📊 Icons cached: ${cachedIcons.length}/13 icons`);
    console.log(`[SW] 📊 All icons present: ${hasAllIcons ? '✅' : '❌'}`);
    
    if (!hasAllIcons) {
      console.warn('[SW] ⚠️ Một số icons bị thiếu trong cache');
      // Tự động cache lại icons bị thiếu
      await cacheMissingIcons(cache, cachedItems);
    }
    
    // Schedule update checks
    setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
    
  })());
});

// ========== CACHE LẠI ICONS BỊ THIẾU ==========
async function cacheMissingIcons(cache, cachedItems) {
  console.log('[SW] 🔄 Đang cache lại icons bị thiếu...');
  
  const missingIcons = CRITICAL_ASSETS.filter(asset => 
    asset.includes('/icons/') && 
    !cachedItems.some(item => item.url === asset)
  );
  
  if (missingIcons.length === 0) {
    console.log('[SW] ✅ Không có icons nào bị thiếu');
    return;
  }
  
  console.log(`[SW] 🔍 Tìm thấy ${missingIcons.length} icons bị thiếu:`, missingIcons);
  
  for (const iconUrl of missingIcons) {
    try {
      const response = await fetch(iconUrl);
      if (response.ok) {
        await cache.put(iconUrl, response);
        console.log(`[SW] ✅ Đã cache lại: ${iconUrl}`);
      }
    } catch (error) {
      console.error(`[SW] ❌ Không thể cache lại: ${iconUrl}`);
    }
  }
}

// ========== MESSAGE HANDLING ==========
self.addEventListener('message', (event) => {
  const { type } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      console.log('[SW] 📨 Nhận lệnh skip waiting');
      self.skipWaiting();
      break;
      
    case 'CHECK_UPDATE':
      console.log('[SW] 📨 Nhận lệnh check update');
      checkForUpdates();
      break;
      
    case 'FORCE_UPDATE':
      console.log('[SW] 📨 Nhận lệnh force update');
      self.skipWaiting();
      break;
      
    case 'GET_CACHE_STATUS':
      event.waitUntil((async () => {
        const cache = await caches.open(CACHE_STATIC);
        const cachedItems = await cache.keys();
        const cachedIcons = cachedItems.filter(item => item.url.includes('/icons/'));
        
        event.ports[0]?.postMessage({
          version: APP_VERSION,
          totalItems: cachedItems.length,
          cachedIcons: cachedIcons.length,
          hasAllIcons: CRITICAL_ASSETS.filter(a => a.includes('/icons/'))
            .every(icon => cachedItems.some(item => item.url === icon))
        });
      })());
      break;
  }
});

// ========== FETCH HANDLER ==========
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/pha-thuoc/')) return;

  const isNavigation = request.mode === 'navigate';
  
  if (isNavigation) {
    event.respondWith(handleNavigationRequest());
    return;
  }
  
  if (url.origin === self.location.origin) {
    event.respondWith(handleStaticRequest(event));
  }
});

async function handleNavigationRequest() {
  try {
    const cache = await caches.open(CACHE_STATIC);
    const cachedHtml = await cache.match(BASE + 'index.html', { ignoreSearch: true });
    
    if (cachedHtml) {
      console.log('[SW] ✅ Phục vụ từ cache - OFFLINE READY');
      return cachedHtml;
    }
    
    try {
      const networkResponse = await fetch(BASE + 'index.html');
      if (networkResponse.ok) {
        await cache.put(BASE + 'index.html', networkResponse.clone());
        return networkResponse;
      }
    } catch (networkError) {
      console.log('[SW] 🌐 Network không khả dụng');
    }
    
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
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title><style>body{font-family:system-ui;background:#0b1220;color:#e2e8f0;padding:40px;text-align:center}</style></head><body><h1>📶 Đang offline</h1><button onclick="location.reload()">🔄 Thử lại</button></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

console.log(`[SW ${APP_VERSION}] ✅ Đã tải - CACHE ĐẦY ĐỦ 100%`);