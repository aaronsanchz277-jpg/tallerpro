// ─── CORE: Utilidades fundamentales para toda la app ─────────────────────────
let _offlineIndicatorVisible = false;

async function safeCall(fn, btnId = null, errorMsg = 'Ocurrió un error. Intentá de nuevo.') {
  const btn = btnId ? document.getElementById(btnId) : null;
  const originalText = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Cargando...'; }
  try {
    const result = await fn();
    return result;
  } catch (error) {
    console.error('Error en safeCall:', error);
    toast(errorMsg, 'error');
    throw error;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}

async function tryCatch(fn, errorMsg = 'Ocurrió un error') {
  try { return await fn(); }
  catch (error) { console.error(error); toast(errorMsg, 'error'); throw error; }
}

function showOfflinePendingIndicator() {
  if (_offlineIndicatorVisible) return;
  const indicator = document.createElement('div');
  indicator.id = 'offline-pending-indicator';
  indicator.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--warning);color:#000;padding:8px 16px;border-radius:30px;font-size:0.8rem;font-family:var(--font-head);font-weight:600;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px;white-space:nowrap;';
  indicator.innerHTML = `<span>⏳</span><span>Cambios sin sincronizar</span><button onclick="forceSyncNow()" style="background:rgba(0,0,0,0.2);border:none;color:#000;border-radius:20px;padding:4px 10px;margin-left:8px;cursor:pointer;font-size:0.7rem;font-weight:bold">Sincronizar</button>`;
  document.body.appendChild(indicator);
  _offlineIndicatorVisible = true;
}

function hideOfflinePendingIndicator() {
  const el = document.getElementById('offline-pending-indicator');
  if (el) el.remove();
  _offlineIndicatorVisible = false;
}

async function forceSyncNow() {
  toast('Sincronizando...', 'info');
  await processOfflineQueue();
  const count = await getQueueCount();
  if (count === 0) { hideOfflinePendingIndicator(); toast('✓ Todo sincronizado', 'success'); }
  else { toast(`Quedan ${count} elementos por sincronizar`, 'warning'); }
}

function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && !value.trim())) {
    toast(`El campo "${fieldName}" es obligatorio`, 'error');
    return false;
  }
  return true;
}

function validatePositiveNumber(value, fieldName) {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) {
    toast(`El campo "${fieldName}" debe ser un número mayor a 0`, 'error');
    return false;
  }
  return true;
}

function formatMoneda(valor) { return '₲ ' + gs(valor); }
function formatNumero(valor) { return new Intl.NumberFormat('es-PY').format(valor || 0); }
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : ''; }

const originalToast = toast;
toast = function(msg, type = 'info', duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--accent)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
};
