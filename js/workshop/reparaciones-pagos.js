// ─── PAGOS DE REPARACIÓN ────────────────────────────────────────────────────
let _registrandoPago = false;
// Callback opcional. Si se setea, se llama tras un cobro exitoso EN VEZ
// de navegar al detalle de la reparación. Lo usa el "Centro de cobros"
// (porCobrar) para no perder el contexto de la lista de pendientes.
let _onPagoSuccess = null;

async function modalPagosReparacion(repId, montoSugerido = null, onSuccess = null) {
  _onPagoSuccess = typeof onSuccess === 'function' ? onSuccess : null;
  // Solo admin o empleado con permiso explícito de "registrar_cobros"
  if (typeof esAdmin === 'function' && !esAdmin()
      && !(typeof tienePerm === 'function' && tienePerm('registrar_cobros'))) {
    if (typeof toast === 'function') toast('No tenés permisos para registrar cobros', 'error');
    return;
  }
  const [{ data: rep }, { data: pagos }] = await Promise.all([
    sb.from('reparaciones').select('costo,descripcion').eq('id', repId).single(),
    sb.from('pagos_reparacion').select('*').eq('reparacion_id', repId).order('fecha', {ascending:false})
  ]);
  const totalPagado = (pagos||[]).reduce((s,p) => s + parseFloat(p.monto||0), 0);
  const saldo = montoSugerido !== null ? montoSugerido : parseFloat(rep?.costo||0) - totalPagado;

  openModal(`
    <div class="modal-title">💰 Pagos — ${h(rep?.descripcion||'')}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:1rem">
      <div style="background:var(--surface2);border-radius:10px;padding:.5rem;text-align:center">
        <div style="font-size:.55rem;color:var(--text2);letter-spacing:1px">TOTAL</div>
        <div style="font-family:var(--font-head);font-size:.95rem;color:var(--text)">${fm(rep?.costo||0)}</div>
      </div>
      <div style="background:rgba(0,255,136,.08);border-radius:10px;padding:.5rem;text-align:center">
        <div style="font-size:.55rem;color:var(--success);letter-spacing:1px">PAGADO</div>
        <div style="font-family:var(--font-head);font-size:.95rem;color:var(--success)">${fm(totalPagado)}</div>
      </div>
      <div style="background:${saldo>0?'rgba(255,68,68,.08)':'rgba(0,255,136,.08)'};border-radius:10px;padding:.5rem;text-align:center">
        <div style="font-size:.55rem;color:${saldo>0?'var(--danger)':'var(--success)'};letter-spacing:1px">SALDO</div>
        <div style="font-family:var(--font-head);font-size:.95rem;color:${saldo>0?'var(--danger)':'var(--success)'}">${fm(saldo)}</div>
      </div>
    </div>
    ${(pagos||[]).length > 0 ? `
    <div style="margin-bottom:1rem">
      ${(pagos||[]).map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-size:.82rem">${h(p.metodo||'Efectivo')}</div>
            <div style="font-size:.68rem;color:var(--text2)">${formatFecha(p.fecha)}${p.notas?' · '+h(p.notas):''}</div>
          </div>
          <div style="font-family:var(--font-head);color:var(--success);font-size:.9rem">${fm(p.monto)}</div>
        </div>`).join('')}
    </div>` : ''}
    ${saldo > 0 ? `
    <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1px;margin-bottom:.4rem">REGISTRAR PAGO</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Monto ${monedaActual().simbolo}</label><input class="form-input" id="f-pago-monto" type="number" value="${saldo}" min="1"></div>
      <div class="form-group"><label class="form-label">Método</label>
        <select class="form-input" id="f-pago-metodo">
          <option value="Efectivo">Efectivo</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Tarjeta">Tarjeta</option>
          <option value="Crédito">Crédito (queda como fiado)</option>
          <option value="Otro">Otro</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Nota (opcional)</label><input class="form-input" id="f-pago-notas" placeholder="Seña, cuota 1/3..."></div>
    <button class="btn-primary" id="btn-registrar-pago" onclick="guardarPagoReparacion('${repId}')">Registrar Pago</button>` : '<div style="text-align:center;color:var(--success);font-size:.9rem;padding:.5rem">✓ Totalmente pagado</div>'}
    <button class="btn-secondary" onclick="closeModal()">Cerrar</button>`);
}

async function guardarPagoReparacion(repId) {
  if (typeof esAdmin === 'function' && !esAdmin()
      && !(typeof tienePerm === 'function' && tienePerm('registrar_cobros'))) {
    if (typeof toast === 'function') toast('No tenés permisos para registrar cobros', 'error');
    return;
  }
  // Anti-doble-click: si ya hay una inserción en curso, salir
  if (_registrandoPago) return;
  _registrandoPago = true;
  const btn = document.getElementById('btn-registrar-pago');
  const btnTextOrig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Registrando…'; btn.style.opacity = '.6'; }

  const restaurarBtn = () => {
    _registrandoPago = false;
    if (btn) { btn.disabled = false; btn.textContent = btnTextOrig || 'Registrar Pago'; btn.style.opacity = ''; }
  };

  try {
    await safeCall(async () => {
      const monto = parseFloat(document.getElementById('f-pago-monto').value);
      if (!validatePositiveNumber(monto, 'Monto')) { restaurarBtn(); return; }

      const metodo = document.getElementById('f-pago-metodo').value;
      const notas = document.getElementById('f-pago-notas').value;
      const fecha = new Date().toISOString().split('T')[0];

      // Validar contra el saldo real (puede haber cambiado mientras el modal estaba abierto)
      const [repRes, pagosRes] = await Promise.all([
        sb.from('reparaciones').select('costo').eq('id', repId).single(),
        sb.from('pagos_reparacion').select('monto').eq('reparacion_id', repId)
      ]);
      if (repRes.error || !repRes.data) {
        toast('No se pudo verificar el saldo, intentá de nuevo', 'error');
        restaurarBtn();
        return;
      }
      const totalPrev = (pagosRes.data || []).reduce((s, p) => s + parseFloat(p.monto || 0), 0);
      const saldoActual = parseFloat(repRes.data.costo || 0) - totalPrev;

      if (saldoActual <= 0.01) {
        toast('Esta reparación ya está totalmente pagada', 'error');
        restaurarBtn();
        return;
      }

      if (monto > saldoActual + 0.01) {
        const exceso = monto - saldoActual;
        const ok = confirm(`Te estás pasando ${fm(exceso)} del saldo (queda ${fm(saldoActual)}).\n\n¿Es propina o vale extra del cliente?`);
        if (!ok) { restaurarBtn(); return; }
      }

      const { data: pago, error } = await sb.from('pagos_reparacion').insert({
        reparacion_id: repId,
        monto,
        metodo,
        notas,
        fecha,
        taller_id: tid()
      }).select('id').single();

      if (error) { toast('Error: '+error.message,'error'); restaurarBtn(); return; }

      // NOTA: La inserción en movimientos_financieros ahora la hace un TRIGGER en Supabase
      // (ver script SQL proporcionado)

      if (metodo === 'Crédito') {
        const { data: rep2 } = await sb.from('reparaciones').select('cliente_id,descripcion').eq('id',repId).single();
        if (rep2?.cliente_id) {
          await sb.from('fiados').insert({
            cliente_id: rep2.cliente_id,
            monto,
            descripcion: 'Crédito: ' + (rep2.descripcion||''),
            pagado: false,
            taller_id: tid()
          });
          clearCache('creditos');
        }
      }

      clearCache('reparaciones');
      _registrandoPago = false;
      toast('Pago registrado', 'success');
      closeModal();
      // Si quien abrió el modal pasó un callback (ej: el Centro de cobros),
      // lo usamos en lugar de saltar al detalle de la reparación.
      const cb = _onPagoSuccess;
      _onPagoSuccess = null;
      if (cb) { try { cb(repId); } catch (_) { detalleReparacion(repId); } }
      else { detalleReparacion(repId); }
    }, null, 'No se pudo registrar el pago');
  } catch (e) {
    restaurarBtn();
    throw e;
  } finally {
    // Si el flujo falló silenciosamente o safeCall no llamó closeModal, restauramos
    if (_registrandoPago) restaurarBtn();
  }
}
