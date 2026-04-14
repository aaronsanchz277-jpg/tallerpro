// ─── PROYECCIÓN DE FLUJO DE CAJA ─────────────────────────────────────────────
async function reporteFlujoCaja() {
  const hoy = new Date().toISOString().split('T')[0];
  const prox30dias = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  
  const [{ data: cuentasCobrar }, { data: cuentasPagar }, { data: saldoInicial }] = await Promise.all([
    // Cuentas por cobrar (créditos/fiados pendientes + reparaciones con saldo)
    sb.from('fiados').select('monto, clientes(nombre)').eq('taller_id', tid()).eq('pagado', false),
    // Cuentas por pagar pendientes
    sb.from('cuentas_pagar').select('proveedor, monto, fecha_vencimiento').eq('taller_id', tid()).eq('pagada', false).lte('fecha_vencimiento', prox30dias),
    // Saldo actual (último balance)
    sb.rpc('get_balance', { p_taller_id: tid(), p_fecha_inicio: '2000-01-01', p_fecha_fin: hoy })
  ]);

  const totalCobrar = (cuentasCobrar || []).reduce((s, c) => s + parseFloat(c.monto || 0), 0);
  const totalPagar = (cuentasPagar || []).reduce((s, c) => s + parseFloat(c.monto || 0), 0);
  const saldoActual = saldoInicial?.data?.balance_neto || 0;
  const proyeccion = saldoActual + totalCobrar - totalPagar;

  // Agrupar cuentas por pagar por vencimiento
  const vencimientos = {};
  (cuentasPagar || []).forEach(c => {
    const fecha = c.fecha_vencimiento || 'Sin fecha';
    if (!vencimientos[fecha]) vencimientos[fecha] = [];
    vencimientos[fecha].push(c);
  });

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text)">💵 Flujo de Caja</div>
        <button class="btn-add" onclick="exportarReportePDF('Flujo_Caja', 'flujo-content')" style="font-size:.8rem;padding:.4rem .8rem">📥 PDF</button>
      </div>
      
      <div id="flujo-content">
        <!-- Saldo actual -->
        <div style="background:var(--surface);border:2px solid ${saldoActual >= 0 ? 'var(--success)' : 'var(--danger)'};border-radius:12px;padding:1rem;margin-bottom:1rem;text-align:center">
          <div style="font-size:.7rem;color:var(--text2);letter-spacing:1px">SALDO ACTUAL EN CAJA</div>
          <div style="font-family:var(--font-head);font-size:2rem;color:${saldoActual >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatearMoneda(saldoActual)}</div>
        </div>

        <!-- Proyección -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
          <div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:12px;padding:.75rem">
            <div style="font-size:.6rem;color:var(--success)">POR COBRAR</div>
            <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--success)">${formatearMoneda(totalCobrar)}</div>
            <div style="font-size:.65rem;color:var(--text2)">${(cuentasCobrar || []).length} créditos</div>
          </div>
          <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.2);border-radius:12px;padding:.75rem">
            <div style="font-size:.6rem;color:var(--danger)">POR PAGAR (30d)</div>
            <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--danger)">${formatearMoneda(totalPagar)}</div>
            <div style="font-size:.65rem;color:var(--text2)">${(cuentasPagar || []).length} cuentas</div>
          </div>
        </div>

        <!-- Proyección final -->
        <div style="background:${proyeccion >= 0 ? 'rgba(0,255,136,.06)' : 'rgba(255,68,68,.06)'};border:1px solid ${proyeccion >= 0 ? 'rgba(0,255,136,.3)' : 'rgba(255,68,68,.3)'};border-radius:12px;padding:.75rem;margin-bottom:1rem;text-align:center">
          <div style="font-size:.65rem;color:${proyeccion >= 0 ? 'var(--success)' : 'var(--danger)'}">PROYECCIÓN A 30 DÍAS</div>
          <div style="font-family:var(--font-head);font-size:1.5rem;color:${proyeccion >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatearMoneda(proyeccion)}</div>
        </div>

        <!-- Desglose de cuentas por pagar -->
        <div style="font-family:var(--font-head);font-size:.9rem;color:var(--text2);margin:1rem 0 .5rem">📅 VENCIMIENTOS PRÓXIMOS</div>
        ${Object.keys(vencimientos).length === 0 ? '<p style="color:var(--text2);font-size:.85rem">No hay cuentas por pagar próximas</p>' :
          Object.entries(vencimientos).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, cuentas]) => `
            <div style="margin-bottom:.5rem">
              <div style="font-size:.75rem;color:var(--warning);margin-bottom:.2rem">${fecha === 'Sin fecha' ? 'Sin fecha definida' : formatFecha(fecha)}</div>
              ${cuentas.map(c => `
                <div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.8rem">
                  <span>${h(c.proveedor)}</span>
                  <span style="color:var(--danger)">${formatearMoneda(c.monto)}</span>
                </div>
              `).join('')}
            </div>
          `).join('')}

        <!-- Créditos por cobrar -->
        <div style="font-family:var(--font-head);font-size:.9rem;color:var(--text2);margin:1rem 0 .5rem">💰 CRÉDITOS POR COBRAR</div>
        ${(cuentasCobrar || []).length === 0 ? '<p style="color:var(--text2);font-size:.85rem">No hay créditos pendientes</p>' :
          cuentasCobrar.map(c => `
            <div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.8rem">
              <span>${h(c.clientes?.nombre || 'Sin cliente')}</span>
              <span style="color:var(--success)">${formatearMoneda(c.monto)}</span>
            </div>
          `).join('')}
      </div>
    </div>`;
}
