// ─── DETALLE DE REPARACIÓN ───────────────────────────────────────────────────
// Este archivo asume que las dependencias ya están cargadas globalmente:
// - TIPO_ICONS (de reparaciones-core.js)
// - cargarItemsReparacion, renderItemsReparacion (de reparaciones-items.js)
// - repMecanicos_cargar, repMecanicos_renderChips (de hr/mecanicos.js)
// - obtenerCategoriaFinanciera (de finances/categorias.js)

async function detalleReparacion(id) {
  const { data: r, error: qErr } = await safeQuery(() => sb.from('reparaciones').select('*, vehiculos(patente,marca,modelo), clientes(nombre,telefono)').eq('id', id).single());
  if (!r) { if (qErr) toast('Error al cargar reparación', 'error'); navigate('reparaciones'); return; }

  // Guardamos el trabajo en "recientes" (localStorage) para que aparezca rápido
  // en el dashboard y en el buscador global.
  if (typeof recordReciente === 'function') {
    recordReciente('reparaciones', {
      id: r.id,
      descripcion: r.descripcion,
      patente: r.vehiculos?.patente || ''
    });
  }

  const isAdmin = currentPerfil?.rol === 'admin';
  const canEdit = ['admin', 'empleado'].includes(currentPerfil?.rol);
  const isCliente = currentPerfil?.rol === 'cliente';
  // Permisos finos para empleado (admin siempre ve/puede)
  const puedeVerCostos    = isAdmin || (typeof tienePerm === 'function' && tienePerm('ver_costos'));
  const puedeVerGanancia  = isAdmin || (typeof tienePerm === 'function' && tienePerm('ver_ganancia'));
  const puedeModificar    = isAdmin || (typeof tienePerm === 'function' && tienePerm('modificar_precios'));
  const puedeRegistrarCob = isAdmin || (typeof tienePerm === 'function' && tienePerm('registrar_cobros'));

  const checklist = r.checklist_recepcion || {};
  const fotos = r.fotos_recepcion || [];
  const aprobacion = r.aprobacion_cliente || 'pendiente';
  const aprobBadge = aprobacion === 'aprobado' ? 'badge-green' : aprobacion === 'rechazado' ? 'badge-red' : 'badge-yellow';
  const aprobLabel = aprobacion === 'aprobado' ? '✓ Aprobado' : aprobacion === 'rechazado' ? '✕ Rechazado' : '⏳ Pendiente';

  const items = await cargarItemsReparacion(id);
  const [{ data: pagos }, { data: mecPagos }] = await Promise.all([
    sb.from('pagos_reparacion').select('monto').eq('reparacion_id', id),
    sb.from('reparacion_mecanicos').select('pago').eq('reparacion_id', id)
  ]);
  const totalPagado = (pagos || []).reduce((s, p) => s + parseFloat(p.monto || 0), 0);
  const saldo = parseFloat(r.costo || 0) - totalPagado;
  const totalPagoMecanicos = (mecPagos || []).reduce((s, m) => s + parseFloat(m.pago || 0), 0);
  const costoRep = parseFloat(r.costo_repuestos || 0);
  const cobrado = parseFloat(r.costo || 0);
  const gananciaReal = cobrado - costoRep - totalPagoMecanicos;
  const pctGanancia = cobrado > 0 ? Math.round((gananciaReal / cobrado) * 100) : 0;

  const ORIGENES_VALIDOS = ['reparaciones','mis-trabajos','mis-reparaciones','dashboard','panel-trabajo'];
  const fallbackOrigen = isCliente ? 'mis-reparaciones' : 'reparaciones';
  const origenBack = ORIGENES_VALIDOS.includes(currentPage) ? currentPage : fallbackOrigen;

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('${origenBack}')">${t('volver')}</button>
      <div class="detail-avatar">${TIPO_ICONS[r.tipo_trabajo] || '🔧'}</div>
      <div><div class="detail-name" style="font-size:1rem">${h(r.descripcion)}</div><div class="detail-sub">${r.tipo_trabajo ? h(r.tipo_trabajo) + ' · ' : ''}${formatFecha(r.fecha)}</div></div>
    </div>
    <div class="info-grid">
      <div class="info-item"><div class="label">Estado</div><div class="value"><span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span></div></div>
      <div class="info-item"><div class="label">Vehículo</div><div class="value">${r.vehiculos ? h(r.vehiculos.patente) + ' ' + h(r.vehiculos.marca || '') : '-'}</div></div>
      <div class="info-item"><div class="label">Cliente</div><div class="value">${r.clientes ? h(r.clientes.nombre) : '-'}</div></div>
      <div class="info-item"><div class="label">Aprobación</div><div class="value"><span class="card-badge ${aprobBadge}">${aprobLabel}</span></div></div>
      ${r.kilometraje_ingreso ? `<div class="info-item"><div class="label">Km ingreso</div><div class="value">${r.kilometraje_ingreso.toLocaleString()} km</div></div>` : ''}
      ${r.combustible_ingreso ? `<div class="info-item"><div class="label">Combustible</div><div class="value">${h(r.combustible_ingreso)}</div></div>` : ''}
    </div>

    ${r.estado === 'esperando_repuestos' && r.repuesto_disponible_at ? `
    <div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.3);border-radius:12px;padding:.75rem 1rem;margin-bottom:1rem;display:flex;align-items:center;gap:.75rem">
      <div style="font-size:1.4rem">📦</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--font-head);font-size:.82rem;color:var(--success);letter-spacing:.5px">REPUESTO DISPONIBLE</div>
        <div style="font-size:.72rem;color:var(--text2)">Llegó al stock hace ${Math.max(0, Math.floor((Date.now() - new Date(r.repuesto_disponible_at).getTime()) / 86400000))} día(s). Avisale al cliente para coordinar la instalación.</div>
      </div>
      ${canEdit && r.clientes?.telefono ? `<button onclick="repuestoLlego_enviarWhatsApp('${id}')" style="background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.35);border-radius:8px;padding:.5rem .75rem;font-family:var(--font-head);font-size:.72rem;cursor:pointer;white-space:nowrap">💬 Avisar</button>` : ''}
    </div>` : ''}

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <span style="font-size:.72rem;color:var(--text2);font-family:var(--font-head);letter-spacing:1px">COBRADO AL CLIENTE</span>
        <span style="font-family:var(--font-head);font-size:1.4rem;color:var(--success)">₲${gs(r.costo)}</span>
      </div>
      ${costoRep > 0 && puedeVerCostos ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-top:1px solid var(--border)">
        <span style="font-size:.78rem;color:var(--text2)">Repuestos gastados</span>
        <span style="font-size:.85rem;color:var(--danger)">-₲${gs(costoRep)}</span>
      </div>` : ''}
      ${totalPagoMecanicos > 0 && puedeVerCostos ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-top:1px solid var(--border)">
        <span style="font-size:.78rem;color:var(--text2)">Mano de obra (mecánicos)</span>
        <span style="font-size:.85rem;color:var(--danger)">-₲${gs(totalPagoMecanicos)}</span>
      </div>` : ''}
      ${(costoRep > 0 || totalPagoMecanicos > 0) && puedeVerGanancia ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-top:1px solid var(--border)">
        <span style="font-size:.78rem;font-weight:600">Ganancia real</span>
        <span style="font-family:var(--font-head);font-size:1.1rem;color:${gananciaReal > 0 ? 'var(--accent)' : 'var(--danger)'}">₲${gs(gananciaReal)} <span style="font-size:.7rem;color:var(--text2)">(${pctGanancia}%)</span></span>
      </div>` : ''}
      ${saldo > 0 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-top:1px solid var(--border);margin-top:.4rem">
        <span style="font-size:.78rem;color:var(--warning)">SALDO PENDIENTE</span>
        <span style="font-family:var(--font-head);font-size:1rem;color:var(--warning)">₲${gs(saldo)}</span>
      </div>` : totalPagado > 0 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-top:1px solid var(--border);margin-top:.4rem">
        <span style="font-size:.78rem;color:var(--success)">TOTALMENTE PAGADO</span>
        <span style="font-family:var(--font-head);font-size:.85rem;color:var(--success)">✓</span>
      </div>` : ''}
      ${puedeModificar ? `<button onclick="modalActualizarCosto('${id}',${r.costo},${r.costo_repuestos || 0})" style="width:100%;margin-top:.5rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.4rem;font-size:.72rem;color:var(--text2);cursor:pointer">✏️ Actualizar costos</button>` : ''}
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <span style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:1px">📦 ÍTEMS DETALLADOS</span>
        ${canEdit ? `<button onclick="modalAgregarItemReparacion('${id}')" style="background:var(--surface2);border:1px solid var(--border);color:var(--accent);border-radius:8px;padding:.25rem .5rem;font-size:.7rem;cursor:pointer">+ Agregar</button>` : ''}
      </div>
      ${renderItemsReparacion(items)}
      ${items.length > 0 ? `<div style="text-align:right;margin-top:.5rem;font-size:.8rem;color:var(--accent)">Total ítems: ₲${gs(items.reduce((s, i) => s + parseFloat(i.total || i.precio_unitario * i.cantidad), 0))}</div>` : ''}
    </div>

    ${r.notas ? `<div class="info-item" style="margin-bottom:1rem"><div class="label">Notas</div><div class="value">${h(r.notas)}</div></div>` : ''}
    <div id="rep-presupuesto-link"></div>

    <div id="rep-mecanicos-section" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:1px">👥 MECÁNICOS ASIGNADOS</div>
        ${canEdit ? `<button onclick="repMecanicos_modal('${id}')" style="background:var(--surface2);border:1px solid var(--border);color:var(--accent);border-radius:8px;padding:.25rem .5rem;font-size:.7rem;cursor:pointer;font-family:var(--font-head)">Gestionar</button>` : ''}
      </div>
      <div id="rep-mec-chips">Cargando...</div>
    </div>

    ${Object.keys(checklist).length > 0 ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:1px;margin-bottom:.5rem">📋 CHECKLIST DE RECEPCIÓN</div>
      ${Object.entries(checklist).map(([k, v]) => `<div style="font-size:.85rem;padding:.25rem 0;display:flex;justify-content:space-between"><span style="color:var(--text2)">${h(k)}</span><span style="color:${v === 'ok' ? 'var(--success)' : v === 'problema' ? 'var(--danger)' : 'var(--text2)'}">${v === 'ok' ? '✓ OK' : v === 'problema' ? '⚠ Problema' : '—'}</span></div>`).join('')}
    </div>` : ''}

    ${fotos.length > 0 || (r.fotos_proceso || []).length > 0 || (r.fotos_entrega || []).length > 0 ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:1px;margin-bottom:.5rem">📷 FOTOS</div>
      ${fotos.length > 0 ? `<div style="font-size:.7rem;color:var(--text2);margin-bottom:.3rem">RECEPCIÓN</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-bottom:.6rem">
        ${fotos.map(url => `<img src="${safeFotoUrl(url)}" style="width:100%;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer" onclick="window.open('${safeFotoUrl(url)}')">`).join('')}
      </div>` : ''}
      ${(r.fotos_proceso || []).length > 0 ? `<div style="font-size:.7rem;color:var(--accent2);margin-bottom:.3rem">EN PROCESO</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-bottom:.6rem">
        ${(r.fotos_proceso || []).map(url => `<img src="${safeFotoUrl(url)}" style="width:100%;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer" onclick="window.open('${safeFotoUrl(url)}')">`).join('')}
      </div>` : ''}
      ${(r.fotos_entrega || []).length > 0 ? `<div style="font-size:.7rem;color:var(--success);margin-bottom:.3rem">ENTREGA</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem">
        ${(r.fotos_entrega || []).map(url => `<img src="${safeFotoUrl(url)}" style="width:100%;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer" onclick="window.open('${safeFotoUrl(url)}')">`).join('')}
      </div>` : ''}
    </div>` : ''}

    ${isCliente && aprobacion === 'pendiente' && r.costo > 0 ? `
    <div style="background:rgba(0,229,255,.05);border:1px solid rgba(0,229,255,.2);border-radius:12px;padding:1rem;margin-bottom:1rem;text-align:center">
      <div style="font-family:var(--font-head);font-size:.9rem;color:var(--text);margin-bottom:.5rem">¿Aprobás este presupuesto?</div>
      <div style="font-size:.85rem;color:var(--text2);margin-bottom:.75rem">${h(r.descripcion)} — ₲${gs(r.costo)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
        <button onclick="aprobarPresupuestoCliente('${id}','aprobado')" style="background:rgba(0,255,136,.15);color:var(--success);border:1px solid rgba(0,255,136,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.9rem;cursor:pointer">✓ APROBAR</button>
        <button onclick="aprobarPresupuestoCliente('${id}','rechazado')" style="background:rgba(255,68,68,.1);color:var(--danger);border:1px solid rgba(255,68,68,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.9rem;cursor:pointer">✕ RECHAZAR</button>
      </div>
    </div>` : ''}

    ${canEdit ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
      ${r.estado !== 'en_progreso' ? `<button class="btn-secondary" style="margin:0;font-size:.8rem" onclick="cambiarEstado('${id}','en_progreso')">${t('enProgresoBtn')}</button>` : ''}
      ${r.estado !== 'esperando_repuestos' ? `<button class="btn-secondary" style="margin:0;font-size:.73rem;color:var(--accent2);border-color:var(--accent2)" onclick="cambiarEstado('${id}','esperando_repuestos')">⏳ Esp. repuestos</button>` : ''}
      ${r.estado !== 'finalizado' ? `<button class="btn-secondary" style="margin:0;font-size:.8rem;color:var(--success);border-color:var(--success)" onclick="cambiarEstado('${id}','finalizado')">${t('finalizarBtn')}</button>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:.5rem">
      <button class="btn-secondary" style="margin:0;font-size:.72rem;padding:.5rem .3rem" onclick="modalFotosEtapa('${id}','recepcion')">📷 Recepción</button>
      <button class="btn-secondary" style="margin:0;font-size:.72rem;padding:.5rem .3rem" onclick="modalFotosEtapa('${id}','proceso')">📷 Proceso</button>
      <button class="btn-secondary" style="margin:0;font-size:.72rem;padding:.5rem .3rem" onclick="modalFotosEtapa('${id}','entrega')">📷 Entrega</button>
    </div>
    <div style="display:grid;grid-template-columns:${puedeRegistrarCob ? '1fr 1fr' : '1fr'};gap:.5rem;margin-bottom:.5rem">
      <button class="btn-secondary" style="margin:0;font-size:.8rem" onclick="modalChecklistRecepcion('${id}')">📋 Revisión</button>
      ${puedeRegistrarCob ? `<button class="btn-secondary" style="margin:0;font-size:.8rem" onclick="modalPagosReparacion('${id}')">💰 Pagos</button>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem">
      ${r.ficha_recepcion ? `<button class="btn-secondary" style="margin:0;font-size:.8rem;color:var(--success);border-color:var(--success)" onclick="verFichaRecepcion('${id}')">📋 Ver Ficha</button>` : `<button class="btn-secondary" style="margin:0;font-size:.8rem" onclick="modalFichaRecepcion('${id}')">📋 Ficha Ingreso</button>`}
      ${r.estado === 'finalizado' ? `<button class="btn-secondary" style="margin:0;font-size:.8rem;color:var(--success);border-color:var(--success)" onclick="generarCartaConformidad('${id}')">📨 Carta Conformidad</button>` : `<button class="btn-secondary" style="margin:0;font-size:.8rem;opacity:.5" disabled>📨 Carta (al finalizar)</button>`}
    </div>
    ${aprobacion === 'pendiente' && r.clientes?.telefono ? `
    <button onclick="enviarAprobacionWhatsApp('${id}')" style="width:100%;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer;margin-bottom:.5rem">💬 Pedir aprobación por WhatsApp</button>` : ''}
    ${r.estado === 'esperando_repuestos' && r.clientes?.telefono ? `
    <button onclick="repuestoLlego_enviarWhatsApp('${id}')" style="width:100%;background:rgba(37,211,102,.12);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer;margin-bottom:.5rem">📦 Avisar al cliente que llegó el repuesto</button>` : ''}
    <div style="display:flex;gap:.5rem">
      <button class="btn-secondary" style="margin:0" onclick="modalEditarReparacion('${id}')">${t('editarBtn')}</button>
      ${isAdmin ? `<button class="btn-danger" style="margin:0" onclick="eliminarReparacion('${id}')">${t('eliminarBtn')}</button>` : ''}
      ${isAdmin ? `<button class="btn-add" style="flex:1;justify-content:center" onclick="modalNuevoPresupuesto(null,'${id}')">🧾 Presupuesto</button>` : ''}
    </div>` : ''}`;

  repMecanicos_cargar(id).then(mecs => {
    const el = document.getElementById('rep-mec-chips');
    if (el) el.innerHTML = repMecanicos_renderChips(mecs);
  });

  sb.from('presupuestos_v2').select('id,descripcion,total').eq('reparacion_id', id).maybeSingle().then(({ data: ppto }) => {
    const linkEl = document.getElementById('rep-presupuesto-link');
    if (linkEl && ppto) {
      linkEl.innerHTML = `<div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);border-radius:10px;padding:.6rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="detallePresupuesto('${ppto.id}')">
        <div><div style="font-size:.68rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px">PRESUPUESTO ORIGEN</div><div style="font-size:.82rem;color:var(--text)">${h(ppto.descripcion || 'Presupuesto')} — ₲${gs(ppto.total || 0)}</div></div>
        <span style="color:var(--accent);font-size:.85rem">Ver →</span>
      </div>`;
    }
  });
}

async function cambiarEstado(id, estado) {
  const { data: rep } = await sb.from('reparaciones').select('costo, descripcion, clientes(nombre)').eq('id', id).single();

  if (estado === 'finalizado') {
    const { data: pagos } = await sb.from('pagos_reparacion').select('monto').eq('reparacion_id', id);
    const totalPagado = (pagos || []).reduce((s, p) => s + parseFloat(p.monto || 0), 0);
    const saldo = parseFloat(rep.costo || 0) - totalPagado;

    if (saldo > 0) {
      const confirmMsg = `Queda un saldo pendiente de ₲${gs(saldo)}. ¿Registrar pago completo ahora?`;
      if (confirm(confirmMsg)) {
        closeModal();
        await modalPagosReparacion(id, saldo);
        return;
      }
    }

    if (totalPagado === 0 && rep.costo > 0) {
      const categoriaId = await obtenerCategoriaFinanciera('Reparaciones', 'ingreso');
      if (categoriaId) {
        const { data: existe } = await sb.from('movimientos_financieros').select('id').eq('taller_id', tid()).eq('referencia_id', id).eq('referencia_tabla', 'reparaciones').limit(1);
        if (!existe?.length) {
          await sb.from('movimientos_financieros').insert({
            taller_id: tid(),
            tipo: 'ingreso',
            categoria_id: categoriaId,
            monto: rep.costo,
            concepto: 'Trabajo: ' + (rep.descripcion || '') + (rep.clientes ? ' — ' + rep.clientes.nombre : ''),
            fecha: new Date().toISOString().split('T')[0],
            referencia_id: id,
            referencia_tabla: 'reparaciones'
          });
        }
      }
    }
  }

  await offlineUpdate('reparaciones', { estado }, 'id', id);
  clearCache('reparaciones');
  toast('Estado actualizado', 'success');
  detalleReparacion(id);
}

function aprobarPresupuestoCliente(repId, decision) {
  const confirmMsg = decision === 'aprobado'
    ? '¿Confirmás que aprobás este presupuesto?'
    : '¿Confirmás que rechazás este presupuesto?';
  if (!confirm(confirmMsg)) return;
  safeCall(async () => {
    await offlineUpdate('reparaciones', { aprobacion_cliente: decision, fecha_aprobacion: new Date().toISOString() }, 'id', repId);
    toast(decision === 'aprobado' ? 'Presupuesto aprobado' : 'Presupuesto rechazado', decision === 'aprobado' ? 'success' : 'error');
    detalleReparacion(repId);
  }, null, 'No se pudo procesar la aprobación');
}

function enviarAprobacionWhatsApp(repId) {
  sb.from('reparaciones').select('*, clientes(nombre,telefono), vehiculos(patente)').eq('id', repId).single().then(({ data: r }) => {
    if (!r?.clientes?.telefono) return;
    const tel = r.clientes.telefono.replace(/\D/g, '');
    const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';
    const msg = `Hola ${r.clientes.nombre}! Soy del taller ${tallerNombre}. Te paso el presupuesto para tu vehículo ${r.vehiculos?.patente || ''}:\n\n🔧 ${r.descripcion}\n💰 Costo: ₲${gs(r.costo)}\n\n¿Aprobás este trabajo? Respondé con SI o NO.`;
    window.open(`https://wa.me/595${tel}?text=${encodeURIComponent(msg)}`);
  });
}

