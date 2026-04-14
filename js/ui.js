// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--accent)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function openModal(html) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}
function closeModal() {
  const m = document.getElementById('modal-overlay');
  if (m) m.remove();
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const tid = () => currentPerfil?.taller_id;

function gs(n) {
  let num = parseFloat(n);
  if (isNaN(num)) num = 0;
  return num.toLocaleString('es-PY');
}

function formatPhone(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 10) v = v.slice(0, 10);
  let formatted = '';
  for (let i = 0; i < v.length; i++) {
    if (i === 4) formatted += ' ';
    formatted += v[i];
  }
  input.value = formatted;
}

function phoneInput(id, value, placeholder) {
  const prefijos = [
    {code:'+595',flag:'🇵🇾',name:'PY'},
    {code:'+54',flag:'🇦🇷',name:'AR'},
    {code:'+55',flag:'🇧🇷',name:'BR'},
    {code:'+56',flag:'🇨🇱',name:'CL'},
    {code:'+57',flag:'🇨🇴',name:'CO'},
    {code:'+598',flag:'🇺🇾',name:'UY'},
    {code:'+51',flag:'🇵🇪',name:'PE'},
    {code:'+591',flag:'🇧🇴',name:'BO'},
    {code:'+593',flag:'🇪🇨',name:'EC'},
    {code:'+58',flag:'🇻🇪',name:'VE'},
    {code:'+52',flag:'🇲🇽',name:'MX'},
    {code:'+1',flag:'🇺🇸',name:'US'},
    {code:'+34',flag:'🇪🇸',name:'ES'},
  ];
  const opts = prefijos.map(p => `<option value="${p.code}" ${p.code==='+595'?'selected':''}>${p.flag} ${p.code}</option>`).join('');
  return `<div class="phone-wrap"><select class="phone-prefix" id="${id}-prefix">${opts}</select><input class="form-input" id="${id}" type="tel" value="${h(value||'')}" placeholder="${placeholder||'0981 123 456'}" oninput="formatPhone(this)"></div>`;
}

function estadoBadge(e) { return { pendiente:'badge-yellow', en_progreso:'badge-orange', esperando_repuestos:'badge-blue', finalizado:'badge-green' }[e]||'badge-blue'; }
function estadoLabel(e) { return { pendiente:t('repEstPendiente'), en_progreso:t('repEstProgreso'), esperando_repuestos:'Esperando repuestos', finalizado:t('repEstFinalizado') }[e]||e; }

