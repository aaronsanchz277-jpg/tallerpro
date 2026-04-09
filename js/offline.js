// ─── OFFLINE: IndexedDB para cache local ─────────────────────────────────────
const DB_NAME = 'tallerpro_offline';
const DB_VERSION = 1;
let _offlineDB = null;

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    if (_offlineDB) { resolve(_offlineDB); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => { _offlineDB = e.target.result; resolve(_offlineDB); };
    req.onerror = e => reject(e.target.error);
  });
}

// Guardar datos en cache local
async function cacheLocal(key, data) {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').put({ key, data, timestamp: Date.now() });
  } catch(e) { console.warn('Cache write failed:', e); }
}

// Leer datos del cache local
async function readCache(key) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction('cache', 'readonly');
      const req = tx.objectStore('cache').get(key);
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror = () => resolve(null);
    });
  } catch(e) { return null; }
}

// ─── OFFLINE: Cola de operaciones pendientes ─────────────────────────────────
async function addToQueue(operation) {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add({ ...operation, createdAt: Date.now() });
    updateSyncBadge();
  } catch(e) { console.error('Queue write failed:', e); }
}

async function getQueueCount() {
  try {
    const db = await openOfflineDB();
    return new Promise(resolve => {
      const tx = db.transaction('queue', 'readonly');
      const req = tx.objectStore('queue').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch(e) { return 0; }
}

async function getAllQueue() {
  try {
    const db = await openOfflineDB();
    return new Promise(resolve => {
      const tx = db.transaction('queue', 'readonly');
      const req = tx.objectStore('queue').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch(e) { return []; }
}

async function clearQueueItem(id) {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(id);
  } catch(e) {}
}

// Procesar cola cuando vuelve internet
async function processOfflineQueue() {
  if (!navigator.onLine) return;
  const items = await getAllQueue();
  if (items.length === 0) return;
  
  let processed = 0;
  for (const item of items) {
    try {
      const { table, action, data, matchField, matchValue } = item;
      let result;
      if (action === 'insert') {
        result = await sb.from(table).insert(data);
      } else if (action === 'update') {
        result = await sb.from(table).update(data).eq(matchField, matchValue);
      } else if (action === 'delete') {
        result = await sb.from(table).delete().eq(matchField, matchValue);
      }
      if (!result.error) {
        await clearQueueItem(item.id);
        processed++;
      }
    } catch(e) {
      console.warn('Sync failed for item:', item.id, e);
    }
  }
  
  if (processed > 0) {
    toast(`✓ ${processed} cambio${processed>1?'s':''} sincronizado${processed>1?'s':''}`, 'success');
    // Refrescar la vista actual
    if (currentPage) navigate(currentPage);
  }
  updateSyncBadge();
}

// ─── OFFLINE: Wrapper para operaciones CRUD ──────────────────────────────────
// Reemplaza las llamadas directas a Supabase cuando no hay internet
async function offlineInsert(table, data) {
  if (navigator.onLine) {
    const result = await sb.from(table).insert(data);
    if (!result.error) cacheLocal(`${table}_list`, null); // Invalidar cache
    return result;
  }
  // Offline: guardar en cola
  await addToQueue({ table, action: 'insert', data });
  toast('Guardado offline — se sincronizará al volver internet', 'info');
  return { data: [data], error: null };
}

async function offlineUpdate(table, data, matchField, matchValue) {
  if (navigator.onLine) {
    const result = await sb.from(table).update(data).eq(matchField, matchValue);
    return result;
  }
  await addToQueue({ table, action: 'update', data, matchField, matchValue });
  toast('Actualizado offline — se sincronizará', 'info');
  return { data: [data], error: null };
}

async function offlineDelete(table, matchField, matchValue) {
  if (navigator.onLine) {
    const result = await sb.from(table).delete().eq(matchField, matchValue);
    return result;
  }
  await addToQueue({ table, action: 'delete', matchField, matchValue });
  toast('Eliminado offline — se sincronizará', 'info');
  return { error: null };
}

// ─── OFFLINE: Wrapper para queries (lee cache si offline) ────────────────────
const _memCache = {};
const CACHE_TTL = 30000; // 30 segundos

function clearCache(prefix) {
  if (!prefix) { Object.keys(_memCache).forEach(k => delete _memCache[k]); return; }
  Object.keys(_memCache).forEach(k => { if (k.startsWith(prefix)) delete _memCache[k]; });
  Object.keys(_memCache).forEach(k => { if (k.startsWith('dash_')) delete _memCache[k]; });
  // Invalidar contexto IA
  if (typeof _iaContextCache !== 'undefined') _iaContextCache = null;
}

async function cachedQuery(cacheKey, queryFn) {
  // Cache en memoria: si la query se hizo hace menos de 30s, devolver resultado anterior
  if (_memCache[cacheKey] && (Date.now() - _memCache[cacheKey].ts < CACHE_TTL)) {
    return _memCache[cacheKey].result;
  }
  if (navigator.onLine) {
    try {
      const result = await queryFn();
      // Detectar sesión expirada
      if (result.error && (result.error.code === 'PGRST301' || result.error.code === '401' || result.error.message?.includes('JWT') || result.error.message?.includes('token'))) {
        toast('Tu sesión expiró. Volvé a iniciar sesión.','error');
        logout();
        return { data: [], count: 0, error: result.error };
      }
      if (result.data || result.count !== undefined) {
        _memCache[cacheKey] = { result, ts: Date.now() };
        cacheLocal(cacheKey, result);
      }
      return result;
    } catch(e) {
      // Network error — fall through to cache
    }
  }
  // Offline o error de red: leer del cache en memoria primero
  if (_memCache[cacheKey]) return _memCache[cacheKey].result;
  const cached = await readCache(cacheKey);
  if (cached) return cached;
  return { data: [], count: 0, error: { message: 'Sin conexión y sin datos en cache' } };
}

// Wrapper seguro para queries directas (no cacheadas)
async function safeQuery(queryFn, fallback = null) {
  try {
    const result = await queryFn();
    if (result.error) {
      if (result.error.code === 'PGRST301' || result.error.code === '401' || result.error.message?.includes('JWT')) {
        toast('Tu sesión expiró. Volvé a iniciar sesión.','error');
        logout();
        return fallback !== null ? { data: fallback, error: result.error } : result;
      }
      console.warn('Query error:', result.error.message);
    }
    return result;
  } catch(e) {
    console.error('Query exception:', e);
    toast('Error de conexión','error');
    return { data: fallback, error: { message: e.message } };
  }
}

// ─── OFFLINE: Estado de conexión ─────────────────────────────────────────────
let _isOnline = navigator.onLine;

function updateOnlineStatus() {
  _isOnline = navigator.onLine;
  const bar = document.getElementById('offline-bar');
  if (bar) bar.classList.toggle('show', !_isOnline);
  document.body.classList.toggle('is-offline', !_isOnline);
  
  // Cuando vuelve internet, sincronizar
  if (_isOnline) {
    setTimeout(processOfflineQueue, 1000);
  }
}

async function updateSyncBadge() {
  const count = await getQueueCount();
  const badge = document.getElementById('sync-badge');
  if (badge) {
    badge.textContent = `⏳ ${count}`;
    badge.classList.toggle('show', count > 0);
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
// Init on load
setTimeout(updateOnlineStatus, 100);

