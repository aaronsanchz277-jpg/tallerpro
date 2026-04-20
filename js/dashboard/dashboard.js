// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function fechaHoy() { return new Date().toISOString().split('T')[0]; }
function primerDiaMes() { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-01`; }
function formatFecha(f) { if (!f) return ''; const [y,m,d] = f.split('-'); return `${d}/${m}/${y}`; }

// ─── CONFIGURACIÓN DE KPIS DEL DASHBOARD ────────────────────────────────────
let _dashboardConfig = null;

async function cargarDashboardConfig() {
  if (_dashboardConfig) return _dashboardConfig;
  const { data } = await sb.from('dashboard_config').select('*').eq('taller_id', tid()).maybeSingle();
  if (!data) {
    _dashboardConfig = {
      kpis_visibles: ['clientes', 'en_progreso', 'hoy', 'creditos'],
      orden_kpis: []
    };
  } else {
    _dashboardConfig = data;
  }
  return _dashboardConfig;
}

async function modalConfigurarKPIs() {
  const config = await cargarDashboardConfig();
  const kpisDisponibles = [
    { id: 'clientes', label: 'Total clientes', icon: '👥' },
    { id: 'vehiculos', label: 'Total vehículos', icon: '🚗' },
    { id: 'en_progreso', label: 'Trabajos en progreso', icon: '🔧' },
    { id: 'hoy', label: 'Trabajos hoy', icon: '📅' },
    { id: 'creditos', label: 'Créditos pendientes', icon: '💰' },
    { id: 'ingresos_mes', label: 'Ingresos del mes', icon: '📊' },
    { id: 'ganancia_neta', label: 'Ganancia neta', icon: '💎' },
    { id: 'vehiculos_hoy', label: 'Vehículos hoy', icon: '🚙' },
    { id: 'stock_bajo', label: 'Alertas stock bajo', icon: '⚠️' }
  ];
  
  const visibles = config.kpis_visibles || [];
  
  openModal(`
    <div class="modal-title">📊 Configurar KPIs del Dashboard</div>
    <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">Seleccioná qué indicadores querés ver en la pantalla principal</div>
    <div style="display:grid;gap:.5rem;margin-bottom:1rem">
      ${kpisDisponibles.map(kpi => `
        <label style="display:flex;align-items:center;gap:.5rem;padding:.5rem;background:var(--surface2);border-radius:8px;cursor:pointer">
          <input type="checkbox" value="${kpi.id}" ${visibles.includes(kpi.id) ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent)">
          <span style="font-size:.9rem">${kpi.icon} ${kpi.label}</span>
        </label>
      `).join('')}
    </div>
    <button class="btn-primary" onclick="guardarKPIsConfig()">Guardar configuración</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
  `);
}

async function guardarKPIsConfig() {
  const checkboxes = document.querySelectorAll('#modal-overlay input[type="checkbox"]');
  const visibles = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
  
  await sb.from('dashboard_config').upsert({
    taller_id: tid(),
    kpis_visibles: visibles,
    updated_at: new Date().toISOString()
  });
  
  _dashboardConfig = null;
  toast('Configuración guardada', 'success');
  closeModal();
  navigate('dashboard');
}

function renderDashboardKPIs(stats, config) {
  const visibles = config.kpis_visibles || ['clientes', 'en_progreso', 'hoy', 'creditos'];
  const kpiRenderers = {
    clientes: () => `<div class="stat-card" onclick="navigate('clientes')"><div class="stat-value">${stats.total_clientes}</div><div class="stat-label">Clientes</div></div>`,
    vehiculos: () => `<div class="stat-card" onclick="navigate('vehiculos')"><div class="stat-value">${stats.total_vehiculos}</div><div class="stat-label">Vehículos</div></div>`,
    en_progreso: () => `<div class="stat-card" onclick="reparaciones({filtro:'en_progreso'})"><div class="stat-value" style="color:var(--accent2)">${stats.en_progreso}</div><div class="stat-label">En progreso</div></div>`,
    hoy: () => `<div class="stat-card" onclick="reparaciones({filtro:'hoy'})"><div class="stat-value" style="color:var(--success)">${stats.reparaciones_hoy}</div><div class="stat-label">Hoy</div></div>`,
    creditos: () => `<div class="stat-card" onclick="navigate('creditos')"><div class="stat-value" style="color:var(--danger)">₲${gs(stats.creditos_pendientes)}</div><div class="stat-label">Créditos</div></div>`,
    ingresos_mes: () => `<div class="stat-card"><div class="stat-value" style="color:var(--success)">₲${gs(stats.ingresos_mes)}</div><div class="stat-label">Ingresos mes</div></div>`,
    ganancia_neta: () => `<div class="stat-card"><div class="stat-value" style="color:${stats.ganancia_neta >= 0 ? 'var(--success)' : 'var(--danger)'}">₲${gs(stats.ganancia_neta)}</div><div class="stat-label">Ganancia neta</div></div>`,
    vehiculos_hoy: () => `<div class="stat-card" onclick="reparaciones({filtro:'hoy'})"><div class="stat-value" style="color:var(--accent2)">${stats.vehiculos_hoy}</div><div class="stat-label">Vehículos hoy</div></div>`,
    stock_bajo: () => `<div class="stat-card" onclick="navigate('inventario')"><div class="stat-value" style="color:var(--warning)">${stats.stock_bajo?.length || 0}</div><div class="stat-label">Stock bajo</div></div>`
  };
  
  let html = '<div class="stats-grid">';
  for (const kpi of visibles) {
    if (kpiRenderers[kpi]) html += kpiRenderers[kpi]();
  }
  html += '</div>';
  return html;
}

async function dashboard() {
  const rol = currentPerfil?.rol;
  const tallerNombre = currentPerfil?.talleres?.nombre || 'Tu Taller';
  if (rol === 'cliente') { misReparaciones(); return; }

  const hoy = fechaHoy();
  const primerMes = primerDiaMes();

  // Obtener estadísticas consolidadas vía RPC con caché
  const { data: stats, error, fromCache } = await cachedQuery('dash_stats', () => 
    sb.rpc('get_dashboard_stats', { p_taller_id: tid() })
  );
  
  if (error) {
    console.error('Error cargando dashboard:', error);
    document.getElementById('main-content').innerHTML = `<div class="empty"><p>Error al cargar el dashboard</p></div>`;
    return;
  }

  // Cargar configuración de KPIs
  const kpiConfig = await cargarDashboardConfig();

  const totalClientes = stats.total_clientes || 0;
  const totalVehiculos = stats.total_vehiculos || 0;
  const enProgreso = stats.en_progreso || 0;
  const totalCrédito = stats.creditos_pendientes || 0;
  const repsHoyCount = stats.reparaciones_hoy || 0;
  const totalMes = stats.ingresos_mes || 0;
  const alertasStock = stats.stock_bajo || [];
  const recientes = stats.recientes || [];
  const vehiculosHoy = stats.vehiculos_hoy || 0;
  const vehiculosSemana = stats.vehiculos_semana || 0;
  const vehiculosMes = stats.vehiculos_mes || 0;
  
  let gananciaNeta = 0;

  let totalQSMes = 0, totalPOSMes = 0, totalGastosMes = 0;
  if (currentPerfil?.rol === 'admin') {
    const [{ data: qsMes }, { data: posMes }, { data: gastosMes }] = await Promise.all([
      cachedQuery('dash_qs_mes', () => sb.from('ventas').select('total').eq('taller_id', tid()).eq('es_servicio_rapido', true).gte('created_at', primerMes + 'T00:00:00')),
      cachedQuery('dash_pos_mes', () => sb.from('ventas').select('total').eq('taller_id', tid()).eq('es_servicio_rapido', false).gte('created_at', primerMes + 'T00:00:00')),
      cachedQuery('dash_gastos_mes', () => sb.from('gastos_taller').select('monto').eq('taller_id', tid()).gte('fecha', primerMes))
    ]);
    totalQSMes = (qsMes?.data || []).reduce((s, r) => s + parseFloat(r.total || 0), 0);
    totalPOSMes = (posMes?.data || []).reduce((s, r) => s + parseFloat(r.total || 0), 0);
    totalGastosMes = (gastosMes?.data || []).reduce((s, r) => s + parseFloat(r.monto || 0), 0);
    gananciaNeta = totalMes + totalQSMes + totalPOSMes - totalGastosMes;
  }

  stats.ganancia_neta = gananciaNeta;
  stats.stock_bajo = alertasStock;

  let deudoresHTML = '';
  if (currentPerfil?.rol === 'admin') {
    const { data: repsConDeuda } = await cachedQuery('dash_deudores', () => 
      sb.from('reparaciones').select('id,descripcion,costo,clientes(nombre)').eq('taller_id', tid()).eq('estado', 'finalizado').gt('costo', 0).limit(50)
    );
    if (repsConDeuda?.length) {
      const { data: allPagos } = await cachedQuery('dash_pagos_rep', () =>
        sb.from('pagos_reparacion').select('reparacion_id,monto').eq('taller_id', tid()).limit(500)
      );
      const pagosPorRep = {};
      (allPagos || []).forEach(p => { if (!pagosPorRep[p.reparacion_id]) pagosPorRep[p.reparacion_id] = 0; pagosPorRep[p.reparacion_id] += parseFloat(p.monto || 0); });
      const deudores = repsConDeuda.filter(r => {
        const pagado = pagosPorRep[r.id] || 0;
        return pagado < parseFloat(r.costo) && pagado > 0;
      }).map(r => ({ ...r, saldo: parseFloat(r.costo) - (pagosPorRep[r.id] || 0) }));
      if (deudores.length > 0) {
        const totalDeuda = deudores.reduce((s, d) => s + d.saldo, 0);
        deudoresHTML = `<div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.3);border-radius:10px;padding:.75rem;margin-bottom:1rem;cursor:pointer" onclick="navigate('reparaciones')">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
            <div style="font-size:.72rem;color:var(--warning);font-family:var(--font-head);letter-spacing:1px">💸 PAGOS PARCIALES PENDIENTES</div>
            <div style="font-family:var(--font-head);color:var(--warning);font-size:1rem">₲${gs(totalDeuda)}</div>
          </div>
          ${deudores.slice(0, 3).map(d => `<div style="font-size:.78rem;color:var(--text2);padding:.15rem 0">${h(d.clientes?.nombre || 'Sin cliente')} — <span style="color:var(--warning)">debe ₲${gs(d.saldo)}</span></div>`).join('')}
          ${deudores.length > 3 ? `<div style="font-size:.7rem;color:var(--text2);margin-top:.3rem">y ${deudores.length - 3} más...</div>` : ''}
        </div>`;
      }
    }
  }

  let cuentasVencidasHTML = '';
  if (currentPerfil?.rol === 'admin') {
    const { data: cuentasP } = await cachedQuery('dash_cuentas_pagar', () =>
      sb.from('cuentas_pagar').select('proveedor,monto,fecha_vencimiento').eq('taller_id', tid()).eq('pagada', false).order('fecha_vencimiento').limit(10)
    );
    const hoyStr = new Date().toISOString().split('T')[0];
    const vencidas = (cuentasP || []).filter(c => c.fecha_vencimiento && c.fecha_vencimiento < hoyStr);
    const porVencer = (cuentasP || []).filter(c => c.fecha_vencimiento && c.fecha_vencimiento >= hoyStr && c.fecha_vencimiento <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    const urgentes = [...vencidas, ...porVencer];
    if (urgentes.length > 0) {
      const totalUrgente = urgentes.reduce((s, c) => s + parseFloat(c.monto || 0), 0);
      cuentasVencidasHTML = `<div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:10px;padding:.75rem;margin-bottom:1rem;cursor:pointer" onclick="navigate('cuentas-pagar')">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
          <div style="font-size:.72rem;color:var(--danger);font-family:var(--font-head);letter-spacing:1px">📋 CUENTAS POR PAGAR</div>
          <div style="font-family:var(--font-head);color:var(--danger);font-size:1rem">₲${gs(totalUrgente)}</div>
        </div>
        ${urgentes.slice(0, 3).map(c => `<div style="font-size:.78rem;color:var(--text2);padding:.15rem 0">${h(c.proveedor)} — ₲${gs(c.monto)}${c.fecha_vencimiento < hoyStr ? ' <span style="color:var(--danger)">VENCIDA</span>' : ' vence ' + formatFecha(c.fecha_vencimiento)}</div>`).join('')}
      </div>`;
    }
  }

  let html = `
    <div style="padding:.25rem 0 .75rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.15rem">
        <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text)">${h(tallerNombre)}</div>
        <div style="display:flex;gap:.3rem">
          ${typeof getTemaToggle === 'function' ? getTemaToggle() : ''}
          ${currentPerfil?.rol === 'admin' ? `<button onclick="modalConfigurarKPIs()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .6rem;cursor:pointer;font-size:.75rem">📊</button>` : ''}
          ${currentPerfil?.rol === 'admin' ? `<button onclick="modalConfigDatos()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .6rem;cursor:pointer;font-size:.75rem">⚙️</button>` : ''}
        </div>
      </div>
      <div style="font-size:.75rem;color:var(--text2);margin-bottom:1rem">${t('bienvenido')}, ${h(currentPerfil?.nombre || '')}</div>`;

  if (fromCache) {
    html += `<div id="cache-indicator" style="background:var(--warning);color:#000;padding:2px 8px;border-radius:20px;font-size:.65rem;margin-bottom:.5rem;display:inline-block">📦 Datos en caché</div>`;
  }

  html += `
      ${typeof getModoSimpleToggle === 'function' ? getModoSimpleToggle() : ''}

      ${typeof esModoSimple === 'function' && esModoSimple() ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
          <div onclick="modalNuevaReparacionSimple()" style="background:linear-gradient(145deg, var(--surface), var(--surface2));border:2px solid var(--accent);border-radius:16px;padding:1.2rem .5rem;text-align:center;cursor:pointer">
            <div style="font-size:2.5rem">🔧</div>
            <div style="font-family:var(--font-head);font-size:1rem;color:var(--accent);margin-top:.3rem">Nuevo trabajo</div>
            <div style="font-size:.7rem;color:var(--text2)">Registrar ingreso de vehículo</div>
          </div>
          <div onclick="navigate('ventas')" style="background:linear-gradient(145deg, var(--surface), var(--surface2));border:2px solid var(--success);border-radius:16px;padding:1.2rem .5rem;text-align:center;cursor:pointer">
            <div style="font-size:2.5rem">💰</div>
            <div style="font-family:var(--font-head);font-size:1rem;color:var(--success);margin-top:.3rem">Cobrar servicio</div>
            <div style="font-size:.7rem;color:var(--text2)">Venta rápida de productos</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
          <div onclick="navigate('agenda')" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.8rem;text-align:center;cursor:pointer">
            <div style="font-size:1.5rem">📅</div>
            <div style="font-size:.8rem;color:var(--text)">Turnos de hoy</div>
          </div>
          <div onclick="modalCierreCaja()" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.8rem;text-align:center;cursor:pointer">
            <div style="font-size:1.5rem">🔐</div>
            <div style="font-size:.8rem;color:var(--text)">Cierre de caja</div>
          </div>
        </div>
      ` : ''}

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

      ${renderDashboardKPIs(stats, kpiConfig)}

      <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr">
        <div class="stat-card" onclick="reparaciones({filtro:'semana'})" style="cursor:pointer"><div class="stat-value">${vehiculosSemana}</div><div class="stat-label">Esta semana</div></div>
        <div class="stat-card" onclick="reparaciones({filtro:'mes'})" style="cursor:pointer"><div class="stat-value">${vehiculosMes}</div><div class="stat-label">Este mes</div></div>
        <div class="stat-card" onclick="navigate('modo-taller')" style="cursor:pointer;background:rgba(0,229,255,.06);border-color:var(--accent)"><div class="stat-value" style="font-size:1.5rem">📺</div><div class="stat-label">Modo Taller</div></div>
      </div>

      ${currentPerfil?.rol === 'admin' ? `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:.72rem;color:var(--text2);letter-spacing:1px;font-family:var(--font-head)">${t('dashIngresosMes')}</div>
          <div style="font-family:var(--font-head);font-size:1.8rem;font-weight:700;color:var(--success)">₲${gs(totalMes + totalQSMes + totalPOSMes)}</div>
          <div style="font-size:.7rem;color:var(--text2);margin-top:.2rem">OTs: ₲${gs(totalMes)} · QS: ₲${gs(totalQSMes)} · POS: ₲${gs(totalPOSMes)}</div>
        </div>
        <div style="font-size:2rem">💰</div>
      </div>
      ${totalGastosMes > 0 ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
        <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:12px;padding:.75rem;cursor:pointer" onclick="navigate('gastos')">
          <div style="font-size:.68rem;color:var(--danger);font-family:var(--font-head);letter-spacing:1px">GASTOS MES</div>
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:var(--danger)">₲${gs(totalGastosMes)}</div>
        </div>
        <div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);border-radius:12px;padding:.75rem">
          <div style="font-size:.68rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px">GANANCIA NETA</div>
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:${gananciaNeta >= 0 ? 'var(--success)' : 'var(--danger)'}">₲${gs(gananciaNeta)}</div>
        </div>
      </div>` : ''}` : ''}

      ${deudoresHTML}
      ${cuentasVencidasHTML}

      <div style="font-family:var(--font-head);font-size:.9rem;color:var(--text2);margin-bottom:.6rem;letter-spacing:2px">${t('dashRecientes')}</div>
      ${recientes.length === 0 ? `<div class="empty"><p>${t('dashSinReps')}</p></div>` :
        recientes.map(r => `
        <div class="card" onclick="detalleReparacion('${r.id}')">
          <div class="card-header">
            <div class="card-avatar">🔧</div>
            <div class="card-info">
              <div class="card-name">${h(r.descripcion)}</div>
              <div class="card-sub">${r.vehiculos ? h(r.vehiculos.marca) + ' ' + h(r.vehiculos.patente) : t('sinVehiculo')} · ${formatFecha(r.fecha)}</div>
            </div>
            <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
          </div>
        </div>`).join('')}
    </div>`;

  document.getElementById('main-content').innerHTML = html;
  
  if (typeof esModoSimple === 'function' && esModoSimple() && typeof iniciarTutorial === 'function') {
    setTimeout(iniciarTutorial, 500);
  }
}

let patenteBusquedaTimer = null;
async function buscarPatente(valor) {
  const resultsEl = document.getElementById('patente-results');
  if (!resultsEl) return;
  const patente = valor.trim().toUpperCase();
  if (!patente) { resultsEl.innerHTML = ''; return; }
  clearTimeout(patenteBusquedaTimer);
  patenteBusquedaTimer = setTimeout(async () => {
    await safeCall(async () => {
      const { data: vehs, fromCache } = await cachedQuery(`buscar_patente_${patente}`, () =>
        sb.from('vehiculos').select('*, clientes(nombre,telefono), reparaciones(id,descripcion,estado,costo,fecha)').eq('taller_id', tid()).ilike('patente', `%${patente}%`).limit(3)
      );
      if (!vehs || vehs.length === 0) {
        resultsEl.innerHTML = `<div style="background:var(--surface2);border-radius:10px;padding:.75rem;margin-bottom:1rem;font-size:.85rem;color:var(--text2)">No se encontró ningún vehículo con esa patente.</div>`;
        return;
      }
      let html = fromCache ? '<div style="font-size:.6rem;color:var(--warning);margin-bottom:.3rem">📦 Resultados en caché</div>' : '';
      html += vehs.map(v => {
        const reps = (v.reparaciones || []).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 5);
        return `
          <div style="background:var(--surface);border:1px solid var(--accent);border-radius:12px;padding:1rem;margin-bottom:1rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
              <div>
                <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);letter-spacing:2px">${h(v.patente)}</div>
                <div style="font-size:.82rem;color:var(--text2)">${h(v.marca || '')} ${h(v.modelo || '')} ${v.anio ? '· ' + v.anio : ''}</div>
                ${v.clientes ? `<div style="font-size:.8rem;color:var(--text2)">👤 ${h(v.clientes.nombre)}</div>` : ''}
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
      resultsEl.innerHTML = html;
    }, null, 'Error al buscar patente');
  }, 500);
}

