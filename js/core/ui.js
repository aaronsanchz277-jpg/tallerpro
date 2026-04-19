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

// ─── VERIFICACIÓN DE CONEXIÓN PARA ACCIONES CRÍTICAS ─────────────────────────
function requireOnline(actionName = 'realizar esta acción') {
  if (!navigator.onLine) {
    toast(`Necesitás conexión a internet para ${actionName}`, 'error');
    return false;
  }
  return true;
  // ─── ICONOS SVG (sin emojis) ─────────────────────────────────────────────────
function iconoSVG(nombre, color = 'currentColor', tamaño = 20) {
  const iconos = {
    // Dashboard / KPIs
    clientes: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    vehiculos: '<rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-3"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    enProgreso: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    hoy: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    creditos: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
    ingresos: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    ganancia: '<polyline points="23 6 13.5 15.5 8.5 10.5 3 16"/><polyline points="17 6 23 6 23 12"/>',
    stockBajo: '<path d="M21.5 18.5L12 13v-6M12 3v6M2.5 18.5L12 13"/><line x1="12" y1="7" x2="12" y2="13"/><circle cx="12" cy="19" r="1.5"/>',
    nuevoTrabajo: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
    cobrar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    turnos: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    cierreCaja: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    alerta: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1"/>',
    buscar: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    tema: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    // Acciones
    guardar: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    cancelar: '<circle cx="12" cy="12" r="10"/><line x1="18" y1="6" x2="6" y2="18"/>',
    eliminar: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    editar: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    volver: '<polyline points="15 18 9 12 15 6"/>',
    pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
    whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    // Estados
    pendiente: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1"/>',
    completado: '<circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="${tamaño}" height="${tamaño}">${iconos[nombre] || ''}</svg>`;
}