function modalActualizarCosto(id, costoActual, repuestosActual) {
  openModal(`
    <div class="modal-title">✏️ Actualizar costos</div>
    <div class="form-group"><label class="form-label">Cobrado al cliente ₲</label><input class="form-input" id="f-upd-costo" type="number" min="0" value="${costoActual || 0}"></div>
    <div class="form-group"><label class="form-label">Gastado en repuestos ₲</label><input class="form-input" id="f-upd-rep" type="number" min="0" value="${repuestosActual || 0}"></div>
    <div class="form-group"><label class="form-label">Notas adicionales</label><textarea class="form-input" id="f-upd-notas" rows="2" placeholder="Cambió el presupuesto porque..."></textarea></div>
    <button class="btn-primary" onclick="guardarActualizarCosto('${id}')">Actualizar</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function guardarActualizarCosto(id) {
  if (typeof esAdmin === 'function' && !esAdmin() && !(typeof tienePerm === 'function' && tienePerm('modificar_precios'))) {
    toast('No tenés permisos para modificar costos','error');
    return;
  }
  await safeCall(async () => {
    const costo = parseFloat(document.getElementById('f-upd-costo').value) || 0;
    const rep = parseFloat(document.getElementById('f-upd-rep').value) || 0;
    const notasExtra = document.getElementById('f-upd-notas').value.trim();
    const updates = { costo, costo_repuestos: rep };
    if (notasExtra) {
      const { data: r } = await sb.from('reparaciones').select('notas').eq('id', id).single();
      updates.notas = ((r?.notas || '') + '\n' + notasExtra).trim();
    }
    await sb.from('reparaciones').update(updates).eq('id', id);
    clearCache('reparaciones');
    toast('Costos actualizados', 'success');
    closeModal();
    detalleReparacion(id);
  }, null, 'No se pudo actualizar los costos');
}
