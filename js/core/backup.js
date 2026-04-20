// ─── BACKUP AUTOMÁTICO DE COLA OFFLINE ──────────────────────────────────────
// Guarda una copia de seguridad de la cola offline antes de sincronizar.
// Se ejecuta en segundo plano, sin intervención del usuario.

const BACKUP_KEY = 'tallerpro_queue_backup';
const BACKUP_TIMESTAMP_KEY = 'tallerpro_queue_backup_ts';

async function backup_crearSnapshot() {
  try {
    const queue = await getAllQueue();
    if (!queue || queue.length === 0) return;

    const snapshot = {
      queue: queue,
      fecha: new Date().toISOString(),
      usuario: currentUser?.id || 'desconocido',
      taller: tid() || 'desconocido'
    };

    localStorage.setItem(BACKUP_KEY, JSON.stringify(snapshot));
    localStorage.setItem(BACKUP_TIMESTAMP_KEY, Date.now().toString());

    console.log('✅ Backup de cola offline creado:', queue.length, 'items');
  } catch (e) {
    console.warn('Error creando backup offline:', e);
  }
}

function backup_obtenerSnapshot() {
  try {
    const data = localStorage.getItem(BACKUP_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

function backup_obtenerTimestamp() {
  return localStorage.getItem(BACKUP_TIMESTAMP_KEY) || null;
}

async function backup_restaurarDesdeSnapshot() {
  const snapshot = backup_obtenerSnapshot();
  if (!snapshot || !snapshot.queue || snapshot.queue.length === 0) {
    return { restaurado: 0 };
  }

  const db = await openOfflineDB();
  const tx = db.transaction('queue', 'readwrite');
  const store = tx.objectStore('queue');

  let restaurado = 0;
  for (const item of snapshot.queue) {
    try {
      // Evitar duplicados
      const all = await new Promise(resolve => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
      });

      const existe = all.some(existing =>
        existing.table === item.table &&
        existing.action === item.action &&
        JSON.stringify(existing.data) === JSON.stringify(item.data)
      );

      if (!existe) {
        await new Promise((resolve, reject) => {
          const req = store.add({ ...item, createdAt: Date.now(), restoredFromBackup: true });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        restaurado++;
      }
    } catch (e) {
      console.warn('Error restaurando item:', item, e);
    }
  }

  // No borramos el backup automáticamente; el usuario puede decidir limpiarlo
  return { restaurado };
}

function backup_limpiarSnapshot() {
  localStorage.removeItem(BACKUP_KEY);
  localStorage.removeItem(BACKUP_TIMESTAMP_KEY);
}

// Interceptar processOfflineQueue para hacer backup antes de sincronizar
const originalProcessOfflineQueue = processOfflineQueue;
processOfflineQueue = async function() {
  await backup_crearSnapshot();
  return await originalProcessOfflineQueue.apply(this, arguments);
};
