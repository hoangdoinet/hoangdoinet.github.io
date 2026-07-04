import { db, auth, provider } from './firebase.js';
import { collection, doc, setDoc, getDoc, deleteDoc, onSnapshot, getDocs, writeBatch, clearIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { SecureCrypto } from './crypto.js';
import { $, escapeHtml, toggleLoader, focusAndBlink, showInlineError, clearInlineError, showAlert, showConfirm, showPrompt } from './ui.js';
import { APP_VERSION, AppUpdater, initLatestVersionLabel } from './updater.js';

function getTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

let currentUserUid = null;
let systemEncryptKey = null;
let unsubSnapshot = null;
let unsubVerify = null;
let activeDEKKey = null;

if (window.lucide) lucide.createIcons();

const CHECK_KEY = "_verify";
const CHECK_VALUE = "Xác minh";
const MAX_MASTER_FAIL = 5;
const MASTER_LOCK_MS = 3 * 60 * 1000;

function getFriendlyErrorMessage(err) {
  if (!err) return "Đã xảy ra lỗi không xác định.";
  const code = err.code || err.name;
  const msg = err.message || "";

  if (code === 'auth/popup-closed-by-user') return "Bạn đã đóng cửa sổ trước khi hoàn tất đăng nhập.";
  if (code === 'auth/popup-blocked') return "Cửa sổ đăng nhập bị trình duyệt chặn. Vui lòng cấp quyền mở popup cho trang web.";
  if (code === 'auth/network-request-failed') return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại WiFi/4G.";
  if (code === 'permission-denied') return "Bạn không có quyền thực hiện thao tác này (Truy cập bị từ chối).";
  if (code === 'unavailable') return "Dịch vụ đang gián đoạn hoặc bạn đang mất mạng. Vui lòng thử lại sau.";
  if (code === 'resource-exhausted') return "Máy chủ đang quá tải. Vui lòng thử lại sau ít phút.";
  if (code === 'OperationError' || msg.includes('decrypt')) return "Mật khẩu giải mã không chính xác hoặc dữ liệu đã bị hỏng.";
  if (msg.includes('JSON')) return "Tệp dữ liệu không đúng định dạng (không phải file JSON hợp lệ).";
  if (msg.includes('Không thể giải mã khóa dữ liệu cũ')) return "Mật khẩu hiện tại không khớp với hệ thống. Đổi mật khẩu thất bại.";

  return `Lỗi hệ thống: ${msg}`;
}

async function getDEKKey(masterPassword, verifyObj) {
  if (activeDEKKey) return activeDEKKey;
  if (!verifyObj || !verifyObj.encrypted_dek) return null;
  const rawDEK = await SecureCrypto.decryptSafe(verifyObj.encrypted_dek, masterPassword);
  if (!rawDEK) return null;
  activeDEKKey = await SecureCrypto.importDEK(rawDEK);
  return activeDEKKey;
}

function validateImportSchema(importedArray) {
  if (!Array.isArray(importedArray)) throw new Error("Tệp không đúng định dạng. Dữ liệu phải là một danh sách (Array).");
  if (importedArray.length === 0) throw new Error("Tệp dữ liệu trống.");

  let hasVerifyKey = false;
  const maxStringLength = 10000;

  for (let i = 0; i < importedArray.length; i++) {
    const item = importedArray[i];
    if (typeof item !== 'object' || item === null) throw new Error(`Bản ghi thứ ${i + 1} bị lỗi: Không phải đối tượng hợp lệ.`);

    if (item[CHECK_KEY]) {
      hasVerifyKey = true;
      if (typeof item[CHECK_KEY] !== 'string' || typeof item.encrypted_dek !== 'string') throw new Error("Dữ liệu khóa bảo mật hệ thống bị hỏng hoặc sai định dạng.");
      continue;
    }

    const displayVal = item.rawDisplay || item.display;
    if (!displayVal || typeof displayVal !== 'string' || displayVal.length > maxStringLength) throw new Error(`Bản ghi thứ ${i + 1} bị lỗi: Tên dịch vụ (display) không hợp lệ.`);
    if (item.account && (typeof item.account !== 'string' || item.account.length > maxStringLength)) throw new Error(`Bản ghi thứ ${i + 1} (${displayVal}) bị lỗi: Trường 'account' sai.`);
    if (item.password && (typeof item.password !== 'string' || item.password.length > maxStringLength)) throw new Error(`Bản ghi thứ ${i + 1} (${displayVal}) bị lỗi: Trường 'password' sai.`);
    if (item.record_id && typeof item.record_id !== 'string' && typeof item.record_id !== 'number') throw new Error(`Bản ghi thứ ${i + 1} (${displayVal}) bị lỗi: 'record_id' phải là chuỗi hoặc số.`);
  }

  if (!hasVerifyKey) throw new Error("Tệp dữ liệu không chứa khóa xác minh (Verify Key). Không thể khôi phục.");
  return true;
}

let masterFailCount = 0; 
let masterLockUntil = 0; 
let unsubLockState = null;

function listenCloudLockState() {
  if (!currentUserUid) return;
  if (unsubLockState) unsubLockState();
  unsubLockState = onSnapshot(doc(db, "user_security", currentUserUid), (docSnap) => {
    if (docSnap.exists()) {
      const d = docSnap.data(); 
      masterFailCount = d.failCount || 0; 
      masterLockUntil = d.lockUntil || 0;
      if (isMasterLocked() && document.querySelector('.modal-backdrop.open')) {
        document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
        showAlert("Tài khoản của bạn đang bị khóa bảo mật tạm thời.", {type: 'error', title: 'Lỗi bảo mật'});
      }
    }
  });
}

async function saveLockState() {
  try {
    if (currentUserUid) {
       await setDoc(doc(db, "user_security", currentUserUid), { failCount: masterFailCount, lockUntil: masterLockUntil }, { merge: true });
    }
  } catch (e) { console.warn(e); }
}

function isMasterLocked() { 
  if (!masterLockUntil) return false; 
  if (Date.now() >= masterLockUntil) { masterLockUntil = 0; masterFailCount = 0; saveLockState(); return false; } 
  return true; 
}
function getMasterLockRemainingSeconds() { return isMasterLocked() ? Math.max(1, Math.ceil((masterLockUntil - Date.now()) / 1000)) : 0; }
function registerMasterFail() { masterFailCount++; if (masterFailCount >= MAX_MASTER_FAIL) { masterLockUntil = Date.now() + MASTER_LOCK_MS; } saveLockState(); }
function resetMasterFail() { if(masterFailCount===0 && masterLockUntil===0) return; masterFailCount = 0; masterLockUntil = 0; saveLockState(); }
function getMasterLockMessage() { return `Bạn đã nhập sai mật khẩu quá nhiều lần.\nVui lòng thử lại sau ${getMasterLockRemainingSeconds()} giây.`; }
function getWrongMasterMessage(base = 'Mật khẩu chính không chính xác') { if (isMasterLocked()) return getMasterLockMessage(); const remain = Math.max(0, MAX_MASTER_FAIL - masterFailCount); return remain > 0 ? `${base} (còn ${remain} lần thử).` : base; }

const el = {
  miGenerate: $('#miGenerate'), genModal: $('#genModal'), genLength: $('#genLength'), genLower: $('#genLower'), genUpper: $('#genUpper'), genNumber: $('#genNumber'), genSymbol: $('#genSymbol'), genBtn: $('#genBtn'), genResult: $('#genResult'), genStrength: $('#genStrength'), genClose: $('#genClose'), genX: $('#genX'),
  search: $('#search'), list: $('#passwordList'), statCount: $('#statCount'),
  miAdd: $('#miAdd'), miExport: $('#miExport'), miImport: $('#miImport'), miChangeKey: $('#miChangeKey'), miReset: $('#miReset'), miAbout: $('#miAbout'), miInstall: $('#miInstall'), fileImport: $('#fileImport'),
  editModal: $('#editModal'), editTitle: $('#editTitle'), fDisplay: $('#fDisplay'), fAccount: $('#fAccount'), fPassword: $('#fPassword'), fMaster: $('#fMaster'), btnSaveEdit: $('#btnSaveEdit'), btnCancelEdit: $('#btnCancelEdit'), editX: $('#editX'), strengthMsg: $('#strengthMsg'), masterConfirmRow: $('#masterConfirmRow'), fMasterConfirm: $('#fMasterConfirm'), masterConfirmHint: $('#masterConfirmHint'),
  errDisplay: $('#errDisplay'), errAccount: $('#errAccount'), errPassword: $('#errPassword'), errMaster: $('#errMaster'),
  aboutModal: $('#aboutModal'), aboutX: $('#aboutX'), aboutClose: $('#aboutClose'), appVersion: $('#appVersion'), 
  connectionStatus: $('#connection-status'), connectionWrapper: $('#connection-wrapper'),
  ckModal: $('#changeKeyModal'), ckX: $('#ckX'), ckOld: $('#ckOld'), ckNew: $('#ckNew'), ckConfirm: $('#ckConfirm'), ckStrength: $('#ckStrength'), ckHint: $('#ckHint'), ckOk: $('#ckOk'), ckCancel: $('#ckCancel'),
  errCkOld: $('#errCkOld'), errCkNew: $('#errCkNew'), errCkConfirm: $('#errCkConfirm'),
  installModal: $('#installModal'), installX: $('#installX'), installNow: $('#installNow'), installLater: $('#installLater'), iosTip: $('#iosTip'),
  btnInstallHeader: $('#btn-install'), btnInstallLogin: $('#btn-install-login'), btnExportHeader: $('#btn-export'), btnImportHeader: $('#btn-import'), btnLogout: $('#btn-logout'),
  aboutCheckUpdate: $('#aboutCheckUpdate')
};

el.appVersion.textContent = APP_VERSION; 
$('#splashVersion').textContent = APP_VERSION;

let appUpdater = new AppUpdater();
setTimeout(initLatestVersionLabel, 800);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/encypass/sw.js', { scope: '/encypass/', updateViaCache: 'none' });
    } catch (e) { console.warn(e); }
  });
}

