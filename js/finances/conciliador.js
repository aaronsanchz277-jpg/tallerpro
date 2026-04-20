// ─── CONCILIADOR FINANCIERO ──────────────────────────────────────────────────
// Verifica y repara discrepancias entre fuentes de ingresos/egresos y movimientos_financieros

/**
 * Verifica los ingresos de una fecha y detecta movimientos faltantes.
 * @param {string} fecha - Fecha en formato YYYY-MM-DD (opcional, por defecto hoy)
 * @returns {Promise<Object>} Resultado de la verificación
 */
async function conciliador_verificarIngresos(fecha = null) {
  if (!tid()) return { ok: false, error: 'No hay taller activo' };

  const fechaStr = fecha || new Date().toISOString().split('T')[0];
  const inicio = fechaStr + 'T00:00:00';
  const fin = fechaStr + 'T23:59:59';

  // 1. Obtener todos los movimientos financieros del día (ingresos)
  const { data: movs } = await sb
    .from('movimientos_financieros')
    .select('*')
    .eq('taller_id', tid())
    .eq('tipo', 'ingreso')
    .gte('fecha', fechaStr)
    .lte('fecha', fechaStr);

  // 2. Obtener ventas completadas del día
  const { data: ventas } = await sb
    .from('ventas')
    .select('id,total,created_at,metodo_pago')
    .eq('taller_id', tid())
    .eq('estado', 'completado')
    .gte('created_at', inicio)
    .lte('created_at', fin);

  // 3. Obtener pagos de reparaciones del día (excepto método "Crédito")
  const { data: pagosRep } = await sb
    .from('pagos_reparacion')
    .select('id,monto,fecha,metodo')
    .eq('taller_id', tid())
    .gte('fecha', fechaStr)
    .lte('fecha', fechaStr);

  // 4. Obtener créditos pagados hoy
  const { data: creditosPag } = await sb
    .from('fiados')
    .select('id,monto,fecha_pago')
    .eq('taller_id', tid())
    .eq('pagado', true)
    .gte('fecha_pago', fechaStr)
    .lte('fecha_pago', fechaStr);

  const pendientes = [];

  // Verificar ventas
  for (const venta of ventas || []) {
    const existe = movs?.find(m =>
      m.referencia_id === venta.id && m.referencia_tabla === 'ventas'
    );
    if (!existe) {
      pendientes.push({
        tipo: 'venta',
        id: venta.id,
        monto: venta.total,
        fecha: venta.created_at?.split('T')[0] || fechaStr,
        metodo: venta.metodo_pago || 'Efectivo'
      });
    }
  }

  // Verificar pagos de reparación (excepto los de tipo 'Crédito')
  for (const pago of pagosRep || []) {
    if (pago.metodo === 'Crédito') continue;
    const existe = movs?.find(m =>
      m.referencia_id === pago.id && m.referencia_tabla === 'pagos_reparacion'
    );
    if (!existe) {
      pendientes.push({
        tipo: 'pago_reparacion',
        id: pago.id,
        monto: pago.monto,
        fecha: pago.fecha,
        metodo: pago.metodo || 'Efectivo'
      });
    }
  }

  // Verificar créditos pagados
  for (const cred of creditosPag || []) {
    const existe = movs?.find(m =>
      m.referencia_id === cred.id && m.referencia_tabla === 'fiados'
    );
    if (!existe) {
      pendientes.push({
        tipo: 'fiado',
        id: cred.id,
        monto: cred.monto,
        fecha: cred.fecha_pago,
        metodo: 'Efectivo'
      });
    }
  }

  return {
    ok: true,
    fecha: fechaStr,
    totalVentas: ventas?.length || 0,
    totalPagosRep: pagosRep?.length || 0,
    totalCreditos: creditosPag?.length || 0,
    movimientosExistentes: movs?.length || 0,
    pendientes: pendientes
  };
}

/**
 * Repara (crea) los movimientos financieros pendientes de ingresos.
 * @param {Array} pendientes - Lista de pendientes devuelta por conciliador_verificarIngresos
 * @returns {Promise<Object>} Resultado de la reparación
 */
