// ─── COMPONENTS: Selectores, modales y fragmentos HTML reutilizables ─────────
let _cachedClientes = null;
let _cachedClientesTimestamp = 0;
const CACHE_CLIENTES_TTL = 60000;

async function getClientes() {
  const now = Date.now();
  if (_cachedClientes && (now - _cachedClientesTimestamp) < CACHE_CLIENTES_TTL) return _cachedClientes;
  const { data } = await sb.from('clientes').select('id, nombre, telefono').eq('taller_id', tid()).order('nombre');
  _cachedClientes = data || [];
  _cachedClientesTimestamp = now;
  return _cachedClientes;
}

let _cachedVehiculos = null;
let _cachedVehiculosTimestamp = 0;
const CACHE_VEHICULOS_TTL = 60000;

async function getVehiculos() {
  const now = Date.now();
  if (_cachedVehiculos && (now - _cachedVehiculosTimestamp) < CACHE_VEHICULOS_TTL) return _cachedVehiculos;
  const { data } = await sb.from('vehiculos').select('id, patente, marca, modelo, cliente_id, clientes(nombre)').eq('taller_id', tid()).order('patente');
  _cachedVehiculos = data || [];
  _cachedVehiculosTimestamp = now;
  return _cachedVehiculos;
}

function invalidateComponentCache() {
  _cachedClientes = null;
  _cachedVehiculos = null;
}

// ─── ANTI-DUPLICADOS: helpers compartidos ──────────────────────────────────
function normalizarTelefono(tel) {
  if (tel === null || tel === undefined) return '';
  return String(tel).replace(/\D/g, '');
}

function normalizarPatente(p) {
  if (p === null || p === undefined) return '';
  return String(p).toUpperCase().replace(/\s+/g, '');
}

async function buscarClienteExistente(tallerId, { telefono, ruc } = {}, excludeId = null) {
  const telN = normalizarTelefono(telefono);
  const rucN = (ruc || '').toString().trim();
  if (!telN && !rucN) return null;
  const { data, error } = await sb
    .from('clientes')
    .select('id, nombre, telefono, ruc')
    .eq('taller_id', tallerId);
  if (error || !data) return null;
  for (const c of data) {
    if (excludeId && c.id === excludeId) continue;
    if (rucN && c.ruc && String(c.ruc).trim() === rucN) return c;
    if (telN && normalizarTelefono(c.telefono) === telN) return c;
  }
  return null;
}

async function buscarVehiculoExistente(tallerId, patente, excludeId = null) {
  const pat = normalizarPatente(patente);
  if (!pat) return null;
  // Usamos .limit(1) en vez de .maybeSingle() para tolerar el caso de
  // duplicados preexistentes en la base (justamente el problema que esta
  // tarea ayuda a frenar). .maybeSingle() devuelve error si hay >1 fila.
  const { data, error } = await sb
    .from('vehiculos')
    .select('id, patente, marca, modelo, cliente_id, clientes(nombre)')
    .eq('taller_id', tallerId)
    .eq('patente', pat)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error || !data || !data.length) return null;
  const fila = data[0];
  if (excludeId && fila.id === excludeId) {
    // Si la primera coincidencia es la fila editada, buscamos cualquier otra.
    const { data: otras } = await sb
      .from('vehiculos')
      .select('id, patente, marca, modelo, cliente_id, clientes(nombre)')
      .eq('taller_id', tallerId)
      .eq('patente', pat)
      .neq('id', excludeId)
      .limit(1);
    return (otras && otras.length) ? otras[0] : null;
  }
  return fila;
}