const formFields = [
  { input: el.fDisplay, err: el.errDisplay },
  { input: el.fAccount, err: el.errAccount },
  { input: el.fPassword, err: el.errPassword },
  { input: el.fMaster, err: el.errMaster }
];
formFields.forEach(field => {
  if (field.input) {
    field.input.addEventListener('focus', () => clearInlineError(field.input, field.err));
    field.input.addEventListener('input', () => clearInlineError(field.input, field.err));
  }
});

function clearAllEditErrors() { formFields.forEach(field => clearInlineError(field.input, field.err)); }

const ckFields = [
  { input: el.ckOld, err: el.errCkOld },
  { input: el.ckNew, err: el.errCkNew },
  { input: el.ckConfirm, err: el.errCkConfirm }
];
ckFields.forEach(field => {
  if (field.input) {
    field.input.addEventListener('focus', () => clearInlineError(field.input, field.err));
    field.input.addEventListener('input', () => clearInlineError(field.input, field.err));
  }
});

function clearAllCkErrors() { ckFields.forEach(field => clearInlineError(field.input, field.err)); }

let lockoutInterval = null;
function showLockoutAlert() {
  if (!isMasterLocked()) return null;
  if (lockoutInterval) clearInterval(lockoutInterval);
  
  const modalMsgEl = document.getElementById('modalMsg');
  const modalOkEl = document.getElementById('modalOk');

  const promise = showAlert(getMasterLockMessage(), { type: 'error', title: 'Khóa bảo mật' }).then((v) => {
    clearInterval(lockoutInterval);
    return v;
  });

  lockoutInterval = setInterval(() => {
    const remain = getMasterLockRemainingSeconds();
    if (remain <= 0) {
      clearInterval(lockoutInterval);
      if (modalMsgEl) modalMsgEl.textContent = "Bạn có thể thử lại ngay bây giờ.";
      if (modalOkEl) modalOkEl.disabled = false;
    } else {
      if (modalMsgEl) modalMsgEl.textContent = `Bạn đã nhập sai mật khẩu quá nhiều lần.\nVui lòng thử lại sau ${remain} giây.`;
    }
  }, 1000);
  
  return promise;
}

let data = []; let visible = {}; let autoHideTimers = {}; let editingId = null; let savingEdit = false;

toggleLoader(true, 'boot', 'Đang khởi động...');

