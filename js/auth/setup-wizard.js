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
// El estado fuente de verdad es `talleres.setup_pasos_pendientes` (jsonb):
// un array con las claves de los pasos que todavía no se completaron. Tras
// cada paso lo persistimos a la BD, así si el usuario cierra el navegador
// a la mitad puede retomar exactamente desde donde se fue.
let _setupPasos = [];          // array de claves de pasos a mostrar (en orden)
let _setupIdx = 0;             // índice del paso actual dentro de _setupPasos
let _setupPendientes = new Set();   // claves todavía sin completar (la verdad)
let _setupActivo = false;
let _setupModoIndividual = false;   // true = se abrió 1 solo paso desde la tarjeta

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
// Devuelve true si el admin del taller todavía no completó el setup
// (queda al menos un paso pendiente, incluyendo el obligatorio "datos").
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

// Construye la lista completa de pasos disponibles según las features que
// estén activas en el ambiente (moneda solo si la columna existe; pwa solo
// si la app no está ya instalada).
function _setupListaCompleta() {
  const lista = ['datos'];
  if (_setupTieneMoneda()) lista.push('moneda');
  lista.push('servicios');
  if (_setupTienePWA())    lista.push('pwa');
  return lista;
}

// Persiste a la BD el estado actual de pendientes. Si quedó vacío, marca
// también `setup_completado` con la fecha. Si "datos" ya no está pendiente,
// marca `setup_completado` aunque queden otros pasos saltados (la única
// condición obligatoria para considerar el setup mínimo es haber cargado
// datos fiscales). Es tolerante al fallo (ej: columna inexistente).
async function _setupPersistir() {
  const pendientes = Array.from(_setupPendientes);
  const datosListos = !_setupPendientes.has('datos');
  const patch = { setup_pasos_pendientes: pendientes };
  if (datosListos && currentPerfil?.talleres && !currentPerfil.talleres.setup_completado) {
    patch.setup_completado = new Date().toISOString();
  }
  let okBD = false;
  try {
    const { error } = await sb.from('talleres').update(patch).eq('id', tid());
    if (error) {
      // Si la columna no existe (migración Tarea #62 sin aplicar), no hay
      // mucho que hacer: cerramos silenciosamente para no bloquear al
      // usuario y NO mutamos el perfil en memoria — al recargar la app
      // el wizard volverá a aparecer y eso está bien (la migración debería
      // aplicarse antes del deploy).
      console.warn('[setup] update falló:', error.message || error);
    } else {
      okBD = true;
    }
  } catch (e) {
    console.warn('[setup] no se pudo persistir estado:', e);
  }
  // Solo reflejamos en el perfil en memoria si la BD aceptó el cambio,
  // para que el dashboard y la tarjeta de pendientes no muestren un
  // estado inconsistente con lo que realmente está guardado.
  if (okBD && currentPerfil?.talleres) {
    currentPerfil.talleres.setup_pasos_pendientes = pendientes;
    if (patch.setup_completado) {
      currentPerfil.talleres.setup_completado = patch.setup_completado;
    }
  }
}

