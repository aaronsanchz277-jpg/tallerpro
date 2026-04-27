// ─── SPLASH ───────────────────────────────────────────────────────────────────
function hideSplash(immediate = false) {
  const splash = document.getElementById('splash');
  if (!splash || splash.style.display === 'none') return;
  if (immediate) { splash.style.display = 'none'; return; }
  splash.style.pointerEvents = 'none';
  splash.style.zIndex = '-1';
  const remaining = Math.max(0, 1600 - (Date.now() - splashStart));
  setTimeout(() => {
    splash.style.opacity = '0';
    setTimeout(() => { splash.style.display = 'none'; }, 400);
  }, remaining);
}

// ─── VARIABLES GLOBALES DE AUTENTICACIÓN ──────────────────────────────────────
let currentUser   = null;
let currentPerfil = null;
let currentPage   = 'dashboard';
let loginTab      = 'login';
let recoveryMode  = window.location.hash.includes('type=recovery');
let _loggedOutOnce = false;

const urlParams       = new URLSearchParams(window.location.search);
const _rawTallerId    = urlParams.get('taller');
const UUID_REGEX      = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tallerIdFromUrl = (_rawTallerId && UUID_REGEX.test(_rawTallerId)) ? _rawTallerId : null;
const codigoFromUrl   = urlParams.get('codigo') || null;

const splashStart = Date.now();

// ─── INIT ────────────────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  if (recoveryMode) {
    hideSplash(true);
    mostrarFormCambiarPass();
    return;
  }
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      if (window.location.hash === '#nuevo-taller') {
        await sb.auth.signOut();
        hideSplash(true);
        showLogin();
        setTimeout(() => switchLoginTab('nuevo-taller'), 100);
        return;
      }
      hideSplash(true);
      await loadPerfil(session.user);
    } else {
      hideSplash();
      showLogin();
      if (window.location.hash === '#nuevo-taller') {
        setTimeout(() => switchLoginTab('nuevo-taller'), 100);
      }
    }
  } catch(e) {
    hideSplash(true);
    showLogin();
  }
});

// onAuthStateChange
sb.auth.onAuthStateChange(async (event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    recoveryMode = true;
    hideSplash(true);
    mostrarFormCambiarPass();
  } else if (event === 'SIGNED_OUT') {
    recoveryMode = false;
    _loggedOutOnce = true;
    currentUser = null;
    currentPerfil = null;
    showLogin();
  } else if (event === 'TOKEN_REFRESHED' && !session) {
    toast('Tu sesión expiró. Volvé a iniciar sesión.','error');
    currentUser = null;
    currentPerfil = null;
    showLogin();
  }
});

