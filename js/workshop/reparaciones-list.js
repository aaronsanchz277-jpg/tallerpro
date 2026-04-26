async function reparaciones({ filtro='todos', search='', offset=0, tipo='', mecanico='', viejos=false }={}) {

  // ── Filtro por mecánico (siempre fresco, nunca cacheado) ──────────────────
  let repIds = null; // null = sin filtro, [] = mecánico sin reparaciones
  if (mecanico) {
    const { data: asignaciones, error: errAsig } = await sb
      .from('reparacion_mecanicos')
      .select('reparacion_id')
      .or(`mecanico_id.eq.${mecanico},empleado_id.eq.${mecanico}`);

    if (errAsig) {
      console.error('Error al buscar asignaciones:', errAsig);
      toast('Error al filtrar reparaciones del mecánico', 'error');
      return;
    }
    repIds = (asignaciones || []).map(a => a.reparacion_id);
  }

  // ── Vista rápida "+7d esperando repuestos": fuerza estado y umbral ───────
  // Nos sirve para rescatar trabajos olvidados que llevan más de una semana
  // estancados sin que llegue el repuesto.
  const seteVistaViejos = viejos === true || viejos === 'true';
  if (seteVistaViejos) filtro = 'esperando_repuestos';

  // ── Cuando hay mecánico, NO usamos caché (resultado siempre directo) ──────
  let data, count;
  if (mecanico) {
    let q = sb.from('reparaciones')
      .select('*, vehiculos(patente,marca), clientes(nombre)', { count: 'exact' })
      .eq('taller_id', tid())
      .order('created_at', { ascending: false });

    if (repIds.length > 0) {
      q = q.in('id', repIds);
    } else {
      // Mecánico sin reparaciones asignadas → forzar vacío
      q = q.in('id', ['00000000-0000-0000-0000-000000000000']);
    }

    if (filtro === 'hoy') q = q.eq('fecha', new Date().toISOString().split('T')[0]);
    else if (filtro === 'semana') q = q.gte('fecha', inicioSemana());
    else if (filtro === 'mes') q = q.gte('fecha', primerDiaMes());
    else if (filtro !== 'todos') q = q.eq('estado', filtro);
    if (tipo) q = q.eq('tipo_trabajo', tipo);
    if (search) q = q.ilike('descripcion', `%${escapeLikePattern(search)}%`);
    if (seteVistaViejos) {
      const limite = new Date(Date.now() - 7*86400000).toISOString();
      q = q.lt('updated_at', limite);
    }

    q = q.range(offset, offset + PAGE_SIZE - 1);
    const res = await q;
    data = res.data;
    count = res.count;

  } else {
    // ── Sin mecánico: comportamiento normal con caché ─────────────────────
    const cacheKey = `reparaciones_${filtro}_${search}_${offset}_${tipo}_${seteVistaViejos?'v7':''}`;
    const res = await cachedQuery(cacheKey, () => {
      let q = sb.from('reparaciones')
        .select('*, vehiculos(patente,marca), clientes(nombre)', { count: 'exact' })
        .eq('taller_id', tid())
        .order('created_at', { ascending: false });

      if (filtro === 'hoy') q = q.eq('fecha', new Date().toISOString().split('T')[0]);
      else if (filtro === 'semana') q = q.gte('fecha', inicioSemana());
      else if (filtro === 'mes') q = q.gte('fecha', primerDiaMes());
      else if (filtro !== 'todos') q = q.eq('estado', filtro);
      if (tipo) q = q.eq('tipo_trabajo', tipo);
      if (search) q = q.ilike('descripcion', `%${escapeLikePattern(search)}%`);
      if (seteVistaViejos) {
        const limite = new Date(Date.now() - 7*86400000).toISOString();
        q = q.lt('updated_at', limite);
      }
      return q.range(offset, offset + PAGE_SIZE - 1);
    });
    data = res.data;
    count = res.count;
  }

  // ── Lista de empleados para el filtro (cacheada) ─────────────────────────
  let empleados = [];
  if (currentPerfil?.rol === 'admin' || currentPerfil?.rol === 'empleado') {
    try {
      const empRes = await cachedQuery('empleados_filtro_rep', () =>
        sb.from('empleados').select('id,nombre').eq('taller_id', tid()).order('nombre'));
      empleados = empRes.data || [];
    } catch (_) { empleados = []; }
  }
  const mecanicoSel = mecanico ? empleados.find(e => String(e.id) === String(mecanico)) : null;

  // ── Cabecera con botón volver si venimos de un mecánico ───────────────────
  const headerExtra = mecanico ? `
    <button class="btn-secondary" style="margin:0 0 .75rem" onclick="navigate('empleados')">
      ← Volver a Empleados
    </button>` : '';

  // ── Renderizado ───────────────────────────────────────────────────────────
  document.getElementById('main-content').innerHTML = `
    ${headerExtra}
    <div class="section-header">
      <div class="section-title">Trabajos ${count ? `<span style="font-size:.75rem;color:var(--text2)">(${count})</span>` : ''}</div>
      ${['admin','empleado'].includes(currentPerfil?.rol) ? `<button class="btn-add" onclick="modalNuevaReparacion()">+ Nuevo</button>` : ''}
    </div>
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="Buscar trabajo..." value="${h(search)}" oninput="debounce('rep',()=>reparaciones({filtro:'${hjs(filtro)}',search:this.value,tipo:'${hjs(tipo)}',mecanico:'${hjs(mecanico)}',viejos:${seteVistaViejos}}))" class="form-input" style="padding-left:2.5rem">
    </div>
    ${empleados.length > 0 ? `
    <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.5rem">
      <span style="font-size:.7rem;color:var(--text2);font-family:var(--font-head);letter-spacing:1px">MECÁNICO</span>
      <select class="form-input" style="padding:.4rem .5rem;font-size:.78rem;flex:1" onchange="reparaciones({filtro:'${hjs(filtro)}',search:'${hjs(search)}',tipo:'${hjs(tipo)}',mecanico:this.value,viejos:${seteVistaViejos}})">
        <option value="">Todos</option>
        ${empleados.map(e => `<option value="${h(e.id)}" ${String(e.id)===String(mecanico)?'selected':''}>${h(e.nombre)}</option>`).join('')}
      </select>
      ${mecanicoSel ? `<button onclick="reparaciones({filtro:'${hjs(filtro)}',search:'${hjs(search)}',tipo:'${hjs(tipo)}',viejos:${seteVistaViejos}})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.85rem" title="Limpiar mecánico">✕</button>` : ''}
    </div>` : ''}
    <div class="tabs">
      <button class="tab ${filtro==='todos' && !seteVistaViejos?'active':''}" onclick="reparaciones({filtro:'todos',tipo:'${hjs(tipo)}',mecanico:'${hjs(mecanico)}'})">Todos</button>
      <button class="tab ${filtro==='pendiente'?'active':''}" onclick="reparaciones({filtro:'pendiente',tipo:'${hjs(tipo)}',mecanico:'${hjs(mecanico)}'})">Pendiente</button>
      <button class="tab ${filtro==='en_progreso'?'active':''}" onclick="reparaciones({filtro:'en_progreso',tipo:'${hjs(tipo)}',mecanico:'${hjs(mecanico)}'})">En progreso</button>
      <button class="tab ${filtro==='esperando_repuestos' && !seteVistaViejos?'active':''}" onclick="reparaciones({filtro:'esperando_repuestos',tipo:'${hjs(tipo)}',mecanico:'${hjs(mecanico)}'})">Esp. repuestos</button>
      <button class="tab ${seteVistaViejos?'active':''}" onclick="reparaciones({tipo:'${hjs(tipo)}',mecanico:'${hjs(mecanico)}',viejos:true})" title="Esperando repuestos hace más de 7 días">⏱ +7d</button>
      <button class="tab ${filtro==='finalizado'?'active':''}" onclick="reparaciones({filtro:'finalizado',tipo:'${hjs(tipo)}',mecanico:'${hjs(mecanico)}'})">Finalizado</button>
    </div>
    ${tipo ? `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.5rem">
      <span style="font-size:.78rem;color:var(--text2)">Filtro: ${TIPO_ICONS[tipo]||'📋'} ${h(tipo)}</span>
      <button onclick="reparaciones({filtro:'${hjs(filtro)}',mecanico:'${hjs(mecanico)}'})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.8rem">✕</button>
    </div>` : `<div style="display:flex;gap:.3rem;margin-bottom:.5rem;overflow-x:auto;padding-bottom:.3rem">
      ${TIPOS_TRABAJO.map(tp => `<button onclick="reparaciones({filtro:'${hjs(filtro)}',tipo:'${tp}',mecanico:'${hjs(mecanico)}'})" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.25rem .5rem;font-size:.65rem;cursor:pointer;white-space:nowrap;color:var(--text2)">${TIPO_ICONS[tp]||'📋'} ${tp}</button>`).join('')}
    </div>`}
    ${(data||[]).length===0 ? `<div class="empty"><p>${mecanico ? 'Este mecánico no tiene reparaciones asignadas' : 'No hay trabajos'}</p></div>` :
      (data||[]).map(r => {
        // Badge "X días esperando" cuando el trabajo está parado por repuestos.
        // Usa updated_at para reflejar el último cambio de estado/edición.
        let espera = '';
        if (r.estado === 'esperando_repuestos' && r.updated_at) {
          const dias = Math.max(0, Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86400000));
          if (dias >= 1) {
            const color = dias >= 14 ? 'var(--danger)' : dias >= 7 ? 'var(--warning)' : 'var(--text2)';
            espera = `<div class="card-sub" style="color:${color};font-weight:600">⏱ ${dias} días esperando</div>`;
          }
        }
        return `
      <div class="card" onclick="detalleReparacion('${r.id}')">
        <div class="card-header">
          <div class="card-avatar">${TIPO_ICONS[r.tipo_trabajo]||'🔧'}</div>
          <div class="card-info">
            <div class="card-name">${h(r.descripcion)}</div>
            <div class="card-sub">${r.tipo_trabajo?h(r.tipo_trabajo)+' · ':''}${r.vehiculos?h(r.vehiculos.marca)+' '+h(r.vehiculos.patente):''} ${r.clientes?' · '+h(r.clientes.nombre):''}</div>
            <div class="card-sub">₲${gs(r.costo)} · ${formatFecha(r.fecha)}</div>
            ${espera}
          </div>
          <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
        </div>
      </div>`;
      }).join('')}
    ${renderPagination(count||0, offset, `()=>reparaciones({offset:${offset},filtro:'${hjs(filtro)}',search:'${hjs(search)}',tipo:'${hjs(tipo)}',mecanico:'${hjs(mecanico)}',viejos:${seteVistaViejos}})`)}`;
}

function _navRep(o) { reparaciones({offset:o}); }
