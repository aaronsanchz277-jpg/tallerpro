// ─── ASISTENTE DE CONFIGURACIÓN INICIAL (Tarea #62) ─────────────────────────
// Se dispara una sola vez después de crear un taller nuevo. 4-5 pasos
// secuenciales con barra de progreso. Solo "Datos fiscales" es obligatorio
// para marcar el setup como completado; el resto se puede saltar y queda
// listado en la tarjeta de "Configuración pendiente" del dashboard.
//
// Estado:
//   currentPerfil.talleres.setup_completado          → timestamptz | NULL
//   currentPerfil.talleres.setup_pasos_pendientes    → jsonb (array de claves)
//
// Claves de pasos: 'datos' | 'moneda' | 'servicios' | 'pwa'
// (logo se omite hasta que exista la columna `logo_url`).

// ─── SERVICIOS TÍPICOS PRECARGADOS ───────────────────────────────────────────
// Lista pensada para taller mecánico hispanohablante. El admin marca los que
// ofrece y se insertan en `inventario` con categoria='Servicios' y stock alto
// para que nunca aparezca como "agotado".
const SETUP_SERVICIOS_TIPICOS = [
  { nombre: 'Cambio de aceite y filtro', precio: 0 },
  { nombre: 'Alineación', precio: 0 },
  { nombre: 'Balanceo', precio: 0 },
  { nombre: 'Cambio de pastillas de freno', precio: 0 },
  { nombre: 'Cambio de batería', precio: 0 },
  { nombre: 'Service general (10.000 km)', precio: 0 },
  { nombre: 'Diagnóstico computarizado', precio: 0 },
  { nombre: 'Cambio de correa de distribución', precio: 0 },
  { nombre: 'Cambio de bujías', precio: 0 },
  { nombre: 'Cambio de amortiguadores', precio: 0 },
  { nombre: 'Cambio de embrague', precio: 0 },
  { nombre: 'Lavado y engrase', precio: 0 }
];

// ─── ESTADO DEL WIZARD ──────────────────────────────────────────────────────
let _setupPasos = [];          // array de claves de pasos a mostrar (en orden)
let _setupIdx = 0;             // índice del paso actual
let _setupPasosSaltados = new Set();   // claves de pasos saltados/no completados
let _setupActivo = false;

// ─── DETECCIÓN DE FEATURES ──────────────────────────────────────────────────
function _setupTieneMoneda() {
  // La columna moneda_simbolo existe si loadPerfil pudo cargarla. Como el
  // fallback en cascada la quita silenciosamente, chequeamos por presencia.
  return typeof MONEDA_PRESETS !== 'undefined' &&
         currentPerfil?.talleres &&
         'moneda_simbolo' in currentPerfil.talleres;
}

function _setupTienePWA() {
  // Si la app ya está instalada (display-mode standalone), no tiene sentido
  // mostrar el paso. _appInstalled vive en pwa.js.
  if (typeof _appInstalled !== 'undefined' && _appInstalled) return false;
  return true;
}

// ─── DECISIÓN: ¿corre el wizard? ────────────────────────────────────────────
// Devuelve true si el admin del taller todavía no completó el setup.
function setupPendiente() {
  if (currentPerfil?.rol !== 'admin') return false;
  const taller = currentPerfil?.talleres;
  if (!taller) return false;
  // Si la columna no existe (migración no aplicada), no corremos el wizard
  // para no molestar — el fallback en cascada de loadPerfil deja el campo
  // como undefined.
  if (!('setup_completado' in taller)) return false;
  return taller.setup_completado === null || taller.setup_completado === undefined;
}

// ─── DISPARADOR ─────────────────────────────────────────────────────────────
// Llamado desde showApp() después de cargar el perfil. Si no aplica, no hace
// nada (no rompe el flujo normal del dashboard).
function iniciarAsistenteSetup() {
  if (_setupActivo) return;
  if (!setupPendiente()) return;

  _setupActivo = true;
  _setupIdx = 0;
  _setupPasosSaltados = new Set();

  // Construir lista de pasos según features disponibles. "datos" siempre va
  // primero y es el único obligatorio.
  _setupPasos = ['datos'];
  if (_setupTieneMoneda()) _setupPasos.push('moneda');
  _setupPasos.push('servicios');
  if (_setupTienePWA())    _setupPasos.push('pwa');

  _setupRender();
}