onAuthStateChanged(auth, async (user) => {
  toggleLoader(true, 'auth', 'Đang xác thực...');
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, "users_list", user.email));
      if (!userDoc.exists()) {
        await signOut(auth);
        toggleLoader(false, 'auth');
        toggleLoader(false, 'boot');
        await showAlert("Email của bạn không nằm trong danh sách được cấp phép.", { title: 'Từ chối truy cập!', type: 'error' });
        return;
      }

      currentUserUid = user.uid;

      const keyDoc = await getDoc(doc(db, "system", "encrypt_key"));
      if (keyDoc.exists()) {
        systemEncryptKey = keyDoc.data().key;
      } else {
        systemEncryptKey = "encypass_display_key";
        setDoc(doc(db, "system", "encrypt_key"), { key: systemEncryptKey }).catch(e => console.warn(e));
      }

      $('#loginOverlay').classList.add('hidden'); $('#app').classList.remove('invisible');
      el.connectionStatus.textContent = navigator.onLine ? "Đã kết nối máy chủ an toàn" : "Đang hoạt động ngoại tuyến";
      
      listenCloudLockState(); 
      startRealtimeSync();
    } catch (e) {
      console.error(e);
      signOut(auth); 
      toggleLoader(false, 'auth');
      toggleLoader(false, 'boot');
      if (e.code === 'permission-denied') {
          await showAlert("Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau ít phút.", {type: 'error'});
      } else {
          await showAlert(getFriendlyErrorMessage(e), {title: 'Lỗi xác minh hệ thống', type: 'error'});
      }
    } finally {
      toggleLoader(false, 'auth');
      toggleLoader(false, 'boot');
    }
  } else {
    if (!navigator.onLine) {
      toggleLoader(false, 'auth');
      toggleLoader(false, 'boot');
      
      const isRetry = await showConfirm(
        "Ứng dụng cần kết nối mạng để đăng nhập và đồng bộ dữ liệu với máy chủ.\nVui lòng bật mạng (WiFi/4G) và thử lại.",
        "Không có kết nối mạng",
        "error"
      );
      
      if (isRetry) { window.location.reload(); } else {
        try { window.close(); } catch (e) {}
        document.body.innerHTML = '<div class="fixed inset-0 bg-teal-900 flex flex-col items-center justify-center text-white text-center p-6"><i data-lucide="wifi-off" class="w-16 h-16 mb-4 text-teal-300"></i><h2 class="text-xl font-bold mb-2">Đã ngắt kết nối</h2><p class="text-teal-100/80">Vui lòng kết nối mạng và mở lại ứng dụng.</p></div>';
        if (window.lucide) lucide.createIcons();
      }
      return;
    }

    currentUserUid = null;
    systemEncryptKey = null;
    activeDEKKey = null;
    if (unsubSnapshot) unsubSnapshot(); 
    if (unsubVerify) unsubVerify(); 
    if (unsubLockState) unsubLockState();
    $('#loginOverlay').classList.remove('hidden'); $('#app').classList.add('invisible');
    data = []; render();
    toggleLoader(false, 'auth');
    toggleLoader(false, 'boot');
  }
});

$('#btnGoogleLogin').onclick = async () => {
  toggleLoader(true, 'login', 'Đang đăng nhập...');
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error(e);
    showAlert(getFriendlyErrorMessage(e), { title: 'Lỗi đăng nhập', type: 'error' });
  } finally { toggleLoader(false, 'login'); }
};

el.btnLogout.onclick = async () => {
  toggleLoader(true, 'logout', 'Đang đăng xuất...');
  activeDEKKey = null;
  try {
    await signOut(auth);
    await clearIndexedDbPersistence(db);
  } catch (e) { console.error(e); } finally { toggleLoader(false, 'logout'); }
};

function startRealtimeSync() {
  if (!currentUserUid || !systemEncryptKey) return;
  
  if (unsubVerify) unsubVerify();
  unsubVerify = onSnapshot(doc(db, "system", "verify"), (verifySnap) => {
      if(verifySnap.exists()) {
          const dataObj = verifySnap.data();
          const vObj = { [CHECK_KEY]: dataObj.value, encrypted_dek: dataObj.encrypted_dek };
          const idx = data.findIndex(e => e[CHECK_KEY]);
          if (idx > -1) data[idx] = vObj; else data.unshift(vObj);
          render(); 
      }
  });

  unsubSnapshot = onSnapshot(collection(db, "account"), { includeMetadataChanges: true }, async (snapshot) => {
    toggleLoader(true, 'sync', 'Đang đồng bộ...');
    try {
      const newData = [];
      for (const docChange of snapshot.docs) {
        const raw = docChange.data();
        const decDisplay = await SecureCrypto.decryptSafe(raw.display, systemEncryptKey);
        newData.push({ record_id: docChange.id, update: raw.update, display: decDisplay || "[Dữ liệu mã hóa]", account: raw.account, password: raw.password, rawDisplay: raw.display, pending: docChange.metadata.hasPendingWrites });
      }
      
      const v = data.find(e => e[CHECK_KEY]); 
      data = newData; 
      if(v) data.unshift(v);
      
      render();
    } catch (error) { 
      console.error(error); 
    } finally { toggleLoader(false, 'sync'); }
  }, (error) => {
    toggleLoader(false, 'sync');
    if (error.code === 'permission-denied') { 
        signOut(auth); 
        showAlert("Tài khoản đã bị khóa hoặc hết hạn truy cập do sai mật khẩu quá nhiều lần.", {type: 'error'}); 
    }
  });
}

function render(){
  Object.keys(autoHideTimers).forEach(id => { clearInterval(autoHideTimers[id]?.interval); delete autoHideTimers[id]; }); visible = {};
  const q = (el.search.value || '').trim().toLowerCase(); el.list.innerHTML = '';
  const items = []; data.forEach((e, idx)=>{ if(e[CHECK_KEY] || (q && !String(e.display||'').toLowerCase().includes(q))) return; items.push({ entry: e, idx }); });
  el.statCount.textContent = items.length;
  
  const hasReal = data.some(e => !e[CHECK_KEY]);
  el.btnExportHeader.classList.toggle('hidden', !hasReal); 
  el.btnImportHeader.classList.remove('hidden');

  if (items.length === 0) {
    let t = hasReal ? (q ? 'Không tìm thấy kết quả' : 'Chưa có dữ liệu') : 'Chưa có dữ liệu';
    let sub = hasReal ? (q ? 'Vui lòng thử lại với từ khóa khác.' : '') : 'Nhấn nút (+) để thêm tài khoản mới.';
    el.list.innerHTML = `<div class="empty-state"><i data-lucide="inbox" class="w-10 h-10 text-slate-300 mb-1"></i><div class="empty-title">${t}</div><div class="empty-sub">${sub}</div></div>`;
  } else {
    items.sort((a,b)=>b.idx-a.idx).forEach(({entry})=>{
      const syncIcon = entry.pending ? '<i data-lucide="cloud-off" class="w-[16px] h-[16px] text-amber-500 ml-auto flex-shrink-0" title="Đang lưu nháp (offline)"></i>' : '<i data-lucide="cloud-check" class="w-[16px] h-[16px] text-teal-500 ml-auto flex-shrink-0" title="Đã đồng bộ"></i>';
      const div = document.createElement('div'); 
      div.className = 'entry';
      div.innerHTML = `
        <h4 class="flex items-center gap-2"><i data-lucide="box" class="w-[18px] h-[18px] text-teal-600 flex-shrink-0"></i> <span class="truncate">${escapeHtml(entry.display)}</span> ${syncIcon}</h4>
        <div class="row"><input id="acc-${entry.record_id}" class="ro" value="[Tài khoản đã được mã hóa]" readonly></div>
        <div class="row"><input id="pass-${entry.record_id}" class="ro" value="•••••••" readonly></div>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          <button class="btn green sm action-toggle" data-id="${entry.record_id}"><i data-lucide="eye" class="w-[12px] h-[12px] pointer-events-none"></i> Giải mã</button>
          <button class="btn text sm action-edit" data-id="${entry.record_id}"><i data-lucide="edit-2" class="w-[12px] h-[12px] pointer-events-none"></i> Sửa</button>
          <button class="btn danger sm action-delete" data-id="${entry.record_id}"><i data-lucide="trash-2" class="w-[12px] h-[12px] pointer-events-none"></i> Xóa</button>
        </div>`;
      el.list.appendChild(div);
    });
  }
  if (window.lucide) lucide.createIcons({root: el.list});
}

