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
let currentUser   = null;   // Usuario autenticado de Supabase
let currentPerfil = null;   // Perfil con rol y taller
let currentPage   = 'dashboard';
let loginTab      = 'login';
let recoveryMode  = window.location.hash.includes('type=recovery');
let _loggedOutOnce = false;   // ← MOVIDA AQUÍ, al principio del archivo

// Link de invitación: detectar ?taller=ID&codigo=XXXX (validado como UUID)
const urlParams       = new URLSearchParams(window.location.search);
const _rawTallerId    = urlParams.get('taller');
const UUID_REGEX      = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tallerIdFromUrl = (_rawTallerId && UUID_REGEX.test(_rawTallerId)) ? _rawTallerId : null;
const codigoFromUrl   = urlParams.get('codigo') || null;

// Splash: tiempo de inicio para sincronizar animación
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
      // Si viene de la landing con #nuevo-taller pero ya tiene sesión, 
      // cerrar sesión para que pueda crear un taller nuevo
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
      // Si viene de la landing, abrir tab de nuevo taller
      if (window.location.hash === '#nuevo-taller') {
        setTimeout(() => switchLoginTab('nuevo-taller'), 100);
      }
    }
  } catch(e) {
    hideSplash(true);
    showLogin();
  }
});

// onAuthStateChange: recovery, logout y sesión expirada
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
    // Token refresh falló — sesión expirada
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
    const { data: perfil, error } = await sb.from('perfiles')
      .select('id, nombre, rol, taller_id, talleres(id, nombre, telefono, ruc, direccion)')
      .eq('id', user.id)
      .maybeSingle();
    if (error) { console.error('loadPerfil error:', error); showLogin(); return; }
    if (!perfil) {
      // Usuario sin perfil — puede ser un registro incompleto
      // Mostrar prompt de código para que se vincule a un taller
      currentPerfil = { id: user.id, nombre: user.email, rol: 'cliente', taller_id: null };
      showCodigoPrompt();
      return;
    }
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
  
  try {
    const { data: result, error } = await sb.rpc('aplicar_codigo', { p_codigo: codigo, p_user_id: currentUser.id });
    
    if (error) { errEl.textContent = 'Error: ' + error.message; errEl.style.display = 'block'; return; }
    if (!result?.ok) { errEl.textContent = result?.error || 'Código inválido o ya utilizado'; errEl.style.display = 'block'; return; }
    
    // Recargar perfil
    const { data: perfil } = await sb.from('perfiles')
      .select('id, nombre, rol, taller_id, talleres(id, nombre, telefono, ruc, direccion)')
      .eq('id', currentUser.id).maybeSingle();
    currentPerfil = perfil;
    toast(result.rol === 'empleado' ? 'Registrado como empleado' : 'Registrado como cliente', 'success');
    showApp();
  } catch(e) {
    console.error('aplicarCodigo error:', e);
    errEl.textContent = 'Error al aplicar el código. Intentá de nuevo.';
    errEl.style.display = 'block';
  }
}

