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
