// ─── SOLICITUDES DE REPARACIÓN ──────────────────────────────────────────────
// Vista cliente: misSolicitudes()
// Vista taller: solicitudesTaller()

// Cliente: listar y crear solicitudes
async function misSolicitudes() {
  if (currentPerfil?.rol !== 'cliente') { dashboard(); return; }
  const { data: solicitudes } = await sb.from('solicitudes_reparacion')
    .select('*, vehiculos(patente,marca)')
    .eq('cliente_id', currentPerfil.cliente_id || '')
    .order('created_at', { ascending: false });

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">📝 Mis Solicitudes de Reparación</div>
      <button class="btn-add" onclick="modalNuevaSolicitud()">+ Nueva solicitud</button>
    </div>
    ${(solicitudes||[]).length === 0 ? '<div class="empty"><p>No tenés solicitudes activas</p></div>' :
      (solicitudes||[]).map(s => `
      <div class="card">
        <div class="card-header">
          <div class="card-avatar">📋</div>
          <div class="card-info">
            <div class="card-name">${h(s.descripcion)}</div>
            <div class="card-sub">${s.vehiculos ? h(s.vehiculos.marca) + ' ' + h(s.vehiculos.patente) : 'Sin vehículo'}</div>
            <div class="card-sub">${formatFecha(s.created_at?.split('T')[0])} · ${estadoSolicitudLabel(s.estado)}</div>
          </div>
          <span class="card-badge ${s.estado === 'pendiente' ? 'badge-yellow' : s.estado === 'aceptada' ? 'badge-green' : 'badge-red'}">${s.estado.toUpperCase()}</span>
        </div>
      </div>`).join('')}
  `;
}
function estadoSolicitudLabel(e) { return { pendiente: 'Pendiente', aceptada: 'Aceptada', rechazada: 'Rechazada' }[e] || e; }

async function modalNuevaSolicitud() {
  const vehiculos = await getVehiculos();
  const misVehs = (vehiculos||[]).filter(v => v.cliente_id === currentPerfil.cliente_id);
  openModal(`
    <div class="modal-title">Nueva Solicitud de Reparación</div>
    <div class="form-group"><label class="form-label">Vehículo</label>
      <select class="form-input" id="sol-vehiculo">
        <option value="">Sin vehículo</option>
        ${misVehs.map(v => `<option value="${v.id}">${h(v.patente)} ${h(v.marca)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Descripción del problema *</label>
      <textarea class="form-input" id="sol-desc" rows="3" placeholder="Contanos qué necesita tu vehículo..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Fotos (opcional)</label>
      <input type="file" id="sol-fotos" accept="image/*" multiple style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.5rem;color:var(--text);font-size:.85rem">
    </div>
    <button class="btn-primary" onclick="guardarSolicitud()">Enviar solicitud</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function guardarSolicitud() {
  const desc = document.getElementById('sol-desc').value.trim();
  if (!desc) { toast('La descripción es obligatoria', 'error'); return; }
  const vehiculoId = document.getElementById('sol-vehiculo').value || null;
  const fotosInput = document.getElementById('sol-fotos');
  const fotosUrls = [];
  if (fotosInput.files.length > 0) {
    for (const file of fotosInput.files) {
      const path = `solicitudes/${currentPerfil.cliente_id}/${Date.now()}.jpg`;
      const { error: uploadError } = await sb.storage.from('fotos').upload(path, file);
      if (!uploadError) {
        const { data } = sb.storage.from('fotos').getPublicUrl(path);
        fotosUrls.push(data.publicUrl);
      }
    }
  }
  const { error } = await sb.from('solicitudes_reparacion').insert({
    taller_id: tid(),
    cliente_id: currentPerfil.cliente_id,
    vehiculo_id: vehiculoId,
    descripcion: desc,
    fotos: fotosUrls
  });
  if (error) { toast('Error al enviar', 'error'); return; }
  toast('Solicitud enviada correctamente', 'success');
  closeModal();
  misSolicitudes();
}

// Taller: ver solicitudes y convertirlas en reparación
async function solicitudesTaller() {
  const { data } = await sb.from('solicitudes_reparacion')
    .select('*, clientes(nombre,telefono), vehiculos(patente,marca)')
    .eq('taller_id', tid())
    .order('created_at', { ascending: false });

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">📨 Solicitudes de clientes</div>
    </div>
    ${(data||[]).length === 0 ? '<div class="empty"><p>No hay solicitudes pendientes</p></div>' :
      (data||[]).map(s => `
      <div class="card">
        <div class="card-header">
          <div class="card-avatar">📋</div>
          <div class="card-info">
            <div class="card-name">${h(s.descripcion)}</div>
            <div class="card-sub">${s.clientes ? h(s.clientes.nombre) : ''} · ${s.vehiculos ? h(s.vehiculos.marca)+' '+h(s.vehiculos.patente) : ''}</div>
            <div class="card-sub">${formatFecha(s.created_at?.split('T')[0])}</div>
          </div>
          <span class="card-badge badge-yellow">${s.estado.toUpperCase()}</span>
        </div>
        ${s.fotos && s.fotos.length ? `<div style="display:flex;gap:.3rem;margin-top:.5rem">${s.fotos.map(url => `<img src="${url}" style="width:40px;height:40px;object-fit:cover;border-radius:6px">`).join('')}</div>` : ''}
        ${s.estado === 'pendiente' ? `
          <button onclick="convertirSolicitud('${s.id}')" class="btn-primary" style="margin-top:.5rem">🔧 Convertir en reparación</button>
          <button onclick="rechazarSolicitud('${s.id}')" class="btn-secondary">✕ Rechazar</button>` : ''}
      </div>`).join('')}
  `;
}

async function convertirSolicitud(id) {
  const { data: sol } = await sb.from('solicitudes_reparacion')
    .select('*').eq('id', id).single();
  if (!sol) return;
  
  // Marcar como aceptada primero
  await sb.from('solicitudes_reparacion').update({ estado: 'aceptada' }).eq('id', id);
  
  // Abrir modal de nueva reparación precargado
  await modalNuevaReparacion();
  
  // Precargar campos después de que el modal se haya abierto
  setTimeout(async () => {
    const descInput = document.getElementById('f-desc');
    if (descInput) descInput.value = sol.descripcion;
    
    if (sol.cliente_id) {
      const selectCliente = document.getElementById('f-cliente');
      if (selectCliente) selectCliente.value = sol.cliente_id;
    }
    if (sol.vehiculo_id) {
      const selectVehiculo = document.getElementById('f-vehiculo');
      if (selectVehiculo) selectVehiculo.value = sol.vehiculo_id;
    }
  }, 300);
  
  toast('Solicitud convertida. Completá los datos de la reparación.', 'success');
}

async function rechazarSolicitud(id) {
  await sb.from('solicitudes_reparacion').update({ estado: 'rechazada' }).eq('id', id);
  toast('Solicitud rechazada', 'success');
  solicitudesTaller();
}
