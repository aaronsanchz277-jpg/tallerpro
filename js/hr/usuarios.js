// ─── USUARIOS (ADMIN) ─────────────────────────────────────────────────────────
async function usuarios() {
  // Pantalla solo para admin. Si no lo es, lo mandamos al dashboard.
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede gestionar usuarios')) {
    if (typeof navigate === 'function') navigate('dashboard');
    return;
  }
  // Pedimos códigos con empleado_id (Tarea #17). Si la columna todavía no
  // existe en la BD, fallback al select clásico para no romper.
  let codigos = [];
  {
    const r = await sb.from('codigos_empleado')
      .select('id,codigo,tipo,usado,empleado_id,created_at')
      .eq('taller_id', tid()).eq('usado', false)
      .order('created_at', {ascending:false});
    if (r.error && /empleado_id/i.test(r.error.message || '')) {
      const r2 = await sb.from('codigos_empleado').select('*').eq('taller_id', tid()).eq('usado', false).order('created_at', {ascending:false});
      codigos = r2.data || [];
    } else {
      codigos = r.data || [];
    }
  }

  const [{ data: perfiles }, { data: empleadosTaller }] = await Promise.all([
    sb.from('perfiles').select('*').eq('taller_id', tid()).order('nombre'),
    sb.from('empleados').select('id,nombre').eq('taller_id', tid()).order('nombre')
  ]);

  const empMap = {};
  (empleadosTaller || []).forEach(e => { empMap[e.id] = e.nombre; });

  const admins    = (perfiles||[]).filter(u => u.rol === 'admin');
  const empleados = (perfiles||[]).filter(u => u.rol === 'empleado');
  const clientes  = (perfiles||[]).filter(u => u.rol === 'cliente');

  // Tarea #17: bandeja de empleados sin vincular (perfil rol=empleado y
  // empleado_id IS NULL). Es cualquier perfil empleado que entró por código
  // genérico (sin preasociar) y todavía no fue vinculado a una ficha.
  const empleadosPendientes = empleados.filter(u => !u.empleado_id);

  const renderCard = (u) => {
    const nombreEmp = u.empleado_id ? (empMap[u.empleado_id] || '—') : null;
    const subVinculo = u.rol === 'empleado'
      ? (nombreEmp
          ? `<div class="card-sub" style="font-size:.72rem;color:var(--success)">🔗 ${h(nombreEmp)}</div>`
          : `<div class="card-sub" style="font-size:.72rem;color:var(--warning)">⚠️ Sin vincular a un empleado</div>`)
      : '';
    return `
    <div class="card">
      <div class="card-header">
        <div class="card-avatar">${u.nombre?u.nombre.charAt(0).toUpperCase():'?'}</div>
        <div class="card-info">
          <div class="card-name">${h(u.nombre||'Sin nombre')}${u.id===currentUser.id?' (Vos)':''}</div>
          ${subVinculo}
        </div>
        <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          ${u.id!==currentUser.id?`<button onclick="cambiarRol('${u.id}','${u.rol}')" style="font-size:.7rem;background:none;border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:3px 8px;cursor:pointer">Rol</button>`:''}
          ${u.rol==='cliente'?`<button onclick="modalVincularVehiculo('${u.id}','${hjs(u.nombre)}')" style="font-size:.7rem;background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.3);color:var(--accent);border-radius:6px;padding:3px 8px;cursor:pointer">🚗 Autos</button>`:''}
          ${(u.rol==='empleado'||u.rol==='admin')?`<button onclick="modalVincularEmpleado('${u.id}','${hjs(u.nombre)}')" style="font-size:.7rem;background:rgba(255,204,0,.1);border:1px solid rgba(255,204,0,.3);color:var(--warning);border-radius:6px;padding:3px 8px;cursor:pointer">👤 Vincular</button>`:''}
        </div>
      </div>
    </div>`;
  };

  const renderSeccion = (titulo, color, lista) => lista.length === 0 ? '' : `
    <div style="font-size:.72rem;color:${color};font-family:var(--font-head);letter-spacing:1px;margin:.75rem 0 .4rem">${titulo} (${lista.length})</div>
    ${lista.map(renderCard).join('')}`;

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('usTitulo')}</div>
      <button class="btn-add" onclick="modalInvitarUsuario()">${t('usInvitar')}</button>
    </div>

    ${empleadosPendientes.length > 0 ? `
    <div style="background:rgba(255,204,0,.06);border:1px solid rgba(255,204,0,.25);border-radius:10px;padding:.75rem;margin-bottom:1rem">
      <div style="font-size:.72rem;color:var(--warning);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.5rem">⚠️ EMPLEADOS PENDIENTES DE VINCULAR (${empleadosPendientes.length})</div>
      <div style="font-size:.78rem;color:var(--text2);margin-bottom:.6rem">
        Estos usuarios entraron como empleado pero todavía no están vinculados a una ficha de empleado. Vinculálos para que puedan ver su sueldo, comisiones y vales.
      </div>
      ${empleadosPendientes.map(u => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-top:1px solid var(--border)">
          <div style="font-size:.85rem">${h(u.nombre || 'Sin nombre')}${u.id===currentUser.id?' (Vos)':''}</div>
          <button onclick="modalVincularEmpleado('${u.id}','${hjs(u.nombre||'')}')" style="font-size:.72rem;background:rgba(255,204,0,.15);border:1px solid rgba(255,204,0,.35);color:var(--warning);border-radius:6px;padding:3px 10px;cursor:pointer;font-family:var(--font-head)">🔗 Vincular</button>
        </div>`).join('')}
    </div>` : ''}

    ${(codigos||[]).length > 0 ? `
    <div style="background:rgba(255,204,0,.05);border:1px solid rgba(255,204,0,.2);border-radius:10px;padding:.75rem;margin-bottom:1rem">
      <div style="font-size:.72rem;color:var(--warning);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.5rem">${t('usCodigosPend')}</div>
      ${(codigos||[]).map(c => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
          <div>
            <span style="font-family:var(--font-head);font-size:1.1rem;color:${c.tipo==='empleado'?'var(--accent2)':'var(--success)'};letter-spacing:3px">${h(c.codigo)}</span>
            <span style="font-size:.65rem;margin-left:.5rem;padding:2px 6px;border-radius:10px;background:${c.tipo==='empleado'?'rgba(255,107,53,.15)':'rgba(0,255,136,.15)'};color:${c.tipo==='empleado'?'var(--accent2)':'var(--success)'}">${c.tipo==='empleado'?'EMPLEADO':'CLIENTE'}</span>
            ${c.empleado_id && empMap[c.empleado_id] ? `<span style="font-size:.7rem;margin-left:.4rem;color:var(--text2)">→ ${h(empMap[c.empleado_id])}</span>` : ''}
          </div>
          <button onclick="eliminarCodigoConSafeCall('${c.id}')" style="font-size:.7rem;background:none;border:1px solid var(--border);color:var(--danger);border-radius:6px;padding:2px 8px;cursor:pointer">✕</button>
        </div>`).join('')}
    </div>` : ''}

    ${perfiles?.length === 0 ? `<div class="empty"><p>${t('usSinUsuarios')}</p></div>` : ''}
    ${renderSeccion(t('usAdmins'), 'var(--accent)', admins)}
    ${renderSeccion(t('usEmpleados'), 'var(--accent2)', empleados)}
    ${renderSeccion(t('usClientes'), 'var(--success)', clientes)}`;
}

async function eliminarCodigoConSafeCall(id) {
  await safeCall(async () => {
    await eliminarCodigo(id);
  }, null, 'No se pudo eliminar el código');
}

async function eliminarCodigo(id) {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  await sb.from('codigos_empleado').delete().eq('id', id);
  toast('Código cancelado');
  usuarios();
}

async function cambiarRol(userId, rolActual) {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  const roles = ['admin','empleado','cliente'];
  const siguiente = roles[(roles.indexOf(rolActual)+1) % roles.length];
  confirmar(`¿Cambiar el rol a ${siguiente.toUpperCase()}?`, async () => {
    await safeCall(async () => {
      await sb.from('perfiles').update({ rol: siguiente }).eq('id', userId);
      toast('Rol actualizado','success');
      usuarios();
    }, null, 'No se pudo cambiar el rol');
  });
}

async function modalVincularVehiculo(perfilId, nombreUsuario) {
  const { data: perfil } = await sb.from('perfiles').select('cliente_id').eq('id', perfilId).maybeSingle();

  const { data: vehiculosSin } = await sb.from('vehiculos')
    .select('id, patente, marca, modelo')
    .eq('taller_id', tid())
    .is('cliente_id', null)
    .order('patente');

  let vehiculosAsignados = [];
  if (perfil?.cliente_id) {
    const { data } = await sb.from('vehiculos')
      .select('id, patente, marca, modelo')
      .eq('cliente_id', perfil.cliente_id);
    vehiculosAsignados = data || [];
  }

  openModal(`
    <div class="modal-title">${t("modVincularVeh")}</div>
    <p style="color:var(--text2);font-size:.82rem;margin-bottom:1rem">Cliente: <strong style="color:var(--text)">${h(nombreUsuario)}</strong></p>

    ${vehiculosAsignados.length > 0 ? `
    <div style="margin-bottom:1rem">
      <div style="font-size:.72rem;color:var(--success);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.4rem">YA VINCULADOS</div>
      ${vehiculosAsignados.map(v => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
          <span style="font-size:.85rem">${h(v.patente)} · ${h(v.marca)} ${h(v.modelo||'')}</span>
          <button onclick="desvincularVehiculoConSafeCall('${v.id}','${perfilId}','${hjs(nombreUsuario)}')" style="font-size:.7rem;background:none;border:1px solid var(--border);color:var(--danger);border-radius:6px;padding:2px 8px;cursor:pointer">✕ Quitar</button>
        </div>`).join('')}
    </div>` : ''}

    ${(vehiculosSin||[]).length > 0 ? `
    <div style="font-size:.72rem;color:var(--text2);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.4rem">VEHÍCULOS SIN PROPIETARIO</div>
    ${(vehiculosSin||[]).map(v => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
        <span style="font-size:.85rem">${h(v.patente)} · ${h(v.marca)} ${h(v.modelo||'')}</span>
        <button onclick="vincularVehiculoAClienteConSafeCall('${v.id}','${perfilId}','${hjs(nombreUsuario)}')" style="font-size:.7rem;background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.3);color:var(--accent);border-radius:6px;padding:2px 8px;cursor:pointer">+ Asignar</button>
      </div>`).join('')}
    ` : `<p style="color:var(--text2);font-size:.82rem">No hay vehículos sin propietario.</p>`}

    <button class="btn-secondary" onclick="closeModal()" style="margin-top:1rem">CERRAR</button>`);
}

async function vincularVehiculoAClienteConSafeCall(vehiculoId, perfilId, nombreUsuario) {
  await safeCall(async () => {
    await vincularVehiculoACliente(vehiculoId, perfilId, nombreUsuario);
  }, null, 'No se pudo vincular el vehículo');
}

async function vincularVehiculoACliente(vehiculoId, perfilId, nombreUsuario) {
  const { data: perfil } = await sb.from('perfiles').select('cliente_id, nombre').eq('id', perfilId).maybeSingle();
  let clienteId = perfil?.cliente_id;

  if (!clienteId) {
    const { data: cli } = await sb.from('clientes')
      .insert({ nombre: perfil?.nombre || nombreUsuario, taller_id: tid() })
      .select().single();
    if (!cli) { toast('Error al crear ficha de cliente','error'); return; }
    clienteId = cli.id;
    await sb.from('perfiles').update({ cliente_id: clienteId }).eq('id', perfilId);
  }

  await offlineUpdate('vehiculos', { cliente_id: clienteId }, 'id', vehiculoId);
  invalidateComponentCache();
  toast('Vehículo asignado','success');
  closeModal();
  modalVincularVehiculo(perfilId, nombreUsuario);
}

async function desvincularVehiculoConSafeCall(vehiculoId, perfilId, nombreUsuario) {
  await safeCall(async () => {
    await desvincularVehiculo(vehiculoId, perfilId, nombreUsuario);
  }, null, 'No se pudo desvincular el vehículo');
}

async function desvincularVehiculo(vehiculoId, perfilId, nombreUsuario) {
  await offlineUpdate('vehiculos', { cliente_id: null }, 'id', vehiculoId);
  invalidateComponentCache();
  toast('Vehículo desvinculado','success');
  closeModal();
  modalVincularVehiculo(perfilId, nombreUsuario);
}

// ─── VINCULAR PERFIL CON EMPLEADO ─────────────────────────────────────────
async function modalVincularEmpleado(perfilId, nombreUsuario) {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  const { data: perfil } = await sb.from('perfiles').select('empleado_id').eq('id', perfilId).maybeSingle();
  const { data: empleados } = await sb.from('empleados').select('id,nombre').eq('taller_id', tid()).order('nombre');
  
  openModal(`
    <div class="modal-title">Vincular usuario a empleado</div>
    <p style="color:var(--text2);font-size:.82rem;margin-bottom:1rem">Usuario: <strong style="color:var(--text)">${h(nombreUsuario)}</strong></p>
    <div class="form-group">
      <label class="form-label">Seleccionar empleado</label>
      <select class="form-input" id="f-vincular-empleado">
        <option value="">Ninguno (desvincular)</option>
        ${(empleados||[]).map(e => `<option value="${e.id}" ${perfil?.empleado_id===e.id?'selected':''}>${h(e.nombre)}</option>`).join('')}
      </select>
    </div>
    <button class="btn-primary" onclick="vincularPerfilEmpleado('${perfilId}')">Guardar</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
  `);
}

async function vincularPerfilEmpleado(perfilId) {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  const empleadoId = document.getElementById('f-vincular-empleado').value || null;
  const { error } = await sb.from('perfiles').update({ empleado_id: empleadoId }).eq('id', perfilId);
  if (error) { toast('Error: '+error.message,'error'); return; }
  toast('Vinculación actualizada','success');
  closeModal();
  usuarios();
}

async function modalInvitarUsuario(empleadoIdPreseleccionado = null) {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  const base = window.location.origin + window.location.pathname;
  const link = `${base}?taller=${tid()}`;

  // Empleados existentes (Tarea #17) para preasociar el código.
  const { data: empleadosTaller } = await sb.from('empleados')
    .select('id,nombre').eq('taller_id', tid()).order('nombre');

  const opcionesEmpleados = (empleadosTaller || []).map(e =>
    `<option value="${e.id}" ${empleadoIdPreseleccionado===e.id?'selected':''}>${h(e.nombre)}</option>`
  ).join('');

  openModal(`
    <div class="modal-title">${t("modInvitarUsuario")}</div>
    <div class="tabs" style="margin-bottom:1rem">
      <button class="tab active" onclick="switchInviteTab('empleado',this)">Empleado</button>
      <button class="tab" onclick="switchInviteTab('cliente',this)">Cliente</button>
    </div>

    <div id="invite-empleado">
      <p style="color:var(--text2);font-size:.82rem;margin-bottom:.6rem">
        Generá un código y enviáselo al empleado junto con el link de registro.
      </p>
      <div class="form-group">
        <label class="form-label">Vincular a un empleado existente (opcional)</label>
        <select class="form-input" id="f-invite-empleado-id">
          <option value="">— Sin preasociar —</option>
          ${opcionesEmpleados}
        </select>
        <div style="font-size:.7rem;color:var(--text2);margin-top:.3rem">
          Si elegís uno, el usuario va a quedar automáticamente vinculado a esa ficha al ingresar el código.
        </div>
      </div>
      <button class="btn-primary" onclick="generarCodigoConSafeCall('empleado')">GENERAR CÓDIGO</button>
      <div id="codigo-generado-empleado" style="display:none;margin-top:1rem">
        <div style="background:var(--surface2);border:1px solid var(--accent2);border-radius:10px;padding:1rem;text-align:center;margin-bottom:.75rem">
          <div style="font-size:.72rem;color:var(--text2);margin-bottom:.4rem">CÓDIGO DE EMPLEADO</div>
          <div id="codigo-valor-empleado" style="font-family:var(--font-head);font-size:2.2rem;font-weight:700;color:var(--accent2);letter-spacing:6px"></div>
          <div style="font-size:.7rem;color:var(--text2);margin-top:.3rem">Un solo uso</div>
        </div>
        <div id="link-empleado" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.6rem;font-size:.72rem;color:var(--text2);word-break:break-all;margin-bottom:.5rem"></div>
        <div style="display:flex;gap:.4rem">
          <button onclick="copiarInvitacion('empleado')" style="flex:1;background:var(--accent2);color:#000;border:none;border-radius:8px;padding:.6rem;font-family:var(--font-head);font-size:.85rem;font-weight:700;cursor:pointer">📋 COPIAR</button>
          <button onclick="compartirWhatsApp('empleado')" style="flex:1;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:8px;padding:.6rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer">💬 WHATSAPP</button>
        </div>
      </div>
    </div>

    <div id="invite-cliente" style="display:none">
      <p style="color:var(--text2);font-size:.82rem;margin-bottom:1rem">
        Generá un código y enviáselo al cliente junto con el link de registro.
      </p>
      <button class="btn-primary" onclick="generarCodigoConSafeCall('cliente')">GENERAR CÓDIGO</button>
      <div id="codigo-generado-cliente" style="display:none;margin-top:1rem">
        <div style="background:var(--surface2);border:1px solid var(--success);border-radius:10px;padding:1rem;text-align:center;margin-bottom:.75rem">
          <div style="font-size:.72rem;color:var(--text2);margin-bottom:.4rem">CÓDIGO DE CLIENTE</div>
          <div id="codigo-valor-cliente" style="font-family:var(--font-head);font-size:2.2rem;font-weight:700;color:var(--success);letter-spacing:6px"></div>
          <div style="font-size:.7rem;color:var(--text2);margin-top:.3rem">Un solo uso</div>
        </div>
        <div id="link-cliente" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.6rem;font-size:.72rem;color:var(--text2);word-break:break-all;margin-bottom:.5rem"></div>
        <div style="display:flex;gap:.4rem">
          <button onclick="copiarInvitacion('cliente')" style="flex:1;background:var(--success);color:#000;border:none;border-radius:8px;padding:.6rem;font-family:var(--font-head);font-size:.85rem;font-weight:700;cursor:pointer">📋 COPIAR</button>
          <button onclick="compartirWhatsApp('cliente')" style="flex:1;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:8px;padding:.6rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer">💬 WHATSAPP</button>
        </div>
      </div>
    </div>

    <button class="btn-secondary" onclick="closeModal()">CERRAR</button>`);
}

function switchInviteTab(tipo, btn) {
  document.querySelectorAll('#modal-overlay .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('invite-empleado').style.display = tipo==='empleado' ? 'block' : 'none';
  document.getElementById('invite-cliente').style.display = tipo==='cliente' ? 'block' : 'none';
}

async function generarCodigoConSafeCall(tipo) {
  await safeCall(async () => {
    await generarCodigo(tipo);
  }, null, 'No se pudo generar el código');
}

async function generarCodigo(tipo) {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  // Tarea #17: si el modal de invitación trae un empleado preseleccionado,
  // lo asociamos al código para auto-vincular el perfil al aplicarlo.
  const empSel = document.getElementById('f-invite-empleado-id');
  const empleadoId = (tipo === 'empleado' && empSel && empSel.value) ? empSel.value : null;

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let intento = 0; intento < 3; intento++) {
    const arr = new Uint32Array(8);
    crypto.getRandomValues(arr);
    const codigo = Array.from(arr, v => chars[v % chars.length]).join('');
    const payload = { codigo, taller_id: tid(), usado: false, tipo };
    if (empleadoId) payload.empleado_id = empleadoId;
    let { error } = await sb.from('codigos_empleado').insert(payload);
    // Si falla porque la columna empleado_id todavía no existe en BD,
    // reintentamos sin ese campo (degradación elegante).
    if (error && empleadoId && /empleado_id/i.test(error.message || '')) {
      const r = await sb.from('codigos_empleado').insert({ codigo, taller_id: tid(), usado: false, tipo });
      error = r.error;
      if (!error) toast('Código creado, pero no quedó preasociado al empleado (BD sin actualizar)', 'warning');
    }
    if (!error) {
      const base = window.location.href.split('?')[0].split('#')[0];
      const link = `${base}?taller=${tid()}&codigo=${codigo}`;
      document.getElementById(`codigo-generado-${tipo}`).style.display = 'block';
      document.getElementById(`codigo-valor-${tipo}`).textContent = codigo;
      document.getElementById(`link-${tipo}`).textContent = link;
      return;
    }
    if (error.code === '23505' || error.message?.includes('duplicate')) continue;
    toast('Error al generar código','error');
    return;
  }
  toast('Error: no se pudo generar código único','error');
}

function copiarInvitacion(tipo) {
  const codigo = document.getElementById(`codigo-valor-${tipo}`).textContent;
  const link = document.getElementById(`link-${tipo}`).textContent;
  const tipoLabel = tipo === 'empleado' ? 'empleado' : 'cliente';
  const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';
  const texto = `Hola! Te invito a registrarte como ${tipoLabel} en *${tallerNombre}* en TallerPro.\n\n👉 Abrí este link:\n${link}\n\n🔑 Tu código: *${codigo}*\n\nEl código es de un solo uso.`;
  navigator.clipboard.writeText(texto).then(() => toast('¡Invitación copiada! Pegala en WhatsApp', 'success'));
}

function compartirWhatsApp(tipo) {
  const codigo = document.getElementById(`codigo-valor-${tipo}`).textContent;
  const link = document.getElementById(`link-${tipo}`).textContent;
  const tipoLabel = tipo === 'empleado' ? 'empleado' : 'cliente';
  const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';
  const texto = `Hola! Te invito a registrarte como ${tipoLabel} en *${tallerNombre}* en TallerPro.\n\n👉 Abrí este link:\n${link}\n\n🔑 Tu código: *${codigo}*\n\nEl código es de un solo uso.`;
  window.open('https://wa.me/?text=' + encodeURIComponent(texto));
}
