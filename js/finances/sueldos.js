// ─── MEJORA #7: GESTIÓN DE SUELDOS ──────────────────────────────────────────

async function sueldos() {
  if (typeof requireAdmin === 'function' && !requireAdmin('No tenés acceso a esta sección')) {
    navigate('dashboard');
    return;
  }
  const { data: periodos } = await sb.from('periodos_sueldo').select('*').eq('taller_id', tid()).order('fecha_inicio', {ascending:false});

  // Tarea #57: el constraint EXCLUDE de la Tarea #56 evita NUEVOS solapados,
  // pero los pares que ya estaban cargados antes del fix siguen ahí. Sobre la
  // lista que ya trajimos, buscamos pares (a,b) cuyas fechas se cruzan
  // (inicio_a ≤ fin_b AND fin_a ≥ inicio_b) y mostramos un cartel amarillo
  // arriba para que el admin los revise. Si no hay solapamientos, no se
  // renderiza nada (no agregar ruido).
  const pares = [];
  const lista = periodos || [];
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j];
      if (a.fecha_inicio <= b.fecha_fin && a.fecha_fin >= b.fecha_inicio) {
        pares.push([a, b]);
      }
    }
  }
  // Tarea #58: cada par solapado tiene un botón "Resolver" que abre un mini-flujo
  // para borrar el período (si no tiene liquidaciones pagadas) o achicarle las
  // fechas para que deje de cruzarse. Ver `resolverSolapamiento()` abajo.
  const avisoSolapados = pares.length ? `
    <div style="background:#fff7d6;border:1px solid #e5b800;color:#7a5b00;border-radius:8px;padding:.85rem;margin-bottom:1rem">
      <div style="font-family:var(--font-head);font-size:1rem;margin-bottom:.4rem">⚠ Hay períodos de sueldo solapados</div>
      <div style="font-size:.85rem;margin-bottom:.4rem">
        Revisalos para no pagar vales/comisiones dos veces:
      </div>
      <ul style="margin:.25rem 0 0 1.1rem;font-size:.85rem;list-style:none;padding:0">
        ${pares.map(([a,b]) => `<li style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem;flex-wrap:wrap">
          <span style="flex:1;min-width:200px">${formatFecha(a.fecha_inicio)} — ${formatFecha(a.fecha_fin)} ↔ ${formatFecha(b.fecha_inicio)} — ${formatFecha(b.fecha_fin)}</span>
          <button onclick="resolverSolapamiento('${a.id}','${b.id}')" style="background:#7a5b00;color:#fff7d6;border:none;border-radius:6px;padding:.25rem .6rem;font-size:.75rem;cursor:pointer;font-family:var(--font-head)">Resolver</button>
        </li>`).join('')}
      </ul>
    </div>` : '';

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">💰 Sueldos</div>
      <button class="btn-add" onclick="modalNuevoPeriodo()">+ Período</button>
    </div>
    ${avisoSolapados}
    ${(periodos||[]).length === 0 ? '<div class="empty"><p>No hay períodos de sueldo. Creá uno para empezar.</p></div>' :
      (periodos||[]).map(p => `
      <div class="card" onclick="detallePeriodo('${p.id}')">
        <div class="card-header">
          <div class="card-avatar">📅</div>
          <div class="card-info">
            <div class="card-name">${formatFecha(p.fecha_inicio)} — ${formatFecha(p.fecha_fin)}</div>
            <div class="card-sub">${p.estado === 'cerrado' ? '✓ Cerrado' : '⏳ Abierto'}</div>
          </div>
          <span class="card-badge ${p.estado==='cerrado'?'badge-green':'badge-yellow'}">${p.estado==='cerrado'?'CERRADO':'ABIERTO'}</span>
        </div>
      </div>`).join('')}`;
}

async function modalNuevoPeriodo() {
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).toISOString().split('T')[0];
  openModal(`
    <div class="modal-title">Nuevo Período de Sueldo</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Fecha inicio</label>${renderFechaInput('f-periodo-inicio', primerDia)}</div>
      <div class="form-group"><label class="form-label">Fecha fin</label>${renderFechaInput('f-periodo-fin', ultimoDia)}</div>
    </div>
    <button class="btn-primary" onclick="guardarPeriodoConSafeCall()">Crear Período</button>
    <button onclick="crearPeriodoSemanaActual()" style="margin-top:.5rem; width:100%; background:var(--surface2); border:1px solid var(--border); color:var(--text2); border-radius:8px; padding:.4rem; cursor:pointer; font-size:.8rem;">📆 Crear período de esta semana</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