let searchT;
el.search.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(render, 200); });
document.addEventListener('click', e => { if(e.target?.classList?.contains('ro')) e.target.select(); });

const toggleShow = async (record_id, btn) => {
  if (btn.disabled) return;
  const accInp = $(`#acc-${record_id}`), passInp = $(`#pass-${record_id}`);
  if (visible[record_id]) { 
    clearInterval(autoHideTimers[record_id]?.interval); delete autoHideTimers[record_id]; visible[record_id] = false;
    accInp.value = '[Tài khoản đã được mã hóa]'; passInp.value = '•••••••'; btn.innerHTML = '<i data-lucide="eye" class="w-[15px] h-[15px]"></i> Giải mã'; if (window.lucide) lucide.createIcons({root: btn}); return;
  }
  const verify=data.find(e=>e[CHECK_KEY]); if(!verify) return showAlert('Bạn chưa thiết lập mật khẩu chính.', {type:'info'});
  if (isMasterLocked()) return showLockoutAlert();

  btn.disabled = true; const origHtml = btn.innerHTML; btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-3 h-3"></i>...'; if (window.lucide) lucide.createIcons({root:btn});
  try {
    const master = await showPrompt('Nhập mật khẩu chính.', 'Nhập Mật Khẩu...', 'Bảo Mật Tăng Cường', 'password', 'info');
    if(!master) return;
    if(await SecureCrypto.decryptSafe(verify[CHECK_KEY], master) !== CHECK_VALUE){ registerMasterFail(); showAlert(getWrongMasterMessage(), {type:'error'}); return; }
    resetMasterFail();

    const dekKey = await getDEKKey(master, verify);
    if(!dekKey) return showAlert('Không thể tải khóa dữ liệu hệ thống.', {type:'error'});

    const entry = data.find(e => e.record_id === record_id);
    const decAcc = await SecureCrypto.decryptWithDEK(entry.account, dekKey);
    const decPass = await SecureCrypto.decryptWithDEK(entry.password, dekKey);
    
    if(!decAcc || !decPass) return showAlert('Giải mã thất bại. Dữ liệu này có thể đã bị hỏng trong quá trình đồng bộ.', { title: 'Lỗi dữ liệu', type:'error' });

    visible[record_id]=true; accInp.value=decAcc; passInp.value=decPass;
    let rem = 15; btn.disabled = false; btn.innerHTML = `<i data-lucide="eye-off" class="w-3 h-3"></i> ${rem}s`; if (window.lucide) lucide.createIcons({root: btn});
    autoHideTimers[record_id] = { interval: setInterval(()=>{ rem--; if(rem>0){ btn.innerHTML=`<i data-lucide="eye-off" class="w-3 h-3"></i> ${rem}s`; if (window.lucide) lucide.createIcons({root: btn}); } else { toggleShow(record_id, btn); } }, 1000) };
  } finally { if(!visible[record_id]) { btn.disabled = false; btn.innerHTML = origHtml; if (window.lucide) lucide.createIcons({root:btn}); } }
};

function openEdit(open=true){ 
    el.editModal.classList.toggle('open',open); 
    el.editModal.setAttribute('aria-hidden', open?'false':'true'); 
    clearAllEditErrors();
    if(open) {
        setTimeout(()=>el.fDisplay.focus(),0); 
    } else { 
        editingId=null; 
        ['fDisplay','fAccount','fPassword','fMaster','fMasterConfirm'].forEach(id=>el[id].value=''); 
        el.strengthMsg.style.display='none'; el.masterConfirmHint.style.display='none'; el.masterConfirmRow.style.display='none'; 
    } 
}

function addEntryModal() { 
  el.editTitle.innerHTML='<i data-lucide="plus-square" class="w-5 h-5 text-teal-600"></i> Thêm'; 
  if (window.lucide) lucide.createIcons({root:el.editTitle}); 
  el.masterConfirmRow.style.display = data.find(e=>e[CHECK_KEY]) ? 'none':'flex'; 
  openEdit(true); 
}

el.miAdd.onclick = () => { closeMenuModal(); addEntryModal(); };

const checkMasterMatch = () => {
  if (el.masterConfirmRow.style.display === 'none') return;
  const pw1 = el.fMaster.value;
  const pw2 = el.fMasterConfirm.value;
  const isMatch = pw1 === pw2 && pw1 !== '';

  el.masterConfirmHint.className = 'small mt-1 flex items-center gap-1.5';
  el.masterConfirmHint.style.display = (pw1 || pw2) ? 'inline-flex' : 'none';
  el.masterConfirmHint.innerHTML = isMatch
    ? '<i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Mật khẩu trùng khớp'
    : '<i data-lucide="x-circle" class="w-3.5 h-3.5"></i> Mật khẩu không khớp';
  el.masterConfirmHint.style.color = isMatch ? '#0d9488' : '#dc3545';
  if (window.lucide) lucide.createIcons({ root: el.masterConfirmHint });
};

const updateStrength = () => {
    const pw = el.fMaster.value || '';
    el.strengthMsg.className = 'small mt-1 flex items-center gap-1.5 text-teal-600';
    el.strengthMsg.style.display = pw ? 'inline-flex' : 'none';
    el.strengthMsg.innerHTML = '<i data-lucide="shield-check" class="w-3.5 h-3.5"></i> ' + check(pw);
    if (window.lucide) lucide.createIcons({ root: el.strengthMsg });
};

el.fMaster.addEventListener('input', () => { updateStrength(); checkMasterMatch(); });
el.fMasterConfirm.addEventListener('input', checkMasterMatch);

