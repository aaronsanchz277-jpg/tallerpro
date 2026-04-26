// ─── CENTRO DE COBROS UNIFICADO ────────────────────────────────────────────
// Vista única para que al admin/empleado no se le pierda ningún pago.
//   • porCobrar(): lo que te DEBEN  (reparaciones con saldo + fiados pendientes
//     + total cobrado del día).
//   • porPagar():  lo que VOS DEBÉS (cuentas a proveedores + sueldos
//     pendientes + total pagado del día).
// Cada fila tiene un botón "Cobrar" / "Pagar" que dispara los flujos
// existentes (modalPagosReparacion, marcarPagado, etc.) y vuelve a esta
// pantalla en lugar de saltar al detalle, así el usuario sigue trabajando
// la lista sin perderse.

function _pcPuedeCobrar() {
  if (typeof esAdmin === 'function' && esAdmin()) return true;
  if (typeof esEmpleado === 'function' && esEmpleado()
      && typeof tienePerm === 'function' && tienePerm('registrar_cobros')) return true;
  return false;
}

// Guards anti-doble-click para que un click acelerado no inserte dos
// egresos al pagar una cuenta o un sueldo (los triggers de Supabase ya
// validan transiciones, pero esto evita el round-trip y el toast doble).
let _pcPagandoCuenta = false;
let _pcPagandoSueldo = false;