async function crearTallerDesdePrompt() {
  const nombre = document.getElementById('prompt-nombre').value.trim();
  const tallerNombre = document.getElementById('prompt-taller').value.trim();
  const tallerTel = document.getElementById('prompt-tel').value.trim();
  const errEl = document.getElementById('auth-error');
  if (!nombre || !tallerNombre) { errEl.textContent = 'Completá tu nombre y el nombre del taller'; errEl.style.display = 'block'; return; }

  try {
    // Crear taller
    const { data: taller, error: tallerErr } = await sb.from('talleres').insert({ nombre: tallerNombre, telefono: tallerTel }).select().single();
    if (tallerErr || !taller) { errEl.textContent = 'Error al crear el taller: ' + (tallerErr?.message || ''); errEl.style.display = 'block'; return; }

    // Crear o actualizar perfil como admin
    const { data: existePerfil } = await sb.from('perfiles').select('id').eq('id', currentUser.id).maybeSingle();
    if (existePerfil) {
      await sb.from('perfiles').update({ nombre, rol: 'admin', taller_id: taller.id }).eq('id', currentUser.id);
    } else {
      await sb.from('perfiles').insert({ id: currentUser.id, nombre, rol: 'admin', taller_id: taller.id });
    }

    // Crear suscripción trial 14 días
    const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 14);
    await sb.from('suscripciones').insert({ taller_id: taller.id, plan_id: 'premium', estado: 'trial', fecha_vencimiento: trialEnd.toISOString().split('T')[0] });

    // Recargar perfil y entrar
    const { data: perfil } = await sb.from('perfiles').select('id, nombre, rol, taller_id, talleres(id, nombre, telefono, ruc, direccion)').eq('id', currentUser.id).maybeSingle();
    currentPerfil = perfil;
    toast(`¡Bienvenido ${nombre}! Tu taller fue creado.`, 'success');
    showApp();
  } catch(e) {
    console.error('crearTallerDesdePrompt error:', e);
    errEl.textContent = 'Error inesperado. Intentá de nuevo.';
    errEl.style.display = 'block';
  }
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
  // Si ya estuvo loggeado antes, ocultar "Nuevo Taller" — solo se crea taller desde la landing
  if (_loggedOutOnce) {
    const tabNuevo = document.getElementById('tab-nuevo-taller');
    if (tabNuevo) tabNuevo.style.display = 'none';
  }
}

function showLoginNormal(fromInvite) {
  document.getElementById('login-normal').style.display = 'block';
  document.getElementById('login-invitacion').style.display = 'none';
  switchLoginTab('login');
  // Si viene de invitación, ocultar tab "Nuevo Taller"
  const tabNuevo = document.getElementById('tab-nuevo-taller');
  if (tabNuevo) tabNuevo.style.display = fromInvite ? 'none' : '';
}

function showLoginInvitacion() {
  document.getElementById('login-normal').style.display = 'none';
  document.getElementById('login-invitacion').style.display = 'block';
}

function onCodigoInput(val) {
  // No-op: el tipo de código (empleado/cliente) se valida server-side al registrarse
}

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
    // Verificar si el trial o suscripción venció
    const hoy = new Date().toISOString().split('T')[0];
    if ((sub.estado === 'trial' || sub.estado === 'activa') && sub.fecha_vencimiento && sub.fecha_vencimiento < hoy) {
      sub.estado = 'vencida';
      await sb.from('suscripciones').update({ estado: 'vencida' }).eq('id', sub.id);
    }
    currentSuscripcion = sub;
    currentPlan = sub.planes;
  } else {
    // Taller sin suscripción — darle acceso completo como fallback
    currentSuscripcion = { estado: 'activa', plan_id: 'premium' };
    currentPlan = { id:'premium', nombre:'TallerPro', max_usuarios:999, tiene_agenda:true, tiene_mantenimientos:true, tiene_reportes:true, tiene_emails:true };
  }
}

function planPermite(feature) { return true; //
  if (!currentPlan) return false;
  if (currentSuscripcion?.estado === 'vencida') return false;
  return currentPlan[feature] === true;
}

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
    navigate('dashboard');
  });
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}

