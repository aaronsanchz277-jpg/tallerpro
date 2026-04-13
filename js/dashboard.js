// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function fechaHoy() { return new Date().toISOString().split('T')[0]; }
function primerDiaMes() { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-01`; }
function formatFecha(f) { if (!f) return ''; const [y,m,d] = f.split('-'); return `${d}/${m}/${y}`; }

async function dashboard() {
  const rol = currentPerfil?.rol;
  const tallerNombre = currentPerfil?.talleres?.nombre || 'Tu Taller';
  if (rol === 'cliente') { misReparaciones(); return; }

  const hoy = fechaHoy();
  const primerMes = primerDiaMes();
  const primerSemana = (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  })();

  const [
    { count: totalClientes },
    { count: totalVehiculos },
    { count: enProgreso },
    { data: creditos },
    { data: repsHoy },
    { data: ingresosMes },
    { data: stockBajo },
    { data: recientes },
    { count: vehiculosHoy },
    { count: vehiculosSemana },
    { count: vehiculosMes }
  ] = await Promise.all([
    cachedQuery('dash_clientes', () => sb.from('clientes').select('*',{count:'exact',head:true}).eq('taller_id',tid())),
    cachedQuery('dash_vehiculos', () => sb.from('vehiculos').select('*',{count:'exact',head:true}).eq('taller_id',tid())),
    cachedQuery('dash_progreso', () => sb.from('reparaciones').select('*',{count:'exact',head:true}).eq('taller_id',tid()).eq('estado','en_progreso')),
    cachedQuery('dash_creditos', () => sb.from('fiados').select('monto').eq('taller_id',tid()).eq('pagado',false)),
    cachedQuery('dash_hoy', () => sb.from('reparaciones').select('id').eq('taller_id',tid()).eq('fecha',hoy)),
    cachedQuery('dash_ingresos', () => sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').gte('fecha',primerMes)),
    cachedQuery('dash_stock', () => sb.from('inventario').select('nombre,cantidad,stock_minimo').eq('taller_id',tid())),
    cachedQuery('dash_recientes', () => sb.from('reparaciones').select('*, vehiculos(patente,marca)').eq('taller_id',tid()).order('created_at',{ascending:false}).limit(5)),
    cachedQuery('dash_veh_hoy', () => sb.from('reparaciones').select('*',{count:'exact',head:true}).eq('taller_id',tid()).eq('fecha',hoy)),
    cachedQuery('dash_veh_semana', () => sb.from('reparaciones').select('*',{count:'exact',head:true}).eq('taller_id',tid()).gte('fecha',primerSemana)),
    cachedQuery('dash_veh_mes', () => sb.from('reparaciones').select('*',{count:'exact',head:true}).eq('taller_id',tid()).gte('fecha',primerMes))
  ]);

  const totalCrédito = (creditos||[]).reduce((s,f) => s+parseFloat(f.monto||0), 0);
  const totalMes = (ingresosMes||[]).reduce((s,r) => s+parseFloat(r.costo||0), 0);
  const alertasStock = (stockBajo||[]).filter(i => parseFloat(i.cantidad) <= parseFloat(i.stock_minimo));

  let totalQSMes = 0, totalPOSMes = 0, totalGastosMes = 0;
  if (currentPerfil?.rol === 'admin') {
    const [{ data:qsMes },{ data:posMes },{ data:gastosMes }] = await Promise.all([
      cachedQuery('dash_qs_mes', () => sb.from('quickservices').select('total').eq('taller_id',tid()).gte('created_at',primerMes+'T00:00:00')),
      cachedQuery('dash_pos_mes', () => sb.from('ventas_pos').select('total').eq('taller_id',tid()).gte('created_at',primerMes+'T00:00:00')),
      cachedQuery('dash_gastos_mes', () => sb.from('gastos_taller').select('monto').eq('taller_id',tid()).gte('fecha',primerMes))
    ]);
    totalQSMes = (qsMes||[]).reduce((s,r) => s+parseFloat(r.total||0), 0);
    totalPOSMes = (posMes||[]).reduce((s,r) => s+parseFloat(r.total||0), 0);
    totalGastosMes = (gastosMes||[]).reduce((s,r) => s+parseFloat(r.monto||0), 0);
  }

  let deudoresHTML = '';
  if (currentPerfil?.rol === 'admin') {
    const { data: repsConDeuda } = await sb.from('reparaciones').select('id,descripcion,costo,clientes(nombre)').eq('taller_id',tid()).eq('estado','finalizado').gt('costo',0).limit(50);
    if (repsConDeuda?.length) {
      const { data: allPagos } = await sb.from('pagos_reparacion').select('reparacion_id,monto').eq('taller_id',tid()).limit(500);
      const pagosPorRep = {};
      (allPagos||[]).forEach(p => { if(!pagosPorRep[p.reparacion_id]) pagosPorRep[p.reparacion_id]=0; pagosPorRep[p.reparacion_id]+=parseFloat(p.monto||0); });
      const deudores = repsConDeuda.filter(r => {
        const pagado = pagosPorRep[r.id] || 0;
        return pagado < parseFloat(r.costo) && pagado > 0;
      }).map(r => ({ ...r, saldo: parseFloat(r.costo) - (pagosPorRep[r.id]||0) }));
      if (deudores.length > 0) {
        const totalDeuda = deudores.reduce((s,d) => s+d.saldo, 0);
        deudoresHTML = `<div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.3);border-radius:10px;padding:.75rem;margin-bottom:1rem;cursor:pointer" onclick="navigate('reparaciones')">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
            <div style="font-size:.72rem;color:var(--warning);font-family:var(--font-head);letter-spacing:1px">💸 DINERO EN LA CALLE</div>
            <div style="font-family:var(--font-head);color:var(--warning);font-size:1rem">₲${gs(totalDeuda)}</div>
          </div>
          ${deudores.slice(0,3).map(d => `<div style="font-size:.78rem;color:var(--text2);padding:.15rem 0">${h(d.clientes?.nombre||'Sin cliente')} — <span style="color:var(--warning)">debe ₲${gs(d.saldo)}</span></div>`).join('')}
          ${deudores.length>3?`<div style="font-size:.7rem;color:var(--text2);margin-top:.3rem">y ${deudores.length-3} más...</div>`:''}
        </div>`;
      }
    }
  }

  let cuentasVencidasHTML = '';
  if (currentPerfil?.rol === 'admin') {
    const { data: cuentasP } = await sb.from('cuentas_pagar').select('proveedor,monto,fecha_vencimiento').eq('taller_id',tid()).eq('pagada',false).order('fecha_vencimiento').limit(10);
    const hoyStr = new Date().toISOString().split('T')[0];
    const vencidas = (cuentasP||[]).filter(c => c.fecha_vencimiento && c.fecha_vencimiento < hoyStr);
    const porVencer = (cuentasP||[]).filter(c => c.fecha_vencimiento && c.fecha_vencimiento >= hoyStr && c.fecha_vencimiento <= new Date(Date.now()+7*86400000).toISOString().split('T')[0]);
    const urgentes = [...vencidas, ...porVencer];
    if (urgentes.length > 0) {
      const totalUrgente = urgentes.reduce((s,c) => s+parseFloat(c.monto||0), 0);
      cuentasVencidasHTML = `<div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:10px;padding:.75rem;margin-bottom:1rem;cursor:pointer" onclick="navigate('cuentas-pagar')">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
          <div style="font-size:.72rem;color:var(--danger);font-family:var(--font-head);letter-spacing:1px">🚨 CUENTAS POR PAGAR</div>
          <div style="font-family:var(--font-head);color:var(--danger);font-size:1rem">₲${gs(totalUrgente)}</div>
        </div>
        ${urgentes.slice(0,3).map(c => `<div style="font-size:.78rem;color:var(--text2);padding:.15rem 0">${h(c.proveedor)} — ₲${gs(c.monto)}${c.fecha_vencimiento<hoyStr?' <span style="color:var(--danger)">VENCIDA</span>':' vence '+formatFecha(c.fecha_vencimiento)}</div>`).join('')}
      </div>`;
    }
  }

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0 .75rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.15rem">
        <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text)">${h(tallerNombre)}</div>
        ${currentPerfil?.rol==='admin'?`<button onclick="modalConfigDatos()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .6rem;cursor:pointer;font-size:.75rem">⚙️ Configurar</button>`:''}
      </div>
      <div style="font-size:.75rem;color:var(--text2);margin-bottom:1rem">${t('bienvenido')}, ${h(currentPerfil?.nombre||'')}</div>

      ${alertasStock.length > 0 ? `
      <div style="background:rgba(255,68,68,.1);border-left:4px solid var(--danger);border-radius:8px;padding:.75rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between">
        <div><span style="font-weight:bold;color:var(--danger)">⚠️ ${alertasStock.length} producto(s) con stock bajo</span><br><span style="font-size:.75rem;color:var(--text2)">Revisá el inventario para reponer</span></div>
        <button onclick="navigate('inventario')" style="background:var(--danger);color:#fff;border:none;border-radius:6px;padding:.3rem .8rem;cursor:pointer;font-size:.75rem">Ver</button>
      </div>
      ` : ''}

      ${getInstallBanner()}
      ${getSuscripcionBanner()}
      ${typeof getPushBanner === 'function' ? getPushBanner() : ''}

      <div class="search-box" style="margin-bottom:1.25rem">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="${t('dashBuscarPatente')}" class="form-input" style="padding-left:2.5rem;text-transform:uppercase;letter-spacing:2px" oninput="buscarPatente(this.value)">
      </div>

      <div id="patente-results"></div>

      <div class="stats-grid">
        <div class="stat-card" onclick="navigate('clientes')" style="cursor:pointer"><div class="stat-value">${totalClientes||0}</div><div class="stat-label">${t('dashClientes')}</div></div>
        <div class="stat-card" onclick="reparaciones({filtro:'en_progreso'})" style="cursor:pointer"><div class="stat-value" style="color:var(--accent2)">${enProgreso||0}</div><div class="stat-label">${t('dashEnProgreso')}</div></div>
        <div class="stat-card" onclick="reparaciones({filtro:'hoy'})" style="cursor:pointer"><div class="stat-value" style="color:var(--success)">${(repsHoy||[]).length}</div><div class="stat-label">${t('repHoy2')}</div></div>
        ${currentPerfil?.rol==='admin'?`<div class="stat-card" onclick="navigate('creditos')" style="cursor:pointer"><div class="stat-value" style="color:var(--danger)">₲${gs(totalCrédito)}</div><div class="stat-label">${t('dashCreditos')}</div></div>`:`<div class="stat-card"><div class="stat-value">${totalVehiculos||0}</div><div class="stat-label">${t('dashVehiculos')}</div></div>`}
      </div>
      <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr">
        <div class="stat-card" onclick="reparaciones({filtro:'hoy'})" style="cursor:pointer"><div class="stat-value" style="color:var(--accent2)">${vehiculosHoy||0}</div><div class="stat-label">Vehículos hoy</div></div>
        <div class="stat-card" onclick="reparaciones({filtro:'semana'})" style="cursor:pointer"><div class="stat-value">${vehiculosSemana||0}</div><div class="stat-label">Esta semana</div></div>
        <div class="stat-card" onclick="reparaciones({filtro:'mes'})" style="cursor:pointer"><div class="stat-value">${vehiculosMes||0}</div><div class="stat-label">Este mes</div></div>
      </div>

      ${currentPerfil?.rol==='admin'?`<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:.72rem;color:var(--text2);letter-spacing:1px;font-family:var(--font-head)">${t('dashIngresosMes')}</div>
          <div style="font-family:var(--font-head);font-size:1.8rem;font-weight:700;color:var(--success)">₲${gs(totalMes+totalQSMes+totalPOSMes)}</div>
          <div style="font-size:.7rem;color:var(--text2);margin-top:.2rem">OTs: ₲${gs(totalMes)} · QS: ₲${gs(totalQSMes)} · POS: ₲${gs(totalPOSMes)}</div>
        </div>
        <div style="font-size:2rem">💰</div>
      </div>
      ${totalGastosMes>0?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
        <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:12px;padding:.75rem;cursor:pointer" onclick="navigate('gastos')">
          <div style="font-size:.68rem;color:var(--danger);font-family:var(--font-head);letter-spacing:1px">GASTOS MES</div>
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:var(--danger)">₲${gs(totalGastosMes)}</div>
        </div>
        <div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);border-radius:12px;padding:.75rem">
          <div style="font-size:.68rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px">GANANCIA NETA</div>
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:${(totalMes+totalQSMes+totalPOSMes-totalGastosMes)>=0?'var(--success)':'var(--danger)'}">₲${gs(totalMes+totalQSMes+totalPOSMes-totalGastosMes)}</div>
        </div>
      </div>`:''}`:''}

      ${deudoresHTML}
      ${cuentasVencidasHTML}

      <div style="font-family:var(--font-head);font-size:.9rem;color:var(--text2);margin-bottom:.6rem;letter-spacing:2px">${t('dashRecientes')}</div>
      ${(recientes||[]).length===0 ? `<div class="empty"><p>${t('dashSinReps')}</p></div>` :
        (recientes||[]).map(r => `
        <div class="card" onclick="detalleReparacion('${r.id}')">
          <div class="card-header">
            <div class="card-avatar">🔧</div>
            <div class="card-info">
              <div class="card-name">${h(r.descripcion)}</div>
              <div class="card-sub">${r.vehiculos ? h(r.vehiculos.marca)+' '+h(r.vehiculos.patente) : t('sinVehiculo')} · ${formatFecha(r.fecha)}</div>
            </div>
            <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
          </div>
        </div>`).join('')}
    </div>`;
}

let patenteBusquedaTimer = null;
async function buscarPatente(valor) {
  const resultsEl = document.getElementById('patente-results');
  if (!resultsEl) return;
  const patente = valor.trim().toUpperCase();
  if (!patente) { resultsEl.innerHTML = ''; return; }
  clearTimeout(patenteBusquedaTimer);
  patenteBusquedaTimer = setTimeout(async () => {
    const { data: vehs } = await sb.from('vehiculos')
      .select('*, clientes(nombre,telefono), reparaciones(id,descripcion,estado,costo,fecha)')
      .eq('taller_id', tid())
      .ilike('patente', `%${patente}%`)
      .limit(3);
    if (!vehs || vehs.length === 0) {
      resultsEl.innerHTML = `<div style="background:var(--surface2);border-radius:10px;padding:.75rem;margin-bottom:1rem;font-size:.85rem;color:var(--text2)">No se encontró ningún vehículo con esa patente.</div>`;
      return;
    }
    resultsEl.innerHTML = vehs.map(v => {
      const reps = (v.reparaciones||[]).sort((a,b) => (b.fecha||'').localeCompare(a.fecha||'')).slice(0,5);
      return `
        <div style="background:var(--surface);border:1px solid var(--accent);border-radius:12px;padding:1rem;margin-bottom:1rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
            <div>
              <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);letter-spacing:2px">${h(v.patente)}</div>
              <div style="font-size:.82rem;color:var(--text2)">${h(v.marca||'')} ${h(v.modelo||'')} ${v.anio?'· '+v.anio:''}</div>
              ${v.clientes?`<div style="font-size:.8rem;color:var(--text2)">👤 ${h(v.clientes.nombre)}</div>`:''}
            </div>
            <button onclick="detalleVehiculo('${v.id}')" style="font-size:.72rem;background:none;border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:3px 8px;cursor:pointer">Ver</button>
          </div>
          <div style="font-size:.72rem;color:var(--text2);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.4rem">HISTORIAL (${reps.length})</div>
          ${reps.length === 0 ? '<div style="font-size:.8rem;color:var(--text2)">${t("vehSinReps")}</div>' :
            reps.map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.82rem">
              <span>${h(r.descripcion)}</span>
              <span class="card-badge ${estadoBadge(r.estado)}" style="font-size:.65rem">${estadoLabel(r.estado)}</span>
            </div>`).join('')}
        </div>`;
    }).join('');
  }, 500);
}