// ─── DISPARADOR ─────────────────────────────────────────────────────────────
// Llamado desde showApp() después de cargar el perfil. Si no aplica, no hace
// nada (no rompe el flujo normal del dashboard). Si hay un estado parcial
// guardado en `setup_pasos_pendientes`, retomamos desde el primer pendiente.
function iniciarAsistenteSetup() {
  if (_setupActivo) return;
  if (!setupPendiente()) return;

  _setupActivo = true;
  _setupModoIndividual = false;
  _setupIdx = 0;

  const lista = _setupListaCompleta();
  // Si ya teníamos un array de pendientes guardado (resume), usamos esos;
  // si no (primer ingreso), todos los pasos arrancan pendientes.
  const guardados = currentPerfil?.talleres?.setup_pasos_pendientes;
  if (Array.isArray(guardados) && guardados.length > 0) {
    _setupPendientes = new Set(guardados.filter(k => lista.includes(k)));
  } else {
    _setupPendientes = new Set(lista);
  }

  // Mostramos solo los pasos que siguen pendientes (preservando el orden
  // canónico). Si por algún motivo quedó vacío pero el wizard se disparó,
  // mostramos al menos "datos" para no abrir un wizard vacío.
  _setupPasos = lista.filter(k => _setupPendientes.has(k));
  if (_setupPasos.length === 0) _setupPasos = ['datos'];

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
        ${_setupIdx > 0 ? `<button class="btn-secondary" onclick="_setupAtras()" style="background:transparent;border:1px solid var(--border);color:var(--text2)">← Atrás</button>` : ''}
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
    // Si no marca ninguno, NO completamos el paso: lo dejamos pendiente
    // para que aparezca en la tarjeta del dashboard. Devolvemos un objeto
    // con la marca `pendiente` para que _setupSiguiente lo respete.
    return { ok: true, pendiente: true };
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

// Para el paso PWA: solo lo damos por completado si la app está realmente
// instalada (display-mode standalone). Si el usuario aprieta "Terminar"
// sin instalarla, devolvemos {ok:true, pendiente:true} para que quede en
// la tarjeta del dashboard.
function _setupGuardarPWA() {
  if (typeof _appInstalled !== 'undefined' && _appInstalled) {
    return { ok: true, pendiente: false };
  }
  return { ok: true, pendiente: true };
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
  const esUltimo = _setupIdx === _setupPasos.length - 1;
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  // Cada handler retorna `true` (completado), `false` (error / no avanzar)
  // o `{ ok:true, pendiente:true }` (avanzamos pero el paso queda en la
  // tarjeta de pendientes — caso PWA no instalada o servicios sin elegir).
  let res = true;
  try {
    if (paso === 'datos')     res = await _setupGuardarDatos();
    if (paso === 'moneda')    res = await _setupGuardarMoneda();
    if (paso === 'servicios') res = await _setupGuardarServicios();
    if (paso === 'pwa')       res = _setupGuardarPWA();
  } catch (e) {
    console.error('[setup] error guardando paso ' + paso + ':', e);
    res = false;
  }

  const ok = res === true || (res && res.ok);
  const dejarPendiente = res && typeof res === 'object' && res.pendiente;

  if (!ok) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = esUltimo ? '✅ Terminar' : 'Siguiente →';
    }
    return;
  }

  // Actualizamos el estado: quitamos de pendientes si se completó, dejamos
  // si quedó pendiente (caso PWA / servicios vacíos).
  if (!dejarPendiente) _setupPendientes.delete(paso);
  await _setupPersistir();

  if (!esUltimo) {
    _setupIdx++;
    _setupRender();
  } else {
    await _setupFinalizar();
  }
}

async function _setupSaltar() {
  const paso = _setupPasos[_setupIdx];
  if (paso === 'datos') return; // no se puede saltar
  // Saltar = dejar como pendiente. Persistimos por si el usuario cierra el
  // navegador justo después.
  _setupPendientes.add(paso);
  await _setupPersistir();
  if (_setupIdx < _setupPasos.length - 1) {
    _setupIdx++;
    _setupRender();
  } else {
    await _setupFinalizar();
  }
}

// Volver al paso anterior. No se persiste (el estado del paso anterior
// ya quedó guardado cuando avanzamos), solo navegamos hacia atrás. Si
// está en el primer paso, no hace nada (el botón ni se renderiza).
function _setupAtras() {
  if (_setupIdx <= 0) return;
  _setupIdx--;
  _setupRender();
}

// ─── FINALIZACIÓN ───────────────────────────────────────────────────────────
// El estado ya se persistió tras el último paso, así que solo cerramos el
// modal y mostramos el banner final con el CTA pedido por la spec
// ("Cargá tu primer trabajo" → abre el wizard de nueva reparación).
async function _setupFinalizar() {
  // Asegurarnos que setup_completado quedó marcado (caso borde: el usuario
  // saltó todo lo opcional pero "datos" no es saltable, así que en el flujo
  // normal ya quedó marcado por _setupPersistir tras completar datos).
  if (currentPerfil?.talleres && !currentPerfil.talleres.setup_completado) {
    await _setupPersistir();
  }

  const fueIndividual = _setupModoIndividual;
  _setupActivo = false;
  _setupModoIndividual = false;
  const overlay = document.getElementById('setup-wizard-overlay');
  if (overlay) overlay.remove();

  if (fueIndividual) {
    // Volvió a completar/saltar un solo paso desde la tarjeta del dashboard:
    // refrescamos el dashboard sin banner de bienvenida.
    toast('✓ Listo', 'success');
    if (typeof navigate === 'function') navigate('dashboard');
    return;
  }

  // Primer wizard completo: mostramos el banner con CTA "Cargá tu primer
  // trabajo" como pide la spec.
  const pendientes = Array.from(_setupPendientes);
  _setupBannerExito(pendientes);
}