el.btnSaveEdit.onclick = async () => {
  if(savingEdit) return; savingEdit=true; 
  el.btnSaveEdit.disabled=true; 
  el.btnSaveEdit.innerHTML='<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Đang lưu...';
  if (window.lucide) lucide.createIcons({root: el.btnSaveEdit});

  try {
    const d=el.fDisplay.value.trim(), a=el.fAccount.value.trim(), p=el.fPassword.value.trim(), m=el.fMaster.value;
    clearAllEditErrors();
    let isValid = true; let firstErrorInput = null;

    if(!d) { showInlineError(el.fDisplay, el.errDisplay, "Vui lòng nhập tên dịch vụ", false); isValid = false; firstErrorInput = firstErrorInput || el.fDisplay; }
    if(!a) { showInlineError(el.fAccount, el.errAccount, "Vui lòng nhập tài khoản", false); isValid = false; firstErrorInput = firstErrorInput || el.fAccount; }
    if(!p) { showInlineError(el.fPassword, el.errPassword, "Vui lòng nhập mật khẩu", false); isValid = false; firstErrorInput = firstErrorInput || el.fPassword; }
    if(!m) { showInlineError(el.fMaster, el.errMaster, "Vui lòng nhập mật khẩu chính", false); isValid = false; firstErrorInput = firstErrorInput || el.fMaster; }

    let verify=data.find(e=>e[CHECK_KEY]);
    let dekKeyToUse = activeDEKKey;

    if(!verify){
      if(m && m.length < 12) { 
          showInlineError(el.fMaster, el.errMaster, "Mật khẩu chính tối thiểu 12 ký tự", false); 
          isValid = false; firstErrorInput = firstErrorInput || el.fMaster; 
      }
      if(el.fMasterConfirm.value !== m) {
          showInlineError(el.fMasterConfirm, el.masterConfirmHint, "Mật khẩu xác nhận không khớp", false);
          isValid = false; firstErrorInput = firstErrorInput || el.fMasterConfirm;
      }
    }

    if (!isValid) {
        if (firstErrorInput) focusAndBlink(firstErrorInput);
        savingEdit = false; el.btnSaveEdit.disabled = false; 
        el.btnSaveEdit.innerHTML = '<i data-lucide="save" class="w-5 h-5"></i> Lưu dữ liệu'; 
        if (window.lucide) lucide.createIcons({root: el.btnSaveEdit}); return;
    }

    if (verify) {
      if (isMasterLocked()) {
         savingEdit = false; el.btnSaveEdit.disabled = false; el.btnSaveEdit.innerHTML='<i data-lucide="save" class="w-5 h-5"></i> Lưu dữ liệu'; if (window.lucide) lucide.createIcons({root: el.btnSaveEdit});
         return showLockoutAlert();
      }
      if(await SecureCrypto.decryptSafe(verify[CHECK_KEY], m) !== CHECK_VALUE){ 
        registerMasterFail(); showInlineError(el.fMaster, el.errMaster, getWrongMasterMessage());
        savingEdit = false; el.btnSaveEdit.disabled = false; el.btnSaveEdit.innerHTML='<i data-lucide="save" class="w-5 h-5"></i> Lưu dữ liệu'; if (window.lucide) lucide.createIcons({root: el.btnSaveEdit});
        return;
      }
      resetMasterFail();

      dekKeyToUse = await getDEKKey(m, verify);
      if (!dekKeyToUse) {
         savingEdit = false; el.btnSaveEdit.disabled = false; el.btnSaveEdit.innerHTML='<i data-lucide="save" class="w-5 h-5"></i> Lưu dữ liệu'; if (window.lucide) lucide.createIcons({root: el.btnSaveEdit});
         return showAlert('Không thể tải khóa dữ liệu. Dữ liệu bị lỗi.', {type:'error'});
      }
    } else {
      const newRawDEK = SecureCrypto.generateDEK();
      const encryptedDEK = await SecureCrypto.encrypt(newRawDEK, m);
      const checkValEnc = await SecureCrypto.encrypt(CHECK_VALUE, m);
      
      await setDoc(doc(db, "system", "verify"), { value: checkValEnc, encrypted_dek: encryptedDEK });
      dekKeyToUse = await SecureCrypto.importDEK(newRawDEK);
      activeDEKKey = dekKeyToUse;
    }

    toggleLoader(true, 'save', 'Đang lưu dữ liệu...');
    const currentTimeStr = getTimestamp();
    const record_id = editingId !== null ? editingId : currentTimeStr; 

    const encD = await SecureCrypto.encrypt(d, systemEncryptKey);
    const encA = await SecureCrypto.encryptWithDEK(a, dekKeyToUse);
    const encP = await SecureCrypto.encryptWithDEK(p, dekKeyToUse);

    setDoc(doc(db, "account", record_id), { record_id: record_id, display: encD, account: encA, password: encP, update: parseInt(currentTimeStr, 10) });

    toggleLoader(false, 'save'); 
    openEdit(false); 
    await showAlert(navigator.onLine ? 'Dữ liệu đã được lưu thành công.' : 'Đã lưu nháp ngoại tuyến (sẽ tự đồng bộ khi có mạng).', {type: 'success'}); 
    
  } catch(err) {
    toggleLoader(false, 'save');
    await showAlert(getFriendlyErrorMessage(err), { title: 'Không thể lưu', type:'error' });
  } finally { 
    savingEdit=false; el.btnSaveEdit.disabled=false; 
    el.btnSaveEdit.innerHTML='<i data-lucide="save" class="w-5 h-5"></i> Lưu dữ liệu'; 
    if (window.lucide) lucide.createIcons({root: el.btnSaveEdit});
  }
};
el.btnCancelEdit.onclick = el.editX.onclick = () => openEdit(false);

const editEntry = async (record_id) => {
  const verify=data.find(e=>e[CHECK_KEY]); if(!verify) return;
  if (isMasterLocked()) return showLockoutAlert();

  const m = await showPrompt('Nhập mật khẩu chính.', 'Mật Khẩu Chính...', 'Xác thực', 'password', 'info'); if(!m) return;
  if(await SecureCrypto.decryptSafe(verify[CHECK_KEY], m) !== CHECK_VALUE){ registerMasterFail(); return showAlert(getWrongMasterMessage(),{type:'error'}); } resetMasterFail();
  
  const dekKey = await getDEKKey(m, verify);
  if(!dekKey) return showAlert('Không thể tải khóa dữ liệu hệ thống.', {type:'error'});

  const cur = data.find(e=>e.record_id===record_id); 
  const decA = await SecureCrypto.decryptWithDEK(cur.account, dekKey);
  const decP = await SecureCrypto.decryptWithDEK(cur.password, dekKey);
  
  if(!decA||!decP) return showAlert('Giải mã thất bại. Dữ liệu này có thể đã bị hỏng trong quá trình đồng bộ.', { title: 'Lỗi dữ liệu', type:'error' });
  
  editingId=record_id; 
  el.editTitle.innerHTML='<i data-lucide="edit-3" class="w-5 h-5 text-teal-600"></i> Sửa'; if (window.lucide) lucide.createIcons({root:el.editTitle});
  el.fDisplay.value=cur.display; el.fAccount.value=decA; el.fPassword.value=decP; openEdit(true);
};

