// ─── REPORTES (RESUMEN RÁPIDO) ───────────────────────────────────────────────
// Página `reportes` del menú: ganancias del día/semana/mes, créditos, top
// servicios y productividad por empleado.
async function reportes() {
  const hoy = fechaHoy();
  const primerMes = primerDiaMes();
  const primerSemana = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  })();

  const [
    { data: repsHoy },
    { data: repsSemana },
    { data: repsMes },
    { data: todasReps },
    { data: creditosPend },
    { data: repsPorEmpleado }
  ] = await Promise.all([
    cachedQuery('rep_hoy', () => sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').eq('fecha',hoy)),
    cachedQuery('rep_semana', () => sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').gte('fecha',primerSemana)),
    cachedQuery('rep_mes', () => sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').gte('fecha',primerMes)),
    cachedQuery('rep_todas', () => sb.from('reparaciones').select('descripcion,costo').eq('taller_id',tid()).eq('estado','finalizado').gte('fecha',primerMes)),
    cachedQuery('cred_pend', () => sb.from('fiados').select('monto').eq('taller_id',tid()).eq('pagado',false)),
    cachedQuery('rep_emp', () => sb.from('reparacion_mecanicos').select('nombre_mecanico, horas, reparaciones(costo, estado, fecha, taller_id)').order('created_at', {ascending: false}))
  ]);

  const ganHoy = (repsHoy||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
  const ganSemana = (repsSemana||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
  const ganMes = (repsMes||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
  const totalCréditos = (creditosPend||[]).reduce((s,f)=>s+parseFloat(f.monto||0),0);

  let ingresosTotalMes = ganMes;
  let gananciaNeta = ganMes;

  if (currentPerfil?.rol === 'admin') {
    try {
      const { data: balanceMensual } = await sb.rpc('get_balance_mensual', {
        p_taller_id: tid(),
        p_fecha_inicio: primerMes,
        p_fecha_fin: hoy
      });
      if (balanceMensual) {
        ingresosTotalMes = balanceMensual.total_ingresos || ganMes;
        gananciaNeta = balanceMensual.balance_neto || ganMes;
      }
    } catch (e) {
      console.warn('Error obteniendo balance mensual para reportes:', e);
    }
  }

  const serviciosCount = {};
  (todasReps||[]).forEach(r => {
    const key = r.descripcion || 'Sin descripción';
    serviciosCount[key] = (serviciosCount[key]||0) + parseFloat(r.costo||0);
  });
  const topServicios = Object.entries(serviciosCount).sort((a,b)=>b[1]-a[1]).slice(0,5);

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:2px;margin-bottom:.75rem">${t('repGanancias')}</div>
      <div class="stats-grid" style="margin-bottom:1rem">
        <div class="stat-card"><div class="stat-value" style="font-size:1.3rem">${fm(ganHoy)}</div><div class="stat-label">${t('repHoy2')}</div></div>
        <div class="stat-card"><div class="stat-value" style="font-size:1.3rem">${fm(ganSemana)}</div><div class="stat-label">${t('repSemana')}</div></div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:.72rem;color:var(--text2);letter-spacing:1px;font-family:var(--font-head)">${t('repMes')} — INGRESOS TOTALES (filtrado)</div>
          <div style="font-family:var(--font-head);font-size:2rem;font-weight:700;color:var(--success)">${fm(ingresosTotalMes)}</div>
        </div>
        <div style="font-size:2.5rem;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
      </div>
      ${gananciaNeta !== ganMes ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
        <div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:12px;padding:.75rem">
          <div style="font-size:.68rem;color:var(--success);font-family:var(--font-head);letter-spacing:1px">${t('dashGananciaNeta')}</div>
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:${gananciaNeta>=0?'var(--success)':'var(--danger)'}">${fm(gananciaNeta)}</div>
        </div>
      </div>
      ` : ''}
      <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:12px;padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:.72rem;color:var(--danger);letter-spacing:1px;font-family:var(--font-head)">${t('repFiados')}</div>
          <div style="font-family:var(--font-head);font-size:1.8rem;font-weight:700;color:var(--danger)">${fm(totalCréditos)}</div>
        </div>
        <button onclick="navigate('creditos')" style="background:rgba(255,68,68,.15);border:1px solid rgba(255,68,68,.3);color:var(--danger);border-radius:8px;padding:.5rem .75rem;font-size:.8rem;cursor:pointer">${t('repVerCreditos')}</button>
      </div>
      ${topServicios.length > 0 ? `
      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:2px;margin-bottom:.6rem">${t('repTopServ')}</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.75rem;margin-bottom:1rem">
        ${topServicios.map(([desc,total],i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;gap:.5rem;align-items:center">
              <span style="font-family:var(--font-head);font-size:.85rem;color:var(--accent2)">#${i+1}</span>
              <span style="font-size:.85rem">${h(desc)}</span>
            </div>
            <span style="font-family:var(--font-head);color:var(--success);font-size:.9rem">${fm(total)}</span>
          </div>`).join('')}
      </div>` : `<div class="empty"><p>${t('repSinReps2')}</p></div>`}

      ${(() => {
        const empStats = {};
        (repsPorEmpleado||[]).forEach(r => {
          if (!r.reparaciones || r.reparaciones.taller_id !== tid()) return;
          if (r.reparaciones.fecha < primerMes) return;
          const nombre = r.nombre_mecanico || 'Sin nombre';
          if (!empStats[nombre]) empStats[nombre] = { total:0, finalizadas:0, ingresos:0, horas:0 };
          empStats[nombre].total++;
          empStats[nombre].horas += parseFloat(r.horas||0);
          if (r.reparaciones.estado === 'finalizado') { empStats[nombre].finalizadas++; empStats[nombre].ingresos += parseFloat(r.reparaciones.costo||0); }
        });
        const empArr = Object.entries(empStats).sort((a,b)=>b[1].ingresos-a[1].ingresos);
        if (empArr.length === 0) return '';
        return `
        <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:2px;margin-bottom:.6rem">PRODUCTIVIDAD POR EMPLEADO (MES)</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.75rem;margin-bottom:1rem">
          ${empArr.map(([nombre, s], i) => {
            const pct = empArr[0][1].ingresos > 0 ? Math.round(s.ingresos / empArr[0][1].ingresos * 100) : 0;
            return `
            <div style="padding:.6rem 0;${i<empArr.length-1?'border-bottom:1px solid var(--border)':''}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
                <div style="display:flex;gap:.5rem;align-items:center">
                  <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:var(--accent)">${h(nombre).charAt(0)}</div>
                  <span style="font-size:.85rem;font-weight:500">${h(nombre)}</span>
                </div>
                <span style="font-family:var(--font-head);color:var(--success);font-size:.9rem">${fm(s.ingresos)}</span>
              </div>
              <div style="display:flex;gap:1rem;font-size:.72rem;color:var(--text2);margin-left:2.3rem">
                <span>${s.finalizadas} finalizadas</span>
                <span>${s.total} asignadas</span>
                <span>${s.horas}h trabajadas</span>
              </div>
              <div style="margin-left:2.3rem;margin-top:.3rem;height:4px;background:var(--surface2);border-radius:2px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:var(--accent);border-radius:2px"></div>
              </div>
            </div>`;
          }).join('')}
        </div>`;
      })()}
    </div>`;
}

window.reportes = reportes;
