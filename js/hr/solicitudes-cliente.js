// ─── BANDEJA "SOLICITUDES DE CLIENTE" (admin) ──────────────────────────────
// Muestra al admin dos cosas:
//   1) Cuentas de cliente que se registraron por su cuenta y todavía no están
//      vinculadas a un cliente del taller (perfiles con rol=cliente,
//      taller_id = mi taller, cliente_id = null).
//   2) Turnos pedidos por clientes que están en estado "pendiente".
// Acciones: vincular cuenta a un cliente existente (o crear cliente nuevo
// con los datos de su perfil), confirmar / cancelar turno.

async function solicitudesCliente() {
  if (currentPerfil?.rol !== 'admin') { navigate('dashboard'); return; }

  // Cuentas pendientes: perfiles cliente del taller sin cliente_id.
  const { data: pendientes } = await sb.from('perfiles')
    .select('id, nombre, taller_id, cliente_id, rol, created_at')
    .eq('taller_id', tid())
    .eq('rol', 'cliente')
    .is('cliente_id', null)
    .order('created_at', { ascending: false });

  // Turnos pendientes (citas en estado pendiente del taller).
  const { data: turnos } = await sb.from('citas')
    .select('id, descripcion, fecha, hora, estado, clientes(nombre,telefono), vehiculos(patente,marca)')
    .eq('taller_id', tid())
    .eq('estado', 'pendiente')
    .order('fecha', { ascending: true });

  const totalPend = (pendientes||[]).length + (turnos||[]).length;

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">📥 Solicitudes de cliente${totalPend>0?` <span style="font-size:.7rem;color:var(--warning)">(${totalPend})</span>`:''}</div>
    </div>

    <div style="font-family:var(--font-head);font-size:.72rem;color:var(--text2);letter-spacing:1px;margin-top:.5rem;margin-bottom:.5rem">
      👥 CUENTAS PENDIENTES DE VINCULAR
    </div>
    ${(pendientes||[]).length===0 ? `<div class="empty" style="padding:1rem"><p style="font-size:.85rem">No hay cuentas pendientes</p></div>` :
      (pendientes||[]).map(p => `
      <div class="card">
        <div class="card-header">
          <div class="card-avatar">👤</div>
          <div class="card-info">
            <div class="card-name">${h(p.nombre || 'Sin nombre')}</div>
            <div class="card-sub">Cuenta creada ${formatFecha(p.created_at?.split('T')[0])}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-top:.6rem">
          <button onclick="modalVincularPerfilCliente('${p.id}','${hjs(p.nombre||'')}')" style="background:rgba(0,229,255,.12);color:var(--accent);border:1px solid rgba(0,229,255,.3);border-radius:8px;padding:.5rem;font-size:.78rem;font-family:var(--font-head);cursor:pointer">🔗 Vincular</button>
          <button onclick="rechazarPerfilPendiente('${p.id}')" style="background:rgba(255,68,68,.08);color:var(--danger);border:1px solid rgba(255,68,68,.25);border-radius:8px;padding:.5rem;font-size:.78rem;font-family:var(--font-head);cursor:pointer">✕ Rechazar</button>
        </div>
      </div>`).join('')}

    <div style="background:rgba(0,229,255,.04);border:1px solid rgba(0,229,255,.15);border-radius:10px;padding:.75rem;margin-top:1rem">
      <div style="font-family:var(--font-head);font-size:.78rem;color:var(--accent);letter-spacing:.5px;margin-bottom:.4rem">
        📨 ¿Tu cliente creó cuenta sin código?
      </div>
      <div style="font-size:.78rem;color:var(--text2);margin-bottom:.6rem">
        Si un cliente se registró sin tu código de invitación, vinculalo manualmente con su email.
      </div>
      <button onclick="modalVincularPorEmail()" style="background:rgba(0,229,255,.15);color:var(--accent);border:1px solid rgba(0,229,255,.3);border-radius:8px;padding:.5rem .9rem;font-size:.8rem;font-family:var(--font-head);cursor:pointer">🔍 Buscar y vincular por email</button>
    </div>

    <div style="font-family:var(--font-head);font-size:.72rem;color:var(--text2);letter-spacing:1px;margin-top:1.25rem;margin-bottom:.5rem">
      📅 TURNOS PEDIDOS — PENDIENTES DE CONFIRMAR
    </div>
    ${(turnos||[]).length===0 ? `<div class="empty" style="padding:1rem"><p style="font-size:.85rem">No hay turnos pendientes</p></div>` :
      (turnos||[]).map(c => `
      <div class="card" onclick="detalleCita('${c.id}')" style="cursor:pointer">
        <div class="card-header">
          <div class="card-avatar">📅</div>
          <div class="card-info">
            <div class="card-name">${h(c.descripcion)}</div>
            <div class="card-sub">${formatFecha(c.fecha)} ${c.hora?'· '+c.hora.slice(0,5):''} ${c.clientes?'· '+h(c.clientes.nombre):''}</div>
            <div class="card-sub">${c.vehiculos?h(c.vehiculos.patente)+' · '+h(c.vehiculos.marca):''}</div>
          </div>
          <span class="card-badge badge-yellow">PENDIENTE</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-top:.6rem">
          <button onclick="event.stopPropagation();confirmarTurnoSolicitado('${c.id}')" style="background:rgba(0,255,136,.15);color:var(--success);border:1px solid rgba(0,255,136,.3);border-radius:8px;padding:.5rem;font-size:.78rem;font-family:var(--font-head);cursor:pointer">✓ Confirmar</button>
          <button onclick="event.stopPropagation();rechazarTurnoSolicitado('${c.id}')" style="background:rgba(255,68,68,.08);color:var(--danger);border:1px solid rgba(255,68,68,.25);border-radius:8px;padding:.5rem;font-size:.78rem;font-family:var(--font-head);cursor:pointer">✕ Rechazar</button>
        </div>
      </div>`).join('')}
  `;
}

// Abre un modal para asociar el perfil pendiente con un cliente del taller
// (o crear uno nuevo con el nombre del perfil).
async function modalVincularPerfilCliente(perfilId, nombre) {
  const { data: clientes } = await sb.from('clientes')
    .select('id, nombre, telefono, ruc')
    .eq('taller_id', tid())
    .order('nombre');

  const opciones = (clientes||[]).map(c =>
    `<option value="${c.id}">${h(c.nombre)}${c.telefono?' · '+h(c.telefono):''}${c.ruc?' · '+h(c.ruc):''}</option>`
  ).join('');

  openModal(`
    <div class="modal-title">🔗 Vincular cuenta de cliente</div>
    <div style="font-size:.85rem;color:var(--text2);margin-bottom:.75rem">
      <b style="color:var(--text)">${h(nombre||'Cuenta sin nombre')}</b> creó una cuenta y está esperando que la vincules con un cliente del taller.
    </div>

    <div class="form-group">
      <label class="form-label">Vincular a un cliente existente</label>
      <select class="form-input" id="vinc-cliente-id">
        <option value="">— Elegí un cliente —</option>
        ${opciones}
      </select>
    </div>

    <div style="text-align:center;margin:.75rem 0;font-size:.8rem;color:var(--text2)">— o —</div>

    <div class="form-group">
      <label class="form-label">Crear cliente nuevo con este nombre</label>
      <button class="btn-secondary" style="margin:.4rem 0 0;width:100%" onclick="vincularPerfilCrearCliente('${perfilId}','${hjs(nombre||'')}')">+ Crear cliente nuevo "${h(nombre||'Sin nombre')}"</button>
    </div>

    <button class="btn-primary" onclick="vincularPerfilExistente('${perfilId}')">VINCULAR</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
  `);
}

async function vincularPerfilExistente(perfilId) {
  const clienteId = document.getElementById('vinc-cliente-id').value;
  if (!clienteId) { toast('Elegí un cliente o creá uno nuevo', 'error'); return; }
  await safeCall(async () => {
    const { error } = await sb.from('perfiles').update({ cliente_id: clienteId }).eq('id', perfilId);
    if (error) { toast('Error: '+error.message, 'error'); return; }
    toast('Cuenta vinculada', 'success');
    closeModal();
    solicitudesCliente();
  }, null, 'No se pudo vincular la cuenta');
}

async function vincularPerfilCrearCliente(perfilId, nombre) {
  if (!nombre) { toast('La cuenta no tiene nombre. Vinculá a un cliente existente.', 'error'); return; }
  await safeCall(async () => {
    const { data: nuevo, error: insErr } = await sb.from('clientes')
      .insert({ nombre, taller_id: tid() })
      .select('id').single();
    if (insErr) { toast('Error: '+insErr.message, 'error'); return; }
    const { error: updErr } = await sb.from('perfiles').update({ cliente_id: nuevo.id }).eq('id', perfilId);
    if (updErr) { toast('Error: '+updErr.message, 'error'); return; }
    toast('Cliente creado y cuenta vinculada', 'success');
    closeModal();
    solicitudesCliente();
  }, null, 'No se pudo crear el cliente');
}

async function rechazarPerfilPendiente(perfilId) {
  confirmar('¿Rechazar esta solicitud? El usuario seguirá teniendo cuenta pero sin acceso a tu taller.', async () => {
    await safeCall(async () => {
      // Desvincular del taller (no borramos al usuario, solo sacamos el taller_id).
      const { error } = await sb.from('perfiles').update({ taller_id: null }).eq('id', perfilId);
      if (error) { toast('Error: '+error.message, 'error'); return; }
      toast('Solicitud rechazada', 'success');
      solicitudesCliente();
    }, null, 'No se pudo rechazar la solicitud');
  });
}

async function confirmarTurnoSolicitado(citaId) {
  await safeCall(async () => {
    await offlineUpdate('citas', { estado: 'confirmada' }, 'id', citaId);
    clearCache('citas');
    toast('Turno confirmado', 'success');
    solicitudesCliente();
  }, null, 'No se pudo confirmar el turno');
}

async function rechazarTurnoSolicitado(citaId) {
  confirmar('¿Rechazar este turno?', async () => {
    await safeCall(async () => {
      await offlineUpdate('citas', { estado: 'cancelada' }, 'id', citaId);
      clearCache('citas');
      toast('Turno rechazado', 'success');
      solicitudesCliente();
    }, null, 'No se pudo rechazar el turno');
  });
}

// ─── VINCULAR CUENTA SIN CÓDIGO POR EMAIL ────────────────────────────────────
// El cliente pudo registrarse sin ingresar código (taller_id queda NULL).
// Ese perfil no aparece en la bandeja porque las RLS no permiten verlo.
// Esta acción usa la RPC SECURITY DEFINER `admin_vincular_cuenta_huerfana`
// que busca por email exacto y vincula al taller del admin.
async function modalVincularPorEmail() {
  const { data: clientes } = await sb.from('clientes')
    .select('id, nombre, telefono, ruc')
    .eq('taller_id', tid())
    .order('nombre');

  const opciones = (clientes||[]).map(c =>
    `<option value="${c.id}">${h(c.nombre)}${c.telefono?' · '+h(c.telefono):''}</option>`
  ).join('');

  openModal(`
    <div class="modal-title">📨 Vincular cuenta por email</div>
    <div style="font-size:.82rem;color:var(--text2);margin-bottom:.75rem">
      Pedíle a tu cliente el email con el que creó su cuenta en TallerPro y pegalo abajo. Lo vinculamos al taller en el momento.
    </div>

    <div class="form-group">
      <label class="form-label">Email del cliente *</label>
      <input class="form-input" id="vinc-email" type="email" placeholder="cliente@email.com" autocomplete="off">
    </div>

    <div class="form-group">
      <label class="form-label">Vincular a un cliente del CRM (opcional)</label>
      <select class="form-input" id="vinc-cliente-existente">
        <option value="">— Vincular después —</option>
        ${opciones}
      </select>
    </div>

    <button class="btn-primary" onclick="vincularPorEmailEjecutar()">VINCULAR</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
  `);
}

async function vincularPorEmailEjecutar() {
  const email = document.getElementById('vinc-email').value.trim();
  const clienteId = document.getElementById('vinc-cliente-existente').value || null;
  if (!email) { toast('Ingresá el email del cliente', 'error'); return; }

  await safeCall(async () => {
    const { data, error } = await sb.rpc('admin_vincular_cuenta_huerfana', {
      p_email: email,
      p_cliente_id: clienteId
    });
    if (error) { toast('Error: '+error.message, 'error'); return; }
    if (!data?.ok) { toast(data?.error || 'No se pudo vincular', 'error'); return; }
    toast(data.created ? 'Cuenta creada y vinculada' : 'Cuenta vinculada al taller', 'success');
    closeModal();
    solicitudesCliente();
  }, null, 'No se pudo vincular la cuenta');
}
