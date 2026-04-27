// ─── PARA HOY (Vista personal del día) ─────────────────────────────────────
// Tarea #29: pantalla unificada para que admin/empleado vea de un toque
// qué tiene que hacer hoy:
//   1) Trabajos asignados en curso (pendiente / en_progreso).
//   2) Turnos del día donde es responsable (`citas.responsable_id`). Para
//      admin se muestran todos los turnos del taller con etiqueta de
//      responsable; para empleado solo los que le corresponden.
//   3) Reparaciones en `esperando_repuestos` cuyos repuestos llegaron al
//      stock recientemente (cruce vía `reparacion_items.inventario_id`
//      contra `movimientos_inventario` tipo='entrada' de los últimos 7 días).
//      Como fallback, si los ítems no están linkeados al inventario, se
//      cruza por nombre (case-insensitive).
//
// Resolución de "mis asignaciones": reparacion_mecanicos.empleado_id =
// currentPerfil.empleado_id (si el perfil está vinculado) O bien
// reparacion_mecanicos.mecanico_id = auth.uid() (asignaciones viejas que
// guardaban el user uuid). Mismo criterio que misTrabajos / Mi Cobro.
//
// Las columnas `citas.responsable_id` y `reparacion_items.inventario_id`
// se crean en supabase/rls_policies.sql (sección 3.D). Si todavía no se
// corrió la migración, las queries hacen fallback graceful sin romper.
async function paraHoy() {
  const rol = currentPerfil?.rol;
  if (rol !== 'admin' && rol !== 'empleado') { dashboard(); return; }

  const tallerId = tid();
  const userId = currentUser?.id || null;
  const empId = currentPerfil?.empleado_id || null;
  const hoy = fechaHoy();

  // ── Mis asignaciones ────────────────────────────────────────────────────
  let misRepIds = [];
  if (empId || userId) {
    const ors = [];
    if (userId) ors.push(`mecanico_id.eq.${userId}`);
    if (empId)  ors.push(`empleado_id.eq.${empId}`);
    const { data: asign } = await sb.from('reparacion_mecanicos')
      .select('reparacion_id')
      .or(ors.join(','));
    misRepIds = [...new Set((asign || []).map(a => a.reparacion_id).filter(Boolean))];
  }

  // ── Reparaciones activas (mías; si soy admin sin asignación, taller-wide) ──
  let misReps = [];
  if (misRepIds.length > 0) {
    const { data } = await sb.from('reparaciones')
      .select('id,descripcion,estado,fecha,updated_at,tipo_trabajo,vehiculos(patente,marca,modelo),clientes(nombre)')
      .eq('taller_id', tallerId)
      .in('id', misRepIds)
      .in('estado', ['pendiente', 'en_progreso', 'esperando_repuestos'])
      .order('updated_at', { ascending: false });
    misReps = data || [];
  } else if (rol === 'admin') {
    const { data } = await sb.from('reparaciones')
      .select('id,descripcion,estado,fecha,updated_at,tipo_trabajo,vehiculos(patente,marca,modelo),clientes(nombre)')
      .eq('taller_id', tallerId)
      .in('estado', ['pendiente', 'en_progreso', 'esperando_repuestos'])
      .order('updated_at', { ascending: false })
      .limit(50);
    misReps = data || [];
  }

  const enCurso     = misReps.filter(r => r.estado === 'pendiente' || r.estado === 'en_progreso');
  const espRepuestos = misReps.filter(r => r.estado === 'esperando_repuestos');

  // ── Turnos del día filtrados por responsable ─────────────────────────────
  // Empleado → solo SUS turnos. Admin → todos los turnos del taller con
  // etiqueta de responsable visible. Si la columna no fue migrada, se hace
  // fallback a vista taller-wide para no romper la pantalla.
  // Detector de "columna no migrada todavía" (PostgREST devuelve mensajes
  // que mencionan la columna). Solo en ese caso degradamos a la vista
  // taller-wide; cualquier otro error (red, RLS, etc.) se propaga como
  // fallo controlado para no sobreexponer turnos a un empleado.
  const esErrorColumnaResponsable = err => {
    if (!err) return false;
    const msg = (err.message || '') + ' ' + (err.details || '') + ' ' + (err.hint || '');
    return /responsable_id/i.test(msg) && (/column|does not exist|schema cache|undefined/i.test(msg));
  };

  let turnos = [];
  let turnosFiltradoOk = true;
  let migracionPendiente = false;
  let turnosError = null;
  const baseSelect = 'id,descripcion,fecha,hora,estado,responsable_id,clientes(nombre,telefono),vehiculos(patente,marca,modelo)';
  if (rol === 'empleado') {
    if (!empId) {
      turnos = []; // sin vinculación a empleado, no hay turnos asignables
    } else {
      const { data, error } = await sb.from('citas')
        .select(baseSelect)
        .eq('taller_id', tallerId)
        .eq('fecha', hoy)
        .eq('responsable_id', empId)
        .in('estado', ['pendiente', 'confirmada'])
        .order('hora', { ascending: true });
      if (error) {
        if (esErrorColumnaResponsable(error)) {
          // Columna no existe → mostrar 0 turnos al empleado (NO taller-wide)
          // para evitar exponer turnos ajenos. El admin verá el banner.
          migracionPendiente = true;
          turnosFiltradoOk = false;
          turnos = [];
        } else {
          turnosError = error;
        }
      } else {
        turnos = data || [];
      }
    }
  } else {
    const { data, error } = await sb.from('citas')
      .select(baseSelect)
      .eq('taller_id', tallerId)
      .eq('fecha', hoy)
      .in('estado', ['pendiente', 'confirmada'])
      .order('hora', { ascending: true });
    if (error) {
      if (esErrorColumnaResponsable(error)) {
        // Admin: caer al select sin la columna; sigue mostrando todos los
        // turnos del taller, solo sin etiqueta de responsable.
        migracionPendiente = true;
        turnosFiltradoOk = false;
        const { data: fb } = await sb.from('citas')
          .select('id,descripcion,fecha,hora,estado,clientes(nombre,telefono),vehiculos(patente,marca,modelo)')
          .eq('taller_id', tallerId)
          .eq('fecha', hoy)
          .in('estado', ['pendiente', 'confirmada'])
          .order('hora', { ascending: true });
        turnos = fb || [];
      } else {
        turnosError = error;
      }
    } else {
      turnos = data || [];
    }
  }
  if (turnosError) {
    console.warn('[para-hoy] no se pudieron cargar los turnos:', turnosError);
    if (typeof toast === 'function') toast('No se pudieron cargar los turnos: ' + (turnosError.message || ''), 'error');
  }

  // Resolver nombres de responsables para el rol admin.
  const respIds = [...new Set(turnos.map(c => c.responsable_id).filter(Boolean))];
  const respNombres = {};
  if (respIds.length > 0) {
    const { data: emps } = await sb.from('empleados').select('id,nombre').in('id', respIds);
    (emps || []).forEach(e => { respNombres[e.id] = e.nombre; });
  }

  // ── Repuestos llegaron: cruzar items de esperando_repuestos vs entradas ──
  // 1. Ítems de las reparaciones esperando_repuestos.
  // 2. Movimientos de inventario tipo='entrada' de los últimos 7 días.
  // 3. Match por inventario_id (preferido) o por nombre (fallback).
  const repuestosLlegaron = new Set();
  const llegaronPorRep = {}; // rep_id → [{nombre, cantidad, dias}]
  let entradasRecientesCount = 0;

  if (espRepuestos.length > 0) {
    const repIds = espRepuestos.map(r => r.id);
    const itemsSelect = 'reparacion_id,descripcion,inventario_id';
    let items = [];
    try {
      const { data, error } = await sb.from('reparacion_items')
        .select(itemsSelect)
        .in('reparacion_id', repIds);
      if (error) throw error;
      items = data || [];
    } catch (_) {
      // inventario_id no migrado → reintentar solo con descripcion.
      migracionPendiente = true;
      const { data } = await sb.from('reparacion_items')
        .select('reparacion_id,descripcion')
        .in('reparacion_id', repIds);
      items = data || [];
    }

    const limite7 = new Date(Date.now() - 7 * 86400000).toISOString();
    let entradas = [];
    try {
      const { data } = await sb.from('movimientos_inventario')
        .select('inventario_id,cantidad,created_at,inventario(nombre)')
        .eq('taller_id', tallerId)
        .eq('tipo', 'entrada')
        .gte('created_at', limite7)
        .order('created_at', { ascending: false });
      entradas = data || [];
    } catch (_) { entradas = []; }
    entradasRecientesCount = entradas.length;

    // Index entradas por inventario_id y por nombre normalizado.
    const entradasByInvId = {};
    const entradasByNombre = {};
    const norm = s => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
    entradas.forEach(e => {
      if (e.inventario_id) entradasByInvId[e.inventario_id] = e;
      const nm = norm(e.inventario?.nombre);
      if (nm) entradasByNombre[nm] = e;
    });

    // Para fallback por nombre cuando los ítems no tienen inventario_id,
    // necesitamos también el catálogo del taller para poder matchear.
    let catalogoByNombre = {};
    if (Object.keys(entradasByInvId).length === 0 && entradas.length === 0) {
      // No hay entradas → no hay nada que cruzar.
    } else {
      const { data: cat } = await sb.from('inventario')
        .select('id,nombre')
        .eq('taller_id', tallerId);
      (cat || []).forEach(p => { catalogoByNombre[norm(p.nombre)] = p; });
    }

    items.forEach(it => {
      let entrada = null;
      if (it.inventario_id && entradasByInvId[it.inventario_id]) {
        entrada = entradasByInvId[it.inventario_id];
      } else {
        const nm = norm(it.descripcion);
        if (nm && entradasByNombre[nm]) {
          entrada = entradasByNombre[nm];
        } else if (nm && catalogoByNombre[nm] && entradasByInvId[catalogoByNombre[nm].id]) {
          entrada = entradasByInvId[catalogoByNombre[nm].id];
        }
      }
      if (entrada) {
        repuestosLlegaron.add(it.reparacion_id);
        const dias = Math.floor((Date.now() - new Date(entrada.created_at).getTime()) / 86400000);
        (llegaronPorRep[it.reparacion_id] = llegaronPorRep[it.reparacion_id] || []).push({
          nombre: entrada.inventario?.nombre || it.descripcion,
          cantidad: entrada.cantidad,
          dias
        });
      }
    });
  }

  const espLlegaron     = espRepuestos.filter(r => repuestosLlegaron.has(r.id));
  const espAunEsperando = espRepuestos.filter(r => !repuestosLlegaron.has(r.id));

  // ── Render ───────────────────────────────────────────────────────────────
  const nombre = currentPerfil?.nombre || '';
  const fechaLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  // Formato unificado del vehículo: "PATENTE · MARCA MODELO" (omite las
  // partes vacías para no quedar con texto colgado en pantallas chicas).
  const vehStr = v => {
    if (!v) return '';
    const mm = [v.marca, v.modelo].filter(Boolean).map(h).join(' ');
    return h(v.patente) + (mm ? ' · ' + mm : '');
  };

  const turnoCard = c => `
    <div class="card" onclick="detalleCita('${h(c.id)}')">
      <div class="card-header">
        <div class="card-avatar">📅</div>
        <div class="card-info">
          <div class="card-name">${c.hora ? h(c.hora.slice(0, 5)) + ' · ' : ''}${h(c.descripcion)}</div>
          <div class="card-sub">${c.clientes ? h(c.clientes.nombre) : 'Sin cliente'}${c.vehiculos ? ' · ' + vehStr(c.vehiculos) : ''}</div>
          ${rol === 'admin' && c.responsable_id ? `<div class="card-sub" style="color:var(--accent)">👤 ${h(respNombres[c.responsable_id] || '...')}</div>` : ''}
          ${rol === 'admin' && !c.responsable_id ? `<div class="card-sub" style="color:var(--text2)">👤 Sin responsable</div>` : ''}
        </div>
        <span class="card-badge ${c.estado === 'confirmada' ? 'badge-blue' : 'badge-yellow'}">${c.estado === 'confirmada' ? 'CONFIRMADA' : 'PENDIENTE'}</span>
      </div>
    </div>`;

  const repCard = (r, extra) => {
    let dias = '';
    if (r.updated_at) {
      const d = Math.max(0, Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86400000));
      if (d >= 1) {
        const color = d >= 14 ? 'var(--danger)' : d >= 7 ? 'var(--warning)' : 'var(--text2)';
        dias = `<div class="card-sub" style="color:${color};font-weight:600">⏱ ${d} día${d > 1 ? 's' : ''} esperando</div>`;
      }
    }
    return `
      <div class="card" onclick="detalleReparacion('${h(r.id)}')">
        <div class="card-header">
          <div class="card-avatar">${TIPO_ICONS[r.tipo_trabajo] || '🔧'}</div>
          <div class="card-info">
            <div class="card-name">${h(r.descripcion)}</div>
            <div class="card-sub">${r.vehiculos ? vehStr(r.vehiculos) : 'Sin vehículo'}${r.clientes ? ' · ' + h(r.clientes.nombre) : ''}</div>
            ${dias}
            ${extra || ''}
          </div>
          <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
        </div>
      </div>`;
  };

  const turnosTitulo = rol === 'empleado'
    ? `📅 MIS TURNOS DE HOY (${turnos.length})`
    : `📅 TURNOS DE HOY (${turnos.length})`;
  const turnosVacioMsg = rol === 'empleado'
    ? (!turnosFiltradoOk
        ? 'Aún no se aplicó la migración para asignar responsables a los turnos. Pedile al admin que actualice la base.'
        : (empId
            ? 'No tenés turnos asignados para hoy. Pedile al admin que te asigne como responsable cuando agende uno.'
            : 'Tu usuario no está vinculado a un empleado. Pedile al admin que te asocie para ver tus turnos.'))
    : 'No hay turnos agendados para hoy';

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="font-family:var(--font-head);font-size:1.4rem;color:var(--text);margin-bottom:.15rem">📋 Para hoy</div>
      <div style="font-size:.78rem;color:var(--text2);margin-bottom:1rem;text-transform:capitalize">${h(nombre)} · ${h(fechaLabel)}</div>

      ${migracionPendiente && rol === 'admin' ? `
        <div style="background:rgba(255,193,7,.08);border:1px solid rgba(255,193,7,.3);border-radius:10px;padding:.55rem .75rem;margin-bottom:.8rem;font-size:.75rem;color:var(--text2)">
          ⚠️ Para que cada empleado vea solo SUS turnos y se detecten repuestos llegados, corré la última versión de <code>supabase/rls_policies.sql</code> (sección 3.D).
        </div>` : ''}

      <div class="stats-grid" style="margin-bottom:1rem">
        <div class="stat-card"><div class="stat-value" style="color:var(--accent2)">${enCurso.length}</div><div class="stat-label">MIS TRABAJOS</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${turnos.length}</div><div class="stat-label">${rol === 'empleado' ? 'MIS TURNOS' : 'TURNOS HOY'}</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${espRepuestos.length}</div><div class="stat-label">ESP. REPUESTOS</div></div>
      </div>

      <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1.5px;margin:.6rem 0 .4rem;display:flex;align-items:center;gap:.5rem">
        <span>🔧 MIS TRABAJOS EN CURSO (${enCurso.length})</span>
        ${misRepIds.length === 0 && rol === 'admin' ? '<span style="font-size:.6rem;color:var(--text2);background:var(--surface2);border-radius:6px;padding:1px 6px">overview taller</span>' : ''}
      </div>
      ${enCurso.length === 0 ? `
        <div class="empty" style="padding:.75rem"><p style="font-size:.82rem">${misRepIds.length === 0 && rol === 'empleado' ? 'No tenés trabajos asignados todavía.' : 'No tenés trabajos pendientes ni en progreso. ¡Buen momento para tomar uno nuevo!'}</p></div>` :
        enCurso.map(r => `
          <div class="card" onclick="detalleReparacion('${h(r.id)}')">
            <div class="card-header">
              <div class="card-avatar">${TIPO_ICONS[r.tipo_trabajo] || '🔧'}</div>
              <div class="card-info">
                <div class="card-name">${h(r.descripcion)}</div>
                <div class="card-sub">${r.vehiculos ? vehStr(r.vehiculos) : 'Sin vehículo'}${r.clientes ? ' · ' + h(r.clientes.nombre) : ''}</div>
                <div class="card-sub">${formatFecha(r.fecha)}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
                <button onclick="event.stopPropagation();paraHoy_marcarHecho('${h(r.id)}')" style="font-size:.65rem;background:rgba(0,255,136,.12);border:1px solid rgba(0,255,136,.35);color:var(--success);border-radius:6px;padding:3px 9px;cursor:pointer;font-family:var(--font-head);letter-spacing:.5px">✓ HECHO HOY</button>
              </div>
            </div>
          </div>`).join('')}

      <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1.5px;margin:1.2rem 0 .4rem">${turnosTitulo}${!turnosFiltradoOk && rol === 'empleado' ? ' <span style="font-size:.6rem;color:var(--warning);background:rgba(255,193,7,.1);border-radius:6px;padding:1px 6px">requiere migración</span>' : (!turnosFiltradoOk && rol === 'admin' ? ' <span style="font-size:.6rem;color:var(--warning);background:rgba(255,193,7,.1);border-radius:6px;padding:1px 6px">sin filtro responsable</span>' : '')}</div>
      ${turnos.length === 0 ? `
        <div class="empty" style="padding:.75rem"><p style="font-size:.82rem">${turnosVacioMsg}</p></div>` :
        turnos.map(turnoCard).join('')}

      ${espLlegaron.length > 0 ? `
        <div style="font-family:var(--font-head);font-size:.75rem;color:var(--success);letter-spacing:1.5px;margin:1.2rem 0 .4rem">
          ✅ REPUESTOS LLEGARON (${espLlegaron.length})
        </div>
        ${espLlegaron.map(r => {
          const llegados = (llegaronPorRep[r.id] || []);
          const extra = `<div style="margin-top:.3rem;padding:.4rem .55rem;background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.25);border-radius:8px;font-size:.72rem;color:var(--text)">
            <div style="color:var(--success);font-weight:600;margin-bottom:.2rem">📦 Llegó al stock:</div>
            ${llegados.slice(0, 3).map(l => `<div>• ${h(l.nombre)}${l.cantidad ? ' (x' + l.cantidad + ')' : ''} <span style="color:var(--text2)">— hace ${l.dias} día${l.dias === 1 ? '' : 's'}</span></div>`).join('')}
            ${llegados.length > 3 ? `<div style="color:var(--text2)">+${llegados.length - 3} más</div>` : ''}
          </div>`;
          return repCard(r, extra);
        }).join('')}` : ''}

      <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1.5px;margin:1.2rem 0 .4rem">📦 ESPERAN REPUESTOS (${espAunEsperando.length})</div>
      ${espAunEsperando.length === 0 ? `
        <div class="empty" style="padding:.75rem"><p style="font-size:.82rem">${espRepuestos.length === 0 ? 'No tenés trabajos esperando repuestos' : '¡Todos los que esperabas ya llegaron! 🎉'}</p></div>` :
        espAunEsperando.map(r => repCard(r)).join('')}

      ${espRepuestos.length > 0 && entradasRecientesCount === 0 ? `
        <div style="font-size:.7rem;color:var(--text2);margin-top:.5rem">No hubo entradas de inventario en los últimos 7 días.</div>` : ''}
    </div>`;
}

// Atajo "Hecho hoy": marca la reparación como finalizada con un toque.
async function paraHoy_marcarHecho(repId) {
  confirmar('¿Marcar este trabajo como finalizado?', async () => {
    await safeCall(async () => {
      await offlineUpdate('reparaciones', {
        estado: 'finalizado',
        updated_at: new Date().toISOString()
      }, 'id', repId);
      if (typeof clearCache === 'function') clearCache('reparaciones');
      toast('✓ Marcado como hecho', 'success');
      paraHoy();
    }, null, 'No se pudo marcar como hecho');
  });
}

window.paraHoy = paraHoy;
window.paraHoy_marcarHecho = paraHoy_marcarHecho;