async function conciliador_repararIngresosPendientes(pendientes) {
  if (!pendientes || pendientes.length === 0) return { reparados: 0, errores: [] };

  let reparados = 0;
  const errores = [];
  const categoriaIngresoId = await obtenerCategoriaFinanciera('Servicios', 'ingreso');

  if (!categoriaIngresoId) {
    return { reparados: 0, errores: ['No se pudo obtener/crear categoría financiera "Servicios"'] };
  }

  for (const p of pendientes) {
    try {
      let referenciaTabla = '';
      let descripcion = '';

      if (p.tipo === 'venta') {
        referenciaTabla = 'ventas';
        descripcion = `Venta POS (${p.metodo || 'efectivo'})`;
      } else if (p.tipo === 'pago_reparacion') {
        referenciaTabla = 'pagos_reparacion';
        descripcion = `Pago de reparación (${p.metodo || 'efectivo'})`;
      } else if (p.tipo === 'fiado') {
        referenciaTabla = 'fiados';
        descripcion = `Cobro de crédito`;
      } else {
        continue;
      }

      // Verificar si ya existe (doble check por seguridad)
      const { data: existe } = await sb
        .from('movimientos_financieros')
        .select('id')
        .eq('taller_id', tid())
        .eq('referencia_id', p.id)
        .eq('referencia_tabla', referenciaTabla)
        .maybeSingle();

      if (!existe) {
        await sb.from('movimientos_financieros').insert({
          taller_id: tid(),
          tipo: 'ingreso',
          categoria_id: categoriaIngresoId,
          monto: p.monto,
          descripcion: descripcion,
          fecha: p.fecha,
          referencia_id: p.id,
          referencia_tabla: referenciaTabla
        });
        reparados++;
      }
    } catch (e) {
      console.warn('Error reparando ingreso pendiente:', p, e);
      errores.push(`Error en ${p.tipo} ID ${p.id}: ${e.message}`);
    }
  }

  clearCache('finanzas');
  return { reparados, errores };
}

/**
 * Verifica los egresos de una fecha y detecta movimientos faltantes.
 * @param {string} fecha - Fecha en formato YYYY-MM-DD (opcional, por defecto hoy)
 * @returns {Promise<Object>} Resultado de la verificación
 */
async function conciliador_verificarEgresos(fecha = null) {
  if (!tid()) return { ok: false, error: 'No hay taller activo' };

  const fechaStr = fecha || new Date().toISOString().split('T')[0];

  // Gastos del día
  const { data: gastos } = await sb
    .from('gastos_taller')
    .select('id,monto,fecha')
    .eq('taller_id', tid())
    .gte('fecha', fechaStr)
    .lte('fecha', fechaStr);

  // Movimientos financieros de egreso del día
  const { data: movs } = await sb
    .from('movimientos_financieros')
    .select('*')
    .eq('taller_id', tid())
    .eq('tipo', 'egreso')
    .gte('fecha', fechaStr)
    .lte('fecha', fechaStr);

  const pendientes = [];

  for (const gasto of gastos || []) {
    const existe = movs?.find(m =>
      m.referencia_id === gasto.id && m.referencia_tabla === 'gastos_taller'
    );
    if (!existe) {
      pendientes.push({
        tipo: 'gasto',
        id: gasto.id,
        monto: gasto.monto,
        fecha: gasto.fecha
      });
    }
  }

  // También verificar cuentas pagadas (proveedores)
  const { data: cuentasPagadas } = await sb
    .from('cuentas_pagar')
    .select('id,monto,fecha_pago,proveedor')
    .eq('taller_id', tid())
    .eq('pagada', true)
    .gte('fecha_pago', fechaStr)
    .lte('fecha_pago', fechaStr);

  for (const cuenta of cuentasPagadas || []) {
    const existe = movs?.find(m =>
      m.referencia_id === cuenta.id && m.referencia_tabla === 'cuentas_pagar'
    );
    if (!existe) {
      pendientes.push({
        tipo: 'cuenta_pagar',
        id: cuenta.id,
        monto: cuenta.monto,
        fecha: cuenta.fecha_pago,
        proveedor: cuenta.proveedor
      });
    }
  }

  return {
    ok: true,
    fecha: fechaStr,
    totalGastos: gastos?.length || 0,
    totalCuentasPagadas: cuentasPagadas?.length || 0,
    movimientosExistentes: movs?.length || 0,
    pendientes: pendientes
  };
}

/**
 * Repara (crea) los movimientos financieros pendientes de egresos.
 * @param {Array} pendientes - Lista de pendientes devuelta por conciliador_verificarEgresos
 * @returns {Promise<Object>} Resultado de la reparación
 */
