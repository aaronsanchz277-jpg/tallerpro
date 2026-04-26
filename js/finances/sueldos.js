// ─── MEJORA #7: GESTIÓN DE SUELDOS ──────────────────────────────────────────

async function sueldos() {
  const { data: periodos } = await sb.from('periodos_sueldo').select('*').eq('taller_id', tid()).order('fecha_inicio', {ascending:false});
  
  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">💰 Sueldos</div>
      <button class="btn-add" onclick="modalNuevoPeriodo()">+ Período</button>
    </div>
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
  const inicio = document.getElementById('f-periodo-inicio').value;
  const fin = document.getElementById('f-periodo-fin').value;
  if (!inicio || !fin) { toast('Las fechas son obligatorias','error'); return; }
  const { error } = await sb.from('periodos_sueldo').insert({ fecha_inicio:inicio, fecha_fin:fin, taller_id:tid() });
  if (error) { toast('Error: '+error.message,'error'); return; }
  toast('Período creado','success');
  closeModal(); 
  sueldos();
}

async function detallePeriodo(periodoId) {
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
            <div class="card-sub">Base: ₲${gs(l.sueldo_base)} · Bonos: ₲${gs(l.total_bonos)} · Desc: ₲${gs(l.total_descuentos)}</div>
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

async function generarLiquidaciones(periodoId) {
  const { data: periodo } = await sb.from('periodos_sueldo').select('*').eq('id', periodoId).single();
  const { data: emps } = await sb.from('empleados').select('id,nombre,sueldo').eq('taller_id', tid());
  if (!emps?.length) { toast('No hay empleados registrados','error'); return; }

  const empIds = emps.map(e => e.id);

  // ── Batch: 3 queries en lugar de 3·N ────────────────────────────────────────
  const [yaLiquidados, vales, trabajos] = await Promise.all([
    sb.from('liquidaciones').select('empleado_id').eq('periodo_id', periodoId).in('empleado_id', empIds),
    sb.from('vales_empleado').select('empleado_id, monto').in('empleado_id', empIds).gte('fecha', periodo.fecha_inicio).lte('fecha', periodo.fecha_fin),
    sb.from('trabajos_empleado').select('empleado_id, monto').in('empleado_id', empIds).gte('fecha', periodo.fecha_inicio).lte('fecha', periodo.fecha_fin),
  ]);

  const yaSet = new Set((yaLiquidados.data || []).map(r => r.empleado_id));
  const valesPorEmp = {};
  (vales.data || []).forEach(v => {
    valesPorEmp[v.empleado_id] = (valesPorEmp[v.empleado_id] || 0) + parseFloat(v.monto || 0);
  });
  const trabajosPorEmp = {};
  (trabajos.data || []).forEach(t => {
    trabajosPorEmp[t.empleado_id] = (trabajosPorEmp[t.empleado_id] || 0) + parseFloat(t.monto || 0);
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
      total_extra: trabajosPorEmp[emp.id] || 0,
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

async function registrarPagoSueldoConSafeCall(liquidacionId) {
  confirmar('¿Marcar esta liquidación como pagada?', async () => {
    await safeCall(async () => {
      await registrarPagoSueldo(liquidacionId);
    }, null, 'No se pudo registrar el pago');
  });
}

async function registrarPagoSueldo(liquidacionId) {
  const { data: liq, error: liqErr } = await sb.from('liquidaciones')
    .select('*, empleados(nombre), periodos_sueldo(fecha_inicio, fecha_fin)')
    .eq('id', liquidacionId).single();
  if (liqErr || !liq) { toast('Error al obtener liquidación','error'); return; }

  const fechaPago = new Date().toISOString().split('T')[0];
  await sb.from('liquidaciones').update({ estado:'pagado', fecha_pago: fechaPago }).eq('id', liquidacionId);

  // NOTA: La inserción en movimientos_financieros ahora la hace un TRIGGER en Supabase
  // (ver script SQL proporcionado)

  clearCache('finanzas');
  toast('✓ Sueldo marcado como pagado y registrado en Finanzas', 'success');
  detallePeriodo(liq.periodo_id);
}

async function cerrarPeriodoConSafeCall(periodoId) {
  confirmar('¿Cerrar este período? No se podrán hacer más cambios.', async () => {
    await safeCall(async () => {
      await cerrarPeriodo(periodoId);
    }, null, 'No se pudo cerrar el período');
  });
}

async function cerrarPeriodo(periodoId) {
  await sb.from('periodos_sueldo').update({ estado:'cerrado' }).eq('id', periodoId);
  toast('Período cerrado','success');
  detallePeriodo(periodoId);
}

function verLiquidaciones(empleadoId) {
  navigate('sueldos');
}