// ─── PAGINACIÓN ─────────────────────────────────────────────────────────────
const PAGE_SIZE = 30;
function renderPagination(total, offset, onNavigate) {
  if (total <= PAGE_SIZE) return '';
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;
  const current = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  return `<div style="display:flex;justify-content:center;align-items:center;gap:1rem;padding:1rem 0">
    ${hasPrev ? `<button onclick="${onNavigate}(${offset - PAGE_SIZE})" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .8rem;cursor:pointer;font-size:.8rem">← Anterior</button>` : ''}
    <span style="font-size:.75rem;color:var(--text2)">${current} / ${totalPages}</span>
    ${hasNext ? `<button onclick="${onNavigate}(${offset + PAGE_SIZE})" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .8rem;cursor:pointer;font-size:.8rem">Siguiente →</button>` : ''}
  </div>`;
}

// ─── DEBOUNCE ───────────────────────────────────────────────────────────────
const _debounceTimers = {};
function debounce(key, fn, ms = 400) {
  clearTimeout(_debounceTimers[key]);
  _debounceTimers[key] = setTimeout(fn, ms);
}

// ─── SKELETON LOADING ───────────────────────────────────────────────────────
function getSkeleton(page) {
  if (page === 'dashboard') return `<div style="padding:.25rem 0"><div class="skeleton skel-title"></div><div class="skeleton skel-search"></div><div class="stats-grid"><div class="skeleton skel-stat"></div><div class="skeleton skel-stat"></div><div class="skeleton skel-stat"></div><div class="skeleton skel-stat"></div></div><div class="skeleton skel-panel"></div><div class="skeleton skel-card"></div><div class="skeleton skel-card"></div><div class="skeleton skel-card"></div></div>`;
  if (['clientes','vehiculos','reparaciones','inventario','creditos','empleados','presupuestos','usuarios'].includes(page)) return `<div class="skeleton skel-title"></div><div class="skeleton skel-search"></div><div class="skeleton skel-card"></div><div class="skeleton skel-card"></div><div class="skeleton skel-card"></div><div class="skeleton skel-card"></div><div class="skeleton skel-card"></div>`;
  if (page === 'reportes') return `<div class="skeleton skel-title"></div><div class="stats-grid"><div class="skeleton skel-stat"></div><div class="skeleton skel-stat"></div></div><div class="skeleton skel-panel"></div><div class="skeleton skel-panel"></div>`;
  return `<div class="skeleton skel-card"></div><div class="skeleton skel-card"></div><div class="skeleton skel-card"></div>`;
}

// ─── RATE LIMITING EN LOGIN ─────────────────────────────────────────────────
let _loginAttempts = 0;
let _loginLockUntil = 0;

function checkLoginRateLimit() {
  if (Date.now() < _loginLockUntil) {
    const secsLeft = Math.ceil((_loginLockUntil - Date.now()) / 1000);
    showAuthError(`Demasiados intentos. Esperá ${secsLeft} segundos.`);
    return false;
  }
  _loginAttempts++;
  if (_loginAttempts >= 5) {
    _loginLockUntil = Date.now() + 60000;
    _loginAttempts = 0;
    showAuthError('Demasiados intentos. Esperá 60 segundos.');
    return false;
  }
  return true;
}

function resetLoginAttempts() { _loginAttempts = 0; _loginLockUntil = 0; }

// ─── CHART.JS LAZY LOADER ───────────────────────────────────────────────────
let _chartJsLoaded = false;
async function loadChartJs() {
  if (_chartJsLoaded || window.Chart) { _chartJsLoaded = true; return; }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = () => { _chartJsLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('No se pudo cargar Chart.js'));
    document.head.appendChild(s);
  });
}

// ─── MANEJO GLOBAL DE ERRORES ────────────────────────────────────────────────
window.onerror = (msg, src, line) => { console.error(`Error: ${msg} at ${src}:${line}`); toast('Ocurrió un error inesperado','error'); };
window.onunhandledrejection = (e) => { console.error('Unhandled:', e.reason); toast('Error de conexión','error'); };

// ─── PROTECCIÓN DOBLE CLICK ─────────────────────────────────────────────────
let _guardando = false;
function guardando() {
  if (_guardando) { toast('Guardando...','info'); return true; }
  _guardando = true;
  setTimeout(() => _guardando = false, 3000);
  return false;
}

// ─── SEARCHABLE SELECT ──────────────────────────────────────────────────────
function searchableSelect(id, placeholder) {
  return `<div style="position:relative">
    <input class="form-input" id="${id}-search" placeholder="${placeholder}" autocomplete="off"
      oninput="ssSearch('${id}',this.value)" onfocus="ssSearch('${id}',this.value)">
    <input type="hidden" id="${id}">
    <div id="${id}-results" style="display:none;position:absolute;z-index:50;width:100%;max-height:180px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:0 0 10px 10px;box-shadow:0 4px 12px rgba(0,0,0,.3)"></div>
  </div>`;
}

window._ssCallbacks = {};
function ssRegister(id, searchFn) { window._ssCallbacks[id] = searchFn; }

async function ssSearch(id, query) {
  const results = document.getElementById(id+'-results');
  if (!query || query.length < 1) { results.style.display = 'none'; return; }
  const fn = window._ssCallbacks[id];
  if (!fn) return;
  const items = await fn(query);
  if (!items?.length) {
    results.innerHTML = '<div style="padding:.5rem;font-size:.78rem;color:var(--text2)">Sin resultados</div>';
    results.style.display = 'block';
    return;
  }
  results.innerHTML = items.map(item =>
    `<div onclick="ssSelect('${id}','${item.id}','${h(item.label)}')" style="padding:.5rem .7rem;font-size:.82rem;cursor:pointer;border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">${h(item.label)}</div>`
  ).join('');
  results.style.display = 'block';
}

function ssSelect(id, value, label) {
  document.getElementById(id).value = value;
  document.getElementById(id+'-search').value = label;
  document.getElementById(id+'-results').style.display = 'none';
}

function ssSetValue(id, value, label) {
  const hidden = document.getElementById(id);
  const search = document.getElementById(id+'-search');
  if (hidden) hidden.value = value || '';
  if (search) search.value = label || '';
}

document.addEventListener('click', (e) => {
  document.querySelectorAll('[id$="-results"]').forEach(el => {
    if (!el.parentElement.contains(e.target)) el.style.display = 'none';
  });
});

let _pendingConfirm = null;
function confirmar(msg, onConfirm) {
  _pendingConfirm = onConfirm;
  openModal(`
    <div style="text-align:center;padding:.5rem">
      <div style="font-size:2rem;margin-bottom:.75rem">⚠️</div>
      <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--text);margin-bottom:.5rem">¿Estás seguro?</div>
      <div style="font-size:.85rem;color:var(--text2);margin-bottom:1.5rem">${h(msg)}</div>
      <div style="display:flex;gap:.75rem">
        <button class="btn-secondary" style="margin:0;flex:1" onclick="closeModal()">${t('cancelar')}</button>
        <button class="btn-danger" style="margin:0;flex:1" id="btn-confirm-action">CONFIRMAR</button>
      </div>
    </div>`);
  setTimeout(() => {
    const btn = document.getElementById('btn-confirm-action');
    if (btn) btn.addEventListener('click', () => { closeModal(); if (_pendingConfirm) { _pendingConfirm(); _pendingConfirm = null; } });
  }, 50);
}

function cleanNum(v) {
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

const MAX_FOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_FOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
let _pendingFotoFile = null;

function previewFoto(input, hiddenId, previewId) {
  const file = input.files[0];
  _pendingFotoFile = null;
  if (!file) return;
  if (!ALLOWED_FOTO_TYPES.includes(file.type)) {
    toast('Solo se permiten imágenes JPG, PNG o WebP','error');
    input.value = '';
    return;
  }
  if (file.size > MAX_FOTO_SIZE) {
    toast('La imagen no puede superar 5MB','error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_DIM = 800;
      let w = img.width, ht = img.height;
      if (w > MAX_DIM || ht > MAX_DIM) {
        if (w > ht) { ht = Math.round(ht * MAX_DIM / w); w = MAX_DIM; }
        else { w = Math.round(w * MAX_DIM / ht); ht = MAX_DIM; }
      }
      canvas.width = w; canvas.height = ht;
      canvas.getContext('2d').drawImage(img, 0, 0, w, ht);
      const previewUrl = canvas.toDataURL('image/jpeg', 0.7);
      document.getElementById(previewId).innerHTML = `<img src="${previewUrl}" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`;
      canvas.toBlob(blob => { _pendingFotoFile = blob; }, 'image/jpeg', 0.7);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function safeFotoUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/png') || url.startsWith('data:image/webp')) return url;
  if (url.startsWith('https://')) return url;
  return '';
}

function esAdmin() {
  const rol = currentPerfil?.rol;
  return rol === 'admin' || rol === 'superadmin';
}