// Banner de éxito a pantalla completa con CTA al wizard de reparaciones.
// Reemplaza el toast porque la spec pide un banner con botón directo a
// "Cargá tu primer trabajo" (modalNuevaReparacionSimple).
function _setupBannerExito(pendientes) {
  const overlay = document.createElement('div');
  overlay.id = 'setup-wizard-exito';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.7);
    display:flex;align-items:center;justify-content:center;padding:1rem;
  `;
  const restantes = pendientes.length;
  const txtPend = restantes === 0
    ? '¡Tu taller está listo!'
    : `Listo lo principal. Te quedan ${restantes} ${restantes === 1 ? 'paso opcional' : 'pasos opcionales'} para completar cuando quieras.`;
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.5rem;max-width:420px;width:100%;text-align:center">
      <div style="font-size:3rem;margin-bottom:.5rem">🎉</div>
      <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);margin-bottom:.5rem">¡Bienvenido a TallerPro!</div>
      <div style="font-size:.85rem;color:var(--text);line-height:1.5;margin-bottom:1.2rem">${h(txtPend)}</div>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <button class="btn-primary" onclick="_setupCerrarBannerYNuevoTrabajo()" style="background:var(--success);color:#000">🔧 Cargá tu primer trabajo</button>
        <button class="btn-secondary" onclick="_setupCerrarBanner()">Ir al dashboard</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// Punto único para encadenar el tutorial existente (`js/ux/tutorial.js`),
// que es el tour 4-step del dashboard. Usa localStorage para no repetirse,
// así que llamarlo dos veces es seguro. El delay le da tiempo a que el
// dashboard se pinte y, en el camino "Cargá tu primer trabajo", a que el
// usuario cierre o avance en el modal de reparaciones.
function _setupDispararTutorial(delay) {
  if (typeof iniciarTutorial !== 'function') return;
  setTimeout(() => iniciarTutorial(), delay || 400);
}

function _setupCerrarBanner() {
  const o = document.getElementById('setup-wizard-exito');
  if (o) o.remove();
  if (typeof navigate === 'function') navigate('dashboard');
  _setupDispararTutorial(400);
}

function _setupCerrarBannerYNuevoTrabajo() {
  const o = document.getElementById('setup-wizard-exito');
  if (o) o.remove();
  if (typeof navigate === 'function') navigate('dashboard');
  if (typeof modalNuevaReparacionSimple === 'function') {
    modalNuevaReparacionSimple();
  }
  // El tutorial igual queda encadenado, pero con delay más largo para no
  // chocar con el modal del wizard de reparaciones. Si el usuario aún
  // está cargando el trabajo a los 5s, el tour del dashboard quedará
  // marcado como visto cuando sí lleguen al dashboard la próxima vez
  // (porque el modal lo bloquea visualmente). Es la mejor concesión sin
  // agregar dependencias entre módulos.
  _setupDispararTutorial(5000);
}

// ─── TARJETA "CONFIGURACIÓN PENDIENTE" PARA DASHBOARD ───────────────────────
// Devuelve HTML vacío si no aplica (no admin, sin pendientes, o columna
// inexistente). Cada ítem es un botón con su propio onclick que abre
// directamente ese paso (no todo el wizard).
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

  // Filtramos los pendientes según features actuales (ej: si ya instalaron
  // la PWA desde el botón del header, no mostrar ese ítem).
  const aplicables = pendientes.filter(k => {
    if (!labels[k]) return false;
    if (k === 'pwa'    && !_setupTienePWA())    return false;
    if (k === 'moneda' && !_setupTieneMoneda()) return false;
    return true;
  });
  if (aplicables.length === 0) return '';

  const items = aplicables.map(k => `
    <button onclick="event.stopPropagation();_setupAbrirSoloPaso('${k}')" style="display:flex;align-items:center;justify-content:space-between;width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.55rem .7rem;margin-top:.4rem;cursor:pointer;color:var(--text);font-size:.82rem;text-align:left">
      <span style="display:flex;align-items:center;gap:.5rem">
        <span style="font-size:1rem">${labels[k].icon}</span>
        <span>${labels[k].txt}</span>
      </span>
      <span style="color:var(--accent);font-size:.75rem">Hacerlo →</span>
    </button>
  `).join('');

  return `
    <div style="background:linear-gradient(145deg, rgba(0,229,255,.08), rgba(0,229,255,.02));border:1px solid rgba(0,229,255,.3);border-radius:12px;padding:.85rem 1rem;margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem">
        <div style="font-family:var(--font-head);font-size:.85rem;color:var(--accent);letter-spacing:1px">⚙️ CONFIGURACIÓN PENDIENTE</div>
        <span style="font-size:.7rem;color:var(--text2)">${aplicables.length} ${aplicables.length === 1 ? 'tarea' : 'tareas'}</span>
      </div>
      ${items}
    </div>
  `;
}

// Abre el wizard mostrando UN solo paso (el que el usuario tocó en la
// tarjeta de pendientes). Al completarlo, lo quita de pendientes y vuelve
// al dashboard sin mostrar el banner de éxito.
function _setupAbrirSoloPaso(clave) {
  if (_setupActivo) return;
  const taller = currentPerfil?.talleres;
  if (!taller) return;
  // Filtros de aplicabilidad por las dudas (ej: clic muy viejo después de
  // que el usuario ya instaló la PWA).
  if (clave === 'moneda' && !_setupTieneMoneda()) return;
  if (clave === 'pwa'    && !_setupTienePWA())    return;

  _setupActivo = true;
  _setupModoIndividual = true;
  _setupIdx = 0;
  // Sembrar `_setupPendientes` desde la BD para no perder lo que ya estaba.
  const guardados = Array.isArray(taller.setup_pasos_pendientes) ? taller.setup_pasos_pendientes : [];
  _setupPendientes = new Set(guardados);
  _setupPasos = [clave];
  _setupRender();
}

// Reabre el wizard completo con todos los pasos pendientes. Se mantiene
// como función pública por compatibilidad pero ya no se usa desde la
// tarjeta — quedó para casos puntuales donde se quiera reabrir todo.
function reanudarAsistenteSetup() {
  if (_setupActivo) return;
  const taller = currentPerfil?.talleres;
  const pendientes = taller?.setup_pasos_pendientes;
  if (!Array.isArray(pendientes) || pendientes.length === 0) return;

  _setupActivo = true;
  _setupModoIndividual = false;
  _setupIdx = 0;
  _setupPendientes = new Set(pendientes);

  const aplicables = pendientes.filter(k => {
    if (k === 'moneda' && !_setupTieneMoneda()) return false;
    if (k === 'pwa'    && !_setupTienePWA())    return false;
    return true;
  });

  if (aplicables.length === 0) {
    // Limpiamos pendientes residuales que ya no aplican y refrescamos.
    _setupPendientes = new Set();
    _setupPersistir().then(() => {
      if (typeof navigate === 'function') navigate('dashboard');
    });
    _setupActivo = false;
    return;
  }

  _setupPasos = aplicables;
  _setupRender();
}

// Exponemos para uso desde HTML inline y otros módulos.
window.iniciarAsistenteSetup            = iniciarAsistenteSetup;
window.reanudarAsistenteSetup           = reanudarAsistenteSetup;
window.getSetupPendienteCard            = getSetupPendienteCard;
window._setupSiguiente                  = _setupSiguiente;
window._setupSaltar                     = _setupSaltar;
window._setupAtras                      = _setupAtras;
window._setupInstalarPWA                = _setupInstalarPWA;
window._setupAbrirSoloPaso              = _setupAbrirSoloPaso;
window._setupCerrarBanner               = _setupCerrarBanner;
window._setupCerrarBannerYNuevoTrabajo  = _setupCerrarBannerYNuevoTrabajo;