const deleteEntry = async (record_id) => {
  const verify=data.find(e=>e[CHECK_KEY]); if(!verify) return;
  if (isMasterLocked()) return showLockoutAlert();

  const m = await showPrompt('Nhập mật khẩu chính để xóa.', 'Mật Khẩu Chính...', 'Xác thực Hành động', 'password', 'warning'); if(!m) return;
  if(await SecureCrypto.decryptSafe(verify[CHECK_KEY], m) !== CHECK_VALUE){ registerMasterFail(); return showAlert(getWrongMasterMessage(),{type:'error'}); } resetMasterFail();
  
  if(await showConfirm('Bạn có chắc chắn muốn xóa tài khoản này? Hành động này không thể hoàn tác.', 'Cảnh báo', 'error')) { 
      toggleLoader(true, 'delete', 'Đang xóa...');
      try {
          deleteDoc(doc(db, "account", record_id)); 
          toggleLoader(false, 'delete'); 
          await showAlert(navigator.onLine ? 'Tài khoản đã được xóa.' : 'Đã xóa ngoại tuyến (sẽ tự đồng bộ khi có mạng).', {type: 'success'}); 
      } catch(e) {
          toggleLoader(false, 'delete');
          await showAlert(getFriendlyErrorMessage(e), { title: 'Lỗi khi xóa', type:'error' });
      }
  }
};

el.list.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.classList.contains('action-toggle')) toggleShow(id, btn);
  else if (btn.classList.contains('action-edit')) editEntry(id);
  else if (btn.classList.contains('action-delete')) deleteEntry(id);
});

function openCK(open=true){ 
  el.ckModal.classList.toggle('open',open); 
  clearAllCkErrors();
  if(!open){ 
    el.ckOld.value=el.ckNew.value=el.ckConfirm.value=''; 
    el.ckStrength.style.display=el.ckHint.style.display='none'; 
  } else { setTimeout(()=>el.ckOld.focus(),0); }
}

el.miChangeKey.onclick = () => { closeMenuModal(); if(data.some(e=>!e[CHECK_KEY])) openCK(true); else showAlert('Danh sách hiện đang trống.', {type: 'info'}); };
el.ckCancel.onclick = el.ckX.onclick = () => openCK(false);

el.ckOk.onclick = async () => {
  if (!navigator.onLine) return showAlert('Vui lòng bật mạng (WiFi/4G) để đổi mật khẩu chính!', {type: 'warning'});
  if (isMasterLocked()) return showLockoutAlert();
  
  const old=el.ckOld.value, nk=el.ckNew.value, cf=el.ckConfirm.value;
  const verify=data.find(e=>e[CHECK_KEY]);
  
  clearAllCkErrors();
  let isValid = true; let firstErrorInput = null;

  if (!old) { showInlineError(el.ckOld, el.errCkOld, "Vui lòng nhập mật khẩu hiện tại", false); isValid = false; firstErrorInput = firstErrorInput || el.ckOld; }
  if (!nk) { showInlineError(el.ckNew, el.errCkNew, "Vui lòng nhập mật khẩu mới", false); isValid = false; firstErrorInput = firstErrorInput || el.ckNew; }
  if (!cf) { showInlineError(el.ckConfirm, el.errCkConfirm, "Vui lòng xác nhận mật khẩu", false); isValid = false; firstErrorInput = firstErrorInput || el.ckConfirm; }
  if(nk && nk.length < 12) { showInlineError(el.ckNew, el.errCkNew, "Mật khẩu mới phải có tối thiểu 12 ký tự", false); isValid = false; firstErrorInput = firstErrorInput || el.ckNew; }
  if(cf && nk !== cf) { showInlineError(el.ckConfirm, el.errCkConfirm, "Xác nhận mật khẩu không khớp", false); isValid = false; firstErrorInput = firstErrorInput || el.ckConfirm; }
  
  if (!isValid) { if (firstErrorInput) focusAndBlink(firstErrorInput); return; }
  if(!verify) return showAlert('Không tìm thấy khóa dữ liệu hệ thống.', {type:'error'});
  
  if(await SecureCrypto.decryptSafe(verify[CHECK_KEY], old) !== CHECK_VALUE){ 
    registerMasterFail(); return showInlineError(el.ckOld, el.errCkOld, getWrongMasterMessage()); 
  } 
  resetMasterFail();
  
  toggleLoader(true, 'ck', 'Đang đổi mật khẩu...');
  el.ckOk.disabled = true;
  el.ckOk.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Đang xử lý...';
  if (window.lucide) lucide.createIcons({root: el.ckOk});

  try {
    const rawDEK = await SecureCrypto.decryptSafe(verify.encrypted_dek, old);
    if (!rawDEK) throw new Error('Không thể giải mã khóa dữ liệu cũ.');

    const newEncryptedDEK = await SecureCrypto.encrypt(rawDEK, nk);
    const newCheckVal = await SecureCrypto.encrypt(CHECK_VALUE, nk);

    await setDoc(doc(db, "system", "verify"), { value: newCheckVal, encrypted_dek: newEncryptedDEK });
    activeDEKKey = null;
    
    toggleLoader(false, 'ck'); openCK(false); 
    await showAlert('Đổi mật khẩu thành công. Mọi tài khoản đã được bảo vệ bằng mật khẩu mới!', {type:'success'});
  } catch(e) { 
    toggleLoader(false, 'ck');
    await showAlert(getFriendlyErrorMessage(e), { title: 'Đổi mật khẩu thất bại', type:'error' }); 
  } finally {
    el.ckOk.disabled = false;
    el.ckOk.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i> Xác nhận đổi';
    if (window.lucide) lucide.createIcons({root: el.ckOk});
  }
};

const updateStrengthCK = () => { 
    const pw = el.ckNew.value || ''; 
    el.ckStrength.className = 'small mt-1 flex items-center gap-1.5 text-amber-600';
    el.ckStrength.style.display = pw ? 'inline-flex' : 'none'; 
    el.ckStrength.innerHTML = '<i data-lucide="shield-check" class="w-3.5 h-3.5"></i> ' + check(pw); 
    
    el.ckHint.className = 'small mt-1 flex items-center gap-1.5';
    el.ckHint.style.display = el.ckConfirm.value ? 'inline-flex' : 'none'; 
    el.ckHint.innerHTML = el.ckConfirm.value === pw ? '<i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Mật khẩu trùng khớp' : '<i data-lucide="x-circle" class="w-3.5 h-3.5"></i> Mật khẩu không khớp'; 
    el.ckHint.style.color = el.ckConfirm.value === pw ? '#0d9488' : '#dc3545'; 
    if (window.lucide) lucide.createIcons({ root: el.ckNew.parentNode.parentNode }); 
};
el.ckNew.addEventListener('input', updateStrengthCK);
el.ckConfirm.addEventListener('input', updateStrengthCK);

function check(pw){ const s=(pw.length>=12?1:0)+(/[A-Z]/.test(pw)?1:0)+(/[a-z]/.test(pw)?1:0)+(/\d/.test(pw)?1:0)+(/[\W_]/.test(pw)?1:0); return s>4?' Bảo mật rất cao':s>3?' Bảo mật cao':s>2?' Bảo mật trung bình':' Bảo mật yếu'; }