// ─── RENDER DEL MODAL A PANTALLA COMPLETA ───────────────────────────────────
function _setupRender() {
  // Removemos el modal previo si existe y montamos uno nuevo a pantalla
  // completa con z-index muy alto para que quede por encima de la app y
  // del modal-overlay normal.
  const prev = document.getElementById('setup-wizard-overlay');
  if (prev) prev.remove();

  const paso = _setupPasos[_setupIdx];
  const total = _setupPasos.length;
  const num = _setupIdx + 1;
  const pct = Math.round((num / total) * 100);
  const nombre = h(currentPerfil?.nombre || '');
  const esUltimo = _setupIdx === total - 1;
  const esDatos = paso === 'datos';

  const overlay = document.createElement('div');
  overlay.id = 'setup-wizard-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:500;background:var(--bg);
    overflow-y:auto;display:flex;flex-direction:column;align-items:center;
    padding:1rem;
  `;
  overlay.innerHTML = `
    <div style="width:100%;max-width:520px;display:flex;flex-direction:column;gap:1rem;padding:1rem 0">
      <div style="text-align:center">
        <div style="font-family:var(--font-head);font-size:1.6rem;color:var(--accent);letter-spacing:3px">TALLERPRO</div>
        ${num === 1 ? `<div style="font-size:.95rem;color:var(--text);margin-top:.4rem">¡Bienvenido${nombre ? ', ' + nombre : ''}!</div>
          <div style="font-size:.78rem;color:var(--text2);margin-top:.2rem">Configuremos tu taller en menos de 2 minutos.</div>` : ''}
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text2);margin-bottom:.3rem">
          <span style="font-family:var(--font-head);letter-spacing:1px">PASO ${num} DE ${total}</span>
          <span>${pct}%</span>
        </div>
        <div style="background:var(--surface2);border-radius:20px;height:8px;overflow:hidden">
          <div style="background:var(--accent);height:100%;width:${pct}%;transition:width .3s"></div>
        </div>
      </div>

      <div id="setup-wizard-body" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem">
        ${_setupRenderPaso(paso)}
      </div>

      <div style="display:flex;gap:.5rem;flex-direction:column">
        <button class="btn-primary" id="setup-btn-siguiente" onclick="_setupSiguiente()">
          ${esUltimo ? '✅ Terminar' : 'Siguiente →'}
        </button>
        ${!esDatos ? `<button class="btn-secondary" onclick="_setupSaltar()">Saltar este paso</button>` : ''}
      </div>

      <div style="text-align:center;font-size:.68rem;color:var(--text2);padding:.5rem 0 1rem">
        Podés completar lo que saltes desde el dashboard cuando quieras.
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Inicialización extra por paso (ej: cargar valores actuales).
  if (paso === 'datos') _setupCargarDatos();
  if (paso === 'pwa')   _setupActualizarBotonPWA();
}

// ─── PASO: DATOS FISCALES ───────────────────────────────────────────────────
function _setupRenderPaso(paso) {
  switch (paso) {
    case 'datos':     return _setupHtmlDatos();
    case 'moneda':    return _setupHtmlMoneda();
    case 'servicios': return _setupHtmlServicios();
    case 'pwa':       return _setupHtmlPWA();
  }
  return '';
}