// ─── REPORTES ─────────────────────────────────────────────────────────────────
async function reportes() {
  const hoy = fechaHoy();
  const primerMes = primerDiaMes();
  const primerSemana = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  })();

  const [
    { data: repsHoy },
    { data: repsSemana },
    { data: repsMes },
    { data: todasReps },
    { data: creditosPend },
    { data: repsPorEmpleado }
  ] = await Promise.all([
    sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').eq('fecha',hoy),
    sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').gte('fecha',primerSemana),
    sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').gte('fecha',primerMes),
    sb.from('reparaciones').select('descripcion,costo').eq('taller_id',tid()).eq('estado','finalizado').gte('fecha',primerMes),
    sb.from('fiados').select('monto').eq('taller_id',tid()).eq('pagado',false),
    sb.from('reparacion_mecanicos').select('nombre_mecanico, horas, reparaciones(costo, estado, fecha, taller_id)').order('created_at', {ascending: false})
  ]);

  const ganHoy = (repsHoy||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
  const ganSemana = (repsSemana||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
  const ganMes = (repsMes||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
  const totalCréditos = (creditosPend||[]).reduce((s,f)=>s+parseFloat(f.monto||0),0);

  let repQSMes=0, repPOSMes=0, repGastosMes=0;
  const [{data:_qsM},{data:_posM},{data:_gastM}] = await Promise.all([
    sb.from('quickservices').select('total').eq('taller_id',tid()).gte('created_at',primerMes+'T00:00:00'),
    sb.from('ventas_pos').select('total').eq('taller_id',tid()).gte('created_at',primerMes+'T00:00:00'),
    sb.from('gastos_taller').select('monto').eq('taller_id',tid()).gte('fecha',primerMes)
  ]);
  repQSMes = (_qsM||[]).reduce((s,r)=>s+parseFloat(r.total||0),0);
  repPOSMes = (_posM||[]).reduce((s,r)=>s+parseFloat(r.total||0),0);
  repGastosMes = (_gastM||[]).reduce((s,r)=>s+parseFloat(r.monto||0),0);
  const ingresosTotalMes = ganMes + repQSMes + repPOSMes;
  const gananciaNeta = ingresosTotalMes - repGastosMes;

  const serviciosCount = {};
  (todasReps||[]).forEach(r => {
    const key = r.descripcion || 'Sin descripción';
    serviciosCount[key] = (serviciosCount[key]||0) + parseFloat(r.costo||0);
  });
  const topServicios = Object.entries(serviciosCount).sort((a,b)=>b[1]-a[1]).slice(0,5);

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:2px;margin-bottom:.75rem">${t('repGanancias')}</div>
      <div class="stats-grid" style="margin-bottom:1rem">
        <div class="stat-card"><div class="stat-value" style="font-size:1.3rem">₲${gs(ganHoy)}</div><div class="stat-label">${t('repHoy2')}</div></div>
        <div class="stat-card"><div class="stat-value" style="font-size:1.3rem">₲${gs(ganSemana)}</div><div class="stat-label">${t('repSemana')}</div></div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:.72rem;color:var(--text2);letter-spacing:1px;font-family:var(--font-head)">${t('repMes')} — INGRESOS TOTALES</div>
          <div style="font-family:var(--font-head);font-size:2rem;font-weight:700;color:var(--success)">₲${gs(ingresosTotalMes)}</div>
          <div style="font-size:.7rem;color:var(--text2);margin-top:.2rem">OTs: ₲${gs(ganMes)} · QS: ₲${gs(repQSMes)} · POS: ₲${gs(repPOSMes)}</div>
        </div>
        <div style="font-size:2.5rem">💰</div>
      </div>
      ${repGastosMes>0?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
        <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:12px;padding:.75rem;cursor:pointer" onclick="navigate('gastos')">
          <div style="font-size:.68rem;color:var(--danger);font-family:var(--font-head);letter-spacing:1px">GASTOS MES</div>
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:var(--danger)">₲${gs(repGast
