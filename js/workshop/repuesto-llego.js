// ─── AVISO "REPUESTO LLEGÓ" AL CLIENTE (Tarea #30) ──────────────────────────
// Cuando entra una mercadería al stock vinculada a una reparación que estaba
// `esperando_repuestos`, marcamos la reparación con `repuesto_disponible_at`
// y ofrecemos al taller mandar un WhatsApp al cliente para que coordine la
// instalación.
//
// Punto de entrada principal: `repuestoLlego_chequear(invIds, nombresExtra)`.
// Lo invoca `inventario.js` después de registrar una entrada.
//
// Compatibilidad: si `reparacion_items.inventario_id` no fue migrado (3.D)
// o `reparaciones.repuesto_disponible_at` no fue migrado (3.E), las queries
// hacen fallback graceful (match por nombre) y/o solo no marcan la columna.

// ── Detección ───────────────────────────────────────────────────────────────
// invIds: array con uno o más inventario_id que acaban de recibir entrada.
// nombresFallback: array de nombres por si no hay link inventario_id en items.
// Devuelve: [{ rep, items: [{descripcion,cantidad}] }] cruzando por id o nombre.
async function repuestoLlego_detectar(invIds, nombresFallback) {
  const tallerId = (typeof tid === 'function') ? tid() : null;
  if (!tallerId) return [];

  invIds = (invIds || []).filter(Boolean);
  const nombresNorm = (nombresFallback || []).map(n => (n || '').toLowerCase().trim()).filter(Boolean);

  // 1) Reparaciones del taller en estado esperando_repuestos.
  const { data: reps, error: errReps } = await sb.from('reparaciones')
    .select('id,descripcion,estado,repuesto_disponible_at,vehiculos(patente,marca,modelo),clientes(nombre,telefono)')
    .eq('taller_id', tallerId)
    .eq('estado', 'esperando_repuestos');
  // Si la columna repuesto_disponible_at no fue migrada todavía, reintentamos
  // sin pedirla para que la detección igual funcione.
  let repsList = reps || [];
  if (errReps) {
    const msg = (errReps.message || '') + ' ' + (errReps.details || '');
    if (/repuesto_disponible_at/i.test(msg)) {
      const { data: reps2 } = await sb.from('reparaciones')
        .select('id,descripcion,estado,vehiculos(patente,marca,modelo),clientes(nombre,telefono)')
        .eq('taller_id', tallerId)
        .eq('estado', 'esperando_repuestos');
      repsList = reps2 || [];
    } else {
      console.warn('[repuestoLlego] error consultando reparaciones:', errReps);
      return [];
    }
  }
  if (repsList.length === 0) return [];

  const repIds = repsList.map(r => r.id);

  // 2) Items de esas reparaciones.
  let items = [];
  try {
    const { data, error } = await sb.from('reparacion_items')
      .select('reparacion_id,descripcion,cantidad,inventario_id')
      .in('reparacion_id', repIds);
    if (error) throw error;
    items = data || [];
  } catch (_) {
    // inventario_id no migrado → solo descripción.
    const { data } = await sb.from('reparacion_items')
      .select('reparacion_id,descripcion,cantidad')
      .in('reparacion_id', repIds);
    items = data || [];
  }
  if (items.length === 0) return [];

  // 3) Cruzar items contra los inv. recién entrados (por id o por nombre).
  const norm = s => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const invIdSet = new Set(invIds.map(String));
  const nombreSet = new Set(nombresNorm.map(norm));

  // Para fallback por nombre cuando los items no traen inventario_id, traemos
  // el catálogo de los inventarios entrados para poder mapear nombre → id.
  const nombreById = {};
  if (invIds.length > 0) {
    const { data: cat } = await sb.from('inventario')
      .select('id,nombre').in('id', invIds);
    (cat || []).forEach(p => { nombreById[p.id] = norm(p.nombre); });
  }

  const matchPorRep = {}; // rep_id → [{descripcion, cantidad}]
  items.forEach(it => {
    let hit = false;
    if (it.inventario_id && invIdSet.has(String(it.inventario_id))) hit = true;
    if (!hit) {
      const nm = norm(it.descripcion);
      if (nm && nombreSet.has(nm)) hit = true;
    }
    if (!hit && it.inventario_id && nombreById[it.inventario_id]) {
      // Por completitud, no debería diferir, pero protege contra typos.
      if (nombreSet.has(nombreById[it.inventario_id])) hit = true;
    }
    if (hit) {
      (matchPorRep[it.reparacion_id] = matchPorRep[it.reparacion_id] || [])
        .push({ descripcion: it.descripcion, cantidad: it.cantidad });
    }
  });

  return repsList
    .filter(r => matchPorRep[r.id])
    .map(r => ({ rep: r, items: matchPorRep[r.id] }));
}

