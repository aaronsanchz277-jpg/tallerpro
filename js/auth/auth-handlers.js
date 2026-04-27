// ─── MANEJO DE AUTENTICACIÓN (FORM HANDLERS) ─────────────────────────────────
// Handlers de los formularios de login/registro/reset de contraseña, y logout.
// Las variables globales (currentUser, currentPerfil, currentSuscripcion, etc.)
// y `_isSuperAdmin` se declaran en auth.js / super-admin.js — acá sólo se
// asignan o leen. Cargado DESPUÉS de auth.js y super-admin.js.
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

      // Si el proyecto Supabase tiene "Confirm email" activado, signUp NO devuelve
      // sesión activa: los siguientes upsert/RPC fallarían en RLS porque corren
      // como anon. Cortamos acá con un mensaje claro; el usuario completará el
      // setup (código del taller, datos de contacto) después de confirmar el email,
      // vía showCodigoPrompt cuando entre por primera vez.
      if (!data.session) {
        switchLoginTab('login');
        toast('Te enviamos un email para confirmar tu cuenta. Confirmalo y volvé a entrar para terminar el registro.', 'info');
        return;
      }

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
        const { error: upsertErr } = await sb.from('perfiles').upsert({
          id: data.user.id,
          nombre,
          rol: 'cliente'
        });
        if (upsertErr) {
          console.error('[soy-cliente] upsert perfil falló:', upsertErr);
          throw new Error('No pudimos crear tu perfil. Probá de nuevo o pedile el código al taller.');
        }
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
  if (typeof fab_actualizarVisibilidad === 'function') fab_actualizarVisibilidad();
  switchLoginTab('login');
  const tabNuevo = document.getElementById('tab-nuevo-taller');
  if (tabNuevo) tabNuevo.style.display = 'none';
  if (window.location.hash) history.replaceState(null, '', window.location.pathname);
}
