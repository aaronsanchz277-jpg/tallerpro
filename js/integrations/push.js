// ─── PUSH NOTIFICATIONS ─────────────────────────────────────────────────────
const PUSH_STORAGE_KEY = 'tallerpro_push_enabled';
let _pushCheckTimer = null;

async function pushRequestPermission() {
  if (!('Notification' in window)) {
    toast('Tu navegador no soporta notificaciones', 'error');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    toast('Las notificaciones están bloqueadas. Habilítalas en la config del navegador.', 'error');
    return false;
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    localStorage.setItem(PUSH_STORAGE_KEY, '1');
    toast('✓ Notificaciones activadas', 'success');
    pushStartChecking();
    return true;
  }
  return false;
}

function pushNotify(title, body, tag, onclick) {
  if (Notification.permission !== 'granted') return;
  const options = {
    body,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="%230a0a0f"/><text x="32" y="44" font-size="32" text-anchor="middle" fill="%2300e5ff" font-family="sans-serif" font-weight="bold">T</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="%2300e5ff"/></svg>',
    tag: tag || 'tallerpro-' + Date.now(),
    vibrate: [200, 100, 200],
    requireInteraction: false,
    silent: false
  };
  try {
    const notif = new Notification(title, options);
    if (onclick) {
      notif.onclick = () => { window.focus(); onclick(); notif.close(); };
    }
  } catch (e) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options));
    }
  }
}

async function pushCheckCitas() {
  if (!currentPerfil || Notification.permission !== 'granted') return;
  const hoy = new Date().toISOString().split('T')[0];
  const ahora = new Date();
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes();

  await safeCall(async () => {
    const { data: citas } = await sb.from('citas').select('id,descripcion,fecha,hora,clientes(nombre)')
      .eq('taller_id', tid()).eq('fecha', hoy).in('estado', ['pendiente', 'confirmada']);
    if (!citas || citas.length === 0) return;

    const notificadas = JSON.parse(localStorage.getItem('tallerpro_notif_citas') || '{}');
    const hoyKey = hoy;

    citas.forEach(c => {
      if (notificadas[c.id + '_' + hoyKey]) return;
      if (c.hora) {
        const [h, m] = c.hora.split(':').map(Number);
        const minutosCita = h * 60 + m;
        const diff = minutosCita - horaActual;
        if (diff > 0 && diff <= 60) {
          pushNotify(`📅 Cita en ${diff} min`, `${c.descripcion}${c.clientes ? ' — ' + c.clientes.nombre : ''} a las ${c.hora.slice(0, 5)}`, 'cita-' + c.id, () => navigate('agenda'));
          notificadas[c.id + '_' + hoyKey] = true;
        }
      }
    });
    localStorage.setItem('tallerpro_notif_citas', JSON.stringify(notificadas));
  }, null, 'Error verificando citas');
}

async function pushCheckMantenimientos() {
  if (!currentPerfil || Notification.permission !== 'granted') return;
  if (currentPerfil.rol === 'cliente') return;

  const hoy = new Date().toISOString().split('T')[0];
  const notifKey = 'tallerpro_notif_mant_' + hoy;
  if (localStorage.getItem(notifKey)) return;

  await safeCall(async () => {
    const { data } = await sb.from('mantenimientos').select('id,tipo,vehiculos(patente),clientes(nombre)')
      .eq('taller_id', tid()).eq('estado', 'activo').lte('proximo_fecha', hoy).limit(10);
    if (!data || data.length === 0) return;
    pushNotify(`🔔 ${data.length} mantenimiento${data.length > 1 ? 's' : ''} vencido${data.length > 1 ? 's' : ''}`, data.slice(0, 3).map(m => `${m.tipo} — ${m.vehiculos?.patente || ''}`).join(', '), 'mant-vencidos', () => navigate('mantenimientos'));
    localStorage.setItem(notifKey, '1');
  }, null, 'Error verificando mantenimientos');
}

async function pushCheckStock() {
  if (!currentPerfil || Notification.permission !== 'granted') return;
  if (currentPerfil.rol === 'cliente') return;

  const notifKey = 'tallerpro_notif_stock_' + new Date().toISOString().split('T')[0];
  if (localStorage.getItem(notifKey)) return;

  await safeCall(async () => {
    const { data } = await sb.from('inventario').select('nombre,cantidad,stock_minimo').eq('taller_id', tid()).limit(200);
    const bajo = (data || []).filter(i => parseFloat(i.cantidad) <= parseFloat(i.stock_minimo));
    if (bajo.length === 0) return;
    pushNotify(`⚠ ${bajo.length} producto${bajo.length > 1 ? 's' : ''} con stock bajo`, bajo.slice(0, 3).map(i => `${i.nombre}: ${i.cantidad}`).join(', '), 'stock-bajo', () => navigate('inventario'));
    localStorage.setItem(notifKey, '1');
  }, null, 'Error verificando stock');
}

async function pushRunChecks() {
  await pushCheckCitas();
  await pushCheckMantenimientos();
  await pushCheckStock();
}

function pushStartChecking() {
  if (_pushCheckTimer) clearInterval(_pushCheckTimer);
  setTimeout(pushRunChecks, 10000);
  _pushCheckTimer = setInterval(pushRunChecks, 15 * 60 * 1000);
}

function pushInit() {
  if (Notification.permission === 'granted' && localStorage.getItem(PUSH_STORAGE_KEY)) {
    pushStartChecking();
  }
}

function getPushBanner() {
  if (!('Notification' in window)) return '';
  if (Notification.permission === 'granted') return '';
  if (Notification.permission === 'denied') return '';
  return `<div onclick="pushRequestPermission()" style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.15);border-radius:10px;padding:.6rem;margin-bottom:1rem;cursor:pointer;display:flex;align-items:center;gap:.6rem">
    <span style="font-size:1.3rem">🔔</span>
    <div>
      <div style="font-size:.82rem;color:var(--accent);font-family:var(--font-head)">Activar notificaciones</div>
      <div style="font-size:.7rem;color:var(--text2)">Recordatorios de citas y mantenimientos</div>
    </div>
  </div>`;
}

function pushCleanOldNotifs() {
  try {
    const citasStr = localStorage.getItem('tallerpro_notif_citas');
    if (citasStr) {
      const citas = JSON.parse(citasStr);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      const cleaned = {};
      Object.entries(citas).forEach(([k, v]) => { const dateMatch = k.match(/\d{4}-\d{2}-\d{2}/); if (dateMatch && dateMatch[0] >= cutoffStr) cleaned[k] = v; });
      localStorage.setItem('tallerpro_notif_citas', JSON.stringify(cleaned));
    }
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('tallerpro_notif_mant_') || k.startsWith('tallerpro_notif_stock_')) {
        const dateMatch = k.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
          if (dateMatch[0] < cutoff.toISOString().split('T')[0]) localStorage.removeItem(k);
        }
      }
    });
  } catch (e) {}
}

pushCleanOldNotifs();
