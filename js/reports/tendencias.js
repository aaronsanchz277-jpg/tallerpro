// ─── REPORTE DE TENDENCIAS (Evolución de ingresos y gastos) ──────────────────
async function reporteTendencias() {
  const { inicio, fin } = getFechasReporte();
  
  const [
    { data: reparaciones },
    { data: ventas },
    { data: gastos }
  ] = await Promise.all([
    sb.from('reparaciones').select('fecha, costo, costo_repuestos').eq('taller_id', tid()).eq('estado', 'finalizado').gte('fecha', inicio).lte('fecha', fin).order('fecha'),
    sb.from('ventas').select('created_at, total').eq('taller_id', tid()).eq('estado', 'completado').gte('created_at', inicio).lte('created_at', fin + 'T23:59:59').order('created_at'),
    sb.from('gastos_taller').select('fecha, monto').eq('taller_id', tid()).gte('fecha', inicio).lte('fecha', fin).order('fecha')
  ]);

  // Agrupar por día
  const porDia = {};
  
  (reparaciones || []).forEach(r => {
    const fecha = r.fecha;
    if (!porDia[fecha]) porDia[fecha] = { ingresos: 0, ganancia: 0, gastos: 0 };
    porDia[fecha].ingresos += parseFloat(r.costo || 0);
    porDia[fecha].ganancia += parseFloat(r.costo || 0) - parseFloat(r.costo_repuestos || 0);
  });

  (ventas || []).forEach(v => {
    const fecha = v.created_at?.split('T')[0];
    if (!fecha) return;
    if (!porDia[fecha]) porDia[fecha] = { ingresos: 0, ganancia: 0, gastos: 0 };
    porDia[fecha].ingresos += parseFloat(v.total || 0);
    porDia[fecha].ganancia += parseFloat(v.total || 0) * 0.3; // Estimación de margen en ventas (30%)
  });

  (gastos || []).forEach(g => {
    const fecha = g.fecha;
    if (!porDia[fecha]) porDia[fecha] = { ingresos: 0, ganancia: 0, gastos: 0 };
    porDia[fecha].gastos += parseFloat(g.monto || 0);
  });

  const fechas = Object.keys(porDia).sort();
  const ingresosData = fechas.map(f => porDia[f].ingresos);
  const gananciaData = fechas.map(f => porDia[f].ganancia);
  const gastosData = fechas.map(f => porDia[f].gastos);

  const totalIngresos = ingresosData.reduce((a, b) => a + b, 0);
  const totalGanancia = gananciaData.reduce((a, b) => a + b, 0);
  const totalGastos = gastosData.reduce((a, b) => a + b, 0);

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text)">📉 Tendencias</div>
        <button class="btn-add" onclick="exportarReportePDF('Tendencias', 'tendencias-content')" style="font-size:.8rem;padding:.4rem .8rem">📥 PDF</button>
      </div>
      
      ${renderSelectorFechas('reporteTendencias')}
      
      <div id="tendencias-content">
        <!-- Resumen -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:1rem">
          <div style="background:rgba(0,255,136,.08);border-radius:8px;padding:.5rem;text-align:center">
            <div style="font-size:.6rem;color:var(--success)">INGRESOS</div>
            <div style="font-family:var(--font-head);font-size:1rem;color:var(--success)">${formatearMoneda(totalIngresos)}</div>
          </div>
          <div style="background:rgba(0,229,255,.08);border-radius:8px;padding:.5rem;text-align:center">
            <div style="font-size:.6rem;color:var(--accent)">GANANCIA</div>
            <div style="font-family:var(--font-head);font-size:1rem;color:var(--accent)">${formatearMoneda(totalGanancia)}</div>
          </div>
          <div style="background:rgba(255,68,68,.08);border-radius:8px;padding:.5rem;text-align:center">
            <div style="font-size:.6rem;color:var(--danger)">GASTOS</div>
            <div style="font-family:var(--font-head);font-size:1rem;color:var(--danger)">${formatearMoneda(totalGastos)}</div>
          </div>
        </div>

        <!-- Gráfico -->
        <div class="chart-container" style="padding:.5rem">
          <canvas id="chart-tendencias" style="width:100%;height:250px"></canvas>
        </div>

        <!-- Tabla de datos -->
        <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);margin:1rem 0 .5rem">📋 DETALLE POR DÍA</div>
        <div style="max-height:300px;overflow-y:auto">
          <table style="width:100%;border-collapse:collapse;font-size:.75rem">
            <thead>
              <tr style="border-bottom:2px solid var(--border);color:var(--text2)">
                <th style="padding:.3rem;text-align:left">Fecha</th>
                <th style="padding:.3rem;text-align:right">Ingresos</th>
                <th style="padding:.3rem;text-align:right">Ganancia</th>
                <th style="padding:.3rem;text-align:right">Gastos</th>
              </tr>
            </thead>
            <tbody>
              ${fechas.map(f => `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:.3rem">${formatFecha(f)}</td>
                  <td style="padding:.3rem;text-align:right;color:var(--success)">${formatearMoneda(porDia[f].ingresos)}</td>
                  <td style="padding:.3rem;text-align:right;color:var(--accent)">${formatearMoneda(porDia[f].ganancia)}</td>
                  <td style="padding:.3rem;text-align:right;color:var(--danger)">${formatearMoneda(porDia[f].gastos)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  // Renderizar gráfico
  if (fechas.length > 0) {
    setTimeout(async () => {
      await loadChartJs();
      const ctx = document.getElementById('chart-tendencias')?.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: fechas.map(f => formatFecha(f).slice(0, 5)),
            datasets: [
              { label: 'Ingresos', data: ingresosData, borderColor: '#00ff88', backgroundColor: 'transparent', tension: 0.3, pointRadius: 2 },
              { label: 'Ganancia', data: gananciaData, borderColor: '#00e5ff', backgroundColor: 'transparent', tension: 0.3, pointRadius: 2 },
              { label: 'Gastos', data: gastosData, borderColor: '#ff4444', backgroundColor: 'transparent', tension: 0.3, pointRadius: 2 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#8888aa', boxWidth: 12, padding: 10 } } },
            scales: {
              y: { beginAtZero: true, ticks: { color: '#8888aa', callback: v => fm(v) }, grid: { color: '#2a2a3a' } },
              x: { ticks: { color: '#8888aa' }, grid: { display: false } }
            }
          }
        });
      }
    }, 100);
  }
}