function crearPeriodoSemanaActual() {
  const hoy = new Date();
  const diaSemana = hoy.getDay();
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  
  document.getElementById('f-periodo-inicio').value = inicio.toISOString().split('T')[0];
  document.getElementById('f-periodo-fin').value = fin.toISOString().split('T')[0];
}

async function guardarPeriodoConSafeCall() {
  await safeCall(async () => {
    await guardarPeriodo();
  }, null, 'No se pudo crear el período');
}

async function guardarPeriodo() {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede crear períodos de sueldo')) return;
  const inicio = document.getElementById('f-periodo-inicio').value;
  const fin = document.getElementById('f-periodo-fin').value;
  if (!inicio || !fin) { toast('Las fechas son obligatorias','error'); return; }
  if (inicio > fin) { toast('La fecha de inicio no puede ser posterior a la fecha fin','error'); return; }

  // Tarea #56: avisar si las fechas se solapan con otro período del mismo
  // taller (cerrado o abierto). Dos períodos solapados hacen que vales,
  // trabajos manuales y comisiones que caen en el rango compartido se
  // cuenten dos veces — una en cada liquidación.
  // Solapan ⇔ inicio_otro ≤ fin_nuevo  AND  fin_otro ≥ inicio_nuevo.
  const { data: solapados, error: solErr } = await sb.from('periodos_sueldo')
    .select('id, fecha_inicio, fecha_fin, estado')
    .eq('taller_id', tid())
    .lte('fecha_inicio', fin)
    .gte('fecha_fin', inicio)
    .order('fecha_inicio');
  if (solErr) { toast('Error: '+solErr.message,'error'); return; }

  if ((solapados||[]).length) {
    const lista = solapados.map(p =>
      `${formatFecha(p.fecha_inicio)} — ${formatFecha(p.fecha_fin)} (${p.estado})`
    ).join(', ');
    confirmar(
      `Este período se pisa con: ${lista}. Si creás los dos, los vales, trabajos y comisiones que caen en el rango compartido se cuentan dos veces. ¿Crear igual?`,
      () => {
        safeCall(async () => { await insertarPeriodo(inicio, fin); }, null, 'No se pudo crear el período');
      }
    );
    return;
  }

  await insertarPeriodo(inicio, fin);
}

async function insertarPeriodo(inicio, fin) {
  const { error } = await sb.from('periodos_sueldo').insert({ fecha_inicio:inicio, fecha_fin:fin, taller_id:tid() });
  if (error) { toast('Error: '+error.message,'error'); return; }
  toast('Período creado','success');
  closeModal();
  sueldos();
}

