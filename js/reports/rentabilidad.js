// ─── REPORTE DE RENTABILIDAD ─────────────────────────────────────────────────
async function reporteRentabilidad() {
  const { inicio, fin } = getFechasReporte();
  
  const [{ data: reparaciones }, { data: pagos }, { data: gastos }, { data: ventas }] = await Promise.all([
    sb.from('reparaciones').select('id, descripcion, costo, costo_repuestos, clientes(nombre), reparacion_mecanicos(nombre_mecanico)')
      .eq('taller_id', tid()).eq('estado', 'finalizado').gte('fecha', inicio).lte('fecha', fin),
    sb.from('pagos_reparacion').select('monto, metodo').eq('taller_id', tid()).gte('fecha', inicio).lte('fecha', fin),
    sb.from('gastos_taller').select('monto, categoria').eq('taller_id', tid()).gte('fecha', inicio).lte('fecha', fin),
    sb.from('ventas').select('total, items').eq('taller_id', tid()).gte('created_at', inicio).lte('created_at', fin + 'T23:59:59')
  ]);

  // Cálculos generales
  const ingresoReparaciones = (reparaciones || []).reduce((s, r) => s + parseFloat(r.costo || 0), 0);
  const costoRepuestos = (reparaciones || []).reduce((s, r) => s + parseFloat(r.costo_repuestos || 0), 0);
  const ingresosVentas = (ventas || []).reduce((s, v) => s + parseFloat(v.total || 0), 0);
  const totalGastos = (gastos || []).reduce((s, g) => s + parseFloat(g.monto || 0), 0);
  
  const ingresosTotales = ingresoReparaciones + ingresosVentas;
  const gananciaBruta = ingresosTotales - costoRepuestos;
  const gananciaNeta = gananciaBruta - totalGastos;
  const margenNeto = ingresosTotales > 0 ? (gananciaNeta / ingresosTotales * 100) : 0;

  // Rentabilidad por tipo de trabajo
  const porTipo = {};
  (reparaciones || []).forEach(r => {
    const tipo = r.descripcion?.split(' ').slice(0, 2).join(' ') || 'Otro';
    if (!porTipo[tipo]) porTipo[tipo] = { ingresos: 0, costoRepuestos: 0, count: 0 };
    porTipo[tipo].ingresos += parseFloat(r.costo || 0);
    porTipo[tipo].costoRepuestos += parseFloat(r.costo_repuestos || 0);
    porTipo[tipo].count++;
  });
  const rankingTipos = Object.entries(porTipo)
    .map(([nombre, datos]) => ({ nombre, ...datos, ganancia: datos.ingresos - datos.costoRepuestos }))
    .sort((a, b) => b.ganancia - a.ganancia);

  // Rentabilidad por cliente
  const porCliente = {};
  (reparaciones || []).forEach(r => {
    const cliente = r.clientes?.nombre || 'Sin cliente';
    if (!porCliente[cliente]) porCliente[cliente] = { ingresos: 0, count: 0 };
    porCliente[cliente].ingresos += parseFloat(r.costo || 0);
    porCliente[cliente].count++;
  });
  const rankingClientes = Object.entries(porCliente)
    .map(([nombre, datos]) => ({ nombre, ...datos }))
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, 10);

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text)">📊 Rentabilidad</div>
        <button class="btn-add" onclick="exportarReportePDF('Rentabilidad', 'rentabilidad-content')" style="font-size:.8rem;padding:.4rem .8rem">📥 PDF</button>
      </div>
      
      ${renderSelectorFechas('reporteRentabilidad')}
      
      <div id="rentabilidad-content">
        <!-- KPIs principales -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
          <div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:12px;padding:.75rem;text-align:center">
            <div style="font-size:.6rem;color:var(--success);letter-spacing:1px">GANANCIA BRUTA</div>
            <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--success)">${formatearMoneda(gananciaBruta)}</div>
          </div>
          <div style="background:${gananciaNeta >= 0 ? 'rgba(0,255,136,.08)' : 'rgba(255,68,68,.08)'};border:1px solid ${gananciaNeta >= 0 ? 'rgba(0,255,136,.2)' : 'rgba(255,68,68,.2)'};border-radius:12px;padding:.75rem;text-align:center">
            <div style="font-size:.6rem;color:${gananciaNeta >= 0 ? 'var(--success)' : 'var(--danger)'};letter-spacing:1px">GANANCIA NETA</div>
            <div style="font-family:var(--font-head);font-size:1.3rem;color:${gananciaNeta >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatearMoneda(gananciaNeta)}</div>
          </div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:1rem">
          <div style="background:var(--surface);border-radius:8px;padding:.5rem;text-align:center">
            <div style="font-size:.6rem;color:var(--text2)">Ingresos</div>
            <div style="font-family:var(--font-head);font-size:1rem;color:var(--accent)">${formatearMoneda(ingresosTotales)}</div>
          </div>
          <div style="background:var(--surface);border-radius:8px;padding:.5rem;text-align:center">
            <div style="font-size:.6rem;color:var(--text2)">Costo Rep.</div>
            <div style="font-family:var(--font-head);font-size:1rem;color:var(--danger)">${formatearMoneda(costoRepuestos)}</div>
          </div>
          <div style="background:var(--surface);border-radius:8px;padding:.5rem;text-align:center">
            <div style="font-size:.6rem;color:var(--text2)">Margen Neto</div>
            <div style="font-family:var(--font-head);font-size:1rem;color:${margenNeto >= 0 ? 'var(--success)' : 'var(--danger)'}">${margenNeto.toFixed(1)}%</div>
          </div>
        </div>

        <!-- Rentabilidad por tipo de servicio -->
        <div style="font-family:var(--font-head);font-size:.9rem;color:var(--text2);margin:1rem 0 .5rem">🔧 POR TIPO DE TRABAJO</div>
        ${rankingTipos.length === 0 ? '<p style="color:var(--text2);font-size:.85rem">Sin datos</p>' : rankingTipos.slice(0, 8).map(t => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:.6rem;margin-bottom:.4rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
              <span style="font-size:.85rem">${h(t.nombre)} (${t.count})</span>
              <span style="font-family:var(--font-head);color:var(--success)">${formatearMoneda(t.ganancia)}</span>
            </div>
            <div style="display:flex;gap:.5rem;font-size:.7rem;color:var(--text2)">
              <span>Ingresos: ${formatearMoneda(t.ingresos)}</span>
              <span>Repuestos: ${formatearMoneda(t.costoRepuestos)}</span>
            </div>
            <div style="margin-top:.3rem;height:4px;background:var(--surface2);border-radius:2px;overflow:hidden">
              <div style="width:${(t.ganancia / rankingTipos[0].ganancia) * 100}%;height:100%;background:var(--accent);border-radius:2px"></div>
            </div>
          </div>
        `).join('')}

        <!-- Top clientes -->
        <div style="font-family:var(--font-head);font-size:.9rem;color:var(--text2);margin:1rem 0 .5rem">👥 TOP CLIENTES</div>
        ${rankingClientes.length === 0 ? '<p style="color:var(--text2);font-size:.85rem">Sin datos</p>' : rankingClientes.map((c, i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
            <span>${i+1}. ${h(c.nombre)} (${c.count} trab.)</span>
            <span style="font-family:var(--font-head);color:var(--accent)">${formatearMoneda(c.ingresos)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
}