function _setupHtmlDatos() {
  return `
    <div style="font-family:var(--font-head);font-size:1.05rem;color:var(--accent);margin-bottom:.5rem">📋 Datos del taller</div>
    <div style="font-size:.78rem;color:var(--text2);margin-bottom:1rem">Aparecen en presupuestos, facturas y mensajes a clientes.</div>
    <div class="form-group">
      <label class="form-label">RUC <span style="color:var(--danger)">*</span></label>
      <input class="form-input" id="setup-ruc" placeholder="80012345-6">
    </div>
    <div class="form-group">
      <label class="form-label">Dirección <span style="color:var(--danger)">*</span></label>
      <input class="form-input" id="setup-direccion" placeholder="Av. Ejemplo 123, Asunción">
    </div>
    <div class="form-group" style="margin-bottom:0">
      <label class="form-label">Teléfono / WhatsApp</label>
      ${phoneInput('setup-telefono', currentPerfil?.talleres?.telefono || '', '0981 123 456')}
    </div>
  `;
}

async function _setupCargarDatos() {
  // Precargar lo que ya esté en la DB (por si el admin abre el wizard
  // por segunda vez y ya completó algo).
  const t = currentPerfil?.talleres;
  if (!t) return;
  const ruc = document.getElementById('setup-ruc');
  const dir = document.getElementById('setup-direccion');
  if (ruc && t.ruc)        ruc.value = t.ruc;
  if (dir && t.direccion)  dir.value = t.direccion;
}

async function _setupGuardarDatos() {
  const ruc       = document.getElementById('setup-ruc').value.trim();
  const direccion = document.getElementById('setup-direccion').value.trim();
  const telefono  = document.getElementById('setup-telefono').value.trim();
  if (!ruc)       { toast('El RUC es obligatorio', 'error'); return false; }
  if (!direccion) { toast('La dirección es obligatoria', 'error'); return false; }

  const { error } = await sb.from('talleres')
    .update({ ruc, direccion, telefono: telefono || null })
    .eq('id', tid());
  if (error) { toast('Error: ' + error.message, 'error'); return false; }

  // Actualizamos el perfil en memoria para que el resto de la app vea los
  // valores nuevos sin tener que recargar.
  if (currentPerfil?.talleres) {
    currentPerfil.talleres.ruc = ruc;
    currentPerfil.talleres.direccion = direccion;
    currentPerfil.talleres.telefono = telefono || null;
  }
  return true;
}

// ─── PASO: PAÍS / MONEDA ────────────────────────────────────────────────────
function _setupHtmlMoneda() {
  const paisActual = currentPerfil?.talleres?.pais || 'PY';
  return `
    <div style="font-family:var(--font-head);font-size:1.05rem;color:var(--accent);margin-bottom:.5rem">🌎 País y moneda</div>
    <div style="font-size:.78rem;color:var(--text2);margin-bottom:1rem">Define el símbolo de moneda y el formato de números en toda la app.</div>
    <div class="form-group" style="margin-bottom:0">
      <label class="form-label">País / Moneda</label>
      <select class="form-input" id="setup-pais">
        ${MONEDA_PRESETS.map(p => `<option value="${p.pais}" ${p.pais === paisActual ? 'selected' : ''}>${p.label}</option>`).join('')}
      </select>
    </div>
  `;
}

async function _setupGuardarMoneda() {
  const pais = document.getElementById('setup-pais').value;
  const preset = MONEDA_PRESETS.find(p => p.pais === pais) || MONEDA_PRESETS[0];
  const { error } = await sb.from('talleres').update({
    pais: preset.pais,
    moneda_simbolo: preset.simbolo,
    moneda_locale:  preset.locale
  }).eq('id', tid());
  if (error) { toast('Error: ' + error.message, 'error'); return false; }
  if (currentPerfil?.talleres) {
    currentPerfil.talleres.pais = preset.pais;
    currentPerfil.talleres.moneda_simbolo = preset.simbolo;
    currentPerfil.talleres.moneda_locale = preset.locale;
  }
  return true;
}

