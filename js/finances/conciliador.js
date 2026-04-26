// ─── CONCILIADOR FINANCIERO ──────────────────────────────────────────────────
async function conciliador_verificarIngresos(fecha = null) {
  if (!tid()) return { ok: false, error: 'No hay taller activo' };
  const fechaStr = fecha || new Date().toISOString().split('T')[0];
  const inicio = fechaStr + 'T00:00:00';
  const fin = fechaStr + 'T23:59:59';

  const { data: movs } = await sb.from('movimientos_financieros').select('*').eq('taller_id', tid()).eq('tipo', 'ingreso').gte('fecha', fechaStr).lte('fecha', fechaStr);
  const { data: ventas } = await sb.from('ventas').select('id,total,created_at,metodo_pago').eq('taller_id', tid()).eq('estado', 'completado').gte('created_at', inicio).lte('created_at', fin);
  const { data: pagosRep } = await sb.from('pagos_reparacion').select('id,monto,fecha,metodo').eq('taller_id', tid()).gte('fecha', fechaStr).lte('fecha', fechaStr);
  const { data: creditosPag } = await sb.from('fiados').select('id,monto,fecha_pago').eq('taller_id', tid()).eq('pagado', true).gte('fecha_pago', fechaStr).lte('fecha_pago', fechaStr);

  const pendientes = [];
  for (const venta of ventas || []) {
    if (!movs?.find(m => m.referencia_id === venta.id && m.referencia_tabla === 'ventas')) {
      pendientes.push({ tipo: 'venta', id: venta.id, monto: venta.total, fecha: venta.created_at?.split('T')[0] || fechaStr, metodo: venta.metodo_pago || 'Efectivo' });
    }
  }
  for (const pago of pagosRep || []) {
    if (pago.metodo === 'Crédito') continue;
    if (!movs?.find(m => m.referencia_id === pago.id && m.referencia_tabla === 'pagos_reparacion')) {
      pendientes.push({ tipo: 'pago_reparacion', id: pago.id, monto: pago.monto, fecha: pago.fecha, metodo: pago.metodo || 'Efectivo' });
    }
  }
  for (const cred of creditosPag || []) {
    if (!movs?.find(m => m.referencia_id === cred.id && m.referencia_tabla === 'fiados')) {
      pendientes.push({ tipo: 'fiado', id: cred.id, monto: cred.monto, fecha: cred.fecha_pago, metodo: 'Efectivo' });
    }
  }
  return { ok: true, fecha: fechaStr, totalVentas: ventas?.length || 0, totalPagosRep: pagosRep?.length || 0, totalCreditos: creditosPag?.length || 0, movimientosExistentes: movs?.length || 0, pendientes };
}

async function conciliador_repararIngresosPendientes(pendientes) {
  if (!pendientes?.length) return { reparados: 0, errores: [] };
  let reparados = 0;
  const errores = [];
  const categoriaIngresoId = await obtenerCategoriaFinanciera('Servicios', 'ingreso');
  if (!categoriaIngresoId) return { reparados: 0, errores: ['No se pudo obtener/crear categoría "Servicios"'] };

  for (const p of pendientes) {
    try {
      let refTabla = p.tipo === 'venta' ? 'ventas' : p.tipo === 'pago_reparacion' ? 'pagos_reparacion' : 'fiados';
      let concepto = p.tipo === 'venta' ? `Venta POS (${p.metodo})` : p.tipo === 'pago_reparacion' ? `Pago de reparación (${p.metodo})` : 'Cobro de crédito';
      const { data: existe } = await sb.from('movimientos_financieros').select('id').eq('taller_id', tid()).eq('referencia_id', p.id).eq('referencia_tabla', refTabla).maybeSingle();
      if (!existe) {
        await sb.from('movimientos_financieros').insert({ taller_id: tid(), tipo: 'ingreso', categoria_id: categoriaIngresoId, monto: p.monto, concepto, fecha: p.fecha, referencia_id: p.id, referencia_tabla: refTabla });
        reparados++;
      }
    } catch (e) { errores.push(`Error en ${p.tipo} ID ${p.id}: ${e.message}`); }
  }
  clearCache('finanzas');
  return { reparados, errores };
}

