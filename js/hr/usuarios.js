// ─── USUARIOS (ADMIN) ─────────────────────────────────────────────────────────
async function usuarios() {
  const [{ data: perfiles }, { data: codigos }] = await Promise.all([
    sb.from('perfiles').select('*').eq('taller_id', tid()).order('nombre'),
    sb.from('codigos_empleado').select('*').eq('taller_id', tid()).eq('usado', false).order('created_at', {ascending:false})
  ]);

  const admins    = (perfiles||[]).filter(u => u.rol === 'admin');
  const empleados = (perfiles||[]).filter(u => u.rol === 'empleado');
  const clientes  = (perfiles||[]).filter(u => u.rol === 'cliente');

  const renderCard = (u) => `
    <div class="card">
      <div class="card-header">
        <div class="card-avatar">${u.nombre?u.nombre.charAt(0).toUpperCase():'?'}</div>
        <div class="card-info">
          <div class="card-name">${h(u.nombre||'Sin nombre')}${u.id===currentUser.id?' (Vos)':''}</div>
        </div>
        <div style="display:flex;gap:.4rem;align-items:center">
          ${u.id!==currentUser.id?`<button onclick="cambiarRol('${u.id}','${u.rol}')" style="font-size:.7rem;background:none;border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:3px 8px;cursor:pointer">Rol</button>`:''}
          ${u.rol==='cliente'?`<button onclick="modalVincularVehiculo('${u.id}','${hjs(u.nombre)}')" style="font-size:.7rem;background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.3);color:var(--accent);border-radius:6px;padding:3px 8px;cursor:pointer">🚗 Autos</button>`:''}
          ${(u.rol==='empleado'||u.rol==='admin')?`<button onclick="modalVincularEmpleado('${u.id}','${hjs(u.nombre)}')" style="font-size:.7rem;background:rgba(255,204,0,.1);border:1px solid rgba(255,204,0,.3);color:var(--warning);border-radius:6px;padding:3px 8px;cursor:pointer">👤 Vincular</button>`:''}
        </div>
      </div>
    </div>`;

  const renderSeccion = (titulo, color, lista) => lista.length === 0 ? '' : `
    <div style="font-size:.72rem;color:${color};font-family:var(--font-head);letter-spacing:1px;margin:.75rem 0 .4rem">${titulo} (${lista.length})</div>
    ${lista.map(renderCard).join('')}`;

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('usTitulo')}</div>
      <button class="btn-add" onclick="modalInvitarUsuario()">${t('usInvitar')}</button>
    </div>

    ${(codigos||[]).length > 0 ? `
    <div style="background:rgba(255,204,0,.05);border:1px solid rgba(255,204,0,.2);border-radius:10px;padding:.75rem;margin-bottom:1rem">
      <div style="font-size:.72rem;color:var(--warning);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.5rem">${t('usCodigosPend')}</div>
      ${(codigos||[]).map(c => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
          <div>
            <span style="font-family:var(--font-head);font-size:1.1rem;color:${c.tipo==='empleado'?'var(--accent2)':'var(--success)'};letter-spacing:3px">${h(c.codigo)}</span>
            <span style="font-size:.65rem;margin-left:.5rem;padding:2px 6px;border-radius:10px;background:${c.tipo==='empleado'?'rgba(255,107,53,.15)':'rgba(0,255,136,.15)'};color:${c.tipo==='empleado'?'var(--accent2)':'var(--success)'}">${c.tipo==='empleado'?'EMPLEADO':'CLIENTE'}</span>
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
  await sb.from('codigos_empleado').delete().eq('id', id);
  toast('Código cancelado');
  usuarios();
}

async function cambiarRol(userId, rolActual) {
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
  const empleadoId = document.getElementById('f-vincular-empleado').value || null;
  const { error } = await sb.from('perfiles').update({ empleado_id: empleadoId }).eq('id', perfilId);
  if (error) { toast('Error: '+error.message,'error'); return; }
  toast('Vinculación actualizada','success');
  closeModal();
  usuarios();
}

function modalInvitarUsuario() {
  const base = window.location.origin + window.location.pathname;
  const link = `${base}?taller=${tid()}`;

  openModal(`
    <div class="modal-title">${t("modInvitarUsuario")}</div>
    <div class="tabs" style="margin-bottom:1rem">
      <button class="tab active" onclick="switchInviteTab('empleado',this)">Empleado</button>
      <button class="tab" onclick="switchInviteTab('cliente',this)">Cliente</button>
    </div>

    <div id="invite-empleado">
      <p style="color:var(--text2);font-size:.82rem;margin-bottom:1rem">
        Generá un código y enviáselo al empleado junto con el link de registro.
      </p>
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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let intento = 0; intento < 3; intento++) {
    const arr = new Uint32Array(8);
    crypto.getRandomValues(arr);
    const codigo = Array.from(arr, v => chars[v % chars.length]).join('');
    const { error } = await sb.from('codigos_empleado').insert({ codigo, taller_id: tid(), usado: false, tipo });
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