function closeMenuModal() { $('#fab-menu-modal').classList.remove('open'); }
document.getElementById('btnOpenMenu').addEventListener('click', () => $('#fab-menu-modal').classList.add('open'));
document.getElementById('btnCloseMenu').addEventListener('click', closeMenuModal);

const exportData = async () => {
  const verify = data.find(e => e[CHECK_KEY]); if(!verify) return;
  if (isMasterLocked()) return showLockoutAlert();

  const m = await showPrompt('Mật khẩu chính để xuất.', 'Nhập mật khẩu...', 'Bảo vệ Sao lưu', 'password', 'info'); if(!m) return;
  if(await SecureCrypto.decryptSafe(verify[CHECK_KEY], m) !== CHECK_VALUE){ registerMasterFail(); return showAlert('Mật khẩu không chính xác.', {type:'error'}); } resetMasterFail();

  const exportList = data.map(item => {
    if (item[CHECK_KEY]) return { [CHECK_KEY]: item[CHECK_KEY], encrypted_dek: item.encrypted_dek }; 
    return { record_id: item.record_id, display: item.rawDisplay || item.display, account: item.account, password: item.password, update: item.update };
  });

  const b = new Blob([JSON.stringify(exportList, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `PWM_Cloud_${getTimestamp()}.json`; a.click(); 
  showAlert('Dữ liệu đã được tải xuống máy của bạn an toàn.', {type: 'success'});
};

el.btnExportHeader.addEventListener('click', exportData);
el.miExport.onclick = () => { closeMenuModal(); exportData(); };

el.btnImportHeader.addEventListener('click', () => el.fileImport.click());
el.miImport.onclick = () => { closeMenuModal(); el.fileImport.click(); };

el.fileImport.onchange = (e) => {
  if (!navigator.onLine) { e.target.value = ''; return showAlert('Vui lòng bật mạng (WiFi/4G) để khôi phục dữ liệu!', {type: 'warning'}); }
  const f = e.target.files?.[0]; if(!f) return; 
  if (f.name && !f.name.toLowerCase().endsWith('.json')) { e.target.value = ''; return showAlert('Vui lòng chọn tệp định dạng .json hợp lệ.', {type: 'error'}); }
  if (isMasterLocked()) { showLockoutAlert(); e.target.value = ''; return; }

  const r = new FileReader();
  r.onload = async ev => {
    try{
      let imported;
      try { imported = JSON.parse(ev.target.result); } catch (parseErr) { throw new Error("Tệp tin bị hỏng hoặc không phải là JSON hợp lệ."); }
      validateImportSchema(imported);

      const verify = imported.find(x=>x[CHECK_KEY]);
      const m = await showPrompt('Nhập mật khẩu của tệp dữ liệu (JSON).', 'Nhập mật khẩu...', 'Khôi phục Dữ liệu', 'password', 'info'); 
      if(!m) { e.target.value=''; return; }
      
      if(await SecureCrypto.decryptSafe(verify[CHECK_KEY], m) !== CHECK_VALUE){ registerMasterFail(); await showAlert('Mật khẩu không chính xác.', {type:'error'}); e.target.value=''; return; } resetMasterFail();
      if(!await showConfirm('Hành động này sẽ xóa vĩnh viễn dữ liệu hiện tại và thay thế bằng dữ liệu mới. Bạn vẫn muốn tiếp tục?', 'Cảnh báo Nguy hiểm', 'error')) { e.target.value=''; return; }
      
      toggleLoader(true, 'import', 'Đang khôi phục...');
      const batch = writeBatch(db);
      batch.set(doc(db, "system", "verify"), { value: verify[CHECK_KEY], encrypted_dek: verify.encrypted_dek });
      
      (await getDocs(collection(db, "account"))).forEach(d => batch.delete(d.ref));
      
      for(const i of imported){
        if(i[CHECK_KEY] || (!i.display && !i.rawDisplay)) continue;
        let finalD = i.rawDisplay || i.display;
        try { if(!await SecureCrypto.decryptSafe(finalD, systemEncryptKey)) finalD = await SecureCrypto.encrypt(String(i.display || ''), systemEncryptKey); } catch{ finalD = await SecureCrypto.encrypt(String(i.display || ''), systemEncryptKey); }
        const newRecordId = String(i.record_id || getTimestamp());
        batch.set(doc(db, "account", newRecordId), { record_id: newRecordId, display: finalD, account: String(i.account || ''), password: String(i.password || ''), update: parseInt(i.update, 10) || parseInt(getTimestamp(), 10) });
      }
      await batch.commit(); 
      toggleLoader(false, 'import'); await showAlert('Dữ liệu đã được khôi phục thành công.', {type: 'success'});
    } catch(err) { toggleLoader(false, 'import'); await showAlert(getFriendlyErrorMessage(err), { title: 'Lỗi khôi phục dữ liệu', type:'error' }); } finally { e.target.value=''; }
  }; r.readAsText(f);
};

el.miReset.onclick = async () => {
  closeMenuModal(); 
  if (!navigator.onLine) return showAlert('Vui lòng bật mạng (WiFi/4G) để xóa toàn bộ dữ liệu!', {type: 'warning'});
  
  const verify=data.find(e=>e[CHECK_KEY]); if(!verify) return;
  if (isMasterLocked()) return showLockoutAlert();

  const m = await showPrompt('Bạn có chắc muốn xóa TOÀN BỘ dữ liệu trên hệ thống?', 'Mật Khẩu Chính...', 'Cảnh báo Nguy hiểm', 'password', 'error'); if(!m) return;
  if(await SecureCrypto.decryptSafe(verify[CHECK_KEY], m) !== CHECK_VALUE){ registerMasterFail(); return showAlert('Mật khẩu không chính xác.', {type:'error'}); } resetMasterFail();
  
  if(!await showConfirm('Lưu ý: Dữ liệu sau khi xóa sẽ không thể khôi phục. Bạn vẫn muốn tiếp tục?', 'Bước cuối cùng', 'error')) return;
  
  toggleLoader(true, 'reset', 'Đang xóa dữ liệu...');
  try {
      const batch = writeBatch(db); 
      (await getDocs(collection(db, "account"))).forEach(d => batch.delete(d.ref)); 
      batch.delete(doc(db, "system", "verify")); 
      await batch.commit(); 
      activeDEKKey = null;
      toggleLoader(false, 'reset'); await showAlert('Toàn bộ dữ liệu đã được xóa khỏi hệ thống.', {type: 'success'});
  } catch (e) {
      toggleLoader(false, 'reset'); await showAlert(getFriendlyErrorMessage(e), { title: 'Không thể reset', type:'error' });
  }
};

function openGen(o=true){ el.genModal.classList.toggle("open",o); if(o) generatePassword(); }

let shuffler = null; let genTimeout = null; 

function rand(max) { 
  if (max <= 0) return 0;
  const maxUint32 = 4294967295;
  const limit = maxUint32 - (maxUint32 % max); 
  const a = new Uint32Array(1); 
  do { crypto.getRandomValues(a); } while (a[0] >= limit); 
  return a[0] % max; 
}

function generatePassword() {
  let len = parseInt(el.genLength.value, 10);
  if (isNaN(len) || len < 6) len = 6; if (len > 100) len = 100;
  el.genLength.value = len; 

  let sets = [];
  if (el.genLower.checked) sets.push("abcdefghijklmnopqrstuvwxyz"); 
  if (el.genUpper.checked) sets.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ"); 
  if (el.genNumber.checked) sets.push("0123456789"); 
  if (el.genSymbol.checked) sets.push("!@#$_");
  
  if (!sets.length) return showAlert("Vui lòng chọn ít nhất một nhóm ký tự.", {type: 'warning'});
  
  let pwd = []; sets.forEach(s => pwd.push(s[rand(s.length)])); 
  const all = sets.join(""); 
  while (pwd.length < len) pwd.push(all[rand(all.length)]);
  
  el.genBtn.disabled = true; el.genStrength.textContent = ""; 
  clearInterval(shuffler); clearTimeout(genTimeout);
  
  shuffler = setInterval(() => { 
    for(let i = pwd.length - 1; i > 0; i--){ const j = rand(i + 1); [pwd[i], pwd[j]] = [pwd[j], pwd[i]]; } 
    el.genResult.value = pwd.join(""); 
  }, 40);
  
  genTimeout = setTimeout(() => { 
    clearInterval(shuffler); el.genBtn.disabled = false; 
    const finalPassword = pwd.join(""); el.genResult.value = finalPassword; 
    el.genStrength.innerHTML = '<div class="flex items-center gap-1.5 text-teal-600 mt-1.5 text-[13px] font-bold"><i data-lucide="shield-check" class="w-4 h-4"></i> ' + check(finalPassword) + '</div>';
    if (window.lucide) lucide.createIcons({ root: el.genStrength });
  }, 1000);
}

function closeGenModal() {
  clearInterval(shuffler); clearTimeout(genTimeout);
  el.genBtn.disabled = false; el.genResult.value = ""; el.genStrength.textContent = ""; 
  openGen(false);
}

el.miGenerate.onclick = ()=>{ closeMenuModal(); openGen(); }; 
el.genBtn.onclick = generatePassword; 
el.genClose.onclick = el.genX.onclick = closeGenModal; 
el.genResult.onclick = function(){ this.select(); };    

el.aboutCheckUpdate.onclick = () => { if (appUpdater) appUpdater.check(); };
el.miAbout.onclick = ()=>{ closeMenuModal(); el.aboutModal.classList.add('open'); }; 
el.aboutX.onclick = el.aboutClose.onclick = () => el.aboutModal.classList.remove('open');

let defPrompt; 
window.addEventListener('beforeinstallprompt', e => { 
  e.preventDefault(); defPrompt = e; 
  el.miInstall.style.display = 'flex'; el.btnInstallHeader.classList.remove('hidden'); 
  if (el.btnInstallLogin) el.btnInstallLogin.classList.remove('hidden');
});

const openInstallModal = (e) => {
  if (e) e.stopPropagation(); closeMenuModal();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) { el.installNow.style.display = 'none'; el.iosTip.style.display = 'block'; } 
  else { el.installNow.style.display = 'flex'; el.iosTip.style.display = 'none'; }
  el.installModal.classList.add('open');
};

el.miInstall.onclick = openInstallModal; el.btnInstallHeader.onclick = openInstallModal; 
if (el.btnInstallLogin) el.btnInstallLogin.onclick = openInstallModal;
el.installX.onclick = el.installLater.onclick = () => el.installModal.classList.remove('open');

el.installNow.onclick = async () => {
  if (defPrompt) { 
    defPrompt.prompt(); await defPrompt.userChoice; defPrompt = null; 
    el.miInstall.style.display = 'none'; el.btnInstallHeader.classList.add('hidden'); 
    if (el.btnInstallLogin) el.btnInstallLogin.classList.add('hidden');
  } 
  el.installModal.classList.remove('open');
};

window.addEventListener('DOMContentLoaded', () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isIOS && !isStandalone) { el.miInstall.style.display = 'flex'; el.btnInstallHeader.classList.remove('hidden'); if (el.btnInstallLogin) el.btnInstallLogin.classList.remove('hidden'); }
});