async function conciliador_repararEgresosPendientes(pendientes) {
  if (!pendientes || pendientes.length === 0) return { reparados: 0, errores: [] };

  let reparados = 0;
  const errores = [];
  const categoriaEgresoId = await obtenerCategoriaFinanciera('Gastos generales', 'egreso');
  const categoriaRepuestosId = await obtenerCategoriaFinanciera('Repuestos', 'egreso');

  if (!categoriaEgresoId) {
    return { reparados: 0, errores: ['No se pudo obtener/crear categoría financiera "Gastos generales"'] };
  }

  for (const p of pendientes) {
    try {
      let categoriaId = categoriaEgresoId;
      let descripcion = '';
      let referenciaTabla = '';

      if (p.tipo === 'gasto') {
        referenciaTabla = 'gastos_taller';
        const { data: gasto } = await sb
          .from('gastos_taller')
          .select('descripcion,categoria')
          .eq('id', p.id)
          .single();
        descripcion = gasto?.descripcion || 'Gasto';
        if (gasto?.categoria === 'Repuestos' && categoriaRepuestosId) {
          categoriaId = categoriaRepuestosId;
        }
      } else if (p.tipo === 'cuenta_pagar') {
        referenciaTabla = 'cuentas_pagar';
        descripcion = `Pago proveedor: ${p.proveedor || 'Proveedor'}`;
        if (categoriaRepuestosId) {
          categoriaId = categoriaRepuestosId;
        }
      } else {
        continue;
      }

      // Verificar si ya existe
      const { data: existe } = await sb
        .from('movimientos_financieros')
        .select('id')
        .eq('taller_id', tid())
        .eq('referencia_id', p.id)
        .eq('referencia_tabla', referenciaTabla)
        .maybeSingle();

      if (!existe) {
        await sb.from('movimientos_financieros').insert({
          taller_id: tid(),
          tipo: 'egreso',
          categoria_id: categoriaId,
          monto: p.monto,
          descripcion: descripcion,
          fecha: p.fecha,
          referencia_id: p.id,
          referencia_tabla: referenciaTabla
        });
        reparados++;
      }
    } catch (e) {
      console.warn('Error reparando egreso pendiente:', p, e);
      errores.push(`Error en ${p.tipo} ID ${p.id}: ${e.message}`);
    }
  }

  clearCache('finanzas');
  return { reparados, errores };
}

/**
 * Ejecuta una conciliación completa (ingresos y egresos) para una fecha.
 * @param {string} fecha - Fecha en formato YYYY-MM-DD (opcional)
 * @returns {Promise<Object>} Resumen de la conciliación
 */
async function conciliador_ejecutarCompleto(fecha = null) {
  const fechaStr = fecha || new Date().toISOString().split('T')[0];

  const ingresoVer = await conciliador_verificarIngresos(fechaStr);
  const egresoVer = await conciliador_verificarEgresos(fechaStr);

  let ingresosReparados = 0;
  let egresosReparados = 0;
  let errores = [];

  if (ingresoVer.ok && ingresoVer.pendientes.length > 0) {
    const res = await conciliador_repararIngresosPendientes(ingresoVer.pendientes);
    ingresosReparados = res.reparados;
    errores = errores.concat(res.errores);
  }

  if (egresoVer.ok && egresoVer.pendientes.length > 0) {
    const res = await conciliador_repararEgresosPendientes(egresoVer.pendientes);
    egresosReparados = res.reparados;
    errores = errores.concat(res.errores);
  }

  return {
    ok: true,
    fecha: fechaStr,
    ingresos: {
      pendientesDetectados: ingresoVer.pendientes?.length || 0,
      reparados: ingresosReparados
    },
    egresos: {
      pendientesDetectados: egresoVer.pendientes?.length || 0,
      reparados: egresosReparados
    },
    errores
  };
}

/**
 * Muestra un modal con el resultado de la conciliación de una fecha.
 * @param {string} fecha - Fecha a conciliar (opcional)
 */
async function conciliador_modalConciliacion(fecha = null) {
  const fechaStr = fecha || fechaHoy();

  openModal(`
    <div class="modal-title">🔍 Conciliación financiera</div>
    <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1rem">
      <label style="font-size:.8rem;color:var(--text2)">Fecha:</label>
      <input type="date" id="conc-fecha" value="${fechaStr}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:.4rem;color:var(--text);font-size:.8rem;flex:1">
      <button onclick="conciliador_modalConciliacion(document.getElementById('conc-fecha').value)" style="background:var(--accent);color:#000;border:none;border-radius:6px;padding:.4rem .8rem;font-size:.8rem;cursor:pointer;font-family:var(--font-head)">Verificar</button>
    </div>
    <div id="conc-resultado">
      <div style="text-align:center;padding:1rem;color:var(--text2)">Verificando datos del ${formatFecha(fechaStr)}...</div>
    </div>
    <button class="btn-secondary" style="margin-top:1rem" onclick="closeModal()">Cerrar</button>
  `);

  await conciliador_cargarResultadoModal(fechaStr);
}

