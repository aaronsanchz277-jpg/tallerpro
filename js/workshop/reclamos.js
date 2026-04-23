// ─── RECLAMOS DE GARANTÍA ──────────────────────────────────────────────────
async function reclamos() {
  const { data } = await sb.from('reclamos_garantia')
    .select('*, reparaciones:reparacion_original_id(descripcion, vehiculos(patente), clientes(nombre))')
    .eq('taller_id', tid())
    .order('created_at', { ascending: false });

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">🛡️ Reclamos de Garantía</div>
    </div>
    ${(data||[]).length === 0 ? '<div class="empty"><p>No hay reclamos registrados</p></div>' :
      (data||[]).map(r => `
      <div class="card" onclick="detalleReclamo('${r.id}')">
        <div class="card-header">
          <div class="card-avatar">🛡️</div>
          <div class="card-info">
            <div class="card-name">${h(r.descripcion)}</div>
            <div class="card-sub">${r.reparaciones ? h(r.reparaciones.descripcion) + ' · ' + (r.reparaciones.vehiculos?.patente || '') : ''}</div>
            <div class="card-sub">${formatFecha(r.created_at?.split('T')[0])}</div>
          </div>
          <span class="card-badge ${r.estado === 'pendiente' ? 'badge-yellow' : r.estado === 'reparado_garantia' ? 'badge-green' : 'badge-blue'}">${r.estado.toUpperCase()}</span>
        </div>
      </div>`).join('')}
  `;
}

async function detalleReclamo(id) {
  const { data: rec } = await sb.from('reclamos_garantia')
    .select('*, reparaciones:reparacion_original_id(descripcion, vehiculos(patente, marca), clientes(nombre))')
    .eq('id', id).single();
  if (!rec) return;
  
  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="reclamos()">← Volver</button>
      <div class="detail-avatar">🛡️</div>
      <div><div class="detail-name">Reclamo de garantía</div><div class="detail-sub">${formatFecha(rec.created_at?.split('T')[0])}</div></div>
    </div>
    <div class="info-grid">
      <div class="info-item"><div class="label">Trabajo original</div><div class="value">${h(rec.reparaciones?.descripcion || '')}</div></div>
      <div class="info-item"><div class="label">Vehículo</div><div class="value">${rec.reparaciones?.vehiculos?.patente || ''} ${rec.reparaciones?.vehiculos?.marca || ''}</div></div>
      <div class="info-item"><div class="label">Cliente</div><div class="value">${h(rec.reparaciones?.clientes?.nombre || '')}</div></div>
      <div class="info-item"><div class="label">Estado</div><div class="value">${rec.estado}</div></div>
    </div>
    <div class="sub-section"><div class="sub-section-title">Descripción del reclamo</div><p>${h(rec.descripcion)}</p></div>
    ${rec.reparacion_garantia_id ? `<button class="btn-primary" onclick="detalleReparacion('${rec.reparacion_garantia_id}')">Ver reparación de garantía</button>` : ''}
  `;
}

// Función para crear un reclamo desde una reparación (se expone globalmente)
async function crearReclamoGarantia(repId) {
  const { data: rep } = await sb.from('reparaciones').select('descripcion').eq('id', repId).single();
  const descripcion = prompt('Describí el problema de garantía:', rep ? 'Reclamo por: ' + rep.descripcion : '');
  if (!descripcion) return;
  
  const { error } = await sb.from('reclamos_garantia').insert({
    reparacion_original_id: repId,
    taller_id: tid(),
    descripcion,
    estado: 'pendiente'
  });
  if (error) { toast('Error al crear reclamo', 'error'); return; }
  toast('Reclamo de garantía registrado', 'success');
}
window.crearReclamoGarantia = crearReclamoGarantia;