// ─── REPORTES (RESUMEN RÁPIDO) ─────────────────────────────────────────────────
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
    cachedQuery('rep_hoy', () => sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').eq('fecha',hoy)),
    cachedQuery('rep_semana', () => sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').gte('fecha',primerSemana)),
    cachedQuery('rep_mes', () => sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').gte('fecha',primerMes)),
    cachedQuery('rep_todas', () => sb.from('reparaciones').select('descripcion,costo').eq('taller_id',tid()).eq('estado','finalizado').gte('fecha',primerMes)),
    cachedQuery('cred_pend', () => sb.from('fiados').select('monto').eq('taller_id',tid()).eq('pagado',false)),
    cachedQuery('rep_emp', () => sb.from('reparacion_mecanicos').select('nombre_mecanico, horas, reparaciones(costo, estado, fecha, taller_id)').order('created_at', {ascending: false}))
  ]);

  const ganHoy = (repsHoy||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
  const ganSemana = (repsSemana||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
  const ganMes = (repsMes||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
  const totalCréditos = (creditosPend||[]).reduce((s,f)=>s+parseFloat(f.monto||0),0);

  let repQSMes=0, repPOSMes=0, repGastosMes=0;
  const [{data:_qsM},{data:_posM},{data:_gastM}] = await Promise.all([
    cachedQuery('rep_qs', () => sb.from('ventas').select('total').eq('taller_id',tid()).eq('es_servicio_rapido', true).gte('created_at',primerMes+'T00:00:00')),
    cachedQuery('rep_pos', () => sb.from('ventas').select('total').eq('taller_id',tid()).eq('es_servicio_rapido', false).gte('created_at',primerMes+'T00:00:00')),
    cachedQuery('rep_gastos', () => sb.from('gastos_taller').select('monto').eq('taller_id',tid()).gte('fecha',primerMes))
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
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:var(--danger)">₲${gs(repGastosMes)}</div>
        </div>
        <div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);border-radius:12px;padding:.75rem">
          <div style="font-size:.68rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px">GANANCIA NETA</div>
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:${gananciaNeta>=0?'var(--success)':'var(--danger)'}">₲${gs(gananciaNeta)}</div>
        </div>
      </div>`:''}
      <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:12px;padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:.72rem;color:var(--danger);letter-spacing:1px;font-family:var(--font-head)">${t('repFiados')}</div>
          <div style="font-family:var(--font-head);font-size:1.8rem;font-weight:700;color:var(--danger)">₲${gs(totalCréditos)}</div>
        </div>
        <button onclick="navigate('creditos')" style="background:rgba(255,68,68,.15);border:1px solid rgba(255,68,68,.3);color:var(--danger);border-radius:8px;padding:.5rem .75rem;font-size:.8rem;cursor:pointer">${t('repVerCreditos')}</button>
      </div>
      ${topServicios.length > 0 ? `
      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:2px;margin-bottom:.6rem">${t('repTopServ')}</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.75rem;margin-bottom:1rem">
        ${topServicios.map(([desc,total],i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;gap:.5rem;align-items:center">
              <span style="font-family:var(--font-head);font-size:.85rem;color:var(--accent2)">#${i+1}</span>
              <span style="font-size:.85rem">${h(desc)}</span>
            </div>
            <span style="font-family:var(--font-head);color:var(--success);font-size:.9rem">₲${gs(total)}</span>
          </div>`).join('')}
      </div>` : `<div class="empty"><p>${t('repSinReps2')}</p></div>`}

      ${(() => {
        const empStats = {};
        (repsPorEmpleado||[]).forEach(r => {
          if (!r.reparaciones || r.reparaciones.taller_id !== tid()) return;
          if (r.reparaciones.fecha < primerMes) return;
          const nombre = r.nombre_mecanico || 'Sin nombre';
          if (!empStats[nombre]) empStats[nombre] = { total:0, finalizadas:0, ingresos:0, horas:0 };
          empStats[nombre].total++;
          empStats[nombre].horas += parseFloat(r.horas||0);
          if (r.reparaciones.estado === 'finalizado') { empStats[nombre].finalizadas++; empStats[nombre].ingresos += parseFloat(r.reparaciones.costo||0); }
        });
        const empArr = Object.entries(empStats).sort((a,b)=>b[1].ingresos-a[1].ingresos);
        if (empArr.length === 0) return '';
        return `
        <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:2px;margin-bottom:.6rem">PRODUCTIVIDAD POR EMPLEADO (MES)</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.75rem;margin-bottom:1rem">
          ${empArr.map(([nombre, s], i) => {
            const pct = empArr[0][1].ingresos > 0 ? Math.round(s.ingresos / empArr[0][1].ingresos * 100) : 0;
            return `
            <div style="padding:.6rem 0;${i<empArr.length-1?'border-bottom:1px solid var(--border)':''}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
                <div style="display:flex;gap:.5rem;align-items:center">
                  <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:var(--accent)">${h(nombre).charAt(0)}</div>
                  <span style="font-size:.85rem;font-weight:500">${h(nombre)}</span>
                </div>
                <span style="font-family:var(--font-head);color:var(--success);font-size:.9rem">₲${gs(s.ingresos)}</span>
              </div>
              <div style="display:flex;gap:1rem;font-size:.72rem;color:var(--text2);margin-left:2.3rem">
                <span>${s.finalizadas} finalizadas</span>
                <span>${s.total} asignadas</span>
                <span>${s.horas}h trabajadas</span>
              </div>
              <div style="margin-left:2.3rem;margin-top:.3rem;height:4px;background:var(--surface2);border-radius:2px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:var(--accent);border-radius:2px"></div>
              </div>
            </div>`;
          }).join('')}
        </div>`;
      })()}
    </div>`;
}
