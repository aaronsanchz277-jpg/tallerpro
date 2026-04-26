// ─── VISTA CLIENTE ────────────────────────────────────────────────────────────
async function misVehiculos() {
  // Buscar cliente_id desde el perfil
  const { data: perfil } = await sb.from('perfiles').select('cliente_id').eq('id', currentUser.id).maybeSingle();

  if (!perfil?.cliente_id) {
    document.getElementById('main-content').innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
        <p style="font-size:1rem;margin-bottom:.5rem">${t('cuentaPendiente')}</p>
        <p style="font-size:.8rem">${t('cuentaPendienteMsg')}/p>
      </div>`;
    return;
  }

  const { data } = await sb.from('vehiculos').select('*').eq('cliente_id', perfil.cliente_id);
  document.getElementById('main-content').innerHTML = `
    <div class="section-header"><div class="section-title">${t('misAutos')}</div></div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('vehSinDatos')}</p></div>` :
      (data||[]).map(v => `
      <div class="card">
        <div class="card-header">
          ${v.foto_url?`<img src="${safeFotoUrl(v.foto_url)}" style="width:44px;height:44px;object-fit:cover;border-radius:8px">`:`<div class="card-avatar" style="font-size:.8rem">${h(v.patente)}</div>`}
          <div class="card-info"><div class="card-name">${h(v.marca)} ${h(v.modelo||'')}</div><div class="card-sub">${h(v.patente)} · ${h(v.anio||'')}</div></div>
        </div>
      </div>`).join('')}`;
}

async function misReparaciones() {
  if (currentPerfil?.rol !== 'cliente') { dashboard(); return; }

  const { data: perfil } = await sb.from('perfiles').select('cliente_id').eq('id', currentUser.id).maybeSingle();

  if (!perfil?.cliente_id) {
    document.getElementById('main-content').innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
        <p style="font-size:1rem;margin-bottom:.5rem">${t('cuentaPendiente')}</p>
        <p style="font-size:.8rem">${t('cuentaPendienteMsg2')}</p>
      </div>`;
    return;
  }

  const { data } = await sb.from('reparaciones').select('*, vehiculos(patente,marca)').eq('cliente_id', perfil.cliente_id).order('created_at',{ascending:false});
  document.getElementById('main-content').innerHTML = `
    <div class="section-header"><div class="section-title">${t('misReps')}</div></div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('repSinDatos')}</p></div>` :
      (data||[]).map(r => `
      <div class="card" onclick="detalleReparacion('${r.id}')" style="cursor:pointer">
        <div class="card-header">
          <div class="card-avatar">🔧</div>
          <div class="card-info">
            <div class="card-name">${h(r.descripcion)}</div>
            <div class="card-sub">${r.vehiculos?h(r.vehiculos.patente)+' · '+h(r.vehiculos.marca):''} · ${formatFecha(r.fecha)}</div>
          </div>
          <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
        </div>
        ${r.estado==='finalizado' ? `<div style="margin-top:.5rem;text-align:right">
          <button onclick="event.stopPropagation();descargarComprobanteCliente('${r.id}')" style="background:rgba(0,229,255,.1);color:var(--accent);border:1px solid rgba(0,229,255,.3);border-radius:8px;padding:.35rem .7rem;font-size:.72rem;cursor:pointer;font-family:var(--font-head);letter-spacing:.5px">📥 Descargar comprobante PDF</button>
        </div>` : ''}
      </div>`).join('')}`;
}

