// ─── PAGOS DE REPARACIÓN ────────────────────────────────────────────────────
async function modalPagosReparacion(repId, montoSugerido = null) {
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
        <div style="font-family:var(--font-head);font-size:.95rem;color:var(--text)">₲${gs(rep?.costo||0)}</div>
      </div>
      <div style="background:rgba(0,255,136,.08);border-radius:10px;padding:.5rem;text-align:center">
        <div style="font-size:.55rem;color:var(--success);letter-spacing:1px">PAGADO</div>
        <div style="font-family:var(--font-head);font-size:.95rem;color:var(--success)">₲${gs(totalPagado)}</div>
      </div>
      <div style="background:${saldo>0?'rgba(255,68,68,.08)':'rgba(0,255,136,.08)'};border-radius:10px;padding:.5rem;text-align:center">
        <div style="font-size:.55rem;color:${saldo>0?'var(--danger)':'var(--success)'};letter-spacing:1px">SALDO</div>
        <div style="font-family:var(--font-head);font-size:.95rem;color:${saldo>0?'var(--danger)':'var(--success)'}">₲${gs(saldo)}</div>
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
          <div style="font-family:var(--font-head);color:var(--success);font-size:.9rem">₲${gs(p.monto)}</div>
        </div>`).join('')}
    </div>` : ''}
    ${saldo > 0 ? `
    <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1px;margin-bottom:.4rem">REGISTRAR PAGO</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Monto ₲</label><input class="form-input" id="f-pago-monto" type="number" value="${saldo}" min="1"></div>
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
    <button class="btn-primary" onclick="guardarPagoReparacion('${repId}')">Registrar Pago</button>` : '<div style="text-align:center;color:var(--success);font-size:.9rem;padding:.5rem">✓ Totalmente pagado</div>'}
    <button class="btn-secondary" onclick="closeModal()">Cerrar</button>`);
}

async function guardarPagoReparacion(repId) {
  if (typeof esAdmin === 'function' && !esAdmin()
      && !(typeof tienePerm === 'function' && tienePerm('registrar_cobros'))) {
    if (typeof toast === 'function') toast('No tenés permisos para registrar cobros', 'error');
    return;
  }
  await safeCall(async () => {
    const monto = parseFloat(document.getElementById('f-pago-monto').value);
    if (!validatePositiveNumber(monto, 'Monto')) return;
    
    const metodo = document.getElementById('f-pago-metodo').value;
    const notas = document.getElementById('f-pago-notas').value;
    const fecha = new Date().toISOString().split('T')[0];
    
    const { data: pago, error } = await sb.from('pagos_reparacion').insert({
      reparacion_id: repId,
      monto,
      metodo,
      notas,
      fecha,
      taller_id: tid()
    }).select('id').single();
    
    if (error) { toast('Error: '+error.message,'error'); return; }
    
    // NOTA: La inserción en movimientos_financieros ahora la hace un TRIGGER en Supabase
    // (ver script SQL proporcionado)
    
    if (metodo === 'Crédito') {
      const { data: rep } = await sb.from('reparaciones').select('cliente_id,descripcion').eq('id',repId).single();
      if (rep?.cliente_id) {
        await sb.from('fiados').insert({
          cliente_id: rep.cliente_id,
          monto,
          descripcion: 'Crédito: ' + (rep.descripcion||''),
          pagado: false,
          taller_id: tid()
        });
        clearCache('creditos');
      }
    }
    
    clearCache('reparaciones');
    toast('Pago registrado', 'success');
    closeModal();
    detalleReparacion(repId);
  }, null, 'No se pudo registrar el pago');
}