// ─── PASO: SERVICIOS TÍPICOS ────────────────────────────────────────────────
function _setupHtmlServicios() {
  const items = SETUP_SERVICIOS_TIPICOS.map((s, i) => `
    <label style="display:flex;align-items:center;gap:.5rem;padding:.5rem;background:var(--surface2);border-radius:8px;cursor:pointer">
      <input type="checkbox" id="setup-srv-${i}" data-nombre="${h(s.nombre)}" checked style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer">
      <span style="font-size:.85rem;color:var(--text)">${h(s.nombre)}</span>
    </label>
  `).join('');
  return `
    <div style="font-family:var(--font-head);font-size:1.05rem;color:var(--accent);margin-bottom:.5rem">🔧 Servicios que ofrecés</div>
    <div style="font-size:.78rem;color:var(--text2);margin-bottom:1rem">Marcá los que tu taller hace habitualmente. Los podés ajustar después en Inventario.</div>
    <div style="display:grid;gap:.4rem">${items}</div>
  `;
}

async function _setupGuardarServicios() {
  const seleccion = SETUP_SERVICIOS_TIPICOS
    .map((s, i) => ({ s, marcado: document.getElementById('setup-srv-' + i)?.checked }))
    .filter(x => x.marcado)
    .map(x => x.s);

  if (seleccion.length === 0) {
    // Si no marca ninguno, lo tratamos como "saltado" pero seguimos.
    return true;
  }

  // Para evitar duplicados si el wizard se reabre (Tarea #62: el usuario
  // pudo cerrar el navegador a mitad del wizard sin que se guardara
  // setup_completado, y al volver pasaría servicios otra vez), filtramos
  // los nombres que ya existan en inventario para este taller.
  const nombres = seleccion.map(s => s.nombre);
  const { data: existentes } = await sb.from('inventario')
    .select('nombre')
    .eq('taller_id', tid())
    .in('nombre', nombres);
  const ya = new Set((existentes || []).map(r => r.nombre));
  const aInsertar = seleccion.filter(s => !ya.has(s.nombre));

  if (aInsertar.length === 0) return true;

  const filas = aInsertar.map(s => ({
    nombre: s.nombre,
    categoria: 'Servicios',
    unidad: 'servicio',
    cantidad: 999,
    stock_minimo: 0,
    precio_unitario: s.precio || 0,
    taller_id: tid()
  }));

  const { error } = await sb.from('inventario').insert(filas);
  if (error) {
    console.warn('[setup] error insertando servicios:', error);
    toast('No se pudieron guardar todos los servicios', 'error');
    return false;
  }
  return true;
}

// ─── PASO: INSTALAR PWA ─────────────────────────────────────────────────────
function _setupHtmlPWA() {
  // Reusamos detección de pwa.js (_isIOS, _installPrompt, etc.). Si la app
  // ya está instalada, ni siquiera deberíamos llegar acá (filtrado en
  // iniciarAsistenteSetup); igual lo cubrimos por las dudas.
  let body = '';
  if (typeof _appInstalled !== 'undefined' && _appInstalled) {
    body = `<div style="text-align:center;padding:.5rem 0">
      <div style="font-size:2.5rem;margin-bottom:.5rem">✓</div>
      <div style="color:var(--success);font-family:var(--font-head)">App ya instalada</div>
    </div>`;
  } else if (typeof _isIOS !== 'undefined' && _isIOS) {
    body = `<div style="font-size:.85rem;color:var(--text);line-height:1.7;background:var(--surface2);border-radius:10px;padding:.85rem">
      1. Abrí TallerPro en <strong style="color:var(--accent)">Safari</strong><br>
      2. Tocá el botón <strong style="color:var(--accent)">Compartir</strong> ⬆️<br>
      3. Tocá <strong style="color:var(--accent)">"Agregar a inicio"</strong>
    </div>
    <div style="font-size:.7rem;color:var(--text2);margin-top:.6rem;text-align:center">Después podés abrir TallerPro como una app nativa desde tu pantalla.</div>`;
  } else if (typeof _installPrompt !== 'undefined' && _installPrompt) {
    body = `<div style="text-align:center;padding:.5rem 0">
      <div style="font-size:.85rem;color:var(--text2);margin-bottom:.85rem">Instalala como app para tener acceso rápido y poder usarla sin internet.</div>
      <button class="btn-primary" onclick="_setupInstalarPWA()" id="setup-btn-instalar" style="background:var(--success);color:#000">📲 Instalar TallerPro</button>
    </div>`;
  } else {
    body = `<div style="font-size:.85rem;color:var(--text2);line-height:1.6;background:var(--surface2);border-radius:10px;padding:.85rem">
      Para instalar: abrí el menú del navegador (⋮) y elegí <strong style="color:var(--accent)">"Instalar app"</strong> o <strong style="color:var(--accent)">"Agregar a pantalla de inicio"</strong>.
    </div>`;
  }
  return `
    <div style="font-family:var(--font-head);font-size:1.05rem;color:var(--accent);margin-bottom:.5rem">📲 Instalá la app</div>
    <div style="font-size:.78rem;color:var(--text2);margin-bottom:1rem">Tu taller en el celular: acceso rápido y funciona sin internet.</div>
    ${body}
  `;
}