async function conciliador_cargarResultadoModal(fecha) {
  const contenedor = document.getElementById('conc-resultado');
  if (!contenedor) return;

  contenedor.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--text2)">Analizando datos...</div>`;

  try {
    const ingresoVer = await conciliador_verificarIngresos(fecha);
    const egresoVer = await conciliador_verificarEgresos(fecha);

    let html = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
        <div style="background:rgba(0,255,136,.06);border-radius:10px;padding:.6rem;text-align:center">
          <div style="font-size:.6rem;color:var(--success)">INGRESOS REGISTRADOS</div>
          <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--success)">${ingresoVer.movimientosExistentes}</div>
          <div style="font-size:.6rem;color:var(--text2)">${ingresoVer.totalVentas} ventas, ${ingresoVer.totalPagosRep} pagos, ${ingresoVer.totalCreditos} créditos</div>
        </div>
        <div style="background:rgba(255,68,68,.06);border-radius:10px;padding:.6rem;text-align:center">
          <div style="font-size:.6rem;color:var(--danger)">EGRESOS REGISTRADOS</div>
          <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--danger)">${egresoVer.movimientosExistentes}</div>
          <div style="font-size:.6rem;color:var(--text2)">${egresoVer.totalGastos} gastos, ${egresoVer.totalCuentasPagadas} ctas pagadas</div>
        </div>
      </div>
    `;

    const totalPendientes = (ingresoVer.pendientes?.length || 0) + (egresoVer.pendientes?.length || 0);

    if (totalPendientes === 0) {
      html += `<div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:10px;padding:.75rem;text-align:center;color:var(--success)">✅ Todo está conciliado correctamente.</div>`;
    } else {
      html += `<div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.2);border-radius:10px;padding:.75rem;margin-bottom:1rem">
        <div style="color:var(--warning);font-family:var(--font-head);margin-bottom:.5rem">⚠️ Se encontraron ${totalPendientes} movimientos pendientes de registrar</div>`;

      if (ingresoVer.pendientes?.length > 0) {
        html += `<div style="font-size:.75rem;color:var(--text2);margin-top:.5rem"><strong>Ingresos pendientes:</strong></div>`;
        ingresoVer.pendientes.slice(0, 3).forEach(p => {
          html += `<div style="font-size:.7rem;color:var(--success)">• ${p.tipo}: ₲${gs(p.monto)}</div>`;
        });
        if (ingresoVer.pendientes.length > 3) {
          html += `<div style="font-size:.7rem;color:var(--text2)">...y ${ingresoVer.pendientes.length - 3} más</div>`;
        }
      }

      if (egresoVer.pendientes?.length > 0) {
        html += `<div style="font-size:.75rem;color:var(--text2);margin-top:.5rem"><strong>Egresos pendientes:</strong></div>`;
        egresoVer.pendientes.slice(0, 3).forEach(p => {
          html += `<div style="font-size:.7rem;color:var(--danger)">• ${p.tipo}: ₲${gs(p.monto)}</div>`;
        });
        if (egresoVer.pendientes.length > 3) {
          html += `<div style="font-size:.7rem;color:var(--text2)">...y ${egresoVer.pendientes.length - 3} más</div>`;
        }
      }

      html += `</div>`;
      html += `<button class="btn-primary" onclick="conciliador_repararDesdeModal('${fecha}')">🔧 Reparar movimientos pendientes</button>`;
    }

    contenedor.innerHTML = html;
  } catch (error) {
    contenedor.innerHTML = `<div style="color:var(--danger);text-align:center;padding:1rem">Error al conciliar: ${error.message}</div>`;
  }
}

async function conciliador_repararDesdeModal(fecha) {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Reparando...';

  const resultado = await conciliador_ejecutarCompleto(fecha);

  if (resultado.ok) {
    toast(`✅ Conciliación completada. Ingresos reparados: ${resultado.ingresos.reparados}, Egresos: ${resultado.egresos.reparados}`, 'success');
    await conciliador_cargarResultadoModal(fecha);
  } else {
    toast('Error en la conciliación', 'error');
  }

  btn.disabled = false;
  btn.textContent = '🔧 Reparar movimientos pendientes';
}