function _pcRenderError(titulo, msg) {
  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${titulo}</div>
      <button class="btn-add" onclick="${titulo.includes('cobrar')?'porCobrar()':'porPagar()'}">↻ Reintentar</button>
    </div>
    <div style="background:rgba(255,68,68,.08);border:1px solid var(--danger);border-radius:12px;padding:1rem;color:var(--danger)">
      <div style="font-family:var(--font-head);margin-bottom:.4rem">No se pudo cargar todo</div>
      <div style="font-size:.8rem;color:var(--text2)">${h(msg || 'Error de conexión')}</div>
      <div style="font-size:.75rem;color:var(--text2);margin-top:.5rem">Para no mostrarte cifras incompletas, esperá que cargue de nuevo. Tocá "Reintentar".</div>
    </div>`;
}

function _pcDiasDesde(fechaStr) {
  if (!fechaStr) return null;
  const f = new Date(fechaStr);
  if (isNaN(f.getTime())) return null;
  const hoy = new Date();
  return Math.max(0, Math.floor((hoy - f) / 86400000));
}

function _pcColorDias(dias) {
  if (dias == null) return 'var(--text2)';
  if (dias >= 30) return 'var(--danger)';
  if (dias >= 7) return 'var(--warning)';
  return 'var(--text2)';
}

// ─── POR COBRAR ────────────────────────────────────────────────────────────
async function porCobrar() {
  if (!_pcPuedeCobrar()) {
    toast('No tenés permisos para registrar cobros', 'error');
    if (typeof navigate === 'function') navigate('dashboard');
    return;
  }

  const tallerId = tid();
  const hoy = new Date().toISOString().split('T')[0];

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">💰 Por cobrar</div>
    </div>
    <div style="text-align:center;padding:2rem;color:var(--text2)">Cargando…</div>`;

  // Trae todo en paralelo: reparaciones activas, sus pagos, fiados pendientes
  // y los movimientos financieros del día (para sumar lo cobrado hoy).
  // Límites altos (1000/500) para no truncar talleres grandes; si alguno
  // se llena, mostramos un aviso "puede haber más" en lugar de mentir.
  const REP_LIMIT = 1000;
  const FIADO_LIMIT = 500;
  const [repsRes, fiadosRes, movHoyRes] = await Promise.all([
    sb.from('reparaciones')
      .select('id,descripcion,costo,fecha,estado,vehiculos(patente,marca),clientes(nombre)')
      .eq('taller_id', tallerId)
      .neq('estado', 'cancelado')
      .gt('costo', 0)
      .order('fecha', { ascending: true })
      .limit(REP_LIMIT),
    sb.from('fiados')
      .select('id,monto,descripcion,fecha,created_at,clientes(nombre)')
      .eq('taller_id', tallerId)
      .eq('pagado', false)
      .order('created_at', { ascending: true })
      .limit(FIADO_LIMIT),
    sb.from('movimientos_financieros')
      .select('monto,tipo')
      .eq('taller_id', tallerId)
      .eq('tipo', 'ingreso')
      .eq('fecha', hoy),
  ]);

  // Si CUALQUIERA falla, preferimos mostrar error explícito antes que
  // pintar "Te deben ₲0" cuando en realidad faltaron datos.
  if (repsRes.error || fiadosRes.error || movHoyRes.error) {
    const errMsg = (repsRes.error || fiadosRes.error || movHoyRes.error)?.message || '';
    _pcRenderError('💰 Por cobrar', errMsg);
    return;
  }

  const reps = repsRes.data || [];
  const fiados = fiadosRes.data || [];
  const movHoy = movHoyRes.data || [];
  const repsTruncado = reps.length >= REP_LIMIT;
  const fiadosTruncado = fiados.length >= FIADO_LIMIT;

  // Pagos por reparación
  const repIds = reps.map(r => r.id);
  let pagosByRep = {};
  let pagosError = null;
  if (repIds.length) {
    const pagosRes = await sb.from('pagos_reparacion')
      .select('reparacion_id,monto')
      .in('reparacion_id', repIds);
    if (pagosRes.error) {
      pagosError = pagosRes.error.message;
    } else {
      (pagosRes.data || []).forEach(p => {
        pagosByRep[p.reparacion_id] = (pagosByRep[p.reparacion_id] || 0) + parseFloat(p.monto || 0);
      });
    }
  }
  if (pagosError) {
    _pcRenderError('💰 Por cobrar', pagosError);
    return;
  }

  const repsPend = reps.map(r => {
    const pagado = pagosByRep[r.id] || 0;
    const saldo = parseFloat(r.costo || 0) - pagado;
    return { ...r, pagado, saldo, _dias: _pcDiasDesde(r.fecha) };
  }).filter(r => r.saldo > 0.01);

  const totalRepsPend = repsPend.reduce((s, r) => s + r.saldo, 0);
  const totalFiadosPend = fiados.reduce((s, f) => s + parseFloat(f.monto || 0), 0);
  const totalCobradoHoy = movHoy.reduce((s, m) => s + parseFloat(m.monto || 0), 0);
  const totalPendiente = totalRepsPend + totalFiadosPend;

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">💰 Por cobrar</div>
      <button class="btn-add" onclick="porCobrar()">↻ Refrescar</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
      <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.25);border-radius:12px;padding:.75rem;text-align:center">
        <div style="font-size:.65rem;color:var(--danger);letter-spacing:1px;font-family:var(--font-head)">TE DEBEN</div>
        <div style="font-family:var(--font-head);font-size:1.4rem;color:var(--danger);margin-top:.2rem">₲${gs(totalPendiente)}</div>
        <div style="font-size:.65rem;color:var(--text2);margin-top:.15rem">${repsPend.length} reparación(es) · ${fiados.length} fiado(s)</div>
      </div>
      <div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.25);border-radius:12px;padding:.75rem;text-align:center">
        <div style="font-size:.65rem;color:var(--success);letter-spacing:1px;font-family:var(--font-head)">HOY COBRASTE</div>
        <div style="font-family:var(--font-head);font-size:1.4rem;color:var(--success);margin-top:.2rem">₲${gs(totalCobradoHoy)}</div>
        <div style="font-size:.65rem;color:var(--text2);margin-top:.15rem">ingresos del día</div>
      </div>
    </div>

    ${(repsTruncado || fiadosTruncado) ? `
      <div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.3);border-radius:10px;padding:.55rem .75rem;margin-bottom:.75rem;font-size:.75rem;color:var(--warning)">
        ⚠ Mostrando los primeros ${repsTruncado?REP_LIMIT+' trabajos':''}${(repsTruncado&&fiadosTruncado)?' y ':''}${fiadosTruncado?FIADO_LIMIT+' fiados':''}. Puede haber más sin listar.
      </div>
    ` : ''}

    ${repsPend.length === 0 && fiados.length === 0 ? `
      <div class="empty"><p>🎉 No te debe nadie. Todo cobrado.</p></div>
    ` : ''}

    ${repsPend.length > 0 ? `
      <div style="font-size:.7rem;color:var(--text2);letter-spacing:1.5px;font-family:var(--font-head);margin:1rem 0 .5rem">
        REPARACIONES CON SALDO (${repsPend.length})
      </div>
      ${repsPend.map(r => {
        const cliente = r.clientes?.nombre || 'Sin cliente';
        const patente = r.vehiculos?.patente || '';
        const marca = r.vehiculos?.marca || '';
        const diasColor = _pcColorDias(r._dias);
        const diasTxt = r._dias != null ? `<span style="color:${diasColor};font-weight:600">⏱ ${r._dias}d</span>` : '';
        return `
        <div class="card" style="cursor:default">
          <div class="card-header">
            <div class="card-avatar" style="background:rgba(0,229,255,.08);color:var(--accent);font-family:var(--font-head);font-size:.75rem">${h(patente.slice(0,5)) || '🔧'}</div>
            <div class="card-info">
              <div class="card-name">${h(r.descripcion || 'Reparación')}</div>
              <div class="card-sub">${h(cliente)}${marca?' · '+h(marca):''}${r.fecha?' · '+formatFecha(r.fecha):''} · ${diasTxt}</div>
              <div class="card-sub">Total ₲${gs(r.costo)} · Pagado ₲${gs(r.pagado)}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <div style="font-family:var(--font-head);font-size:1rem;color:var(--danger)">₲${gs(r.saldo)}</div>
              <button onclick="porCobrar_cobrarReparacion('${r.id}')" style="font-size:.7rem;background:var(--success);color:#000;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:600">💰 Cobrar</button>
              <button onclick="detalleReparacion('${r.id}')" style="font-size:.65rem;background:none;color:var(--text2);border:none;cursor:pointer;padding:0">Ver detalle →</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    ` : ''}

    ${fiados.length > 0 ? `
      <div style="font-size:.7rem;color:var(--text2);letter-spacing:1.5px;font-family:var(--font-head);margin:1rem 0 .5rem">
        FIADOS PENDIENTES (${fiados.length})
      </div>
      ${fiados.map(f => {
        const cliente = f.clientes?.nombre || 'Sin cliente';
        const fecha = f.fecha || (f.created_at ? f.created_at.split('T')[0] : '');
        const dias = _pcDiasDesde(fecha);
        const diasColor = _pcColorDias(dias);
        const diasTxt = dias != null ? `<span style="color:${diasColor};font-weight:600">⏱ ${dias}d</span>` : '';
        return `
        <div class="card" style="cursor:default">
          <div class="card-header">
            <div class="card-avatar" style="background:rgba(255,204,0,.1);color:var(--warning)">📋</div>
            <div class="card-info">
              <div class="card-name">${h(cliente)}</div>
              <div class="card-sub">${h(f.descripcion || 'Sin descripción')}${fecha?' · '+formatFecha(fecha):''} · ${diasTxt}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <div style="font-family:var(--font-head);font-size:1rem;color:var(--danger)">₲${gs(f.monto)}</div>
              <button onclick="porCobrar_marcarFiadoPagado('${f.id}')" style="font-size:.7rem;background:var(--success);color:#000;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:600">✓ Cobrar</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    ` : ''}
  `;
}

// Lanza el modal de pagos pero le dice que después de cobrar refresque
// "Por cobrar" en lugar de saltar al detalle de la reparación.
function porCobrar_cobrarReparacion(repId) {
  if (typeof modalPagosReparacion !== 'function') {
    toast('No se pudo abrir el cobro', 'error');
    return;
  }
  modalPagosReparacion(repId, null, () => {
    if (typeof navigate === 'function' && currentPage === 'por-cobrar') {
      porCobrar();
    } else {
      porCobrar();
    }
  });
}

let _pcCobrandoFiado = false;
async function porCobrar_marcarFiadoPagado(fiadoId) {
  if (!_pcPuedeCobrar()) { toast('No tenés permisos', 'error'); return; }
  if (_pcCobrandoFiado) return;
  _pcCobrandoFiado = true;
  try {
    await safeCall(async () => {
      // Update condicional: solo si sigue sin pagar. Si dos clicks o dos
      // pestañas chocan, solo el primero dispara el trigger del ingreso.
      const { data: actualizados, error: updErr } = await sb.from('fiados')
        .update({ pagado: true })
        .eq('id', fiadoId)
        .eq('pagado', false)
        .select('id');
      if (updErr) { toast('Error: ' + updErr.message, 'error'); return; }
      if (!actualizados || actualizados.length === 0) {
        toast('Este fiado ya estaba cobrado', 'info');
        porCobrar();
        return;
      }
      // El trigger en Supabase ya inserta el ingreso en movimientos_financieros.
      clearCache('creditos');
      clearCache('finanzas');
      toast('Fiado cobrado', 'success');
      porCobrar();
    }, null, 'No se pudo marcar como pagado');
  } finally {
    _pcCobrandoFiado = false;
  }
}

// ─── POR PAGAR ─────────────────────────────────────────────────────────────
async function porPagar() {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede ver lo que se debe pagar')) {
    if (typeof navigate === 'function') navigate('dashboard');
    return;
  }

  const tallerId = tid();
  const hoy = new Date().toISOString().split('T')[0];

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">📤 Por pagar</div>
    </div>
    <div style="text-align:center;padding:2rem;color:var(--text2)">Cargando…</div>`;

  const [cuentasRes, liqsRes, movHoyRes] = await Promise.all([
    sb.from('cuentas_pagar').select('*').eq('taller_id', tallerId).eq('pagada', false).order('fecha_vencimiento', { ascending: true }),
    sb.from('liquidaciones')
      .select('id,sueldo_base,total_bonos,total_descuentos,total_extra,total_liquidado,estado,empleados(nombre),periodos_sueldo(fecha_inicio,fecha_fin,estado)')
      .eq('taller_id', tallerId)
      .neq('estado', 'pagado')
      .order('created_at', { ascending: true }),
    sb.from('movimientos_financieros')
      .select('monto,tipo')
      .eq('taller_id', tallerId)
      .eq('tipo', 'egreso')
      .eq('fecha', hoy),
  ]);

  // Si CUALQUIERA falla, mostramos error en lugar de "Debés ₲0".
  if (cuentasRes.error || liqsRes.error || movHoyRes.error) {
    const errMsg = (cuentasRes.error || liqsRes.error || movHoyRes.error)?.message || '';
    _pcRenderError('📤 Por pagar', errMsg);
    return;
  }

  const cuentas = cuentasRes.data || [];
  // total_liquidado puede venir null si el trigger no lo calculó: lo derivo.
  const liqs = (liqsRes.data || []).map(l => ({
    ...l,
    _total: parseFloat(l.total_liquidado || 0)
      || (parseFloat(l.sueldo_base || 0) + parseFloat(l.total_bonos || 0) + parseFloat(l.total_extra || 0) - parseFloat(l.total_descuentos || 0)),
  }));
  const movHoy = movHoyRes.data || [];

  const totalCuentas = cuentas.reduce((s, c) => s + parseFloat(c.monto || 0), 0);
  const totalSueldos = liqs.reduce((s, l) => s + l._total, 0);
  const totalPagadoHoy = movHoy.reduce((s, m) => s + parseFloat(m.monto || 0), 0);
  const totalDeuda = totalCuentas + totalSueldos;
  const vencidas = cuentas.filter(c => c.fecha_vencimiento && c.fecha_vencimiento < hoy);

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">📤 Por pagar</div>
      <button class="btn-add" onclick="porPagar()">↻ Refrescar</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
      <div style="background:rgba(255,68,68,.08);border:1px solid ${vencidas.length?'var(--danger)':'rgba(255,68,68,.25)'};border-radius:12px;padding:.75rem;text-align:center">
        <div style="font-size:.65rem;color:var(--danger);letter-spacing:1px;font-family:var(--font-head)">DEBÉS</div>
        <div style="font-family:var(--font-head);font-size:1.4rem;color:var(--danger);margin-top:.2rem">₲${gs(totalDeuda)}</div>
        <div style="font-size:.65rem;color:var(--text2);margin-top:.15rem">${cuentas.length} cuenta(s) · ${liqs.length} sueldo(s)${vencidas.length?' · <span style="color:var(--danger)">'+vencidas.length+' vencida(s)</span>':''}</div>
      </div>
      <div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.25);border-radius:12px;padding:.75rem;text-align:center">
        <div style="font-size:.65rem;color:var(--warning);letter-spacing:1px;font-family:var(--font-head)">HOY PAGASTE</div>
        <div style="font-family:var(--font-head);font-size:1.4rem;color:var(--warning);margin-top:.2rem">₲${gs(totalPagadoHoy)}</div>
        <div style="font-size:.65rem;color:var(--text2);margin-top:.15rem">egresos del día</div>
      </div>
    </div>

    ${cuentas.length === 0 && liqs.length === 0 ? `
      <div class="empty"><p>✅ Estás al día. No debés nada.</p></div>
    ` : ''}

    ${cuentas.length > 0 ? `
      <div style="font-size:.7rem;color:var(--text2);letter-spacing:1.5px;font-family:var(--font-head);margin:1rem 0 .5rem">
        CUENTAS A PROVEEDORES (${cuentas.length})
      </div>
      ${cuentas.map(c => {
        const vencida = c.fecha_vencimiento && c.fecha_vencimiento < hoy;
        return `
        <div class="card" style="cursor:default">
          <div class="card-header">
            <div class="card-avatar" style="font-size:1.2rem">${vencida?'🚨':'📄'}</div>
            <div class="card-info">
              <div class="card-name">${h(c.proveedor)}</div>
              <div class="card-sub">${c.fecha_vencimiento?'Vence: '+formatFecha(c.fecha_vencimiento):'Sin fecha'}${c.notas?' · '+h(c.notas):''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <div style="font-family:var(--font-head);font-size:1rem;color:var(--danger)">₲${gs(c.monto)}</div>
              <button onclick="porPagar_pagarCuenta('${c.id}')" style="font-size:.7rem;background:var(--success);color:#000;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:600">✓ Pagar</button>
              <button onclick="detalleCuenta('${c.id}')" style="font-size:.65rem;background:none;color:var(--text2);border:none;cursor:pointer;padding:0">Ver detalle →</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    ` : ''}

    ${liqs.length > 0 ? `
      <div style="font-size:.7rem;color:var(--text2);letter-spacing:1.5px;font-family:var(--font-head);margin:1rem 0 .5rem">
        SUELDOS PENDIENTES (${liqs.length})
      </div>
      ${liqs.map(l => {
        const periodoTxt = l.periodos_sueldo
          ? `${formatFecha(l.periodos_sueldo.fecha_inicio)} → ${formatFecha(l.periodos_sueldo.fecha_fin)}`
          : '';
        const cerrado = l.periodos_sueldo?.estado === 'cerrado';
        return `
        <div class="card" style="cursor:default">
          <div class="card-header">
            <div class="card-avatar">👤</div>
            <div class="card-info">
              <div class="card-name">${h(l.empleados?.nombre || 'Empleado')}</div>
              <div class="card-sub">${periodoTxt}${cerrado?' · <span style="color:var(--text2)">período cerrado</span>':''}</div>
              <div class="card-sub">Base ₲${gs(l.sueldo_base)} · Bonos ₲${gs(l.total_bonos)} · Desc ₲${gs(l.total_descuentos)}${l.total_extra?' · Extra ₲'+gs(l.total_extra):''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <div style="font-family:var(--font-head);font-size:1rem;color:var(--danger)">₲${gs(l._total)}</div>
              <button onclick="porPagar_pagarSueldo('${l.id}')" style="font-size:.7rem;background:var(--success);color:#000;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:600">✓ Pagar</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    ` : ''}
  `;
}

async function porPagar_pagarCuenta(id) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede marcar como pagada')) return;
  if (_pcPagandoCuenta) return; // anti-doble-click global
  if (!confirm('¿Marcar esta cuenta como pagada?')) return;
  _pcPagandoCuenta = true;
  try {
    await safeCall(async () => {
      // Re-leemos el estado y NOS ASEGURAMOS de que sigue pendiente.
      // Si otro usuario o pestaña ya la marcó como pagada, no insertamos
      // un segundo egreso (idempotencia local). Update condicional via
      // eq('pagada', false) → si ya estaba pagada, no actualiza nada.
      const { data: c } = await sb.from('cuentas_pagar').select('proveedor,monto,pagada').eq('id', id).single();
      if (!c) { toast('Cuenta no encontrada', 'error'); return; }
      if (c.pagada) { toast('Esta cuenta ya estaba pagada', 'info'); porPagar(); return; }

      const { data: actualizadas, error: updErr } = await sb.from('cuentas_pagar')
        .update({ pagada: true, fecha_pago: new Date().toISOString().split('T')[0] })
        .eq('id', id)
        .eq('pagada', false)
        .select('id');
      if (updErr) { toast('Error: ' + updErr.message, 'error'); return; }
      if (!actualizadas || actualizadas.length === 0) {
        toast('Esta cuenta ya estaba pagada', 'info');
        porPagar();
        return;
      }

      // Mismo egreso a Finanzas que hace marcarCuentaPagada en cuentas.js.
      // OJO: NO es atómico (Supabase JS no tiene transacciones). Si el
      // insert falla, REVERTIMOS el update para no dejar la cuenta como
      // "pagada" sin su egreso correspondiente — eso desbalancearía caja.
      let egresoOk = true;
      let egresoErr = null;
      if (typeof obtenerCategoriaFinanciera === 'function') {
        const categoriaId = await obtenerCategoriaFinanciera('Repuestos', 'egreso');
        if (categoriaId) {
          const insRes = await sb.from('movimientos_financieros').insert({
            taller_id: tid(),
            tipo: 'egreso',
            categoria_id: categoriaId,
            monto: c.monto,
            descripcion: 'Pago proveedor: ' + c.proveedor,
            fecha: new Date().toISOString().split('T')[0],
            referencia_id: id,
            referencia_tabla: 'cuentas_pagar'
          });
          if (insRes.error) {
            egresoOk = false;
            egresoErr = insRes.error.message;
          }
        } else {
          egresoOk = false;
          egresoErr = 'No se pudo encontrar la categoría "Repuestos"';
        }
      }

      if (!egresoOk) {
        // Rollback del update para mantener la consistencia.
        await sb.from('cuentas_pagar')
          .update({ pagada: false, fecha_pago: null })
          .eq('id', id);
        toast('No se registró el egreso (' + (egresoErr || 'error') + '). Cuenta sigue pendiente.', 'error');
        porPagar();
        return;
      }

      clearCache('cuentas');
      clearCache('finanzas');
      toast('Cuenta pagada — egreso registrado', 'success');
      porPagar();
    }, null, 'No se pudo marcar como pagada');
  } finally {
    _pcPagandoCuenta = false;
  }
}

async function porPagar_pagarSueldo(liquidacionId) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede registrar pagos de sueldo')) return;
  if (_pcPagandoSueldo) return; // anti-doble-click global
  if (!confirm('¿Marcar esta liquidación como pagada?')) return;
  _pcPagandoSueldo = true;
  try {
    await safeCall(async () => {
      // Update condicional: solo si sigue NO pagada. Así, si el trigger
      // de Supabase es estricto y ya hay egreso, no se inserta dos veces.
      const { data: actualizadas, error: updErr } = await sb.from('liquidaciones')
        .update({ estado: 'pagado', fecha_pago: new Date().toISOString().split('T')[0] })
        .eq('id', liquidacionId)
        .neq('estado', 'pagado')
        .select('id');
      if (updErr) { toast('Error: ' + updErr.message, 'error'); return; }
      if (!actualizadas || actualizadas.length === 0) {
        toast('Esta liquidación ya estaba pagada', 'info');
        porPagar();
        return;
      }
      // El trigger en Supabase inserta el egreso en movimientos_financieros.
      clearCache('finanzas');
      toast('✓ Sueldo pagado', 'success');
      porPagar();
    }, null, 'No se pudo registrar el pago');
  } finally {
    _pcPagandoSueldo = false;
  }
}

// ─── CONTADORES PARA EL BADGE DE NAVEGACIÓN ────────────────────────────────
async function porCobrar_contar() {
  const tallerId = tid && tid();
  if (!tallerId) return 0;
  try {
    const [reps, fiados] = await Promise.all([
      sb.from('reparaciones').select('id,costo').eq('taller_id', tallerId).neq('estado', 'cancelado').gt('costo', 0).limit(500),
      sb.from('fiados').select('id', { count: 'exact', head: true }).eq('taller_id', tallerId).eq('pagado', false),
    ]);
    let repsConSaldo = 0;
    const ids = (reps.data || []).map(r => r.id);
    if (ids.length) {
      const { data: pagos } = await sb.from('pagos_reparacion').select('reparacion_id,monto').in('reparacion_id', ids);
      const sumByRep = {};
      (pagos || []).forEach(p => { sumByRep[p.reparacion_id] = (sumByRep[p.reparacion_id] || 0) + parseFloat(p.monto || 0); });
      (reps.data || []).forEach(r => {
        const saldo = parseFloat(r.costo || 0) - (sumByRep[r.id] || 0);
        if (saldo > 0.01) repsConSaldo++;
      });
    }
    return repsConSaldo + (fiados.count || 0);
  } catch (_) { return 0; }
}

async function porPagar_contar() {
  const tallerId = tid && tid();
  if (!tallerId) return 0;
  try {
    const [cuentas, liqs] = await Promise.all([
      sb.from('cuentas_pagar').select('id', { count: 'exact', head: true }).eq('taller_id', tallerId).eq('pagada', false),
      sb.from('liquidaciones').select('id', { count: 'exact', head: true }).eq('taller_id', tallerId).neq('estado', 'pagado'),
    ]);
    return (cuentas.count || 0) + (liqs.count || 0);
  } catch (_) { return 0; }
}

// Exports
window.porCobrar = porCobrar;
window.porCobrar_cobrarReparacion = porCobrar_cobrarReparacion;
window.porCobrar_marcarFiadoPagado = porCobrar_marcarFiadoPagado;
window.porCobrar_contar = porCobrar_contar;
window.porPagar = porPagar;
window.porPagar_pagarCuenta = porPagar_pagarCuenta;
window.porPagar_pagarSueldo = porPagar_pagarSueldo;
window.porPagar_contar = porPagar_contar;