// ── Marcado en BD: setea `repuesto_disponible_at` (si la columna existe). ──
async function repuestoLlego_marcar(repIds) {
  if (!repIds || repIds.length === 0) return;
  try {
    const { error } = await sb.from('reparaciones')
      .update({ repuesto_disponible_at: new Date().toISOString() })
      .in('id', repIds)
      .is('repuesto_disponible_at', null); // no pisar si ya estaba marcado
    if (error) {
      const msg = (error.message || '') + ' ' + (error.details || '');
      if (/repuesto_disponible_at/i.test(msg)) {
        // Columna no migrada (3.E): no es bloqueante, seguimos.
        console.info('[repuestoLlego] columna repuesto_disponible_at no migrada, salteo el marcado.');
      } else {
        console.warn('[repuestoLlego] no pude marcar repuesto_disponible_at:', error);
      }
    }
  } catch (e) {
    console.warn('[repuestoLlego] excepción marcando repuesto_disponible_at:', e);
  }
}

// ── Hook principal: chequea + marca + ofrece avisar al cliente. ───────────
// Llamado desde inventario.js tras una entrada de mercadería.
async function repuestoLlego_chequear(invIds, nombresFallback) {
  try {
    const detalles = await repuestoLlego_detectar(invIds, nombresFallback);
    if (detalles.length === 0) return;

    await repuestoLlego_marcar(detalles.map(d => d.rep.id));
    if (typeof clearCache === 'function') clearCache('reparaciones');

    repuestoLlego_modal(detalles);
  } catch (e) {
    console.warn('[repuestoLlego] chequeo falló:', e);
  }
}

// ── Modal: lista las reparaciones con repuesto disponible y permite avisar. ──
function repuestoLlego_modal(detalles) {
  if (!detalles || detalles.length === 0) return;
  const filas = detalles.map(({ rep, items }) => {
    const cli = rep.clientes?.nombre || 'Sin cliente';
    const veh = rep.vehiculos ? (rep.vehiculos.patente || '') + ' ' + (rep.vehiculos.marca || '') : '';
    const tieneTel = !!rep.clientes?.telefono;
    const itemsStr = items.slice(0, 3).map(i => `${h(i.descripcion)}${i.cantidad > 1 ? ' x' + i.cantidad : ''}`).join(', ');
    return `
      <div style="border:1px solid var(--border);border-radius:10px;padding:.6rem;margin-bottom:.5rem;background:var(--surface2)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
          <div style="min-width:0;flex:1">
            <div style="font-size:.85rem;color:var(--text);font-weight:600">${h(rep.descripcion || 'Reparación')}</div>
            <div style="font-size:.72rem;color:var(--text2);margin-top:.15rem">${h(cli)}${veh ? ' · ' + h(veh) : ''}</div>
            <div style="font-size:.7rem;color:var(--success);margin-top:.2rem">📦 Llegó: ${itemsStr}${items.length > 3 ? ' …' : ''}</div>
          </div>
        </div>
        <div style="display:flex;gap:.4rem;margin-top:.5rem">
          <button onclick="closeModal();detalleReparacion('${h(rep.id)}')" style="flex:1;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:.4rem;font-size:.72rem;cursor:pointer">Ver trabajo</button>
          ${tieneTel ? `<button onclick="repuestoLlego_enviarWhatsApp('${h(rep.id)}')" style="flex:1;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:8px;padding:.4rem;font-size:.72rem;cursor:pointer;font-family:var(--font-head)">💬 Avisar al cliente</button>` : `<button disabled style="flex:1;background:var(--surface);color:var(--text2);border:1px solid var(--border);border-radius:8px;padding:.4rem;font-size:.72rem;opacity:.6">Sin teléfono</button>`}
        </div>
      </div>`;
  }).join('');

  openModal(`
    <div class="modal-title">📦 Repuestos disponibles</div>
    <div style="font-size:.82rem;color:var(--text2);margin-bottom:.75rem">
      ${detalles.length === 1
        ? 'Hay 1 trabajo esperando este repuesto. Avisale al cliente para coordinar la instalación.'
        : `Hay ${detalles.length} trabajos esperando estos repuestos. Avisales a los clientes para coordinar la instalación.`}
    </div>
    ${filas}
    <button class="btn-secondary" onclick="closeModal()">Cerrar</button>
  `);
}

