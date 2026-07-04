import { toggleLoader, showAlert, openModal } from './ui.js';

export const APP_VERSION = 'v1.0.3';
const SW_SCOPE = '/encypass/';

async function getVersionInfo(targetVersion) {
  try {
    const res = await fetch('/encypass/version.json?ts=' + Date.now(), { cache: 'no-cache' });
    if (!res.ok) return null;
    const json = await res.json();
    let entry = null;
    if (Array.isArray(json.changelog)) { entry = json.changelog.find(x => String(x.version) === String(targetVersion)) || json.changelog[0] || null; }
    const changes = (entry && Array.isArray(entry.changes) && entry.changes.length ? entry.changes : Array.isArray(json.notes) ? json.notes : []);
    const releaseDate = (entry && entry.release_date) || json.release_date || '';
    return { app: json.app || 'Trình quản lý mật khẩu', website: json.website || '', version: targetVersion, releaseDate, changes };
  } catch(e) { return null; }
}

function formatDateVN(dateStr) {
  if (!dateStr) return '';
  try {
    const onlyDate = String(dateStr).split('T')[0];
    const parts = onlyDate.split('-');
    if (parts.length === 3) { const [y, m, d] = parts; return `${d}/${m}/${y}`; }
    return dateStr;
  } catch { return dateStr; }
}

function extractLatestVersion(json) {
  if (!json || typeof json !== 'object') return null;
  if (json.latest && (json.latest.version || typeof json.latest === 'string')) return json.latest.version || String(json.latest);
  if (Array.isArray(json.changelog) && json.changelog.length) {
    const sorted = json.changelog.slice().sort((a, b) => {
      if (a.release_date && b.release_date) return new Date(b.release_date) - new Date(a.release_date); return 0;
    });
    return sorted[0].version || null;
  }
  if (json.version) return json.version;
  return null;
}

async function getLatestVersionFromServerSafe() {
  try {
    const res = await fetch('/encypass/version.json?ts=' + Date.now(), { cache: 'no-cache' });
    if (!res.ok) return null;
    const json = await res.json();
    const latest = extractLatestVersion(json);
    return { latest, json };
  } catch(e) { return null; }
}

export async function initLatestVersionLabel() {
  const latestVersionEl = document.getElementById('latestVersion');
  if (!latestVersionEl) return;
  const info = await getLatestVersionFromServerSafe();
  if (info && info.latest) { latestVersionEl.textContent = info.latest; } else { latestVersionEl.textContent = 'Không xác định'; }
}

async function getSwReg() {
  try {
    if(!('serviceWorker' in navigator)) return null;
    return await navigator.serviceWorker.getRegistration(SW_SCOPE);
  } catch { return null; }
}

async function postToSW(msg) {
  const reg = await getSwReg();
  const target = reg?.active || reg?.waiting || reg?.installing;
  if(!target) return false;
  try { target.postMessage(msg); return true; } catch { return false; }
}

export class AppUpdater {
  constructor() { 
    this.updateAvailable = false; 
    this.newVersion = null; 
    this.lastCheck = null; 
    this._userInitiatedCheck = false; 
    this._fallbackTimer = null; 
    this.init(); 
  }
  
  init() { 
    if('serviceWorker' in navigator) { 
      navigator.serviceWorker.addEventListener('message', e => { 
        const data = e.data || {}; 
        const {type, version, currentVersion, reason, status} = data; 
        if(type==='UPDATE_AVAILABLE') { this.handleSwUpdate(version, currentVersion); return; } 
        if(type==='NO_UPDATE') { this.handleSwNoUpdate(version, currentVersion); return; } 
        if(type==='UPDATE_ERROR') { this.handleSwError(reason, status); return; } 
      }); 
    } 
  }
  
  async check() { 
    const aboutModal = document.getElementById('aboutModal');
    if (!navigator.onLine) { 
      if (aboutModal) aboutModal.classList.remove('open');
      await showAlert(`Thiết bị đang không có kết nối mạng.`, { title: 'Không thể kiểm tra', type: 'warning' }); 
      return; 
    } 
    this._userInitiatedCheck = true; this.lastCheck = Date.now(); 
    toggleLoader(true, 'updater', 'Đang kiểm tra bản cập nhật...');
    
    const sent = await postToSW({ type: 'CHECK_UPDATE', clientVersion: APP_VERSION });
    if (sent) { 
      clearTimeout(this._fallbackTimer); 
      this._fallbackTimer = setTimeout(async () => { 
        toggleLoader(false, 'updater');
        const info = await getLatestVersionFromServerSafe(); 
        if (info && info.latest) { 
          const latestVersionEl = document.getElementById('latestVersion');
          if (latestVersionEl) latestVersionEl.textContent = info.latest; 
          if (APP_VERSION.includes(info.latest)) { 
            if (aboutModal) aboutModal.classList.remove('open');
            await showAlert(`Bạn đang sử dụng phiên bản mới nhất.\n\n• Phiên bản hiện tại: ${APP_VERSION}`, { title:'Kiểm tra cập nhật', type:'info' }); 
          }
          else { this.show(info.latest, APP_VERSION); } 
        } else { 
          if (aboutModal) aboutModal.classList.remove('open');
          await showAlert('Không thể lấy thông vị phiên bản từ máy chủ.', { title:'Kiểm tra cập nhật', type:'error' }); 
        } 
        this._userInitiatedCheck = false; 
      }, 2500); 
      return; 
    } 
    
    const info = await getLatestVersionFromServerSafe(); 
    toggleLoader(false, 'updater');
    if (!info || !info.latest) { 
      if (aboutModal) aboutModal.classList.remove('open');
      await showAlert('Không thể lấy thông tin phiên bản.', { title: 'Kiểm tra cập nhật', type: 'error' }); 
      this._userInitiatedCheck = false; return; 
    } 
    const latest = info.latest; 
    const latestVersionEl = document.getElementById('latestVersion');
    if (latestVersionEl) latestVersionEl.textContent = latest; 
    
    if (APP_VERSION.includes(latest)) { 
      if (aboutModal) aboutModal.classList.remove('open');
      await showAlert(`Bạn đang sử dụng phiên bản mới nhất.`, { title: 'Kiểm tra cập nhật', type: 'info' }); 
      this._userInitiatedCheck = false; return; 
    } 
    this.show(latest, APP_VERSION); this._userInitiatedCheck = false; 
  }
  