function switchLoginTab(tab) {
  loginTab = tab;
  document.querySelectorAll('.login-tab').forEach((t,i) => {
    t.classList.toggle('active', (i===0&&tab==='login')||(i===1&&tab==='register')||(i===2&&tab==='nuevo-taller'));
  });
  const regFields = document.getElementById('register-fields');
  if (regFields) regFields.style.display = tab==='register' ? 'block' : 'none';
  document.getElementById('nuevo-taller-fields').style.display = tab==='nuevo-taller' ? 'block' : 'none';
  document.getElementById('forgot-link').style.display = tab==='login' ? 'block' : 'none';
  const forgotMode = tab === 'forgot';
  document.getElementById('auth-pass').style.display = forgotMode ? 'none' : 'block';
  document.getElementById('auth-pass').previousElementSibling.style.display = forgotMode ? 'none' : 'block';
  if (forgotMode) {
    document.getElementById('auth-btn').textContent = 'ENVIAR LINK';
    document.getElementById('auth-btn').onclick = handleForgotPassword;
    document.getElementById('forgot-link').innerHTML = `<button onclick="switchLoginTab('login')" style="background:none;border:none;color:var(--text2);font-size:.8rem;cursor:pointer;text-decoration:underline">← Volver al login</button>`;
  } else {
    const labels = { login:'INGRESAR', register:'REGISTRARME', 'nuevo-taller':'CREAR TALLER' };
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

  try {
    // 1. Crear cuenta
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if (error) {
      errEl.textContent = error.message;
      errEl.style.display = 'block';
      btn.textContent = 'REGISTRARME'; btn.disabled = false;
      return;
    }
    if (!data.user) {
      errEl.textContent = 'Error al crear la cuenta. Intentá de nuevo.';
      errEl.style.display = 'block';
      btn.textContent = 'REGISTRARME'; btn.disabled = false;
      return;
    }

    // 2. Aplicar código via RPC (crea perfil + asigna rol + marca código)
    const { data: result, error: rpcError } = await sb.rpc('aplicar_codigo', { p_codigo: codigo, p_user_id: data.user.id });
    
    if (rpcError || !result?.ok) {
      errEl.textContent = result?.error || rpcError?.message || 'Código inválido o ya utilizado';
      errEl.style.display = 'block';
      btn.textContent = 'REGISTRARME'; btn.disabled = false;
      return;
    }

    // 3. Actualizar nombre en perfil
    const nombreCompleto = `${nombre} ${apellido}`;
    await sb.from('perfiles').update({ nombre: nombreCompleto }).eq('id', data.user.id);

    // 4. Si es cliente, actualizar nombre y teléfono en ficha de cliente
    if (result.rol === 'cliente') {
      const { data: perfil } = await sb.from('perfiles').select('cliente_id').eq('id', data.user.id).maybeSingle();
      if (perfil?.cliente_id) {
        await sb.from('clientes').update({ nombre: nombreCompleto, telefono: telefono || null }).eq('id', perfil.cliente_id);
      }
    }

    toast(`¡Bienvenido ${nombre}!`, 'success');
    btn.textContent = 'REGISTRARME'; btn.disabled = false;

    // 5. Ingresar directamente
    await loadPerfil(data.user);
  } catch(e) {
    console.error('handleRegistroInvitacion error:', e);
    errEl.textContent = 'Error inesperado. Intentá de nuevo.';
    errEl.style.display = 'block';
    btn.textContent = 'REGISTRARME'; btn.disabled = false;
  }
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

  if (loginTab === 'login') {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) {
      showAuthError('Email o contraseña incorrectos');
      btn.textContent = 'INGRESAR'; btn.disabled = false;
      return;
    }
    resetLoginAttempts();
    await loadPerfil(data.user);

  } else if (loginTab === 'nuevo-taller') {
    const nombre = document.getElementById('reg-nombre-admin').value.trim();
    const tallerNombre = document.getElementById('reg-taller').value.trim();
    const tallerTel = document.getElementById('reg-tel').value.trim();
    if (!nombre || !tallerNombre) { showAuthError('Completá todos los campos'); btn.textContent = 'CREAR TALLER'; btn.disabled = false; return; }
    if (pass.length < 6) { showAuthError('La contraseña debe tener al menos 6 caracteres'); btn.textContent = 'CREAR TALLER'; btn.disabled = false; return; }
    
    btn.textContent = 'CREANDO TALLER...';
    
    try {
      // 1. Crear cuenta
      const { data, error } = await sb.auth.signUp({ email, password: pass });
      if (error) { showAuthError(error.message); btn.textContent = 'CREAR TALLER'; btn.disabled = false; return; }
      if (!data.user) { showAuthError('Error al crear la cuenta. Intentá de nuevo.'); btn.textContent = 'CREAR TALLER'; btn.disabled = false; return; }
      
      // 2. Crear taller
      const { data: taller, error: tallerErr } = await sb.from('talleres').insert({ nombre: tallerNombre, telefono: tallerTel }).select().single();
      if (tallerErr || !taller) { 
        showAuthError('Error al crear el taller: ' + (tallerErr?.message || 'intentá de nuevo')); 
        btn.textContent = 'CREAR TALLER'; btn.disabled = false; 
        return; 
      }
      
      // 3. Crear perfil admin
      const { error: perfilErr } = await sb.from('perfiles').insert({ id: data.user.id, nombre, rol: 'admin', taller_id: taller.id });
      if (perfilErr) { 
        showAuthError('Error al crear el perfil: ' + perfilErr.message); 
        btn.textContent = 'CREAR TALLER'; btn.disabled = false; 
        return; 
      }

      // 3.5 Crear suscripción trial (14 días Premium)
      const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 14);
      await sb.from('suscripciones').insert({ taller_id: taller.id, plan_id: 'premium', estado: 'trial', fecha_vencimiento: trialEnd.toISOString().split('T')[0] });
      
      // 4. Intentar login automático
      const { data: loginData, error: loginErr } = await sb.auth.signInWithPassword({ email, password: pass });
      if (loginErr) {
        // Si falla el auto-login (ej: requiere confirmación email), mandar al login
        toast('¡Taller creado! Ingresá con tu email y contraseña.', 'success');
        btn.textContent = 'CREAR TALLER'; btn.disabled = false;
        switchLoginTab('login');
        return;
      }
      
      // 5. Entrar directo
      toast(`¡Bienvenido ${h(nombre)}! Tu taller fue creado.`, 'success');
      await loadPerfil(loginData.user);
      
    } catch(e) {
      console.error('Error creando taller:', e);
      showAuthError('Error inesperado. Intentá de nuevo.');
      btn.textContent = 'CREAR TALLER'; btn.disabled = false;
    }
  }
}