function _setupActualizarBotonPWA() {
  // Si el usuario ya instaló, ocultamos el botón "Instalar" y el Siguiente
  // queda como única opción.
  if (typeof _appInstalled !== 'undefined' && _appInstalled) {
    const btn = document.getElementById('setup-btn-instalar');
    if (btn) btn.disabled = true;
  }
}

async function _setupInstalarPWA() {
  if (typeof installApp === 'function') {
    await installApp();
    // Después del prompt, re-renderizamos el cuerpo del paso para reflejar
    // si quedó instalada.
    const body = document.getElementById('setup-wizard-body');
    if (body) body.innerHTML = _setupHtmlPWA();
  }
}

// ─── NAVEGACIÓN ─────────────────────────────────────────────────────────────
async function _setupSiguiente() {
  const paso = _setupPasos[_setupIdx];
  const btn = document.getElementById('setup-btn-siguiente');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  let ok = true;
  try {
    if (paso === 'datos')     ok = await _setupGuardarDatos();
    if (paso === 'moneda')    ok = await _setupGuardarMoneda();
    if (paso === 'servicios') ok = await _setupGuardarServicios();
    // 'pwa' no necesita guardar nada en BD — es solo informativo.
  } catch (e) {
    console.error('[setup] error guardando paso ' + paso + ':', e);
    ok = false;
  }

  if (!ok) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = _setupIdx === _setupPasos.length - 1 ? '✅ Terminar' : 'Siguiente →';
    }
    return;
  }

  // Si el paso se completó (no se saltó), lo quitamos de pendientes.
  _setupPasosSaltados.delete(paso);

  if (_setupIdx < _setupPasos.length - 1) {
    _setupIdx++;
    _setupRender();
  } else {
    await _setupFinalizar();
  }
}

function _setupSaltar() {
  const paso = _setupPasos[_setupIdx];
  if (paso === 'datos') return; // no se puede saltar
  _setupPasosSaltados.add(paso);
  if (_setupIdx < _setupPasos.length - 1) {
    _setupIdx++;
    _setupRender();
  } else {
    _setupFinalizar();
  }
}

// ─── FINALIZACIÓN ───────────────────────────────────────────────────────────
async function _setupFinalizar() {
  // Marcamos setup_completado y guardamos qué pasos quedaron pendientes.
  // Si la columna no existe (migración no aplicada), el update silencia el
  // error y simplemente cerramos el wizard sin persistir.
  const pendientes = Array.from(_setupPasosSaltados);
  try {
    await sb.from('talleres').update({
      setup_completado: new Date().toISOString(),
      setup_pasos_pendientes: pendientes
    }).eq('id', tid());
  } catch (e) {
    console.warn('[setup] no se pudo persistir setup_completado:', e);
  }

  if (currentPerfil?.talleres) {
    currentPerfil.talleres.setup_completado = new Date().toISOString();
    currentPerfil.talleres.setup_pasos_pendientes = pendientes;
  }

  _setupActivo = false;
  const overlay = document.getElementById('setup-wizard-overlay');
  if (overlay) overlay.remove();

  if (pendientes.length === 0) {
    toast('🎉 ¡Tu taller está listo! Cargá tu primer trabajo.', 'success');
  } else {
    toast('Listo. Lo que saltaste lo podés completar desde el dashboard.', 'success');
  }

  // Refrescamos el dashboard para que muestre la tarjeta de pendientes.
  if (typeof navigate === 'function') navigate('dashboard');
}

