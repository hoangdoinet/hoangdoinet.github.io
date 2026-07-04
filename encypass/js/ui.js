export const $ = s => document.querySelector(s);

export function escapeHtml(s) { 
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); 
}

const activeLoaders = new Map();
let loaderShowTimeout = null;

export function toggleLoader(show, id = 'default', message = 'Đang xử lý...') {
  const loader = document.getElementById('global-loader');
  const loaderText = document.getElementById('loader-text');
  const loaderCard = document.getElementById('loader-card');
  if (!loader) return;
  
  if (show) {
    activeLoaders.set(id, message);
  } else {
    activeLoaders.delete(id);
  }
  
  if (activeLoaders.size > 0) {
    const latestMessage = Array.from(activeLoaders.values()).pop();
    if (loaderText) loaderText.textContent = latestMessage;
    
    if (!loaderShowTimeout && loader.classList.contains('opacity-0')) {
      loaderShowTimeout = setTimeout(() => {
        loader.classList.remove('opacity-0', 'pointer-events-none');
        if (loaderCard) loaderCard.classList.remove('scale-95');
      }, 250); 
    }
  } else {
    if (loaderShowTimeout) {
      clearTimeout(loaderShowTimeout);
      loaderShowTimeout = null;
    }
    loader.classList.add('opacity-0', 'pointer-events-none');
    if (loaderCard) loaderCard.classList.add('scale-95');
  }
}

export function focusAndBlink(target) { 
  if(!target) return; 
  try { 
    target.focus({preventScroll:false}); 
    if(typeof target.select==='function' && target.type!=='password') target.select(); 
    target.classList.remove('ring-invalid'); 
    void target.offsetWidth; 
    target.classList.add('ring-invalid'); 
  } catch{} 
}

export function showInlineError(inputEl, errorEl, msg, autoFocus = true) {
  if (!errorEl) return;
  if (msg) errorEl.innerHTML = `<i data-lucide="alert-circle" class="w-3 h-3"></i> ${msg}`;
  if (window.lucide) lucide.createIcons({root: errorEl});
  errorEl.classList.remove('hidden');
  if (inputEl) inputEl.classList.add('ring-invalid');
  if (inputEl && autoFocus) focusAndBlink(inputEl);
}

export function clearInlineError(inputEl, errorEl) {
  if (errorEl) errorEl.classList.add('hidden');
  if (inputEl) inputEl.classList.remove('ring-invalid');
}

const modalQueue = [];
let isModalActive = false;

function processModalQueue() {
  if (isModalActive || modalQueue.length === 0) return;
  isModalActive = true;
  
  const { config, resolve } = modalQueue.shift();
  const { title='Thông báo', message='', showInput=false, inputType='text', placeholder='', okText='Xác nhận', cancelText='Hủy', cancelVisible=true, type='info' } = config;

  const icons = {
    success: { icon: 'check-circle-2', colors: 'text-emerald-500 bg-emerald-50 border-emerald-100', btn: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 text-white' },
    error: { icon: 'x-circle', colors: 'text-rose-500 bg-rose-50 border-rose-100', btn: 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20 text-white' },
    warning: { icon: 'alert-triangle', colors: 'text-amber-500 bg-amber-50 border-amber-100', btn: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white' },
    info: { icon: 'info', colors: 'text-teal-500 bg-teal-50 border-teal-100', btn: 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20 text-white' }
  };
  const t = icons[type] || icons.info;

  const modal = document.getElementById('modal');
  const iconEl = document.getElementById('modalIconContainer');
  const modalTitle = document.getElementById('modalTitle');
  const modalMsg = document.getElementById('modalMsg');
  const modalInput = document.getElementById('modalInput');
  const modalOk = document.getElementById('modalOk');
  const modalCancel = document.getElementById('modalCancel');

  iconEl.className = `w-20 h-20 rounded-full flex items-center justify-center mb-5 border-[4px] transition-all duration-500 ease-out scale-50 opacity-0 ${t.colors}`;
  iconEl.innerHTML = `<i data-lucide="${t.icon}" class="w-10 h-10"></i>`;
  
  modalTitle.textContent = title;
  modalMsg.textContent = message;
  
  modalInput.style.display = showInput ? 'block' : 'none';
  modalInput.type = inputType || 'text';
  modalInput.placeholder = placeholder || '';
  modalInput.value = '';
  
  modalOk.textContent = okText;
  modalOk.className = `btn flex-1 !min-h-[50px] transition-all ${t.btn}`;
  
  modalCancel.textContent = cancelText;
  modalCancel.style.display = cancelVisible ? 'inline-flex' : 'none';
  
  if (window.lucide) lucide.createIcons({root: iconEl});
  
  let resolved = false; 

  const onOk = () => finish(showInput ? modalInput.value : true);
  const onCancel = () => finish(false);
  const onKeydown = (e) => { 
    if(!modal.classList.contains('open')) return; 
    if(e.key === 'Enter') { e.preventDefault(); onOk(); } 
    if(e.key === 'Escape') { e.preventDefault(); onCancel(); } 
  };

  const cleanup = () => { 
    modal.classList.remove('open'); 
    modal.setAttribute('aria-hidden', 'true'); 
    modalInput.value = ''; 
    
    modalOk.removeEventListener('click', onOk);
    modalCancel.removeEventListener('click', onCancel);
    window.removeEventListener('keydown', onKeydown, true); 
    
    setTimeout(() => {
      isModalActive = false;
      processModalQueue();
    }, 300);
  };

  const finish = (val) => { if(resolved) return; resolved = true; cleanup(); resolve(val); };
  
  modalOk.addEventListener('click', onOk);
  modalCancel.addEventListener('click', onCancel);
  window.addEventListener('keydown', onKeydown, true);
  
  modal.classList.add('open'); 
  modal.setAttribute('aria-hidden','false'); 
  
  setTimeout(() => {
      iconEl.classList.remove('scale-50', 'opacity-0');
      iconEl.classList.add('scale-100', 'opacity-100');
  }, 50);

  setTimeout(() => showInput ? modalInput.focus() : modalOk.focus(), 100);
}

export function openModal(config) {
  return new Promise(resolve => {
    modalQueue.push({ config, resolve });
    processModalQueue();
  });
}

export function showAlert(msg, opts={}) { 
    const {title, focus=null, type='info'} = opts || {}; 
    const defaultTitles = { success: 'Thành công', error: 'Lỗi', warning: 'Cảnh báo', info: 'Thông báo' };
    const finalTitle = title || defaultTitles[type] || 'Thông báo';
    
    return openModal({title: finalTitle, message: msg, okText: 'Đã hiểu', cancelVisible: false, type}).then(v=>{ 
        focusAndBlink(typeof focus==='string'? $(focus): focus); return v; 
    }); 
}

export const showConfirm = (msg, title='Xác nhận', type='warning') => openModal({title, message: msg, okText: 'Đồng ý', cancelText: 'Hủy', cancelVisible: true, type});
export const showPrompt = (msg, placeholder='', title='Xác thực', inputType='text', type='info') => openModal({title, message: msg, showInput: true, inputType, placeholder, okText: 'Xác nhận', cancelText: 'Hủy', cancelVisible: true, type});