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

// Interceptar operaciones offline para invalidar caché
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
