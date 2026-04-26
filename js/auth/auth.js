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
    // Intentamos traer los campos nuevos (empleado_id, permisos). Si la
    // columna `permisos` todavía no fue creada en la BD, hacemos fallback al
    // select sin ella para no romper el login.
    let perfil = null, error = null;
    {
      const res = await sb.from('perfiles')
        .select('id, nombre, rol, taller_id, empleado_id, cliente_id, permisos, talleres(id, nombre, telefono, ruc, direccion)')
        .eq('id', user.id)
        .maybeSingle();
      perfil = res.data;
      error = res.error;
    }
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
    
    const { data: perfil } = await sb.from('perfiles')
      .select('id, nombre, rol, taller_id, talleres(id, nombre, telefono, ruc, direccion)')
      .eq('id', currentUser.id).maybeSingle();
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

    const { data: perfil } = await sb.from('perfiles').select('id, nombre, rol, taller_id, talleres(id, nombre, telefono, ruc, direccion)').eq('id', currentUser.id).maybeSingle();
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
    navigate('dashboard');
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

// ─── MANEJO DE AUTENTICACIÓN ──────────────────────────────────────────────────
async function handleRegistroInvitacion() {
  const nombre = document.getElementById('inv-nombre').value.trim();
  const apellido = document.getElementById('inv-apellido').value.trim();
  const telefono = document.getElementById('inv-telefono').value.trim();
  const codigo = document.getElementById('inv-codigo').value.trim().toUpperCase();
  const email = document.getElementById('inv-email').value.trim();
  const pass = document.getElementById('inv-pass').value;
  const errEl = document.getElementById('inv-error');
  const btn = document.querySelector('#login-invitacion .btn-primary');
  errEl.style.display = 'none';

  if (!nombre || !apellido) { errEl.textContent = 'Nombre y apellido son obligatorios'; errEl.style.display = 'block'; return; }
  if (!codigo) { errEl.textContent = 'El código es obligatorio'; errEl.style.display = 'block'; return; }
  if (!email || !pass) { errEl.textContent = 'Email y contraseña son obligatorios'; errEl.style.display = 'block'; return; }
  if (pass.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres'; errEl.style.display = 'block'; return; }

  btn.textContent = 'REGISTRANDO...';
  btn.disabled = true;

  await safeCall(async () => {
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Error al crear la cuenta');

    const { data: result, error: rpcError } = await sb.rpc('aplicar_codigo', { p_codigo: codigo, p_user_id: data.user.id });
    if (rpcError || !result?.ok) throw new Error(result?.error || rpcError?.message || 'Código inválido o ya utilizado');

    const nombreCompleto = `${nombre} ${apellido}`;
    await sb.from('perfiles').update({ nombre: nombreCompleto }).eq('id', data.user.id);

    if (result.rol === 'cliente') {
      const { data: perfil } = await sb.from('perfiles').select('cliente_id').eq('id', data.user.id).maybeSingle();
      if (perfil?.cliente_id) {
        await sb.from('clientes').update({ nombre: nombreCompleto, telefono: telefono || null }).eq('id', perfil.cliente_id);
      }
    }

    toast(`¡Bienvenido ${nombre}!`, 'success');
    await loadPerfil(data.user);
  }, null, 'Error en el registro').catch(err => {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }).finally(() => {
    btn.textContent = 'REGISTRARME';
    btn.disabled = false;
  });
}

async function handleAuth() {
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  const btn = document.getElementById('auth-btn');
  showAuthError('');
  if (!email || !pass) { showAuthError('Completá todos los campos'); return; }
  if (!checkLoginRateLimit()) { return; }
  btn.textContent = 'CARGANDO...';
  btn.disabled = true;

  await safeCall(async () => {
    if (loginTab === 'login') {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw new Error('Email o contraseña incorrectos');
      resetLoginAttempts();
      await loadPerfil(data.user);
    } else if (loginTab === 'soy-cliente') {
      const nombre = document.getElementById('cli-nombre').value.trim();
      const telPrefix = document.getElementById('cli-tel-prefix')?.value || '';
      const telRaw = document.getElementById('cli-tel')?.value.trim() || '';
      const telefono = telRaw ? (telPrefix + ' ' + telRaw) : '';
      const codigo = document.getElementById('cli-codigo').value.trim().toUpperCase();
      if (!nombre) throw new Error('Ingresá tu nombre');
      if (pass.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');

      btn.textContent = 'CREANDO CUENTA...';

      // Registro libre: el cliente puede crear cuenta SIN código.
      // - Con código  → aplicar_codigo vincula taller + cliente (si el código tenía cliente_id).
      // - Sin código  → cuenta queda en estado "limbo" (rol=cliente, taller_id=null,
      //   cliente_id=null). Al loguear se mostrará showCodigoPrompt para que ingrese
      //   el código del taller (flujo "claim code" post-signup).
      const { data, error } = await sb.auth.signUp({ email, password: pass });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('Error al crear la cuenta');

      if (codigo) {
        // Aplica el código → vincula el perfil con el taller (y opcionalmente con un cliente).
        const { data: result, error: rpcError } = await sb.rpc('aplicar_codigo', { p_codigo: codigo, p_user_id: data.user.id });
        if (rpcError || !result?.ok) throw new Error(result?.error || rpcError?.message || 'Código inválido o ya utilizado');
        await sb.from('perfiles').update({ nombre }).eq('id', data.user.id);
        if (result.rol === 'cliente') {
          const { data: perfil } = await sb.from('perfiles').select('cliente_id').eq('id', data.user.id).maybeSingle();
          if (perfil?.cliente_id) {
            await sb.from('clientes').update({ nombre, telefono: telefono || null }).eq('id', perfil.cliente_id);
          }
        }
      } else {
        // Sin código: trigger anti-escalada en perfiles solo permite insertar
        // rol='cliente' sin taller_id ni cliente_id. Es exactamente lo que necesitamos.
        await sb.from('perfiles').upsert({
          id: data.user.id,
          nombre,
          rol: 'cliente'
        });
        // Guardamos teléfono en metadata del usuario (no requiere columna nueva).
        if (telefono) {
          try { await sb.auth.updateUser({ data: { telefono } }); } catch(_) {}
        }
      }

      // Login (signUp puede dejar la sesión abierta o no según confirmación de email).
      const { data: loginData } = await sb.auth.signInWithPassword({ email, password: pass });
      toast(`¡Bienvenido ${h(nombre)}!`, 'success');
      if (loginData?.user) {
        // loadPerfil() detecta taller_id=null y muestra showCodigoPrompt automáticamente.
        await loadPerfil(loginData.user);
      } else {
        switchLoginTab('login');
        toast('Revisá tu email para confirmar la cuenta', 'info');
      }
    } else if (loginTab === 'nuevo-taller') {
      const nombre = document.getElementById('reg-nombre-admin').value.trim();
      const tallerNombre = document.getElementById('reg-taller').value.trim();
      const tallerTel = document.getElementById('reg-tel').value.trim();
      if (!nombre || !tallerNombre) throw new Error('Completá todos los campos');
      if (pass.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
      
      btn.textContent = 'CREANDO TALLER...';
      
      const { data, error } = await sb.auth.signUp({ email, password: pass });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('Error al crear la cuenta');

      const { data: result, error: rpcError } = await sb.rpc('crear_taller_y_admin', {
        p_user_id:         data.user.id,
        p_nombre:          nombre,
        p_taller_nombre:   tallerNombre,
        p_taller_telefono: tallerTel
      });
      if (rpcError || !result?.ok) {
        throw new Error(result?.error || rpcError?.message || 'Error al crear el taller');
      }

      const { data: loginData, error: loginErr } = await sb.auth.signInWithPassword({ email, password: pass });
      if (loginErr) {
        toast('¡Taller creado! Ingresá con tu email y contraseña.', 'success');
        btn.textContent = 'CREAR TALLER'; btn.disabled = false;
        switchLoginTab('login');
        return;
      }
      
      toast(`¡Bienvenido ${h(nombre)}! Tu taller fue creado.`, 'success');
      await loadPerfil(loginData.user);
    }
  }, 'auth-btn', 'Error de autenticación').catch(err => {
    showAuthError(err.message);
  }).finally(() => {
    if (btn) {
      const labels = { login:'INGRESAR', 'nuevo-taller':'CREAR TALLER', 'soy-cliente':'CREAR MI CUENTA' };
      btn.textContent = labels[loginTab] || 'INGRESAR';
      btn.disabled = false;
    }
  });
}

async function handleForgotPassword() {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) { showAuthError('Ingresá tu email'); return; }
  await safeCall(async () => {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
    if (error) throw new Error('Error al enviar el email');
    document.getElementById('auth-error').style.display = 'none';
    document.getElementById('login-form').innerHTML = `
      <div style="text-align:center;padding:1rem">
        <div style="font-size:2rem;margin-bottom:1rem">📧</div>
        <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);margin-bottom:.5rem">EMAIL ENVIADO</div>
        <p style="color:var(--text2);font-size:.85rem">Revisá tu bandeja de entrada y seguí el link para restablecer tu contraseña.</p>
        <button class="btn-secondary" style="margin-top:1.5rem" onclick="location.reload()">VOLVER AL LOGIN</button>
      </div>`;
  }, null, 'Error al enviar el email').catch(err => showAuthError(err.message));
}

async function cambiarContrasena() {
  const pass1 = document.getElementById('new-pass').value;
  const pass2 = document.getElementById('new-pass2').value;
  const errEl = document.getElementById('auth-error');

  if (!pass1 || pass1.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres'; errEl.style.display = 'block'; return; }
  if (pass1 !== pass2) { errEl.textContent = 'Las contraseñas no coinciden'; errEl.style.display = 'block'; return; }

  const btn = document.querySelector('#login-form .btn-primary');
  if (btn) btn.textContent = 'GUARDANDO...';
  errEl.style.display = 'none';

  await safeCall(async () => {
    const { error } = await sb.auth.updateUser({ password: pass1 });
    if (error) throw new Error(error.message);
    recoveryMode = false;
    await sb.auth.signOut();
    window.location.href = window.location.origin + window.location.pathname;
  }, null, 'Error al cambiar contraseña').catch(err => {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    if (btn) btn.textContent = 'GUARDAR CONTRASEÑA';
  });
}

async function logout() {
  _loggedOutOnce = true;

  // ─── Cleanup de recursos antes de cerrar sesión ──────────────────────────
  // Realtime: evita que el canal siga vivo con otro usuario
  if (typeof realtime_desconectar === 'function') {
    try { realtime_desconectar(); } catch (e) {}
  }
  if (typeof stockRealtime_desconectar === 'function') {
    try { stockRealtime_desconectar(); } catch (e) {}
  }
  // Push: detener el timer de chequeos periódicos
  if (typeof _pushCheckTimer !== 'undefined' && _pushCheckTimer) {
    clearInterval(_pushCheckTimer);
    _pushCheckTimer = null;
  }
  // Modo taller: limpiar intervals y clase del body si quedaron activos
  if (typeof _modoTallerInterval !== 'undefined' && _modoTallerInterval) {
    clearInterval(_modoTallerInterval); _modoTallerInterval = null;
  }
  if (typeof _modoTallerRelojInterval !== 'undefined' && _modoTallerRelojInterval) {
    clearInterval(_modoTallerRelojInterval); _modoTallerRelojInterval = null;
  }
  document.body.classList.remove('modo-taller');
  // Resetear página actual para evitar fugas entre sesiones
  if (typeof currentPage !== 'undefined') currentPage = null;

  currentUser = null;
  currentPerfil = null;
  currentSuscripcion = null;
  currentPlan = null;
  _isSuperAdmin = false;
  await sb.auth.signOut();
  document.getElementById('app').style.display = 'none';
  document.getElementById('splash').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-normal').style.display = 'block';
  document.getElementById('login-invitacion').style.display = 'none';
  switchLoginTab('login');
  const tabNuevo = document.getElementById('tab-nuevo-taller');
  if (tabNuevo) tabNuevo.style.display = 'none';
  if (window.location.hash) history.replaceState(null, '', window.location.pathname);
}

// ─── SUPER-ADMIN: Panel de gestión de talleres ──────────────────────────────
let _isSuperAdmin = false;

async function checkSuperAdmin() {
  const { data } = await sb.from('super_admins').select('user_id').eq('user_id', currentUser?.id).maybeSingle();
  _isSuperAdmin = !!data;
}

async function superAdminPanel() {
  if (!_isSuperAdmin) { navigate('dashboard'); return; }
  
  const [{ data: talleres }, { data: suscripciones }, { data: planes }] = await Promise.all([
    sb.from('talleres').select('*').order('created_at', {ascending:false}),
    sb.from('suscripciones').select('*'),
    sb.from('planes').select('*')
  ]);

  const subMap = {};
  (suscripciones||[]).forEach(s => { subMap[s.taller_id] = s; });
  const planMap = {};
  (planes||[]).forEach(p => { planMap[p.id] = p; });

  const hoy = new Date().toISOString().split('T')[0];

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="font-family:var(--font-head);font-size:1.5rem;color:var(--accent);margin-bottom:.25rem">🔑 SUPER ADMIN</div>
      <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">${(talleres||[]).length} talleres registrados</div>

      <div class="stats-grid" style="margin-bottom:1rem">
        <div class="stat-card"><div class="stat-value">${(talleres||[]).length}</div><div class="stat-label">TALLERES</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${(suscripciones||[]).filter(s=>s.estado==='activa').length}</div><div class="stat-label">ACTIVAS</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${(suscripciones||[]).filter(s=>s.estado==='trial').length}</div><div class="stat-label">TRIAL</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${(suscripciones||[]).filter(s=>s.estado==='vencida').length}</div><div class="stat-label">VENCIDAS</div></div>
      </div>

      ${(talleres||[]).map(taller => {
        const sub = subMap[taller.id];
        const plan = sub ? planMap[sub.plan_id] : null;
        const estadoColor = { trial:'var(--warning)', activa:'var(--success)', vencida:'var(--danger)', cancelada:'var(--text2)' };
        const estadoLabel = { trial:'TRIAL', activa:'ACTIVA', vencida:'VENCIDA', cancelada:'CANCELADA' };
        return `
        <div class="card" style="cursor:default">
          <div class="card-header">
            <div class="card-avatar">${taller.nombre?h(taller.nombre).charAt(0).toUpperCase():'?'}</div>
            <div class="card-info">
              <div class="card-name">${h(taller.nombre)}</div>
              <div class="card-sub">${h(taller.telefono||'Sin teléfono')} · ${plan?h(plan.nombre):'Sin plan'}</div>
              <div class="card-sub">${sub?'Vence: '+(sub.fecha_vencimiento?formatFecha(sub.fecha_vencimiento):'Sin fecha'):''}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <span class="card-badge ${sub?.estado==='activa'?'badge-green':sub?.estado==='trial'?'badge-yellow':sub?.estado==='vencida'?'badge-red':'badge-blue'}">${sub?estadoLabel[sub.estado]||'?':'SIN PLAN'}</span>
              <button onclick="modalGestionarTaller('${taller.id}','${hjs(taller.nombre)}')" style="font-size:.65rem;background:var(--accent);color:#000;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-weight:600">Gestionar</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

async function modalGestionarTaller(tallerId, tallerNombre) {
  const [{ data: sub }, { data: planes }] = await Promise.all([
    sb.from('suscripciones').select('*').eq('taller_id', tallerId).maybeSingle(),
    sb.from('planes').select('*').order('precio')
  ]);

  openModal(`
    <div class="modal-title">Gestionar: ${tallerNombre}</div>
    <div class="form-group"><label class="form-label">Plan</label>
      <select class="form-input" id="f-sa-plan">
        ${(planes||[]).map(p => `<option value="${p.id}" ${sub?.plan_id===p.id?'selected':''}>${h(p.nombre)} — ₲${gs(p.precio)}/mes</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Estado</label>
      <select class="form-input" id="f-sa-estado">
        <option value="trial" ${sub?.estado==='trial'?'selected':''}>Trial</option>
        <option value="activa" ${sub?.estado==='activa'?'selected':''}>Activa</option>
        <option value="vencida" ${sub?.estado==='vencida'?'selected':''}>Vencida</option>
        <option value="cancelada" ${sub?.estado==='cancelada'?'selected':''}>Cancelada</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Fecha de vencimiento</label>
      <input class="form-input" id="f-sa-venc" type="date" value="${sub?.fecha_vencimiento||''}">
    </div>
    <div style="display:flex;gap:.5rem">
      <button onclick="activarPlan30Dias('${tallerId}','${sub?.id||''}')" style="flex:1;background:rgba(0,255,136,.15);color:var(--success);border:1px solid rgba(0,255,136,.3);border-radius:8px;padding:.6rem;font-family:var(--font-head);font-size:.8rem;cursor:pointer">+30 DÍAS</button>
      <button onclick="activarPlan365Dias('${tallerId}','${sub?.id||''}')" style="flex:1;background:rgba(0,229,255,.15);color:var(--accent);border:1px solid rgba(0,229,255,.3);border-radius:8px;padding:.6rem;font-family:var(--font-head);font-size:.8rem;cursor:pointer">+1 AÑO</button>
    </div>
    <button class="btn-primary" onclick="guardarGestionTaller('${tallerId}','${sub?.id||''}')" style="margin-top:.5rem">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarGestionTaller(tallerId, subId) {
  const planId = document.getElementById('f-sa-plan').value;
  const estado = document.getElementById('f-sa-estado').value;
  const venc = document.getElementById('f-sa-venc').value || null;
  
  if (subId) {
    await sb.from('suscripciones').update({ plan_id: planId, estado, fecha_vencimiento: venc }).eq('id', subId);
  } else {
    await sb.from('suscripciones').insert({ taller_id: tallerId, plan_id: planId, estado, fecha_vencimiento: venc });
  }
  toast('Suscripción actualizada','success');
  closeModal();
  superAdminPanel();
}

async function activarPlan30Dias(tallerId, subId) {
  const planId = document.getElementById('f-sa-plan').value;
  const venc = new Date(); venc.setDate(venc.getDate() + 30);
  const vencStr = venc.toISOString().split('T')[0];
  if (subId) {
    await sb.from('suscripciones').update({ plan_id: planId, estado: 'activa', fecha_vencimiento: vencStr }).eq('id', subId);
  } else {
    await sb.from('suscripciones').insert({ taller_id: tallerId, plan_id: planId, estado: 'activa', fecha_vencimiento: vencStr });
  }
  toast('✓ Activado por 30 días','success');
  closeModal(); superAdminPanel();
}

async function activarPlan365Dias(tallerId, subId) {
  const planId = document.getElementById('f-sa-plan').value;
  const venc = new Date(); venc.setDate(venc.getDate() + 365);
  const vencStr = venc.toISOString().split('T')[0];
  if (subId) {
    await sb.from('suscripciones').update({ plan_id: planId, estado: 'activa', fecha_vencimiento: vencStr }).eq('id', subId);
  } else {
    await sb.from('suscripciones').insert({ taller_id: tallerId, plan_id: planId, estado: 'activa', fecha_vencimiento: vencStr });
  }
  toast('✓ Activado por 1 año','success');
  closeModal(); superAdminPanel();
}

// ─── CONFIGURAR DATOS DEL TALLER (solo admin o superadmin) ───────────────────
async function modalConfigDatos() {
  const { data: taller } = await sb.from('talleres').select('*').eq('id', tid()).single();
  if (!taller) return;
  openModal(`
    <div class="modal-title">⚙️ Configurar Taller</div>
    <div class="form-group"><label class="form-label">Nombre del taller</label><input class="form-input" id="f-taller-nombre" value="${h(taller.nombre||'')}"></div>
    <div class="form-group"><label class="form-label">RUC</label><input class="form-input" id="f-taller-ruc" value="${h(taller.ruc||'')}" placeholder="80012345-6"></div>
    <div class="form-group"><label class="form-label">Teléfono / WhatsApp principal</label>${phoneInput('f-taller-tel',taller.telefono,'0981 123 456')}</div>
    <div class="form-group"><label class="form-label">Dirección</label><input class="form-input" id="f-taller-dir" value="${h(taller.direccion||'')}" placeholder="Av. Ejemplo 123"></div>
    <div style="background:var(--surface2);border-radius:8px;padding:.75rem;margin-top:.5rem;margin-bottom:1rem">
      <div style="font-size:.75rem;color:var(--text2)">💡 El RUC y dirección aparecen en las facturas</div>
      <div style="font-size:.75rem;color:var(--text2)">💡 El teléfono se usa para WhatsApp</div>
    </div>
    <button class="btn-primary" onclick="guardarConfigDatos()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarConfigDatos() {
  const nombre = document.getElementById('f-taller-nombre').value.trim();
  const ruc = document.getElementById('f-taller-ruc').value.trim();
  const telefono = document.getElementById('f-taller-tel').value.trim();
  const direccion = document.getElementById('f-taller-dir').value.trim();
  if (!nombre) { toast('El nombre es obligatorio','error'); return; }
  const { error } = await sb.from('talleres').update({ nombre, ruc, telefono, direccion }).eq('id', tid());
  if (error) { toast('Error: '+error.message,'error'); return; }
  if (currentPerfil?.talleres) {
    currentPerfil.talleres.nombre = nombre;
    currentPerfil.talleres.telefono = telefono;
    currentPerfil.talleres.ruc = ruc;
    currentPerfil.talleres.direccion = direccion;
  }
  toast('Taller actualizado','success');
  closeModal();
  navigate('dashboard');
}