async function detallePeriodo(periodoId) {
  if (typeof requireAdmin === 'function' && !requireAdmin('No tenés acceso a esta sección')) {
    navigate('dashboard');
    return;
  }
  const [{ data: periodo }, { data: liquidaciones }, { data: empleadosAll }] = await Promise.all([
    sb.from('periodos_sueldo').select('*').eq('id', periodoId).single(),
    sb.from('liquidaciones').select('*, empleados(nombre)').eq('periodo_id', periodoId).order('created_at'),
    sb.from('empleados').select('id,nombre,sueldo').eq('taller_id', tid()).order('nombre')
  ]);
  if (!periodo) return;
  const totalLiquidado = (liquidaciones||[]).reduce((s,l) => s + parseFloat(l.total_liquidado||0), 0);
  const totalPagado = (liquidaciones||[]).filter(l => l.estado==='pagado').reduce((s,l) => s + parseFloat(l.total_liquidado||0), 0);

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="sueldos()">← Volver</button>
      <div class="detail-avatar">📅</div>
      <div><div class="detail-name">${formatFecha(periodo.fecha_inicio)} — ${formatFecha(periodo.fecha_fin)}</div><div class="detail-sub">${periodo.estado==='cerrado'?'Cerrado':'Abierto'}</div></div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value" style="font-size:1.2rem">₲${gs(totalLiquidado)}</div><div class="stat-label">TOTAL</div></div>
      <div class="stat-card"><div class="stat-value" style="font-size:1.2rem;color:var(--success)">₲${gs(totalPagado)}</div><div class="stat-label">PAGADO</div></div>
    </div>
    ${periodo.estado==='abierto'?`<button class="btn-primary" style="margin-bottom:1rem" onclick="generarLiquidacionesConSafeCall('${periodoId}')">⚡ Generar liquidaciones</button>`:''}
    ${(liquidaciones||[]).length === 0 ? '<div class="empty"><p>Sin liquidaciones. Tocá "Generar liquidaciones" para crear.</p></div>' :
      (liquidaciones||[]).map(l => `
      <div class="card" style="cursor:default">
        <div class="card-header">
          <div class="card-avatar">👤</div>
          <div class="card-info">
            <div class="card-name">${h(l.empleados?.nombre||'?')}</div>
            <div class="card-sub">Base ₲${gs(l.sueldo_base)}${l.total_extra?' · Trabajos y comisiones ₲'+gs(l.total_extra):''}${l.total_bonos?' · Bonos ₲'+gs(l.total_bonos):''}${l.total_descuentos?' · Desc ₲'+gs(l.total_descuentos):''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:var(--font-head);font-size:1rem;color:${l.estado==='pagado'?'var(--success)':'var(--accent)'}">₲${gs(l.total_liquidado)}</div>
            ${l.estado!=='pagado'&&periodo.estado==='abierto'?`<button onclick="registrarPagoSueldoConSafeCall('${l.id}')" style="font-size:.65rem;background:var(--success);color:#000;border:none;border-radius:6px;padding:2px 8px;cursor:pointer;margin-top:4px">Pagar</button>`:`<span style="font-size:.65rem;color:var(--success)">✓ Pagado</span>`}
          </div>
        </div>
      </div>`).join('')}
    ${periodo.estado==='abierto'?`<button class="btn-danger" style="margin-top:1rem" onclick="cerrarPeriodoConSafeCall('${periodoId}')">🔒 Cerrar período</button>`:''}`;
}

async function generarLiquidacionesConSafeCall(periodoId) {
  await safeCall(async () => {
    await generarLiquidaciones(periodoId);
  }, null, 'No se pudieron generar las liquidaciones');
}

// Tarea #56: aviso amarillo INLINE arriba del contenido del período cuando
// éste se cruza con otro y ambos comparten empleados ya liquidados. Se
// inyecta al inicio de #main-content (no es modal) y devuelve una
// promesa<boolean>: true si el admin igual quiere generar, false si cancela.
function confirmarSolapamientoLiquidaciones(rangos, nombres) {
  return new Promise((resolve) => {
    const main = document.getElementById('main-content');
    if (!main) { resolve(true); return; }
    // Sacar un banner previo si quedó colgado
    const prev = document.getElementById('aviso-solapamiento');
    if (prev) prev.remove();
    const lista = nombres.map(n => `<li>${h(n)}</li>`).join('');
    const banner = document.createElement('div');
    banner.id = 'aviso-solapamiento';
    banner.style.cssText = 'background:#fff7d6;border:1px solid #e5b800;color:#7a5b00;border-radius:8px;padding:.85rem;margin-bottom:1rem';
    banner.innerHTML = `
      <div style="font-family:var(--font-head);font-size:1rem;margin-bottom:.4rem">⚠ Período solapado</div>
      <div style="font-size:.85rem;margin-bottom:.5rem">
        Este período se cruza con: <strong>${h(rangos)}</strong>.
      </div>
      <div style="font-size:.85rem;margin-bottom:.4rem">
        Estos empleados ya tienen una liquidación en el período cruzado y
        volverían a recibir vales, trabajos y comisiones del rango compartido:
      </div>
      <ul style="margin:.25rem 0 .75rem 1.1rem;font-size:.85rem">${lista}</ul>
      <div style="display:flex;gap:.5rem">
        <button class="btn-secondary" id="btn-solap-cancel" style="margin:0;flex:1">Cancelar</button>
        <button class="btn-primary" id="btn-solap-ok" style="margin:0;flex:1">Generar igual</button>
      </div>`;
    main.prepend(banner);
    banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('btn-solap-cancel').addEventListener('click', () => {
      banner.remove(); resolve(false);
    });
    document.getElementById('btn-solap-ok').addEventListener('click', () => {
      banner.remove(); resolve(true);
    });
  });
}

async function generarLiquidaciones(periodoId) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede generar liquidaciones')) return;
  const { data: periodo } = await sb.from('periodos_sueldo').select('*').eq('id', periodoId).single();
  const { data: emps } = await sb.from('empleados').select('id,nombre,sueldo').eq('taller_id', tid());
  if (!emps?.length) { toast('No hay empleados registrados','error'); return; }

  const empIds = emps.map(e => e.id);

  // ── Batch: 5 queries en lugar de 4·N ────────────────────────────────────────
  // Tarea #55: agregamos `comisiones` (reparacion_mecanicos.pago) para
  // sumarlas al `total_extra`, así un mecánico que cobra solo a comisión
  // (sueldo base 0) recibe una liquidación con monto correcto.
  // El `inner` join sobre reparaciones filtra por el taller actual y
  // por la fecha de la reparación dentro del período (no por created_at
  // de la asignación, que puede ser otro día).
  // Tarea #56: traemos también los períodos del mismo taller que se
  // solapan en fechas (excluyendo el actual) para chequear si ya hay
  // liquidaciones de empleados que estamos por liquidar otra vez.
  const [yaLiquidados, vales, trabajos, comisiones, solapados] = await Promise.all([
    sb.from('liquidaciones').select('empleado_id').eq('periodo_id', periodoId).in('empleado_id', empIds),
    sb.from('vales_empleado').select('empleado_id, monto').in('empleado_id', empIds).gte('fecha', periodo.fecha_inicio).lte('fecha', periodo.fecha_fin),
    sb.from('trabajos_empleado').select('empleado_id, monto').in('empleado_id', empIds).gte('fecha', periodo.fecha_inicio).lte('fecha', periodo.fecha_fin),
    sb.from('reparacion_mecanicos')
      .select('empleado_id, pago, reparaciones!inner(fecha, taller_id)')
      .in('empleado_id', empIds)
      .eq('reparaciones.taller_id', tid())
      .gte('reparaciones.fecha', periodo.fecha_inicio)
      .lte('reparaciones.fecha', periodo.fecha_fin),
    sb.from('periodos_sueldo')
      .select('id, fecha_inicio, fecha_fin')
      .eq('taller_id', tid())
      .neq('id', periodoId)
      .lte('fecha_inicio', periodo.fecha_fin)
      .gte('fecha_fin', periodo.fecha_inicio),
  ]);

  const yaSet = new Set((yaLiquidados.data || []).map(r => r.empleado_id));

  // Tarea #56: si algún período se cruza con éste y ya tiene liquidaciones
  // de empleados que ahora estamos por liquidar, avisar antes de generar.
  // Solo importan los empleados que NO tienen liquidación todavía en el
  // período actual (los que ya están se filtran abajo de todas formas).
  // Si la query de solapados falla, abortamos: prefiero no generar a
  // generar a ciegas y duplicar pagos.
  if (solapados.error) {
    toast('Error al chequear períodos solapados: ' + solapados.error.message, 'error');
    return;
  }
  const otros = solapados.data || [];
  if (otros.length) {
    const otrosIds = otros.map(p => p.id);
    const { data: liqOtros, error: liqOtrosErr } = await sb.from('liquidaciones')
      .select('empleado_id, periodo_id')
      .in('periodo_id', otrosIds)
      .in('empleado_id', empIds);
    if (liqOtrosErr) {
      toast('Error al chequear liquidaciones de períodos solapados: ' + liqOtrosErr.message, 'error');
      return;
    }
    const conflictoIds = new Set();
    (liqOtros || []).forEach(l => {
      if (!yaSet.has(l.empleado_id)) conflictoIds.add(l.empleado_id);
    });
    if (conflictoIds.size) {
      const nombres = emps.filter(e => conflictoIds.has(e.id)).map(e => e.nombre);
      const rangos = otros.map(p => `${formatFecha(p.fecha_inicio)} — ${formatFecha(p.fecha_fin)}`).join(', ');
      const ok = await confirmarSolapamientoLiquidaciones(rangos, nombres);
      if (!ok) return;
    }
  }
  const valesPorEmp = {};
  (vales.data || []).forEach(v => {
    valesPorEmp[v.empleado_id] = (valesPorEmp[v.empleado_id] || 0) + parseFloat(v.monto || 0);
  });
  const trabajosPorEmp = {};
  (trabajos.data || []).forEach(t => {
    trabajosPorEmp[t.empleado_id] = (trabajosPorEmp[t.empleado_id] || 0) + parseFloat(t.monto || 0);
  });
  const comisionesPorEmp = {};
  (comisiones.data || []).forEach(c => {
    comisionesPorEmp[c.empleado_id] = (comisionesPorEmp[c.empleado_id] || 0) + parseFloat(c.pago || 0);
  });

  const filas = emps
    .filter(emp => !yaSet.has(emp.id))
    .map(emp => ({
      taller_id: tid(),
      empleado_id: emp.id,
      periodo_id: periodoId,
      sueldo_base: emp.sueldo || 0,
      total_bonos: 0,
      total_descuentos: valesPorEmp[emp.id] || 0,
      // total_extra suma DOS fuentes: trabajos manuales (`trabajos_empleado`)
      // + comisiones de OTs (`reparacion_mecanicos.pago`). El admin puede
      // editar este campo después si hace falta corregir.
      total_extra: (trabajosPorEmp[emp.id] || 0) + (comisionesPorEmp[emp.id] || 0),
      estado: 'pendiente'
    }));

  let creados = 0;
  if (filas.length) {
    const { error } = await sb.from('liquidaciones').insert(filas);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    creados = filas.length;
  }

  toast(`✓ ${creados} liquidación(es) generada(s)`,'success');
  detallePeriodo(periodoId);
}

async function registrarPagoSueldoConSafeCall(liquidacionId, onSuccess) {
  confirmar('¿Marcar esta liquidación como pagada?', async () => {
    await safeCall(async () => {
      await registrarPagoSueldo(liquidacionId, onSuccess);
    }, null, 'No se pudo registrar el pago');
  });
}

// Anti-doble-click global para evitar dos egresos por la misma liquidación.
let _sueldoPagandoLock = false;

// onSuccess es opcional. Si está, se llama al final en lugar de saltar al
// detalle del período — para que vistas externas (Centro de cobros) puedan
// quedarse en su lugar y refrescar su lista.
async function registrarPagoSueldo(liquidacionId, onSuccess) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede registrar pagos de sueldo')) return;
  if (_sueldoPagandoLock) return;
  _sueldoPagandoLock = true;
  try {
    const { data: liq, error: liqErr } = await sb.from('liquidaciones')
      .select('*, empleados(nombre), periodos_sueldo(fecha_inicio, fecha_fin)')
      .eq('id', liquidacionId).single();
    if (liqErr || !liq) { toast('Error al obtener liquidación','error'); return; }

    // Update condicional (.neq estado='pagado'): si dos clicks o dos
    // pestañas chocan, solo el primero dispara el trigger del egreso.
    const fechaPago = new Date().toISOString().split('T')[0];
    const { data: actualizadas, error: updErr } = await sb.from('liquidaciones')
      .update({ estado:'pagado', fecha_pago: fechaPago })
      .eq('id', liquidacionId)
      .neq('estado', 'pagado')
      .select('id');
    if (updErr) { toast('Error: ' + updErr.message, 'error'); return; }
    if (!actualizadas || actualizadas.length === 0) {
      toast('Esta liquidación ya estaba pagada', 'info');
      if (typeof onSuccess === 'function') onSuccess(liquidacionId); else detallePeriodo(liq.periodo_id);
      return;
    }

    // NOTA: La inserción en movimientos_financieros la hace un TRIGGER en Supabase.
    clearCache('finanzas');
    toast('✓ Sueldo marcado como pagado y registrado en Finanzas', 'success');
    if (typeof onSuccess === 'function') onSuccess(liquidacionId); else detallePeriodo(liq.periodo_id);
  } finally {
    _sueldoPagandoLock = false;
  }
}

async function cerrarPeriodoConSafeCall(periodoId) {
  confirmar('¿Cerrar este período? No se podrán hacer más cambios.', async () => {
    await safeCall(async () => {
      await cerrarPeriodo(periodoId);
    }, null, 'No se pudo cerrar el período');
  });
}

async function cerrarPeriodo(periodoId) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede cerrar el período')) return;
  await sb.from('periodos_sueldo').update({ estado:'cerrado' }).eq('id', periodoId);
  toast('Período cerrado','success');
  detallePeriodo(periodoId);
}

function verLiquidaciones(empleadoId) {
  navigate('sueldos');
}

// ─── TAREA #58: RESOLVER PERÍODOS SOLAPADOS ──────────────────────────────────
// Mini-flujo lanzado desde el cartel amarillo de `sueldos()`. Trae los dos
// períodos en conflicto + sus liquidaciones, los muestra lado a lado y deja
// borrar el que no tenga pagadas o achicarle las fechas para romper el
// solapamiento. Si el constraint EXCLUDE (Tarea #56) sigue rechazando el
// ajuste, se traduce a un mensaje claro.
async function resolverSolapamiento(idA, idB) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede resolver solapamientos')) return;
  await safeCall(async () => {
    const [pAResp, pBResp, liqAResp, liqBResp] = await Promise.all([
      sb.from('periodos_sueldo').select('*').eq('id', idA).single(),
      sb.from('periodos_sueldo').select('*').eq('id', idB).single(),
      sb.from('liquidaciones').select('id, estado, total_liquidado, empleados(nombre)').eq('periodo_id', idA).order('created_at'),
      sb.from('liquidaciones').select('id, estado, total_liquidado, empleados(nombre)').eq('periodo_id', idB).order('created_at'),
    ]);
    if (pAResp.error || pBResp.error || !pAResp.data || !pBResp.data) {
      toast('No se encontraron los períodos','error'); return;
    }
    // Si falla el fetch de liquidaciones, abortamos: no quiero mostrar
    // counts de "0 pagadas" que en realidad no sabemos, porque eso podría
    // hacer que el admin habilite borrar un período que sí tiene pagadas.
    if (liqAResp.error || liqBResp.error) {
      toast('Error al traer liquidaciones: ' + ((liqAResp.error||liqBResp.error).message || ''),'error');
      return;
    }
    abrirModalResolverSolapamiento(pAResp.data, pBResp.data, liqAResp.data || [], liqBResp.data || []);
  }, null, 'No se pudo abrir el resolutor');
}

function abrirModalResolverSolapamiento(pA, pB, liqsA, liqsB) {
  const pagadasA = liqsA.filter(l => l.estado === 'pagado').length;
  const pagadasB = liqsB.filter(l => l.estado === 'pagado').length;
  let aviso = '';
  if (pagadasA && pagadasB) {
    aviso = `<div style="background:#fff7d6;border:1px solid #e5b800;color:#7a5b00;border-radius:6px;padding:.5rem;margin-bottom:.75rem;font-size:.78rem">Los dos períodos ya tienen liquidaciones pagadas. No se puede borrar ni achicar ninguno desde acá sin riesgo de tocar pagos cerrados — primero anulá manualmente alguna liquidación pagada y volvé a entrar.</div>`;
  } else if (pagadasA || pagadasB) {
    const cual = pagadasA ? 'el de la izquierda' : 'el de la derecha';
    const otro = pagadasA ? 'el de la derecha' : 'el de la izquierda';
    aviso = `<div style="background:#fff7d6;border:1px solid #e5b800;color:#7a5b00;border-radius:6px;padding:.5rem;margin-bottom:.75rem;font-size:.78rem">${cual} ya tiene liquidaciones pagadas, así que no se puede tocar. Podés borrar ${otro} (si no tiene pagadas) o achicarle las fechas para que deje de pisarse.</div>`;
  }
  openModal(`
    <div class="modal-title">Resolver solapamiento</div>
    ${aviso}
    <div style="display:flex;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">${renderColumnaPeriodoSolapado(pA, liqsA, pA.id, pB.id)}</div>
      <div style="flex:1;min-width:220px">${renderColumnaPeriodoSolapado(pB, liqsB, pA.id, pB.id)}</div>
    </div>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
  `);
}

function renderColumnaPeriodoSolapado(p, liqs, idA, idB) {
  const pagadas = liqs.filter(l => l.estado === 'pagado');
  const pendientes = liqs.filter(l => l.estado !== 'pagado');
  const totalPag = pagadas.reduce((s,l) => s + parseFloat(l.total_liquidado||0), 0);
  const totalPen = pendientes.reduce((s,l) => s + parseFloat(l.total_liquidado||0), 0);
  // Regla del task: si el período tiene liquidaciones pagadas no se puede
  // tocar (ni borrar ni achicar). El admin tiene que actuar sobre el otro.
  const puedeTocar = pagadas.length === 0;
  const detalle = liqs.length ? `
    <details style="margin-bottom:.5rem;font-size:.72rem;color:var(--text2)">
      <summary style="cursor:pointer">Ver liquidaciones (${liqs.length})</summary>
      <ul style="margin:.25rem 0 0 .9rem;padding:0">
        ${liqs.map(l => `<li>${h(l.empleados?.nombre||'?')} · ₲${gs(l.total_liquidado)} ${l.estado==='pagado'?'<span style="color:var(--success)">✓ pagada</span>':'<span style="color:var(--accent)">⏳ pendiente</span>'}</li>`).join('')}
      </ul>
    </details>` : '<div style="font-size:.72rem;color:var(--text2);margin-bottom:.5rem">Sin liquidaciones</div>';
  const btnsBloqueados = `
    <button disabled title="Tiene liquidaciones pagadas" style="width:100%;margin:0 0 .35rem 0;padding:.4rem;font-size:.78rem;background:var(--surface2);color:var(--text2);border:1px solid var(--border);border-radius:8px;cursor:not-allowed;opacity:.6">🗑 Borrar (bloqueado)</button>
    <button disabled title="Tiene liquidaciones pagadas" style="width:100%;margin:0;padding:.4rem;font-size:.78rem;background:var(--surface2);color:var(--text2);border:1px solid var(--border);border-radius:8px;cursor:not-allowed;opacity:.6">✂ Achicar (bloqueado)</button>`;
  const btnsActivos = `
    <button class="btn-danger" style="width:100%;margin:0 0 .35rem 0;padding:.4rem;font-size:.78rem" onclick="confirmarBorrarPeriodoSolapado('${p.id}','${idA}','${idB}')">🗑 Borrar período</button>
    <button class="btn-secondary" style="width:100%;margin:0;padding:.4rem;font-size:.78rem" onclick="abrirAchicarFechasSolapado('${p.id}','${idA}','${idB}')">✂ Achicar fechas</button>`;
  return `<div style="border:1px solid var(--border);border-radius:8px;padding:.6rem;background:var(--surface)">
    <div style="font-family:var(--font-head);font-size:.9rem;margin-bottom:.25rem">${formatFecha(p.fecha_inicio)} — ${formatFecha(p.fecha_fin)}</div>
    <div style="font-size:.72rem;color:var(--text2);margin-bottom:.5rem">${p.estado==='cerrado'?'✓ Cerrado':'⏳ Abierto'}</div>
    <div style="font-size:.75rem;margin-bottom:.5rem;line-height:1.4">
      <div>Pagadas: <strong>${pagadas.length}</strong>${pagadas.length?` · ₲${gs(totalPag)}`:''}</div>
      <div>Pendientes: <strong>${pendientes.length}</strong>${pendientes.length?` · ₲${gs(totalPen)}`:''}</div>
    </div>
    ${detalle}
    ${puedeTocar ? btnsActivos : btnsBloqueados}
  </div>`;
}

function confirmarBorrarPeriodoSolapado(periodoId, idA, idB) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede borrar períodos de sueldo')) return;
  confirmar('¿Borrar este período? Se borran también sus liquidaciones pendientes. Los pagos ya registrados en Finanzas no se tocan.', async () => {
    await safeCall(async () => {
      if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede borrar períodos de sueldo')) return;
      // Re-chequear que no haya pagadas (anti-condición de carrera).
      const { data: pagadasAhora, error: chkErr } = await sb.from('liquidaciones')
        .select('id', { count: 'exact', head: false }).eq('periodo_id', periodoId).eq('estado','pagado');
      if (chkErr) { toast('Error: ' + chkErr.message,'error'); return; }
      if ((pagadasAhora||[]).length) {
        toast('Este período ya tiene liquidaciones pagadas. No se puede borrar.','error');
        sueldos();
        return;
      }
      const { error: liqErr } = await sb.from('liquidaciones').delete().eq('periodo_id', periodoId);
      if (liqErr) { toast('Error al borrar liquidaciones: ' + liqErr.message,'error'); return; }
      const { error: pErr } = await sb.from('periodos_sueldo').delete().eq('id', periodoId);
      if (pErr) { toast('Error al borrar el período: ' + pErr.message,'error'); return; }
      toast('✓ Período borrado','success');
      closeModal();
      sueldos();
    }, null, 'No se pudo borrar el período');
  });
}

async function abrirAchicarFechasSolapado(periodoIdAchicar, idA, idB) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede ajustar fechas de períodos')) return;
  const otroId = periodoIdAchicar === idA ? idB : idA;
  await safeCall(async () => {
    const [pAchicarResp, pOtroResp] = await Promise.all([
      sb.from('periodos_sueldo').select('*').eq('id', periodoIdAchicar).single(),
      sb.from('periodos_sueldo').select('*').eq('id', otroId).single(),
    ]);
    if (pAchicarResp.error || pOtroResp.error || !pAchicarResp.data || !pOtroResp.data) {
      toast('No se encontró el período','error'); return;
    }
    const pAchicar = pAchicarResp.data, pOtro = pOtroResp.data;
    openModal(`
      <div class="modal-title">Achicar fechas</div>
      <div style="font-size:.8rem;color:var(--text2);margin-bottom:.4rem">
        Período a achicar: <strong>${formatFecha(pAchicar.fecha_inicio)} — ${formatFecha(pAchicar.fecha_fin)}</strong>
      </div>
      <div style="font-size:.8rem;color:var(--text2);margin-bottom:.75rem">
        Se cruza con: <strong>${formatFecha(pOtro.fecha_inicio)} — ${formatFecha(pOtro.fecha_fin)}</strong>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Nueva fecha inicio</label>${renderFechaInput('f-achicar-inicio', pAchicar.fecha_inicio)}</div>
        <div class="form-group"><label class="form-label">Nueva fecha fin</label>${renderFechaInput('f-achicar-fin', pAchicar.fecha_fin)}</div>
      </div>
      <button class="btn-primary" onclick="guardarAchicarFechasSolapado('${periodoIdAchicar}','${idA}','${idB}')">Guardar</button>
      <button class="btn-secondary" onclick="resolverSolapamiento('${idA}','${idB}')">← Volver</button>
    `);
  }, null, 'No se pudo abrir el editor de fechas');
}

async function guardarAchicarFechasSolapado(periodoId, idA, idB) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede ajustar fechas de períodos')) return;
  const inicio = document.getElementById('f-achicar-inicio').value;
  const fin = document.getElementById('f-achicar-fin').value;
  if (!inicio || !fin) { toast('Las fechas son obligatorias','error'); return; }
  if (inicio > fin) { toast('La fecha de inicio no puede ser posterior a la fecha fin','error'); return; }
  await safeCall(async () => {
    const { error } = await sb.from('periodos_sueldo')
      .update({ fecha_inicio: inicio, fecha_fin: fin })
      .eq('id', periodoId);
    if (error) {
      // El constraint EXCLUDE de la Tarea #56 dispara este error si las
      // nuevas fechas siguen pisando otro período del mismo taller.
      const msg = String(error.message || '');
      if (/periodos_sueldo_no_solapan_taller|exclude|conflicting key|overlap/i.test(msg)) {
        toast('Las fechas siguen pisando otro período del taller. Achicalas más para que no se crucen.','error');
      } else {
        toast('Error: ' + msg,'error');
      }
      return;
    }
    toast('✓ Fechas actualizadas','success');
    closeModal();
    sueldos();
  }, null, 'No se pudieron actualizar las fechas');
}
