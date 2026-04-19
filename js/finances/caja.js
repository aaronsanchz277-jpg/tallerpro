// ─── CIERRE DE CAJA ─────────────────────────────────────────────────────────
async function modalCierreCaja() {
  const hoy = fechaHoy();
  
  await safeCall(async () => {
    // Consultar todas las fuentes de ingresos del día
    const [
      { data: movimientos },
      { data: pagosReparacion },
      { data: ventas },
      { data: creditosPagados }
    ] = await Promise.all([
      sb.from('movimientos_financieros').select('tipo,monto,descripcion,categorias_financieras(nombre)').eq('taller_id', tid()).eq('fecha', hoy),
      sb.from('pagos_reparacion').select('monto,metodo').eq('taller_id', tid()).eq('fecha', hoy),
      sb.from('ventas').select('total,metodo_pago').eq('taller_id', tid()).eq('estado', 'completado').gte('created_at', hoy).lte('created_at', hoy + 'T23:59:59'),
      sb.from('fiados').select('monto').eq('taller_id', tid()).eq('pagado', true).gte('fecha_pago', hoy).lte('fecha_pago', hoy + 'T23:59:59')
    ]);

    // Función segura para sumar montos (maneja null/undefined)
    const sumarMontos = (arr, campo = 'monto') => {
      return (arr || []).reduce((acc, item) => {
        const valor = parseFloat(item[campo]);
        return acc + (isNaN(valor) ? 0 : valor);
      }, 0);
    };

    // 1. Ingresos por método de pago (desde pagos_reparacion + ventas)
    const porMetodo = { Efectivo: 0, Transferencia: 0, Tarjeta: 0, Crédito: 0, Otro: 0 };
    
    (pagosReparacion || []).forEach(p => {
      const metodo = p.metodo || 'Efectivo';
      porMetodo[metodo] = (porMetodo[metodo] || 0) + parseFloat(p.monto || 0);
    });
    
    (ventas || []).forEach(v => {
      const metodo = v.metodo_pago || 'Efectivo';
      porMetodo[metodo] = (porMetodo[metodo] || 0) + parseFloat(v.total || 0);
    });
    
    // Sumar créditos pagados hoy como ingreso (generalmente en efectivo)
    const totalCreditosPagados = sumarMontos(creditosPagados, 'monto');
    porMetodo['Efectivo'] += totalCreditosPagados;

    // 2. Totales desde movimientos_financieros (para egresos y balance general)
    const ingresosHoy = (movimientos || [])
      .filter(m => m.tipo === 'ingreso')
      .reduce((s, m) => s + parseFloat(m.monto || 0), 0);
      
    const egresosHoy = (movimientos || [])
      .filter(m => m.tipo === 'egreso')
      .reduce((s, m) => s + parseFloat(m.monto || 0), 0);
    
    // También considerar egresos que no estén en movimientos_financieros (poco probable)
    const netoHoy = ingresosHoy - egresosHoy;

    // 3. Desglose de egresos por categoría
    const egresosPorCat = {};
    (movimientos || []).filter(m => m.tipo === 'egreso').forEach(m => {
      const cat = m.categorias_financieras?.nombre || 'Otros';
      egresosPorCat[cat] = (egresosPorCat[cat] || 0) + parseFloat(m.monto || 0);
    });

    // 4. Efectivo en caja = (Efectivo cobrado) - (Total egresos del día)
    const efectivoCobrado = porMetodo['Efectivo'] || 0;
    const efectivoEnCaja = efectivoCobrado - egresosHoy;

    // Renderizar modal
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

      <button class="btn-secondary" style="margin-top:1rem" onclick="closeModal()">Cerrar</button>
    `);
  }, null, 'Error al cargar el cierre de caja');
}