// ── Armado del WhatsApp para una reparación puntual. ──────────────────────
async function repuestoLlego_enviarWhatsApp(repId) {
  const { data: r } = await sb.from('reparaciones')
    .select('id,descripcion,clientes(nombre,telefono),vehiculos(patente,marca,modelo)')
    .eq('id', repId).single();
  if (!r) { toast('No encontré la reparación', 'error'); return; }
  const tel = (r.clientes?.telefono || '').replace(/\D/g, '');
  if (!tel) { toast('El cliente no tiene teléfono', 'error'); return; }

  // Deep-link para que el cliente caiga directo en la ficha de la reparación
  // tras loguearse. El handler vive en `js/auth/auth.js` (showApp →
  // urlParams.get('rep')). Se usa el origin del taller (la URL pública desde
  // donde estamos operando), así sirve para staging/prod por igual.
  let link = '';
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      link = `${window.location.origin}/?rep=${encodeURIComponent(r.id)}`;
    }
  } catch (_) { /* no-op */ }

  const datos = {
    cliente: r.clientes?.nombre || '',
    vehiculo: r.vehiculos ? ((r.vehiculos.patente || '') + ' ' + (r.vehiculos.marca || '') + ' ' + (r.vehiculos.modelo || '')).trim() : '',
    descripcion: r.descripcion || '',
    taller: (typeof currentPerfil !== 'undefined' && currentPerfil?.talleres?.nombre) || 'el taller',
    link
  };

  let mensaje;
  if (typeof recordatorio_getMensaje === 'function') {
    mensaje = recordatorio_getMensaje('repuesto_listo', datos);
  }
  if (!mensaje) {
    mensaje = `Hola ${datos.cliente}! Te avisamos desde ${datos.taller} que ya llegó el repuesto que esperabas para tu ${datos.vehiculo}. ¿Cuándo te queda cómodo traerlo para la instalación de "${datos.descripcion}"?${link ? '\n\nIngresá acá para confirmar y agendar: ' + link : ''}`;
  } else if (link && !mensaje.includes(link)) {
    // Si la plantilla configurada NO incluye {link}, lo agregamos al final
    // para que el WhatsApp siempre lleve el enlace accionable de agendamiento.
    mensaje += `\n\nIngresá acá para confirmar y agendar: ${link}`;
  }

  window.open(`https://wa.me/595${tel}?text=${encodeURIComponent(mensaje)}`);
}

// Exponer en window para los onclicks inline.
if (typeof window !== 'undefined') {
  window.repuestoLlego_chequear = repuestoLlego_chequear;
  window.repuestoLlego_modal = repuestoLlego_modal;
  window.repuestoLlego_enviarWhatsApp = repuestoLlego_enviarWhatsApp;
  window.repuestoLlego_detectar = repuestoLlego_detectar;
}