window.addEventListener('appinstalled', () => showAlert('Ứng dụng đã được thêm vào màn hình chính thành công.', {type: 'success'}));

setTimeout(()=>{ const s = document.getElementById('splash'); if(s){ s.classList.add('hidden'); document.body.classList.add('ready'); } }, 1200);

window.addEventListener('offline', () => {
  if (currentUserUid && el.connectionStatus && el.connectionWrapper) {
    el.connectionStatus.textContent = "Đang hoạt động ngoại tuyến";
    el.connectionWrapper.classList.replace('text-teal-100/90', 'text-amber-200');
    el.connectionWrapper.classList.replace('bg-white/10', 'bg-amber-900/40');
    const oldIcon = document.getElementById('connection-icon'); if (oldIcon) oldIcon.remove();
    el.connectionStatus.insertAdjacentHTML('beforebegin', '<i id="connection-icon" data-lucide="cloud-off" class="w-3 h-3 text-amber-400 transition-colors duration-300"></i>');
    if (window.lucide) lucide.createIcons({root: el.connectionWrapper});
  }
});

window.addEventListener('online', () => {
  if (currentUserUid && el.connectionStatus && el.connectionWrapper) {
    el.connectionStatus.textContent = "Đã kết nối máy chủ an toàn";
    el.connectionWrapper.classList.replace('text-amber-200', 'text-teal-100/90');
    el.connectionWrapper.classList.replace('bg-amber-900/40', 'bg-white/10');
    const oldIcon = document.getElementById('connection-icon'); if (oldIcon) oldIcon.remove();
    el.connectionStatus.insertAdjacentHTML('beforebegin', '<i id="connection-icon" data-lucide="cloud-cog" class="w-3 h-3 text-teal-300 transition-colors duration-300"></i>');
    if (window.lucide) lucide.createIcons({root: el.connectionWrapper});
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const action = new URLSearchParams(window.location.search).get('action');
  if (action) {
    setTimeout(() => {
      if (!$('#app').classList.contains('invisible')) {
        if (action === 'new') addEntryModal(); else if (action === 'search' && el.search) el.search.focus(); else if (action === 'backup') exportData();
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 2000); 
  }
});

const navHomeBtn = document.getElementById('nav-home');
if (navHomeBtn) {
  navHomeBtn.onclick = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); if (el.search && el.search.value !== '') { el.search.value = ''; render(); } };
}