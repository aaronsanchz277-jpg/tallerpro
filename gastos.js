
// ─── MIS TRABAJOS (Empleado) ────────────────────────────────────────────────
async function misTrabajos({ filtro='en_progreso' }={}) {
  if (currentPerfil?.rol !== 'empleado') { dashboard(); return; }
  
  // Obtener IDs de reparaciones asignadas a este mecánico
  const { data: misAsignaciones } = await sb.from('reparacion_mecanicos').select('reparacion_id').eq('mecanico_id', currentUser.id);
  const misRepIds = (misAsignaciones||[]).map(a => a.reparacion_id);
  
  let data = [];
  if (misRepIds.length > 0) {
    let q = sb.from('reparaciones').select('*, vehiculos(patente,marca), clientes(nombre)')
      .in('id', misRepIds).order('created_at', {ascending:false});
    if (filtro !== 'todos') q = q.eq('estado', filtro);
    const res = await q;
    data = res.data || [];
  }

  const hoy = fechaHoy();
  const misRepsHoy = (data||[]).filter(r => r.fecha === hoy);
  const total = (data||[]).length;

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text);margin-bottom:.25rem">Mis Trabajos</div>
      <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">${total} reparaciones · ${misRepsHoy.length} hoy</div>

      <div class="tabs">
        <button class="tab ${filtro==='en_progreso'?'active':''}" onclick="misTrabajos({filtro:'en_progreso'})">En Progreso</button>
        <button class="tab ${filtro==='pendiente'?'active':''}" onclick="misTrabajos({filtro:'pendiente'})">Pendientes</button>
        <button class="tab ${filtro==='finalizado'?'active':''}" onclick="misTrabajos({filtro:'finalizado'})">Finalizados</button>
        <button class="tab ${filtro==='todos'?'active':''}" onclick="misTrabajos({filtro:'todos'})">Todos</button>
      </div>

      ${(data||[]).length === 0 ? `<div class="empty"><p>No hay reparaciones ${filtro !== 'todos' ? 'con estado "' + filtro + '"' : ''}</p></div>` :
        (data||[]).map(r => `
        <div class="card" onclick="detalleReparacion('${r.id}')">
          <div class="card-header">
            <div class="card-avatar">🔧</div>
            <div class="card-info">
              <div class="card-name">${h(r.descripcion)}</div>
              <div class="card-sub">${r.vehiculos ? h(r.vehiculos.patente)+' · '+h(r.vehiculos.marca) : t('sinVehiculo')} · ${r.clientes ? h(r.clientes.nombre) : ''}</div>
              <div class="card-sub">${formatFecha(r.fecha)} ${r.costo ? '· ₲'+gs(r.costo) : ''}</div>
            </div>
            <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
          </div>
        </div>`).join('')}
    </div>`;
}

