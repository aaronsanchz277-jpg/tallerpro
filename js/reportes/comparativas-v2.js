async function reporteComparativas() {
  const hoy = new Date();
  const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const finMesActual = hoy.toISOString().split('T')[0];
  const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().split('T')[0];
  const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).toISOString().split('T')[0];
  
  const inicioAnioActual = new Date(hoy.getFullYear(), 0, 1).toISOString().split('T')[0];
  const inicioAnioAnterior = new Date(hoy.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
  const finAnioAnterior = new Date(hoy.getFullYear() - 1, 11, 31).toISOString().split('T')[0];

  const repsActual = await sb.from('reparaciones').select('costo, costo_repuestos').eq('taller_id', tid()).eq('estado', 'finalizado').gte('fecha', inicioMesActual).lte('fecha', finMesActual);
  const repsAnterior = await sb.from('reparaciones').select('costo, costo_repuestos').eq('taller_id', tid()).eq('estado', 'finalizado').gte('fecha', inicioMesAnterior).lte('fecha', finMesAnterior);
  const ventasActual = await sb.from('ventas').select('total').eq('taller_id', tid()).eq('estado', 'completado').gte('created_at', inicioMesActual).lte('created_at', finMesActual + 'T23:59:59');
  const ventasAnterior = await sb.from('ventas').select('total').eq('taller_id', tid()).eq('estado', 'completado').gte('created_at', inicioMesAnterior).lte('created_at', finMesAnterior + 'T23:59:59');
  const gastosActual = await sb.from('gastos_taller').select('monto').eq('taller_id', tid()).gte('fecha', inicioMesActual).lte('fecha', finMesActual);
  const gastosAnterior = await sb.from('gastos_taller').select('monto').eq('taller_id', tid()).gte('fecha', inicioMesAnterior).lte('fecha', finMesAnterior);
  const repsAnioActual = await sb.from('reparaciones').select('costo, costo_repuestos').eq('taller_id', tid()).eq('estado', 'finalizado').gte('fecha', inicioAnioActual).lte('fecha', finMesActual);
  const repsAnioAnterior = await sb.from('reparaciones').select('costo, costo_repuestos').eq('taller_id', tid()).eq('estado', 'finalizado').gte('fecha', inicioAnioAnterior).lte('fecha', finAnioAnterior);
  const ventasAnioActual = await sb.from('ventas').select('total').eq('taller_id', tid()).eq('estado', 'completado').gte('created_at', inicioAnioActual).lte('created_at', finMesActual + 'T23:59:59');
  const ventasAnioAnterior = await sb.from('ventas').select('total').eq('taller_id', tid()).eq('estado', 'completado').gte('created_at', inicioAnioAnterior).lte('created_at', finAnioAnterior + 'T23:59:59');
  const gastosAnioActual = await sb.from('gastos_taller').select('monto').eq('taller_id', tid()).gte('fecha', inicioAnioActual).lte('fecha', finMesActual);
  const gastosAnioAnterior = await sb.from('gastos_taller').select('monto').eq('taller_id', tid()).gte('fecha', inicioAnioAnterior).lte('fecha', finAnioAnterior);

  function calcIngresos(reps, ventas) {
    const ingReps = (reps.data || []).reduce((s, r) => s + parseFloat(r.costo || 0), 0);
    const ingVentas = (ventas.data || []).reduce((s, v) => s + parseFloat(v.total || 0), 0);
    return ingReps + ingVentas;
  }
  function calcGanancia(reps) { return (reps.data || []).reduce((s, r) => s + parseFloat(r.costo || 0) - parseFloat(r.costo_repuestos || 0), 0); }
  function calcGastos(gastos) { return (gastos.data || []).reduce((s, g) => s + parseFloat(g.monto || 0), 0); }

  const ingresosMesActual = calcIngresos(repsActual, ventasActual);
  const ingresosMesAnterior = calcIngresos(repsAnterior, ventasAnterior);
  const gananciaMesActual = calcGanancia(repsActual);
  const gananciaMesAnterior = calcGanancia(repsAnterior);
  const gastosMesActual = calcGastos(gastosActual);
  const gastosMesAnterior = calcGastos(gastosAnterior);

  const ingresosAnioActual = calcIngresos(repsAnioActual, ventasAnioActual);
  const ingresosAnioAnterior = calcIngresos(repsAnioAnterior, ventasAnioAnterior);
  const gananciaAnioActual = calcGanancia(repsAnioActual);
  const gananciaAnioAnterior = calcGanancia(repsAnioAnterior);
  const totalGastosAnioActual = calcGastos(gastosAnioActual);
  const totalGastosAnioAnterior = calcGastos(gastosAnioAnterior);

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text)">📈 Comparativas</div>
        <button class="btn-add" onclick="exportarReportePDF('Comparativas', 'comparativas-content')" style="font-size:.8rem;padding:.4rem .8rem">📥 PDF</button>
      </div>
      <div id="comparativas-content">
        <div style="font-family:var(--font-head);font-size:.9rem;color:var(--accent);margin-bottom:.5rem">📅 ESTE MES vs. MES ANTERIOR</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
          ${renderFilaComparativa('Ingresos', ingresosMesActual, ingresosMesAnterior)}
          ${renderFilaComparativa('Ganancia bruta', gananciaMesActual, gananciaMesAnterior)}
          ${renderFilaComparativa('Gastos', gastosMesActual, gastosMesAnterior, true)}
          <div style="height:1px;background:var(--border);margin:.5rem 0"></div>
          ${renderFilaComparativa('Ganancia neta', gananciaMesActual - gastosMesActual, gananciaMesAnterior - gastosMesAnterior)}
        </div>
        <div style="font-family:var(--font-head);font-size:.9rem;color:var(--accent);margin:1rem 0 .5rem">📆 ESTE AÑO vs. AÑO ANTERIOR</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
          ${renderFilaComparativa('Ingresos', ingresosAnioActual, ingresosAnioAnterior)}
          ${renderFilaComparativa('Ganancia bruta', gananciaAnioActual, gananciaAnioAnterior)}
          ${renderFilaComparativa('Gastos', gastosAnioActual, gastosAnioAnterior, true)}
          <div style="height:1px;background:var(--border);margin:.5rem 0"></div>
          ${renderFilaComparativa('Ganancia neta', gananciaAnioActual - gastosAnioActual, gananciaAnioAnterior - gastosAnioAnterior)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
          <div style="background:var(--surface2);border-radius:10px;padding:.6rem;text-align:center">
            <div style="font-size:.65rem;color:var(--text2)">Ticket promedio (mes)</div>
            <div style="font-family:var(--font-head);font-size:1.1rem">${formatearMoneda(ingresosMesActual / ((repsActual?.data?.length || 0) + (ventasActual?.data?.length || 0) || 1))}</div>
          </div>
          <div style="background:var(--surface2);border-radius:10px;padding:.6rem;text-align:center">
            <div style="font-size:.65rem;color:var(--text2)">Margen neto (mes)</div>
            <div style="font-family:var(--font-head);font-size:1.1rem;color:${(gananciaMesActual - gastosMesActual) >= 0 ? 'var(--success)' : 'var(--danger)'}">${ingresosMesActual > 0 ? ((gananciaMesActual - gastosMesActual) / ingresosMesActual * 100).toFixed(1) : 0}%</div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderFilaComparativa(label, actual, anterior, esGasto = false) {
  const varPct = anterior === 0 ? (actual > 0 ? '+100%' : '0%') : ((actual - anterior) / anterior * 100).toFixed(1) + '%';
  const flecha = actual > anterior ? '↑' : actual < anterior ? '↓' : '→';
  const color = esGasto ? (actual < anterior ? 'var(--success)' : actual > anterior ? 'var(--danger)' : 'var(--text2)') : (actual > anterior ? 'var(--success)' : actual < anterior ? 'var(--danger)' : 'var(--text2)');
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
      <span style="font-size:.85rem">${label}</span>
      <div style="display:flex;gap:.5rem;align-items:center">
        <span style="font-family:var(--font-head)">${formatearMoneda(actual)}</span>
        <span style="font-size:.75rem;color:${color}">${flecha} ${varPct.startsWith('+') ? varPct : (varPct.startsWith('-') ? varPct : '')}</span>
        <span style="font-size:.7rem;color:var(--text2)">vs ${formatearMoneda(anterior)}</span>
      </div>
    </div>`;
}