// ─── PANTALLAS ────────────────────────────────────────────────────────────────
function mostrarFormCambiarPass() {
  document.getElementById('splash').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-form').innerHTML = `
    <div class="login-logo" style="margin-bottom:1.5rem">TALLERPRO</div>
    <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent);margin-bottom:1rem;text-align:center">NUEVA CONTRASEÑA</div>
    <div class="form-group"><label class="form-label">Nueva contraseña *</label><input class="form-input" id="new-pass" type="password" placeholder="Mínimo 6 caracteres"></div>
    <div class="form-group"><label class="form-label">Repetir contraseña *</label><input class="form-input" id="new-pass2" type="password" placeholder="Repetí la contraseña"></div>
    <button class="btn-primary" onclick="cambiarContrasena()">GUARDAR CONTRASEÑA</button>
    <p id="auth-error" class="error-msg"></p>`;
}

async function loadPerfil(user) {
  currentUser = user;
  try {
    // Intentamos traer los campos nuevos (empleado_id, permisos, moneda_*).
    // Si alguna columna nueva (permisos, moneda_simbolo, etc.) todavía no
    // fue creada en la BD, hacemos fallback en cascada para no romper el
    // login en despliegues donde el SQL aún no se aplicó.
    let perfil = null, error = null;
    {
      const res = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, empleado_id, cliente_id, permisos, talleres(id, nombre, telefono, ruc, direccion, moneda_simbolo, moneda_locale, pais, setup_completado, setup_pasos_pendientes, logo_url)')
        .eq('id', user.id)
        .maybeSingle();
      perfil = res.data;
      error = res.error;
    }
    // Fallback 1.0: falta logo_url (Tarea #63 sin migrar). Reintenta sin él.
    if (error && /\blogo_url\b/i.test(error.message || '')) {
      const res = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, empleado_id, cliente_id, permisos, talleres(id, nombre, telefono, ruc, direccion, moneda_simbolo, moneda_locale, pais, setup_completado, setup_pasos_pendientes)')
        .eq('id', user.id)
        .maybeSingle();
      perfil = res.data;
      error = res.error;
    }
    // Fallback 1.a: faltan setup_completado / setup_pasos_pendientes
    // (Tarea #62 sin migrar). Reintenta sin esos campos.
    if (error && /setup_completado|setup_pasos_pendientes/i.test(error.message || '')) {
      const res = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, empleado_id, cliente_id, permisos, talleres(id, nombre, telefono, ruc, direccion, moneda_simbolo, moneda_locale, pais)')
        .eq('id', user.id)
        .maybeSingle();
      perfil = res.data;
      error = res.error;
    }
    // Fallback 1.b: faltan moneda_simbolo / moneda_locale / pais (Tarea #61
    // sin migrar). Reintenta sin esos campos; monedaActual() usará los
    // defaults Paraguay automáticamente.
    if (error && /moneda_simbolo|moneda_locale|\bpais\b/i.test(error.message || '')) {
      const res = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, empleado_id, cliente_id, permisos, talleres(id, nombre, telefono, ruc, direccion)')
        .eq('id', user.id)
        .maybeSingle();
      perfil = res.data;
      error = res.error;
    }
    // Fallback 2: faltan permisos / empleado_id / cliente_id (migración
    // anterior sin aplicar). También intenta sin las columnas de moneda
    // por si tampoco están.
    if (error && /permisos|empleado_id|cliente_id/i.test(error.message || '')) {
      const res = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, talleres(id, nombre, telefono, ruc, direccion)')
        .eq('id', user.id)
        .maybeSingle();
      perfil = res.data;
      error = res.error;
    }
    if (error) { console.error('loadPerfil error:', error); showLogin(); return; }
    if (!perfil) {
      currentPerfil = { id: user.id, nombre: user.email, rol: 'cliente', taller_id: null, permisos: {} };
      showCodigoPrompt();
      return;
    }
    if (!perfil.permisos || typeof perfil.permisos !== 'object') perfil.permisos = {};
    currentPerfil = perfil;
    if (perfil.taller_id && (perfil.rol === 'admin' || perfil.rol === 'empleado' || perfil.rol === 'cliente')) {
      showApp();
    } else {
      showCodigoPrompt();
    }
  } catch(e) {
    console.error('loadPerfil catch:', e);
    showLogin();
  }
}

function showCodigoPrompt() {
  document.getElementById('splash').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-form').innerHTML = `
    <div class="login-logo" style="margin-bottom:.5rem">TALLERPRO</div>
    <div style="font-family:var(--font-head);font-size:1rem;color:var(--text2);text-align:center;margin-bottom:1.5rem;letter-spacing:1px">BIENVENIDO</div>
    <div style="background:rgba(0,229,255,.05);border:1px solid rgba(0,229,255,.2);border-radius:10px;padding:.75rem;margin-bottom:1.25rem;font-size:.82rem;color:var(--text2);text-align:center">
      Tu cuenta no está vinculada a ningún taller. Ingresá el código que te dio el administrador o creá tu propio taller.
    </div>
    <div class="form-group">
      <label class="form-label">Código de invitación</label>
      <input class="form-input" id="prompt-codigo" placeholder="Ingresá tu código" style="text-transform:uppercase;letter-spacing:3px" value="${h(codigoFromUrl||'')}">
    </div>
    <button class="btn-primary" onclick="aplicarCodigo()">INGRESAR CON CÓDIGO</button>
    <p id="auth-error" class="error-msg"></p>
    <div style="text-align:center;margin:1rem 0;font-size:.8rem;color:var(--text2)">— o —</div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:1rem">
      <div style="font-size:.85rem;color:var(--text);margin-bottom:.75rem;text-align:center">¿Sos dueño de un taller?</div>
      <div class="form-group"><label class="form-label">Tu nombre *</label><input class="form-input" id="prompt-nombre" placeholder="Tu nombre completo"></div>
      <div class="form-group"><label class="form-label">Nombre del taller *</label><input class="form-input" id="prompt-taller" placeholder="Taller San José"></div>
      <div class="form-group"><label class="form-label">Teléfono del taller</label><input class="form-input" id="prompt-tel" placeholder="0981 123 456"></div>
      <button class="btn-primary" onclick="crearTallerDesdePrompt()" style="background:var(--success)">CREAR MI TALLER</button>
    </div>
    <button class="btn-secondary" onclick="logout()">Cerrar sesión</button>`;
  if (codigoFromUrl) {
    setTimeout(() => aplicarCodigo(), 300);
  }
}

async function aplicarCodigo() {
  const codigo = document.getElementById('prompt-codigo').value.trim().toUpperCase();
  const errEl = document.getElementById('auth-error');
  if (!codigo) { errEl.textContent = 'El código es obligatorio'; errEl.style.display = 'block'; return; }
  
  await safeCall(async () => {
    const { data: result, error } = await sb.rpc('aplicar_codigo', { p_codigo: codigo, p_user_id: currentUser.id });
    if (error) throw new Error('Error: ' + error.message);
    if (!result?.ok) throw new Error(result?.error || 'Código inválido o ya utilizado');
    
    // Fallback en cascada (igual al de loadPerfil) por si la migración de
    // moneda (Tarea #61) o la de permisos no se aplicó todavía.
    let perfil = null;
    let res = await sb.from('perfiles')
      .select('id, nombre, rol, taller_id, empleado_id, cliente_id, permisos, talleres(id, nombre, telefono, ruc, direccion, moneda_simbolo, moneda_locale, pais, setup_completado, setup_pasos_pendientes, logo_url)')
      .eq('id', currentUser.id).maybeSingle();
    perfil = res.data;
    if (res.error && /\blogo_url\b/i.test(res.error.message || '')) {
      res = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, empleado_id, cliente_id, permisos, talleres(id, nombre, telefono, ruc, direccion, moneda_simbolo, moneda_locale, pais, setup_completado, setup_pasos_pendientes)')
        .eq('id', currentUser.id).maybeSingle();
      perfil = res.data;
    }
    if (res.error && /setup_completado|setup_pasos_pendientes/i.test(res.error.message || '')) {
      res = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, empleado_id, cliente_id, permisos, talleres(id, nombre, telefono, ruc, direccion, moneda_simbolo, moneda_locale, pais)')
        .eq('id', currentUser.id).maybeSingle();
      perfil = res.data;
    }
    if (res.error && /moneda_simbolo|moneda_locale|\bpais\b/i.test(res.error.message || '')) {
      res = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, empleado_id, cliente_id, permisos, talleres(id, nombre, telefono, ruc, direccion)')
        .eq('id', currentUser.id).maybeSingle();
      perfil = res.data;
    }
    if (res.error && /permisos|empleado_id|cliente_id/i.test(res.error.message || '')) {
      res = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, talleres(id, nombre, telefono, ruc, direccion)')
        .eq('id', currentUser.id).maybeSingle();
      perfil = res.data;
    }
    if (res.error) throw new Error('Error al cargar el perfil: ' + res.error.message);
    if (!perfil) throw new Error('No se pudo cargar el perfil tras aplicar el código.');
    if (!perfil.permisos || typeof perfil.permisos !== 'object') perfil.permisos = {};
    currentPerfil = perfil;
    toast(result.rol === 'empleado' ? 'Registrado como empleado' : 'Registrado como cliente', 'success');
    showApp();
  }, null, 'Error al aplicar el código').catch(err => {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  });
}

async function crearTallerDesdePrompt() {
  const nombre = document.getElementById('prompt-nombre').value.trim();
  const tallerNombre = document.getElementById('prompt-taller').value.trim();
  const tallerTel = document.getElementById('prompt-tel').value.trim();
  const errEl = document.getElementById('auth-error');
  if (!nombre || !tallerNombre) { errEl.textContent = 'Completá tu nombre y el nombre del taller'; errEl.style.display = 'block'; return; }

  await safeCall(async () => {
    const { data: taller, error: tallerErr } = await sb.from('talleres').insert({ nombre: tallerNombre, telefono: tallerTel }).select().single();
    if (tallerErr || !taller) throw new Error('Error al crear el taller: ' + (tallerErr?.message || ''));

    const { data: existePerfil } = await sb.from('perfiles').select('id').eq('id', currentUser.id).maybeSingle();
    if (existePerfil) {
      await sb.from('perfiles').update({ nombre, rol: 'admin', taller_id: taller.id }).eq('id', currentUser.id);
    } else {
      await sb.from('perfiles').insert({ id: currentUser.id, nombre, rol: 'admin', taller_id: taller.id });
    }

    const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 14);
    await sb.from('suscripciones').insert({ taller_id: taller.id, plan_id: 'premium', estado: 'trial', fecha_vencimiento: trialEnd.toISOString().split('T')[0] });

    // Fallback por si las migraciones nuevas (Tarea #61 moneda, Tarea #62
    // setup) no se aplicaron.
    let perfil = null;
    let resPerfil = await sb.from('perfiles')
      .select('id, nombre, rol, taller_id, talleres(id, nombre, telefono, ruc, direccion, moneda_simbolo, moneda_locale, pais, setup_completado, setup_pasos_pendientes, logo_url)')
      .eq('id', currentUser.id).maybeSingle();
    perfil = resPerfil.data;
    if (resPerfil.error && /\blogo_url\b/i.test(resPerfil.error.message || '')) {
      resPerfil = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, talleres(id, nombre, telefono, ruc, direccion, moneda_simbolo, moneda_locale, pais, setup_completado, setup_pasos_pendientes)')
        .eq('id', currentUser.id).maybeSingle();
      perfil = resPerfil.data;
    }
    if (resPerfil.error && /setup_completado|setup_pasos_pendientes/i.test(resPerfil.error.message || '')) {
      resPerfil = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, talleres(id, nombre, telefono, ruc, direccion, moneda_simbolo, moneda_locale, pais)')
        .eq('id', currentUser.id).maybeSingle();
      perfil = resPerfil.data;
    }
    if (resPerfil.error && /moneda_simbolo|moneda_locale|\bpais\b/i.test(resPerfil.error.message || '')) {
      resPerfil = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, talleres(id, nombre, telefono, ruc, direccion)')
        .eq('id', currentUser.id).maybeSingle();
      perfil = resPerfil.data;
    }
    currentPerfil = perfil;
    toast(`¡Bienvenido ${nombre}! Tu taller fue creado.`, 'success');
    showApp();
  }, null, 'Error al crear el taller').catch(err => {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  });
}

// ─── AUTH UI ─────────────────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  if (typeof fab_actualizarVisibilidad === 'function') fab_actualizarVisibilidad();
  if (tallerIdFromUrl) {
    showLoginInvitacion();
  } else {
    showLoginNormal();
  }
  if (_loggedOutOnce) {
    const tabNuevo = document.getElementById('tab-nuevo-taller');
    if (tabNuevo) tabNuevo.style.display = 'none';
  }
}

function showLoginNormal(fromInvite) {
  document.getElementById('login-normal').style.display = 'block';
  document.getElementById('login-invitacion').style.display = 'none';
  switchLoginTab('login');
  const tabNuevo = document.getElementById('tab-nuevo-taller');
  if (tabNuevo) tabNuevo.style.display = fromInvite ? 'none' : '';
}

function showLoginInvitacion() {
  document.getElementById('login-normal').style.display = 'none';
  document.getElementById('login-invitacion').style.display = 'block';
}

function onCodigoInput(val) {}

// ─── SUSCRIPCIÓN ────────────────────────────────────────────────────────────
let currentSuscripcion = null;
let currentPlan = null;

async function cargarSuscripcion() {
  if (!tid()) return;
  const { data: sub } = await sb.from('suscripciones')
    .select('*, planes(*)')
    .eq('taller_id', tid())
    .maybeSingle();
  
  if (sub) {
    const hoy = new Date().toISOString().split('T')[0];
    if ((sub.estado === 'trial' || sub.estado === 'activa') && sub.fecha_vencimiento && sub.fecha_vencimiento < hoy) {
      sub.estado = 'vencida';
      await sb.from('suscripciones').update({ estado: 'vencida' }).eq('id', sub.id);
    }
    currentSuscripcion = sub;
    currentPlan = sub.planes;
  } else {
    currentSuscripcion = { estado: 'activa', plan_id: 'premium' };
    currentPlan = { id:'premium', nombre:'TallerPro', max_usuarios:999, tiene_agenda:true, tiene_mantenimientos:true, tiene_reportes:true, tiene_emails:true };
  }
}

function planPermite(feature) { return true; }
function planActivo() {
  return currentSuscripcion && (currentSuscripcion.estado === 'trial' || currentSuscripcion.estado === 'activa');
}

function getSuscripcionBanner() {
  if (currentPerfil?.rol !== 'admin') return '';
  if (!currentSuscripcion) return '';
  
  const hoy = new Date();
  const venc = currentSuscripcion.fecha_vencimiento ? new Date(currentSuscripcion.fecha_vencimiento + 'T23:59') : null;
  const diasRestantes = venc ? Math.ceil((venc - hoy) / 86400000) : null;
  
  if (currentSuscripcion.estado === 'vencida') {
    return `<div style="background:rgba(255,68,68,.1);border:1px solid rgba(255,68,68,.3);border-radius:12px;padding:1rem;margin-bottom:1rem;cursor:pointer" onclick="navigate('mi-plan')">
      <div style="font-family:var(--font-head);font-size:.85rem;color:var(--danger)">⚠️ SUSCRIPCIÓN VENCIDA</div>
      <div style="font-size:.8rem;color:var(--text2);margin-top:.3rem">Tocá para renovar tu suscripción.</div>
    </div>`;
  }
  if (currentSuscripcion.estado === 'trial' && diasRestantes !== null && diasRestantes <= 5) {
    return `<div style="background:rgba(255,204,0,.1);border:1px solid rgba(255,204,0,.3);border-radius:12px;padding:1rem;margin-bottom:1rem;cursor:pointer" onclick="navigate('mi-plan')">
      <div style="font-family:var(--font-head);font-size:.85rem;color:var(--warning)">🕐 PRUEBA GRATIS — ${diasRestantes} días restantes</div>
      <div style="font-size:.8rem;color:var(--text2);margin-top:.3rem">Tocá para elegir un plan.</div>
    </div>`;
  }
  return '';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  aplicarIdioma();
  Promise.all([cargarSuscripcion(), checkSuperAdmin()]).then(() => {
    buildNav();
    if (currentPerfil?.rol !== 'cliente') ia_init();
    if (typeof pushInit === 'function') pushInit();
    if (typeof realtime_init === 'function') realtime_init();
    if (typeof stockRealtime_init === 'function') stockRealtime_init();
    if (typeof fab_actualizarVisibilidad === 'function') fab_actualizarVisibilidad();
    navigate('dashboard');
    // Tarea #62: si es admin de un taller recién creado (setup_completado
    // null), disparar el asistente de configuración inicial. Lo hacemos
    // después de navigate('dashboard') para que al cerrar el wizard el
    // dashboard ya esté pintado con la tarjeta de pendientes.
    if (typeof iniciarAsistenteSetup === 'function') {
      setTimeout(() => iniciarAsistenteSetup(), 300);
    }
    // Deep-link: si la URL trae ?rep=<uuid>, abrimos esa reparación.
    // Lo usa, entre otros, el aviso "repuesto llegó" por WhatsApp (Tarea #30)
    // para que el cliente toque el link y caiga directo en la ficha.
    try {
      const repDeep = urlParams.get('rep');
      if (repDeep && /^[a-f0-9-]{20,}$/i.test(repDeep) && typeof detalleReparacion === 'function') {
        setTimeout(() => detalleReparacion(repDeep), 200);
      }
    } catch (_) { /* no-op */ }
  });
}
function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}

function switchLoginTab(tab) {
  loginTab = tab;
  // Marcar pestaña activa por id, no por índice (evita errores si cambia el orden).
  document.querySelectorAll('.login-tab').forEach(b => b.classList.remove('active'));
  const tabIds = { login:'lt-ingresar', 'soy-cliente':'tab-soy-cliente', 'nuevo-taller':'tab-nuevo-taller' };
  const activeBtn = document.getElementById(tabIds[tab]);
  if (activeBtn) activeBtn.classList.add('active');

  const regFields = document.getElementById('register-fields');
  if (regFields) regFields.style.display = tab==='register' ? 'block' : 'none';
  const ntFields = document.getElementById('nuevo-taller-fields');
  if (ntFields) ntFields.style.display = tab==='nuevo-taller' ? 'block' : 'none';
  const cliFields = document.getElementById('soy-cliente-fields');
  if (cliFields) cliFields.style.display = tab==='soy-cliente' ? 'block' : 'none';
  document.getElementById('forgot-link').style.display = tab==='login' ? 'block' : 'none';
  const forgotMode = tab === 'forgot';
  document.getElementById('auth-pass').style.display = forgotMode ? 'none' : 'block';
  document.getElementById('auth-pass').previousElementSibling.style.display = forgotMode ? 'none' : 'block';
  if (forgotMode) {
    document.getElementById('auth-btn').textContent = 'ENVIAR LINK';
    document.getElementById('auth-btn').onclick = handleForgotPassword;
    document.getElementById('forgot-link').innerHTML = `<button onclick="switchLoginTab('login')" style="background:none;border:none;color:var(--text2);font-size:.8rem;cursor:pointer;text-decoration:underline">← Volver al login</button>`;
  } else {
    const labels = { login:'INGRESAR', register:'REGISTRARME', 'nuevo-taller':'CREAR TALLER', 'soy-cliente':'CREAR MI CUENTA' };
    document.getElementById('auth-btn').textContent = labels[tab] || 'INGRESAR';
    document.getElementById('auth-btn').onclick = handleAuth;
  }
}