async function handleForgotPassword() {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) { showAuthError('Ingresá tu email'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href
  });
  if (error) { showAuthError('Error al enviar el email'); return; }
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('login-form').innerHTML = `
    <div style="text-align:center;padding:1rem">
      <div style="font-size:2rem;margin-bottom:1rem">📧</div>
      <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);margin-bottom:.5rem">EMAIL ENVIADO</div>
      <p style="color:var(--text2);font-size:.85rem">Revisá tu bandeja de entrada y seguí el link para restablecer tu contraseña.</p>
      <button class="btn-secondary" style="margin-top:1.5rem" onclick="location.reload()">VOLVER AL LOGIN</button>
    </div>`;
}

async function cambiarContrasena() {
  const pass1 = document.getElementById('new-pass').value;
  const pass2 = document.getElementById('new-pass2').value;
  const errEl = document.getElementById('auth-error');

  if (!pass1 || pass1.length < 6) { 
    errEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
    errEl.style.display = 'block';
    return; 
  }
  if (pass1 !== pass2) { 
    errEl.textContent = 'Las contraseñas no coinciden';
    errEl.style.display = 'block';
    return; 
  }

  const btn = document.querySelector('#login-form .btn-primary');
  if (btn) btn.textContent = 'GUARDANDO...';
  errEl.style.display = 'none';

  const { error } = await sb.auth.updateUser({ password: pass1 });
  
  if (error) { 
    errEl.textContent = 'Error: ' + error.message;
    errEl.style.display = 'block';
    if (btn) btn.textContent = 'GUARDAR CONTRASEÑA';
    return; 
  }

  recoveryMode = false;
  await sb.auth.signOut();
  window.location.href = window.location.origin + window.location.pathname;
}

async function logout() {
  _loggedOutOnce = true;
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