  async apply() { 
    try { 
      toggleLoader(true, 'updater_apply', 'Đang cập nhật...');
      const reg = await getSwReg(); if(!reg) { location.reload(); return; } 
      if (reg.waiting) { reg.waiting.postMessage({type:'SKIP_WAITING'}); } else { reg.active?.postMessage({type:'FORCE_UPDATE'}); } 
      let reloaded = false; 
      const done = () => { if(reloaded) return; reloaded = true; location.reload(); }; 
      const t = setTimeout(done, 2500); 
      navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(t); done(); }, { once:true }); 
    } catch(e) { 
      toggleLoader(false, 'updater_apply'); 
      const aboutModal = document.getElementById('aboutModal');
      if (aboutModal) aboutModal.classList.remove('open');
      await showAlert('Đã xảy ra lỗi cập nhật. Vui lòng thử lại sau.', { title:'Lỗi cập nhật', type:'error' }); 
    } 
  }
  
  async handleSwUpdate(newV, curV) { 
    clearTimeout(this._fallbackTimer); toggleLoader(false, 'updater'); 
    this.updateAvailable = true; this.newVersion = newV || this.newVersion; 
    this.show(newV || this.newVersion, curV || APP_VERSION); 
    this._userInitiatedCheck = false; 
  }
  
  async handleSwNoUpdate(latestV, curV) { 
    clearTimeout(this._fallbackTimer); toggleLoader(false, 'updater'); 
    const latestVersionEl = document.getElementById('latestVersion');
    if (latestVersionEl && latestV) latestVersionEl.textContent = latestV; 
    if (this._userInitiatedCheck) { 
      const aboutModal = document.getElementById('aboutModal');
      if (aboutModal) aboutModal.classList.remove('open');
      await showAlert(`Bạn đang sử dụng phiên bản mới nhất.`, { title:'Kiểm tra cập nhật', type:'info' }); 
    } 
    this._userInitiatedCheck = false; 
  }
  
  async handleSwError(reason, status) { 
    clearTimeout(this._fallbackTimer); toggleLoader(false, 'updater'); 
    if (this._userInitiatedCheck) { 
      const aboutModal = document.getElementById('aboutModal');
      if (aboutModal) aboutModal.classList.remove('open');
      await showAlert(`Không thể kiểm tra bản cập nhật vào lúc này.`, { title:'Kiểm tra cập nhật', type:'warning' }); 
    } 
    this._userInitiatedCheck = false; 
  }
  
  async show(newV, curV) { 
    const aboutModal = document.getElementById('aboutModal');
    if (!newV || !curV) { 
      if (aboutModal) aboutModal.classList.remove('open');
      await showAlert('Đã có bản cập nhật mới. Vui lòng tải lại trang.', { title: 'Cập nhật mới', type: 'info' }); 
      return; 
    } 
    const latestVersionEl = document.getElementById('latestVersion');
    if (latestVersionEl && newV) latestVersionEl.textContent = newV; 
    
    if (aboutModal) aboutModal.classList.remove('open');
    
    const infoNew = await getVersionInfo(newV); const infoCur = await getVersionInfo(curV); 
    const curDateText = infoCur && infoCur.releaseDate ? ` (${formatDateVN(infoCur.releaseDate)})` : ''; 
    const newDateText = infoNew && infoNew.releaseDate ? ` (${formatDateVN(infoNew.releaseDate)})` : ''; 
    let message = `• Phiên bản hiện tại: ${curV}${curDateText}\n• Phiên bản mới: ${newV}${newDateText}`; 
    if (infoNew && Array.isArray(infoNew.changes) && infoNew.changes.length) { message += `\n\nCó gì mới:\n` + infoNew.changes.map(c => `• ${c}`).join('\n'); } 
    
    const ok = await openModal({ title:'Có bản cập nhật mới', message, okText:'Cập nhật ngay', cancelText:'Để sau', cancelVisible:true, type: 'info' }); 
    if (ok) this.apply(); 
  }
}