// ─── TARJETA "CONFIGURACIÓN PENDIENTE" PARA DASHBOARD ───────────────────────
// Devuelve HTML vacío si no aplica (no admin, sin pendientes, o columna
// inexistente). Se invoca desde dashboard().
function getSetupPendienteCard() {
  if (currentPerfil?.rol !== 'admin') return '';
  const taller = currentPerfil?.talleres;
  if (!taller) return '';
  if (!('setup_completado' in taller)) return '';
  if (!taller.setup_completado) return ''; // wizard activo, no mostrar tarjeta
  const pendientes = taller.setup_pasos_pendientes;
  if (!Array.isArray(pendientes) || pendientes.length === 0) return '';

  const labels = {
    moneda:    { icon: '🌎', txt: 'Elegir país y moneda' },
    servicios: { icon: '🔧', txt: 'Cargar tus servicios típicos' },
    pwa:       { icon: '📲', txt: 'Instalar la app en tu celular' }
  };

  const items = pendientes
    .filter(k => labels[k])
    .map(k => `<div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;font-size:.82rem;color:var(--text)">
      <span style="font-size:1rem">${labels[k].icon}</span>
      <span>${labels[k].txt}</span>
    </div>`).join('');

  if (!items) return '';

  return `
    <div onclick="reanudarAsistenteSetup()" style="background:linear-gradient(145deg, rgba(0,229,255,.08), rgba(0,229,255,.02));border:1px solid rgba(0,229,255,.3);border-radius:12px;padding:.85rem 1rem;margin-bottom:1rem;cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
        <div style="font-family:var(--font-head);font-size:.85rem;color:var(--accent);letter-spacing:1px">⚙️ CONFIGURACIÓN PENDIENTE</div>
        <span style="font-size:.7rem;color:var(--accent)">Completar →</span>
      </div>
      ${items}
    </div>
  `;
}

// Reabre el wizard solo con los pasos que quedaron pendientes. Se llama
// desde la tarjeta del dashboard.
function reanudarAsistenteSetup() {
  if (_setupActivo) return;
  const taller = currentPerfil?.talleres;
  const pendientes = taller?.setup_pasos_pendientes;
  if (!Array.isArray(pendientes) || pendientes.length === 0) return;

  _setupActivo = true;
  _setupIdx = 0;
  _setupPasosSaltados = new Set();

  // Reconstruimos la lista de pasos solo con los pendientes que siguen
  // siendo aplicables (ej: si la PWA ya se instaló desde el botón del
  // header, no la mostramos).
  const aplicables = [];
  for (const k of pendientes) {
    if (k === 'moneda'    && !_setupTieneMoneda())  continue;
    if (k === 'pwa'       && !_setupTienePWA())     continue;
    aplicables.push(k);
  }

  if (aplicables.length === 0) {
    // Limpiamos pendientes residuales que ya no aplican y refrescamos.
    sb.from('talleres').update({ setup_pasos_pendientes: [] }).eq('id', tid())
      .then(() => {
        if (currentPerfil?.talleres) currentPerfil.talleres.setup_pasos_pendientes = [];
        if (typeof navigate === 'function') navigate('dashboard');
      });
    _setupActivo = false;
    return;
  }

  _setupPasos = aplicables;
  _setupRender();
}

// Exponemos para uso desde HTML inline y otros módulos.
window.iniciarAsistenteSetup    = iniciarAsistenteSetup;
window.reanudarAsistenteSetup   = reanudarAsistenteSetup;
window.getSetupPendienteCard    = getSetupPendienteCard;
window._setupSiguiente          = _setupSiguiente;
window._setupSaltar             = _setupSaltar;
window._setupInstalarPWA        = _setupInstalarPWA;
