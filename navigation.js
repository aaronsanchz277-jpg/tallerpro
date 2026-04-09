// ─── CIERRE DE CAJA ─────────────────────────────────────────────────────────
async function modalCierreCaja() {
  const hoy = new Date().toISOString().split('T')[0];
  const { data: movHoy } = await sb.from('movimientos_financieros').select('tipo,monto,descripcion,categorias_financieras(nombre)').eq('taller_id',tid()).eq('fecha',hoy);
  const { data: pagosHoy } = await sb.from('pagos_reparacion').select('monto,metodo').eq('taller_id',tid()).eq('fecha',hoy);

  // Ingresos por método de pago
  const porMetodo = { Efectivo:0, Transferencia:0, Tarjeta:0, Crédito:0, Otro:0 };
  (pagosHoy||[]).forEach(p => { porMetodo[p.metodo] = (porMetodo[p.metodo]||0) + parseFloat(p.monto||0); });

  // Totales del día desde finanzas
  const ingresosHoy = (movHoy||[]).filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+parseFloat(m.monto||0),0);
  const egresosHoy = (movHoy||[]).filter(m=>m.tipo==='egreso').reduce((s,m)=>s+parseFloat(m.monto||0),0);
  const netoHoy = ingresosHoy - egresosHoy;

  // Desglose egresos por categoría
  const egresosPorCat = {};
  (movHoy||[]).filter(m=>m.tipo==='egreso').forEach(m => {
    const cat = m.categorias_financieras?.nombre || 'Otros';
    egresosPorCat[cat] = (egresosPorCat[cat]||0) + parseFloat(m.monto||0);
  });

  // Efectivo en caja (solo efectivo - egresos)
  const efectivoEnCaja = porMetodo.Efectivo - egresosHoy;

  openModal(`
    <div class="modal-title">💵 Cierre de caja — ${formatFecha(hoy)}</div>

    <div style="background:${netoHoy>=0?'rgba(0,255,136,.06)':'rgba(255,68,68,.06)'};border:1px solid ${netoHoy>=0?'rgba(0,255,136,.2)':'rgba(255,68,68,.2)'};border-radius:12px;padding:1rem;margin-bottom:1rem;text-align:center">
      <div style="font-size:.65rem;color:${netoHoy>=0?'var(--success)':'var(--danger)'};letter-spacing:1px;font-family:var(--font-head)">RESULTADO DEL DÍA</div>
      <div style="font-family:var(--font-head);font-size:2rem;color:${netoHoy>=0?'var(--success)':'var(--danger)'}">₲${gs(netoHoy)}</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
      <div style="background:rgba(0,255,136,.06);border-radius:10px;padding:.6rem;text-align:center">
        <div style="font-size:.6rem;color:var(--success);letter-spacing:1px">ENTRADAS</div>
        <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--success)">₲${gs(ingresosHoy)}</div>
      </div>
      <div style="background:rgba(255,68,68,.06);border-radius:10px;padding:.6rem;text-align:center">
        <div style="font-size:.6rem;color:var(--danger);letter-spacing:1px">SALIDAS</div>
        <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--danger)">₲${gs(egresosHoy)}</div>
      </div>
    </div>

    <div style="font-size:.7rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.4rem">COBROS POR MÉTODO</div>
    ${Object.entries(porMetodo).filter(([,v])=>v>0).map(([met,total]) =>
      `<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.82rem">
        <span>${met==='Efectivo'?'💵':met==='Transferencia'?'🏦':met==='Tarjeta'?'💳':met==='Crédito'?'📋':'📎'} ${met}</span>
        <span style="font-family:var(--font-head);color:var(--success)">₲${gs(total)}</span>
      </div>`).join('') || '<div style="font-size:.8rem;color:var(--text2);padding:.3rem 0">Sin cobros hoy</div>'}

    ${Object.keys(egresosPorCat).length > 0 ? `
    <div style="font-size:.7rem;color:var(--danger);font-family:var(--font-head);letter-spacing:1px;margin:.75rem 0 .4rem">GASTOS POR CATEGORÍA</div>
    ${Object.entries(egresosPorCat).map(([cat,total]) =>
      `<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.82rem">
        <span>${cat}</span>
        <span style="font-family:var(--font-head);color:var(--danger)">-₲${gs(total)}</span>
      </div>`).join('')}` : ''}

    <div style="background:var(--surface2);border-radius:10px;padding:.75rem;margin-top:1rem;text-align:center">
      <div style="font-size:.65rem;color:var(--accent);letter-spacing:1px;font-family:var(--font-head)">EFECTIVO EN CAJA</div>
      <div style="font-family:var(--font-head);font-size:1.5rem;color:${efectivoEnCaja>=0?'var(--accent)':'var(--danger)'}">₲${gs(efectivoEnCaja)}</div>
      <div style="font-size:.65rem;color:var(--text2)">Efectivo cobrado menos gastos del día</div>
    </div>

    <button class="btn-secondary" style="margin-top:1rem" onclick="closeModal()">Cerrar</button>`);
}