// ─── MIS PRESUPUESTOS (cliente) ──────────────────────────────────────────────
async function misPresupuestos() {
  if (currentPerfil?.rol !== 'cliente') { dashboard(); return; }

  const { data: perfil } = await sb.from('perfiles').select('cliente_id').eq('id', currentUser.id).maybeSingle();
  if (!perfil?.cliente_id) {
    document.getElementById('main-content').innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
        <p style="font-size:1rem;margin-bottom:.5rem">${t('cuentaPendiente')||'Cuenta pendiente'}</p>
        <p style="font-size:.8rem">Tu cuenta todavía no está vinculada al taller. Ingresá el código de invitación o pedile al taller que te vincule.</p>
      </div>`;
    return;
  }

  // 1) Presupuestos formales del cliente.
  // NOTA: requiere policy RLS que permita SELECT al cliente sobre presupuestos_v2
  // donde cliente_id = (SELECT cliente_id FROM perfiles WHERE id = auth.uid()).
  // Si la policy no está aplicada, la query devuelve [] y mostramos solo las
  // reparaciones pendientes de aprobación (que sí tienen su policy).
  let pptos = [];
  try {
    const res = await sb.from('presupuestos_v2')
      .select('id, descripcion, estado, total, created_at, vehiculos(patente,marca)')
      .eq('cliente_id', perfil.cliente_id)
      .order('created_at', { ascending: false });
    if (!res.error) pptos = res.data || [];
  } catch (_) { /* RLS sin policy → silencioso */ }

  // 2) Reparaciones pendientes de aprobación (presupuesto que el taller carga directo en la OT).
  const { data: repsPend } = await sb.from('reparaciones')
    .select('id, descripcion, costo, fecha, aprobacion_cliente, vehiculos(patente,marca)')
    .eq('cliente_id', perfil.cliente_id)
    .eq('aprobacion_cliente', 'pendiente')
    .gt('costo', 0)
    .order('fecha', { ascending: false });

  const tallerTel = currentPerfil?.talleres?.telefono?.replace(/\D/g,'') || '';
  const tallerNombre = currentPerfil?.talleres?.nombre || 'el taller';

  const pendCount = ((pptos||[]).filter(p => p.estado==='generado').length) + (repsPend?.length || 0);

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">Mis presupuestos${pendCount>0?` <span style="font-size:.7rem;color:var(--warning)">(${pendCount} pendiente${pendCount>1?'s':''})</span>`:''}</div>
    </div>

    ${(repsPend||[]).length>0 ? `
      <div style="font-family:var(--font-head);font-size:.72rem;color:var(--warning);letter-spacing:1px;margin:1rem 0 .5rem">⏳ PENDIENTES DE APROBAR</div>
      ${(repsPend||[]).map(r => `
        <div class="card" style="border-left:3px solid var(--warning)">
          <div class="card-header">
            <div class="card-avatar">📝</div>
            <div class="card-info">
              <div class="card-name">${h(r.descripcion)}</div>
              <div class="card-sub">${r.vehiculos?h(r.vehiculos.patente)+' · '+h(r.vehiculos.marca):''} · ${formatFecha(r.fecha)}</div>
              <div style="font-family:var(--font-head);font-size:1rem;color:var(--accent);margin-top:.3rem">₲${gs(r.costo)}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-top:.6rem">
            <button onclick="aprobarPresupuestoCliente('${r.id}','aprobado')" style="background:rgba(0,255,136,.15);color:var(--success);border:1px solid rgba(0,255,136,.3);border-radius:10px;padding:.55rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer">✓ APROBAR</button>
            <button onclick="aprobarPresupuestoCliente('${r.id}','rechazado')" style="background:rgba(255,68,68,.1);color:var(--danger);border:1px solid rgba(255,68,68,.3);border-radius:10px;padding:.55rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer">✕ RECHAZAR</button>
          </div>
          ${tallerTel ? `<button onclick="window.open('https://wa.me/${tallerTel}?text=${encodeURIComponent('Hola! Tengo dudas sobre el presupuesto: '+(r.descripcion||''))}')" style="width:100%;margin-top:.4rem;background:rgba(37,211,102,.1);color:#25d366;border:1px solid rgba(37,211,102,.25);border-radius:8px;padding:.45rem;font-size:.78rem;cursor:pointer">💬 Tengo dudas — escribir al taller</button>` : ''}
        </div>
      `).join('')}
    ` : ''}

    ${(pptos||[]).length>0 ? `
      <div style="font-family:var(--font-head);font-size:.72rem;color:var(--text2);letter-spacing:1px;margin:1rem 0 .5rem">📋 PRESUPUESTOS</div>
      ${(pptos||[]).map(p => {
        const esGenerado = p.estado === 'generado' || p.estado === 'pendiente';
        return `
        <div class="card" ${esGenerado?'style="border-left:3px solid var(--warning)"':''}>
          <div class="card-header">
            <div class="card-avatar">📋</div>
            <div class="card-info">
              <div class="card-name">${h(p.descripcion||'Presupuesto')}</div>
              <div class="card-sub">${p.vehiculos?h(p.vehiculos.patente)+' · '+h(p.vehiculos.marca):''} · ${formatFecha(p.created_at?.split('T')[0])}</div>
              <div style="font-family:var(--font-head);font-size:.95rem;color:var(--accent);margin-top:.2rem">₲${gs(p.total||0)}</div>
            </div>
            <span class="card-badge ${p.estado==='aprobado'?'badge-green':p.estado==='rechazado'?'badge-red':'badge-yellow'}">${(p.estado||'').toUpperCase()}</span>
          </div>
          ${esGenerado ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-top:.6rem">
              <button onclick="aprobarPresupV2('${p.id}')" style="background:rgba(0,255,136,.15);color:var(--success);border:1px solid rgba(0,255,136,.3);border-radius:10px;padding:.55rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer">✓ APROBAR</button>
              <button onclick="rechazarPresupV2('${p.id}')" style="background:rgba(255,68,68,.1);color:var(--danger);border:1px solid rgba(255,68,68,.3);border-radius:10px;padding:.55rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer">✕ RECHAZAR</button>
            </div>
            <button onclick="aclararPresupV2('${p.id}','${hjs(p.descripcion||'')}')" style="width:100%;margin-top:.4rem;background:rgba(255,176,0,.08);color:var(--warning);border:1px solid rgba(255,176,0,.25);border-radius:8px;padding:.45rem;font-size:.78rem;cursor:pointer">❓ Pedir aclaración</button>
          ` : ''}
          ${tallerTel ? `<div style="margin-top:.5rem;text-align:right"><button onclick="window.open('https://wa.me/${tallerTel}?text=${encodeURIComponent('Hola! Sobre el presupuesto: '+(p.descripcion||''))}')" style="background:rgba(37,211,102,.1);color:#25d366;border:1px solid rgba(37,211,102,.25);border-radius:8px;padding:.35rem .7rem;font-size:.72rem;cursor:pointer">💬 Hablar con el taller</button></div>` : ''}
        </div>`;
      }).join('')}
    ` : ''}

    ${((pptos||[]).length===0 && (repsPend||[]).length===0) ? `<div class="empty"><p>Todavía no tenés presupuestos en ${h(tallerNombre)}.</p></div>` : ''}
  `;
}

// ─── DESCARGAR COMPROBANTE (cliente) ─────────────────────────────────────────
// Reusa el generador de "Carta de Conformidad" que ya existe para reparaciones
// finalizadas. Es el comprobante cliente-friendly: trabajos hechos + total cobrado,
// sin costos internos ni ganancia.
async function descargarComprobanteCliente(repId) {
  if (typeof generarCartaConformidad !== 'function') {
    toast('No se pudo generar el PDF', 'error');
    return;
  }
  await generarCartaConformidad(repId);
}

// ─── ACCIONES SOBRE PRESUPUESTOS FORMALES (presupuestos_v2) ──────────────────
// El cliente puede APROBAR, RECHAZAR o PEDIR ACLARACIÓN sobre un presupuesto
// formal con estado='generado'. Update de estado limitado por la policy
// `presupuestos_v2_update_cliente` (en supabase/rls_policies.sql).
async function aprobarPresupV2(id) {
  confirmar('¿Aprobar este presupuesto? El taller podrá empezar el trabajo.', async () => {
    await safeCall(async () => {
      const { error } = await sb.from('presupuestos_v2')
        .update({ estado: 'aprobado', aprobado_por_cliente_at: new Date().toISOString() })
        .eq('id', id);
      if (error) { toast('No se pudo aprobar: '+error.message, 'error'); return; }
      toast('✓ Presupuesto aprobado', 'success');
      clearCache && clearCache('presupuestos_v2');
      misPresupuestos();
    }, null, 'No se pudo aprobar el presupuesto');
  });
}

async function rechazarPresupV2(id) {
  confirmar('¿Rechazar este presupuesto?', async () => {
    await safeCall(async () => {
      const { error } = await sb.from('presupuestos_v2')
        .update({ estado: 'rechazado', aprobado_por_cliente_at: new Date().toISOString() })
        .eq('id', id);
      if (error) { toast('No se pudo rechazar: '+error.message, 'error'); return; }
      toast('Presupuesto rechazado', 'success');
      clearCache && clearCache('presupuestos_v2');
      misPresupuestos();
    }, null, 'No se pudo rechazar el presupuesto');
  });
}

// "Pedir aclaración" abre WhatsApp con el taller con el contexto del
// presupuesto. No cambia el estado en la base (sigue 'generado'); el taller
// responde y el cliente vuelve a aprobar / rechazar después.
function aclararPresupV2(id, descripcion) {
  const tel = (currentPerfil?.talleres?.telefono || '').replace(/\D/g,'');
  if (!tel) { toast('El taller no tiene teléfono registrado', 'error'); return; }
  const msg = `Hola! Tengo una consulta sobre el presupuesto: ${descripcion || id}`;
  window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(msg), '_blank');
}

