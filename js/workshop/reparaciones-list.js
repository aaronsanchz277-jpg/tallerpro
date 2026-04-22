// ─── LISTADO DE REPARACIONES ─────────────────────────────────────────────────
async function reparaciones({ filtro='todos', search='', offset=0, tipo='', mecanico='' }={}) {
  const cacheKey = `reparaciones_${filtro}_${search}_${offset}_${tipo}_${mecanico}`;
  const { data, count } = await cachedQuery(cacheKey, async () => {
    let q = sb.from('reparaciones')
      .select('*, vehiculos(patente,marca), clientes(nombre)', {count:'exact'})
      .eq('taller_id', tid())
      .order('created_at', {ascending: false});

    // 🔍 Filtro por mecánico (nuevo)
    if (mecanico) {
      const { data: asignaciones } = await sb.from('reparacion_mecanicos')
        .select('reparacion_id')
        .or(`mecanico_id.eq.${mecanico},empleado_id.eq.${mecanico}`);
      const repIds = (asignaciones || []).map(a => a.reparacion_id);
      if (repIds.length) {
        q = q.in('id', repIds);
      } else {
        // Si no hay asignaciones, forzamos un resultado vacío
        q = q.in('id', ['00000000-0000-0000-0000-000000000000']);
      }
    }

    if (filtro === 'hoy') q = q.eq('fecha', new Date().toISOString().split('T')[0]);
    else if (filtro === 'semana') q = q.gte('fecha', inicioSemana());
    else if (filtro === 'mes') q = q.gte('fecha', primerDiaMes());
    else if (filtro !== 'todos') q = q.eq('estado', filtro);
    if (tipo) q = q.eq('tipo_trabajo', tipo);
    if (search) q = q.ilike('descripcion', `%${search}%`);
    return q.range(offset, offset + PAGE_SIZE - 1);
  });

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">Trabajos ${count ? `<span style="font-size:.75rem;color:var(--text2)">(${count})</span>` : ''}</div>
      ${['admin','empleado'].includes(currentPerfil?.rol) ? `<button class="btn-add" onclick="modalNuevaReparacion()">+ Nuevo</button>` : ''}
    </div>
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="Buscar trabajo..." value="${h(search)}" oninput="debounce('rep',()=>reparaciones({filtro:'${filtro}',search:this.value,tipo:'${tipo}',mecanico:'${mecanico}'}))" class="form-input" style="padding-left:2.5rem">
    </div>
    <div class="tabs">
      <button class="tab ${filtro==='todos'?'active':''}" onclick="reparaciones({filtro:'todos',tipo:'${tipo}',mecanico:'${mecanico}'})">Todos</button>
      <button class="tab ${filtro==='pendiente'?'active':''}" onclick="reparaciones({filtro:'pendiente',tipo:'${tipo}',mecanico:'${mecanico}'})">Pendiente</button>
      <button class="tab ${filtro==='en_progreso'?'active':''}" onclick="reparaciones({filtro:'en_progreso',tipo:'${tipo}',mecanico:'${mecanico}'})">En progreso</button>
      <button class="tab ${filtro==='esperando_repuestos'?'active':''}" onclick="reparaciones({filtro:'esperando_repuestos',tipo:'${tipo}',mecanico:'${mecanico}'})">Esp. repuestos</button>
      <button class="tab ${filtro==='finalizado'?'active':''}" onclick="reparaciones({filtro:'finalizado',tipo:'${tipo}',mecanico:'${mecanico}'})">Finalizado</button>
    </div>
    ${tipo ? `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.5rem">
      <span style="font-size:.78rem;color:var(--text2)">Filtro: ${TIPO_ICONS[tipo]||'📋'} ${h(tipo)}</span>
      <button onclick="reparaciones({filtro:'${filtro}',mecanico:'${mecanico}'})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.8rem">✕</button>
    </div>` : `<div style="display:flex;gap:.3rem;margin-bottom:.5rem;overflow-x:auto;padding-bottom:.3rem">
      ${TIPOS_TRABAJO.map(t => `<button onclick="reparaciones({filtro:'${filtro}',tipo:'${t}',mecanico:'${mecanico}'})" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.25rem .5rem;font-size:.65rem;cursor:pointer;white-space:nowrap;color:var(--text2)">${TIPO_ICONS[t]||'📋'} ${t}</button>`).join('')}
    </div>`}
    ${(data||[]).length===0 ? `<div class="empty"><p>No hay trabajos</p></div>` :
      (data||[]).map(r => `
      <div class="card" onclick="detalleReparacion('${r.id}')">
        <div class="card-header">
          <div class="card-avatar">${TIPO_ICONS[r.tipo_trabajo]||'🔧'}</div>
          <div class="card-info">
            <div class="card-name">${h(r.descripcion)}</div>
            <div class="card-sub">${r.tipo_trabajo?h(r.tipo_trabajo)+' · ':''}${r.vehiculos?h(r.vehiculos.marca)+' '+h(r.vehiculos.patente):''} ${r.clientes?' · '+h(r.clientes.nombre):''}</div>
            <div class="card-sub">₲${gs(r.costo)} · ${formatFecha(r.fecha)}</div>
          </div>
          <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
        </div>
      </div>`).join('')}
    ${renderPagination(count||0, offset, `()=>reparaciones({offset:offset,filtro:'${filtro}',search:'${search}',tipo:'${tipo}',mecanico:'${mecanico}'})`)}`;
}

function _navRep(o) { reparaciones({offset:o}); }