// Modal apilable de confirmación: NO cierra el modal de fondo.
// Devuelve 'usar' | 'crear' | 'cancelar'.
function confirmarDuplicado({ titulo, mensajeHtml, etiquetaUsar = 'Usar el existente', etiquetaCrear = 'Crear de todos modos' }) {
  return new Promise(resolve => {
    const prev = document.getElementById('modal-dup-overlay');
    if (prev) prev.remove();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-dup-overlay';
    overlay.style.zIndex = 300;
    overlay.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div style="text-align:center;padding:.25rem">
          <div style="font-size:1.8rem;margin-bottom:.4rem">⚠️</div>
          <div style="font-family:var(--font-head);font-size:1rem;color:var(--accent);margin-bottom:.5rem">${h(titulo || 'Posible duplicado')}</div>
          <div style="font-size:.85rem;color:var(--text);margin-bottom:1rem;text-align:left;line-height:1.45">${mensajeHtml}</div>
          <div style="display:flex;flex-direction:column;gap:.5rem">
            <button class="btn-primary" id="dup-usar" style="margin:0">${h(etiquetaUsar)}</button>
            <button class="btn-secondary" id="dup-crear" style="margin:0">${h(etiquetaCrear)}</button>
            <button id="dup-cancelar" style="margin:0;background:none;border:none;color:var(--text2);font-size:.78rem;cursor:pointer;padding:.4rem">Cancelar</button>
          </div>
        </div>
      </div>`;
    const finish = (resultado) => { overlay.remove(); resolve(resultado); };
    overlay.addEventListener('click', e => { if (e.target === overlay) finish('cancelar'); });
    document.body.appendChild(overlay);
    document.getElementById('dup-usar').addEventListener('click', () => finish('usar'));
    document.getElementById('dup-crear').addEventListener('click', () => finish('crear'));
    document.getElementById('dup-cancelar').addEventListener('click', () => finish('cancelar'));
  });
}

async function renderClienteSelect(selectId, selectedId = null, includeEmpty = true) {
  const clientes = await getClientes();
  const options = clientes.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${h(c.nombre)}${c.telefono ? ' · ' + c.telefono : ''}</option>`).join('');
  const emptyOption = includeEmpty ? `<option value="">${t('sinCliente')}</option>` : '';
  return `<select class="form-input" id="${selectId}">${emptyOption}${options}</select>`;
}

async function renderVehiculoSelect(selectId, selectedId = null, clienteId = null, includeEmpty = true) {
  let vehiculos = await getVehiculos();
  if (clienteId) vehiculos = vehiculos.filter(v => v.cliente_id === clienteId);
  const options = vehiculos.map(v => `<option value="${v.id}" ${v.id === selectedId ? 'selected' : ''}>${h(v.patente)} · ${h(v.marca)} ${h(v.modelo || '')}${v.clientes ? ' (' + h(v.clientes.nombre) + ')' : ''}</option>`).join('');
  const emptyOption = includeEmpty ? `<option value="">${t('sinVehiculo')}</option>` : '';
  return `<select class="form-input" id="${selectId}">${emptyOption}${options}</select>`;
}

function renderEstadoSelect(selectId, selectedEstado = 'pendiente') {
  const estados = [
    { value: 'pendiente', label: t('repEstPendiente') },
    { value: 'en_progreso', label: t('repEstProgreso') },
    { value: 'esperando_repuestos', label: 'Esperando repuestos' },
    { value: 'finalizado', label: t('repEstFinalizado') }
  ];
  const options = estados.map(e => `<option value="${e.value}" ${e.value === selectedEstado ? 'selected' : ''}>${e.label}</option>`).join('');
  return `<select class="form-input" id="${selectId}">${options}</select>`;
}

function renderFechaInput(id, value = null) {
  const fecha = value || new Date().toISOString().split('T')[0];
  return `<input class="form-input" id="${id}" type="date" value="${fecha}">`;
}

function renderMontoInput(id, value = '', placeholder = '0', min = 0) {
  return `<input class="form-input" id="${id}" type="number" min="${min}" value="${value}" placeholder="${placeholder}">`;
}

function renderNotasTextarea(id, value = '', rows = 2) {
  return `<textarea class="form-input" id="${id}" rows="${rows}" placeholder="Observaciones...">${h(value)}</textarea>`;
}

// ─── RECIENTES (localStorage) ───────────────────────────────────────────────
// Memoria local (por taller) de los últimos clientes/reparaciones tocados.
// Usado por el dashboard ("Recientes") y el command palette para sugerir
// resultados sin pegarle a la red.
function _recientesKey(tipo) {
  const t = tid() || 'global';
  return `tp_recientes_${tipo}_${t}`;
}
function recordReciente(tipo, item) {
  if (!item || !item.id) return;
  try {
    const key = _recientesKey(tipo);
    const lista = JSON.parse(localStorage.getItem(key) || '[]');
    const filtrada = lista.filter(x => x.id !== item.id);
    filtrada.unshift({ ...item, _ts: Date.now() });
    localStorage.setItem(key, JSON.stringify(filtrada.slice(0, 10)));
  } catch (_) { /* localStorage lleno o bloqueado */ }
}
function getRecientes(tipo, limit = 5) {
  try {
    const lista = JSON.parse(localStorage.getItem(_recientesKey(tipo)) || '[]');
    return lista.slice(0, limit);
  } catch (_) { return []; }
}

// ─── COMBOBOX AUTOCOMPLETAR (reusable) ──────────────────────────────────────
// Input visible + lista filtrada en vivo + hidden con el id elegido.
// items: [{ id, label, sub?, hidden? (string para búsqueda extra) }]
// onChange (opcional): nombre de función global a invocar cuando cambia el id.
function renderComboboxAuto(id, items, { placeholder = 'Buscar...', selectedId = null, allowEmpty = true, onChange = null } = {}) {
  const sel = items.find(i => String(i.id) === String(selectedId));
  const valLabel = sel ? sel.label : '';
  window._comboboxData = window._comboboxData || {};
  window._comboboxData[id] = { items, onChange, allowEmpty };
  return `<div style="position:relative" data-combo="${id}">
    <input type="text" class="form-input" id="${id}-search" autocomplete="off"
      value="${h(valLabel)}" placeholder="${h(placeholder)}"
      oninput="comboboxFilter('${id}', this.value)"
      onfocus="comboboxFilter('${id}', this.value)"
      onkeydown="comboboxKey('${id}', event)">
    <input type="hidden" id="${id}" value="${h(selectedId || '')}">
    <div id="${id}-results" style="display:none;position:absolute;z-index:50;left:0;right:0;top:100%;margin-top:2px;max-height:220px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:0 0 10px 10px;box-shadow:0 6px 18px rgba(0,0,0,.35)"></div>
  </div>`;
}

function comboboxFilter(id, q) {
  const cfg = (window._comboboxData || {})[id];
  if (!cfg) return;
  const cont = document.getElementById(id + '-results');
  if (!cont) return;
  const term = (q || '').trim().toLowerCase();
  const list = cfg.items.filter(it => {
    if (!term) return true;
    const haystack = `${it.label || ''} ${it.sub || ''} ${it.hidden || ''}`.toLowerCase();
    return haystack.includes(term);
  }).slice(0, 30);
  // Si el texto coincide exactamente con un label, marcamos hidden
  const hidden = document.getElementById(id);
  if (hidden) {
    const exact = cfg.items.find(it => (it.label || '').toLowerCase() === term);
    hidden.value = exact ? exact.id : '';
    if (cfg.onChange) {
      try { window[cfg.onChange] && window[cfg.onChange](hidden.value); } catch(_){}
    }
  }
  if (list.length === 0) {
    cont.innerHTML = `<div style="padding:.55rem .65rem;font-size:.78rem;color:var(--text2)">Sin coincidencias</div>`;
    cont.style.display = 'block';
    return;
  }
  cont.innerHTML = list.map(it => {
    const lbl = it.label || '';
    const labelHtml = term ? hh(lbl, term) : h(lbl);
    const subHtml = it.sub ? (term ? hh(it.sub, term) : h(it.sub)) : '';
    return `
    <div onclick="comboboxPick('${id}','${hjs(String(it.id))}','${hjs(lbl)}')" style="padding:.5rem .65rem;cursor:pointer;border-bottom:1px solid var(--border);font-size:.85rem" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div>${labelHtml}</div>
      ${it.sub ? `<div style="font-size:.7rem;color:var(--text2);margin-top:1px">${subHtml}</div>` : ''}
    </div>`;
  }).join('');
  cont.style.display = 'block';
}

function comboboxPick(id, value, label) {
  const cfg = (window._comboboxData || {})[id] || {};
  const search = document.getElementById(id + '-search');
  const hidden = document.getElementById(id);
  const results = document.getElementById(id + '-results');
  if (search) search.value = label;
  if (hidden) hidden.value = value;
  if (results) results.style.display = 'none';
  if (cfg.onChange) {
    try { window[cfg.onChange] && window[cfg.onChange](value); } catch(_){}
  }
}

function comboboxKey(id, ev) {
  if (ev.key === 'Escape') {
    const r = document.getElementById(id + '-results');
    if (r) r.style.display = 'none';
  } else if (ev.key === 'Enter') {
    const r = document.getElementById(id + '-results');
    if (r && r.style.display !== 'none') {
      const first = r.querySelector('div[onclick]');
      if (first) { first.click(); ev.preventDefault(); }
    }
  }
}

// Cierra resultados al hacer click afuera del combobox
document.addEventListener('click', (e) => {
  document.querySelectorAll('[data-combo]').forEach(box => {
    if (!box.contains(e.target)) {
      const id = box.getAttribute('data-combo');
      const r = document.getElementById(id + '-results');
      if (r) r.style.display = 'none';
    }
  });
});

const originalOfflineInsert = offlineInsert;
offlineInsert = async function(table, data) {
  const result = await originalOfflineInsert(table, data);
  if (table === 'clientes' || table === 'vehiculos') invalidateComponentCache();
  return result;
};
const originalOfflineUpdate = offlineUpdate;
offlineUpdate = async function(table, data, matchField, matchValue) {
  const result = await originalOfflineUpdate(table, data, matchField, matchValue);
  if (table === 'clientes' || table === 'vehiculos') invalidateComponentCache();
  return result;
};
const originalOfflineDelete = offlineDelete;
offlineDelete = async function(table, matchField, matchValue) {
  const result = await originalOfflineDelete(table, matchField, matchValue);
  if (table === 'clientes' || table === 'vehiculos') invalidateComponentCache();
  return result;
};