async function conciliador_verificarEgresos(fecha = null) {
  if (!tid()) return { ok: false, error: 'No hay taller activo' };
  const fechaStr = fecha || new Date().toISOString().split('T')[0];
  const { data: gastos } = await sb.from('gastos_taller').select('id,monto,fecha').eq('taller_id', tid()).gte('fecha', fechaStr).lte('fecha', fechaStr);
  const { data: movs } = await sb.from('movimientos_financieros').select('*').eq('taller_id', tid()).eq('tipo', 'egreso').gte('fecha', fechaStr).lte('fecha', fechaStr);
  const { data: cuentasPagadas } = await sb.from('cuentas_pagar').select('id,monto,fecha_pago,proveedor').eq('taller_id', tid()).eq('pagada', true).gte('fecha_pago', fechaStr).lte('fecha_pago', fechaStr);
  const pendientes = [];
  for (const gasto of gastos || []) {
    if (!movs?.find(m => m.referencia_id === gasto.id && m.referencia_tabla === 'gastos_taller')) {
      pendientes.push({ tipo: 'gasto', id: gasto.id, monto: gasto.monto, fecha: gasto.fecha });
    }
  }
  for (const cuenta of cuentasPagadas || []) {
    if (!movs?.find(m => m.referencia_id === cuenta.id && m.referencia_tabla === 'cuentas_pagar')) {
      pendientes.push({ tipo: 'cuenta_pagar', id: cuenta.id, monto: cuenta.monto, fecha: cuenta.fecha_pago, proveedor: cuenta.proveedor });
    }
  }
  return { ok: true, fecha: fechaStr, totalGastos: gastos?.length || 0, totalCuentasPagadas: cuentasPagadas?.length || 0, movimientosExistentes: movs?.length || 0, pendientes };
}

async function conciliador_repararEgresosPendientes(pendientes) {
  if (!pendientes?.length) return { reparados: 0, errores: [] };
  let reparados = 0;
  const errores = [];
  const categoriaEgresoId = await obtenerCategoriaFinanciera('Gastos generales', 'egreso');
  const categoriaRepuestosId = await obtenerCategoriaFinanciera('Repuestos', 'egreso');
  if (!categoriaEgresoId) return { reparados: 0, errores: ['No se pudo obtener/crear categoría "Gastos generales"'] };

  for (const p of pendientes) {
    try {
      let categoriaId = categoriaEgresoId;
      let concepto = '';
      let refTabla = '';
      if (p.tipo === 'gasto') {
        refTabla = 'gastos_taller';
        const { data: gasto } = await sb.from('gastos_taller').select('descripcion,categoria').eq('id', p.id).single();
        concepto = gasto?.descripcion || 'Gasto';
        if (gasto?.categoria === 'Repuestos' && categoriaRepuestosId) categoriaId = categoriaRepuestosId;
      } else if (p.tipo === 'cuenta_pagar') {
        refTabla = 'cuentas_pagar';
        concepto = `Pago proveedor: ${p.proveedor || 'Proveedor'}`;
        if (categoriaRepuestosId) categoriaId = categoriaRepuestosId;
      } else continue;

      const { data: existe } = await sb.from('movimientos_financieros').select('id').eq('taller_id', tid()).eq('referencia_id', p.id).eq('referencia_tabla', refTabla).maybeSingle();
      if (!existe) {
        await sb.from('movimientos_financieros').insert({ taller_id: tid(), tipo: 'egreso', categoria_id: categoriaId, monto: p.monto, concepto, fecha: p.fecha, referencia_id: p.id, referencia_tabla: refTabla });
        reparados++;
      }
    } catch (e) { errores.push(`Error en ${p.tipo} ID ${p.id}: ${e.message}`); }
  }
  clearCache('finanzas');
  return { reparados, errores };
}

async function conciliador_ejecutarCompleto(fecha = null) {
  const fechaStr = fecha || new Date().toISOString().split('T')[0];
  const ingresoVer = await conciliador_verificarIngresos(fechaStr);
  const egresoVer = await conciliador_verificarEgresos(fechaStr);
  let ingresosReparados = 0, egresosReparados = 0, errores = [];
  if (ingresoVer.ok && ingresoVer.pendientes.length) { const res = await conciliador_repararIngresosPendientes(ingresoVer.pendientes); ingresosReparados = res.reparados; errores.push(...res.errores); }
  if (egresoVer.ok && egresoVer.pendientes.length) { const res = await conciliador_repararEgresosPendientes(egresoVer.pendientes); egresosReparados = res.reparados; errores.push(...res.errores); }
  return { ok: true, fecha: fechaStr, ingresos: { pendientesDetectados: ingresoVer.pendientes?.length || 0, reparados: ingresosReparados }, egresos: { pendientesDetectados: egresoVer.pendientes?.length || 0, reparados: egresosReparados }, errores };
}

