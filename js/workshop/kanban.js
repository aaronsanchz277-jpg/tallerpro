// ─── PANEL DE TRABAJO (Vista Kanban de OTs activas) ──────────────────────────
async function panelTrabajo() {
  await safeCall(async () => {
    const { data: reps } = await sb.from('reparaciones')
      .select('*, vehiculos(patente,marca,modelo), clientes(nombre), reparacion_mecanicos(nombre_mecanico)')
      .eq('taller_id', tid())
      .in('estado', ['pendiente', 'en_progreso', 'esperando_repuestos', 'finalizado'])
      .order('created_at', { ascending: false })
      .limit(100);

    const pendientes = (reps || []).filter(r => r.estado === 'pendiente');
    const enProgreso = (reps || []).filter(r => r.estado === 'en_progreso');
    const esperando = (reps || []).filter(r => r.estado === 'esperando_repuestos');
    const finalizados = (reps || []).filter(r => r.estado === 'finalizado').slice(0, 10);

    function kanbanCard(r) {
      const mecanicos = (r.reparacion_mecanicos || []).map(m => m.nombre_mecanico).filter(Boolean);
      const repuestoListo = r.estado === 'esperando_repuestos' && r.repuesto_disponible_at
        ? `<div style="font-size:.65rem;color:var(--success);margin-top:2px;font-weight:600">📦 Repuesto disponible</div>` : '';
      return `<div class="card" style="margin-bottom:.5rem;cursor:pointer" onclick="detalleReparacion('${r.id}')">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div style="flex:1;min-width:0">
            <div style="font-size:.85rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(r.descripcion)}</div>
            <div style="font-size:.72rem;color:var(--text2);margin-top:2px">${r.vehiculos ? h(r.vehiculos.marca) + ' ' + h(r.vehiculos.patente) : ''}</div>
            ${r.clientes ? `<div style="font-size:.7rem;color:var(--text2)">${h(r.clientes.nombre)}</div>` : ''}
            ${mecanicos.length ? `<div style="font-size:.68rem;color:var(--accent);margin-top:2px">${mecanicos.join(', ')}</div>` : ''}
            ${repuestoListo}
          </div>
          <div style="text-align:right;flex-shrink:0;margin-left:.5rem">
            <div style="font-family:var(--font-head);font-size:.85rem;color:var(--accent)">${fm(r.costo || 0)}</div>
            <div style="font-size:.65rem;color:var(--text2)">${formatFecha(r.fecha)}</div>
          </div>
        </div>
      </div>`;
    }

    function kanbanCol(title, items, color, iconSvg) {
      return `<div style="margin-bottom:1.25rem">
        <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.5rem">
          <span style="width:18px;height:18px;display:flex;align-items:center;justify-content:center">${iconSvg}</span>
          <span style="font-family:var(--font-head);font-size:.8rem;color:${color};letter-spacing:1px">${title}</span>
          <span style="background:var(--surface2);border-radius:10px;padding:1px 8px;font-size:.7rem;color:var(--text2)">${items.length}</span>
        </div>
        ${items.length === 0 ? '<div style="font-size:.78rem;color:var(--text2);padding:.5rem;background:var(--surface);border-radius:8px;text-align:center">Sin trabajos</div>' : items.map(kanbanCard).join('')}
      </div>`;
    }

    // Iconos SVG definidos dentro de la función
    const iconoPendiente = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="var(--warning)" stroke="none"/></svg>`;
    const iconoProgreso = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
    const iconoEspera = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const iconoFinalizado = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`;

    document.getElementById('main-content').innerHTML = `
      <div class="section-header">
        <div class="section-title">Panel de Trabajo</div>
        <button class="btn-add" onclick="navigate('reparaciones')">Ver listado</button>
      </div>
      <div style="background:rgba(0,229,255,.05);border:1px solid rgba(0,229,255,.15);border-radius:10px;padding:.6rem;margin-bottom:1rem;font-size:.78rem;color:var(--text2);text-align:center">
        ${pendientes.length + enProgreso.length + esperando.length} trabajos activos · ${enProgreso.length} en desarrollo · ${finalizados.length} finalizados recientes
      </div>
      ${kanbanCol('PENDIENTES', pendientes, 'var(--warning)', iconoPendiente)}
      ${kanbanCol('EN DESARROLLO', enProgreso, 'var(--accent2)', iconoProgreso)}
      ${kanbanCol('ESPERANDO REPUESTOS', esperando, 'var(--accent)', iconoEspera)}
      ${kanbanCol('FINALIZADOS RECIENTES', finalizados, 'var(--success)', iconoFinalizado)}`;
  }, null, 'Error al cargar el panel de trabajo');
}