async function conciliador_modalConciliacion(fecha = null) {
  const fechaStr = fecha || fechaHoy();
  openModal(`<div class="modal-title">🔍 Conciliación financiera</div><div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1rem"><label style="font-size:.8rem;color:var(--text2)">Fecha:</label><input type="date" id="conc-fecha" value="${fechaStr}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:.4rem;color:var(--text);font-size:.8rem;flex:1"><button onclick="conciliador_modalConciliacion(document.getElementById('conc-fecha').value)" style="background:var(--accent);color:#000;border:none;border-radius:6px;padding:.4rem .8rem;font-size:.8rem;cursor:pointer;font-family:var(--font-head)">Verificar</button></div><div id="conc-resultado"><div style="text-align:center;padding:1rem;color:var(--text2)">Verificando datos del ${formatFecha(fechaStr)}...</div></div><button class="btn-secondary" style="margin-top:1rem" onclick="closeModal()">Cerrar</button>`);
  await conciliador_cargarResultadoModal(fechaStr);
}

async function conciliador_cargarResultadoModal(fecha) {
  const contenedor = document.getElementById('conc-resultado');
  if (!contenedor) return;
  contenedor.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--text2)">Analizando datos...</div>`;
  try {
    const ingresoVer = await conciliador_verificarIngresos(fecha);
    const egresoVer = await conciliador_verificarEgresos(fecha);
    let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem"><div style="background:rgba(0,255,136,.06);border-radius:10px;padding:.6rem;text-align:center"><div style="font-size:.6rem;color:var(--success)">INGRESOS REGISTRADOS</div><div style="font-family:var(--font-head);font-size:1.2rem;color:var(--success)">${ingresoVer.movimientosExistentes}</div><div style="font-size:.6rem;color:var(--text2)">${ingresoVer.totalVentas} ventas, ${ingresoVer.totalPagosRep} pagos, ${ingresoVer.totalCreditos} créditos</div></div><div style="background:rgba(255,68,68,.06);border-radius:10px;padding:.6rem;text-align:center"><div style="font-size:.6rem;color:var(--danger)">EGRESOS REGISTRADOS</div><div style="font-family:var(--font-head);font-size:1.2rem;color:var(--danger)">${egresoVer.movimientosExistentes}</div><div style="font-size:.6rem;color:var(--text2)">${egresoVer.totalGastos} gastos, ${egresoVer.totalCuentasPagadas} ctas pagadas</div></div></div>`;
    const totalPendientes = (ingresoVer.pendientes?.length || 0) + (egresoVer.pendientes?.length || 0);
    if (totalPendientes === 0) html += `<div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:10px;padding:.75rem;text-align:center;color:var(--success)">✅ Todo está conciliado correctamente.</div>`;
    else {
      html += `<div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.2);border-radius:10px;padding:.75rem;margin-bottom:1rem"><div style="color:var(--warning);font-family:var(--font-head);margin-bottom:.5rem">⚠️ Se encontraron ${totalPendientes} movimientos pendientes</div>`;
      if (ingresoVer.pendientes?.length) { html += `<div style="font-size:.75rem;color:var(--text2);margin-top:.5rem"><strong>Ingresos pendientes:</strong></div>`; ingresoVer.pendientes.slice(0,3).forEach(p => html += `<div style="font-size:.7rem;color:var(--success)">• ${p.tipo}: ${fm(p.monto)}</div>`); if (ingresoVer.pendientes.length > 3) html += `<div style="font-size:.7rem;color:var(--text2)">...y ${ingresoVer.pendientes.length - 3} más</div>`; }
      if (egresoVer.pendientes?.length) { html += `<div style="font-size:.75rem;color:var(--text2);margin-top:.5rem"><strong>Egresos pendientes:</strong></div>`; egresoVer.pendientes.slice(0,3).forEach(p => html += `<div style="font-size:.7rem;color:var(--danger)">• ${p.tipo}: ${fm(p.monto)}</div>`); if (egresoVer.pendientes.length > 3) html += `<div style="font-size:.7rem;color:var(--text2)">...y ${egresoVer.pendientes.length - 3} más</div>`; }
      html += `</div><button class="btn-primary" onclick="conciliador_repararDesdeModal('${fecha}')">🔧 Reparar movimientos pendientes</button>`;
    }
    contenedor.innerHTML = html;
  } catch (error) { contenedor.innerHTML = `<div style="color:var(--danger);text-align:center;padding:1rem">Error al conciliar: ${error.message}</div>`; }
}

async function conciliador_repararDesdeModal(fecha) {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Reparando...';
  const resultado = await conciliador_ejecutarCompleto(fecha);
  if (resultado.ok) { toast(`✅ Conciliación completada. Ingresos reparados: ${resultado.ingresos.reparados}, Egresos: ${resultado.egresos.reparados}`, 'success'); await conciliador_cargarResultadoModal(fecha); }
  else toast('Error en la conciliación', 'error');
  btn.disabled = false;
  btn.textContent = '🔧 Reparar movimientos pendientes';
}
