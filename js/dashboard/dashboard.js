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
  
  const iconMap = {
    clientes: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    vehiculos: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14v-5H5v5zm0 0v3h3v-3h8v3h3v-3M5 12V7h14v5"/><path d="M7 7l2-3h6l2 3"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
    en_progreso: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
    hoy: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="15" r="1"/><circle cx="16" cy="15" r="1"/><circle cx="8" cy="15" r="1"/></svg>`,
    creditos: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    ingresos_mes: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/><path d="M15 6h6v6"/><path d="M21 3l-9 9"/></svg>`,
    ganancia_neta: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M6 8l-4 4 4 4M18 8l4 4-4 4"/></svg>`,
    vehiculos_hoy: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14v-5H5v5zm0 0v3h3v-3h8v3h3v-3M5 12V7h14v5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M12 7v5"/></svg>`,
    stock_bajo: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><circle cx="12" cy="12" r="2"/></svg>`
  };
  
  const kpisDisponibles = [
    { id: 'clientes', label: t('kpiClientes') },
    { id: 'vehiculos', label: t('kpiVehiculos') },
    { id: 'en_progreso', label: t('kpiEnProgreso') },
    { id: 'hoy', label: t('kpiHoy') },
    { id: 'creditos', label: t('kpiCreditos') },
    { id: 'ingresos_mes', label: t('kpiIngresosMes') },
    { id: 'ganancia_neta', label: t('kpiGananciaNeta') },
    { id: 'vehiculos_hoy', label: t('kpiVehiculosHoy') },
    { id: 'stock_bajo', label: t('kpiStockBajo') }
  ];
  
  const visibles = config.kpis_visibles || [];
  
  openModal(`
    <div class="modal-title" style="display:flex;align-items:center;gap:8px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v16h16"/><path d="m9 12 2 2 4-4"/></svg>
      ${t('kpisTitulo')}
    </div>
    <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">${t('kpisDesc')}</div>
    <div style="display:grid;gap:.5rem;margin-bottom:1rem">
      ${kpisDisponibles.map(kpi => `
        <label style="display:flex;align-items:center;gap:.75rem;padding:.5rem;background:var(--surface2);border-radius:8px;cursor:pointer">
          <input type="checkbox" value="${kpi.id}" ${visibles.includes(kpi.id) ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent)">
          <span style="display:flex;align-items:center;gap:6px;">${iconMap[kpi.id] || ''} ${kpi.label}</span>
        </label>
      `).join('')}
    </div>
    <button class="btn-primary" onclick="guardarKPIsConfig()">${t('guardarConfig')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>
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
  toast(t('configGuardada'), 'success');
  closeModal();
  navigate('dashboard');
}

function renderDashboardKPIs(stats, config) {
  const visibles = config.kpis_visibles || ['clientes', 'en_progreso', 'hoy', 'creditos'];
  const kpiRenderers = {
    clientes: () => `<div class="stat-card" onclick="navigate('clientes')"><div class="stat-value">${stats.total_clientes}</div><div class="stat-label">${t('kpiClientes')}</div></div>`,
    vehiculos: () => `<div class="stat-card" onclick="navigate('vehiculos')"><div class="stat-value">${stats.total_vehiculos}</div><div class="stat-label">${t('kpiVehiculos')}</div></div>`,
    en_progreso: () => `<div class="stat-card" onclick="reparaciones({filtro:'en_progreso'})"><div class="stat-value" style="color:var(--accent2)">${stats.en_progreso}</div><div class="stat-label">${t('kpiEnProgreso')}</div></div>`,
    hoy: () => `<div class="stat-card" onclick="reparaciones({filtro:'hoy'})"><div class="stat-value" style="color:var(--success)">${stats.reparaciones_hoy}</div><div class="stat-label">${t('kpiHoy')}</div></div>`,
    creditos: () => `<div class="stat-card" onclick="navigate('creditos')"><div class="stat-value" style="color:var(--danger)">₲${gs(stats.creditos_pendientes)}</div><div class="stat-label">${t('kpiCreditos')}</div></div>`,
    ingresos_mes: () => `<div class="stat-card"><div class="stat-value" style="color:var(--success)">₲${gs(stats.ingresos_mes)}</div><div class="stat-label">${t('kpiIngresosMes')}</div></div>`,
    ganancia_neta: () => `<div class="stat-card"><div class="stat-value" style="color:${stats.ganancia_neta >= 0 ? 'var(--success)' : 'var(--danger)'}">₲${gs(stats.ganancia_neta)}</div><div class="stat-label">${t('kpiGananciaNeta')}</div></div>`,
    vehiculos_hoy: () => `<div class="stat-card" onclick="reparaciones({filtro:'hoy'})"><div class="stat-value" style="color:var(--accent2)">${stats.vehiculos_hoy}</div><div class="stat-label">${t('kpiVehiculosHoy')}</div></div>`,
    stock_bajo: () => `<div class="stat-card" onclick="navigate('inventario')"><div class="stat-value" style="color:var(--warning)">${stats.stock_bajo?.length || 0}</div><div class="stat-label">${t('kpiStockBajo')}</div></div>`
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

  const { data: stats, error, fromCache } = await cachedQuery('dash_stats', () => 
    sb.rpc('get_dashboard_stats', { p_taller_id: tid() })
  );
  
  if (error) {
    console.error('Error cargando dashboard:', error);
    document.getElementById('main-content').innerHTML = `<div class="empty"><p>${t('errorCargarDashboard')}</p></div>`;
    return;
  }

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
            <div style="font-size:.72rem;color:var(--warning);font-family:var(--font-head);letter-spacing:1px;display:flex;align-items:center;gap:4px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              ${t('dashPagosParciales')}
            </div>
            <div style="font-family:var(--font-head);color:var(--warning);font-size:1rem">₲${gs(totalDeuda)}</div>
          </div>
          ${deudores.slice(0, 3).map(d => `<div style="font-size:.78rem;color:var(--text2);padding:.15rem 0">${h(d.clientes?.nombre || t('sinCliente'))} — <span style="color:var(--warning)">${t('debe')} ₲${gs(d.saldo)}</span></div>`).join('')}
          ${deudores.length > 3 ? `<div style="font-size:.7rem;color:var(--text2);margin-top:.3rem">${t('yMas', { count: deudores.length - 3 })}</div>` : ''}
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
          <div style="font-size:.72rem;color:var(--danger);font-family:var(--font-head);letter-spacing:1px;display:flex;align-items:center;gap:4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            ${t('dashCuentasPorPagar')}
          </div>
          <div style="font-family:var(--font-head);color:var(--danger);font-size:1rem">₲${gs(totalUrgente)}</div>
        </div>
        ${urgentes.slice(0, 3).map(c => `<div style="font-size:.78rem;color:var(--text2);padding:.15rem 0">${h(c.proveedor)} — ₲${gs(c.monto)}${c.fecha_vencimiento < hoyStr ? ' <span style="color:var(--danger)">' + t('dashVencida') + '</span>' : ' ' + t('dashVence') + ' ' + formatFecha(c.fecha_vencimiento)}</div>`).join('')}
      </div>`;
    }
  }

  let ultimosMovimientosHTML = '';
  if (currentPerfil?.rol === 'admin') {
    try {
      const { data: ultimosMovs } = await safeQuery(() =>
        sb.from('movimientos_financieros')
          .select('tipo,monto,concepto,fecha,categorias_financieras(nombre)')
          .eq('taller_id', tid())
          .order('created_at', { ascending: false })
          .limit(3)
      );
      if (ultimosMovs && ultimosMovs.length > 0) {
        ultimosMovimientosHTML = `
          <div style="margin-top:1rem;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.75rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
              <span style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1px">💵 ${t('dashUltimosMovimientos')}</span>
              <span onclick="navigate('finanzas')" style="font-size:.65rem;color:var(--accent);cursor:pointer;text-decoration:underline">${t('dashVerTodos')} →</span>
            </div>
            ${ultimosMovs.map(m => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.35rem 0;border-bottom:1px solid var(--border);font-size:.78rem">
                <div style="display:flex;align-items:center;gap:.4rem;max-width:70%">
                  <span style="color:${m.tipo === 'ingreso' ? 'var(--success)' : 'var(--danger)'};font-weight:bold">${m.tipo === 'ingreso' ? '↑' : '↓'}</span>
                  <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(m.concepto || m.categorias_financieras?.nombre || t('movimiento'))}</span>
                </div>
                <span style="font-family:var(--font-head);color:${m.tipo === 'ingreso' ? 'var(--success)' : 'var(--danger)'}">${m.tipo === 'ingreso' ? '+' : '-'}₲${gs(m.monto)}</span>
              </div>
            `).join('')}
          </div>`;
      }
    } catch (e) {
      console.warn('Error cargando últimos movimientos:', e);
    }
  }

  let html = `
    <div style="padding:.25rem 0 .75rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.15rem">
        <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text)">${h(tallerNombre)}</div>
        <div style="display:flex;gap:.3rem">
          ${typeof getTemaToggle === 'function' ? getTemaToggle() : ''}
          ${currentPerfil?.rol === 'admin' ? `<button onclick="modalConfigurarKPIs()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .6rem;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v16h16"/><path d="m9 12 2 2 4-4"/></svg>
          </button>` : ''}
          ${currentPerfil?.rol === 'admin' ? `<button onclick="modalConfigDatos()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .6rem;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>` : ''}
        </div>
      </div>
      <div style="font-size:.75rem;color:var(--text2);margin-bottom:1rem">${t('bienvenido')}, ${h(currentPerfil?.nombre || '')}</div>`;

  if (fromCache) {
    html += `<div id="cache-indicator" style="background:var(--warning);color:#000;padding:2px 8px;border-radius:20px;font-size:.65rem;margin-bottom:.5rem;display:inline-block;display:flex;align-items:center;gap:4px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
      ${t('dashDatosEnCache')}
    </div>`;
  }

  html += `
      ${typeof getModoSimpleToggle === 'function' ? getModoSimpleToggle() : ''}

      ${typeof esModoSimple === 'function' && esModoSimple() ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
          <div onclick="modalNuevaReparacionSimple()" style="background:linear-gradient(145deg, var(--surface), var(--surface2));border:2px solid var(--accent);border-radius:16px;padding:1.2rem .5rem;text-align:center;cursor:pointer">
            <div style="font-size:2.5rem;margin-bottom:5px;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div style="font-family:var(--font-head);font-size:1rem;color:var(--accent);margin-top:.3rem">${t('dashNuevoTrabajo')}</div>
            <div style="font-size:.7rem;color:var(--text2)">${t('dashRegistrarIngreso')}</div>
          </div>
          <div onclick="navigate('ventas')" style="background:linear-gradient(145deg, var(--surface), var(--surface2));border:2px solid var(--success);border-radius:16px;padding:1.2rem .5rem;text-align:center;cursor:pointer">
            <div style="font-size:2.5rem;margin-bottom:5px;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div style="font-family:var(--font-head);font-size:1rem;color:var(--success);margin-top:.3rem">${t('dashCobrarServicio')}</div>
            <div style="font-size:.7rem;color:var(--text2)">${t('dashVentaRapida')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
          <div onclick="navigate('agenda')" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.8rem;text-align:center;cursor:pointer">
            <div style="margin-bottom:8px;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div style="font-size:.8rem;color:var(--text)">${t('dashTurnosHoy')}</div>
          </div>
          <div onclick="modalCierreCaja()" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.8rem;text-align:center;cursor:pointer">
            <div style="margin-bottom:8px;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div style="font-size:.8rem;color:var(--text)">${t('dashCierreCaja')}</div>
          </div>
        </div>
      ` : ''}

      ${alertasStock.length > 0 ? `
      <div style="background:rgba(255,68,68,.1);border-left:4px solid var(--danger);border-radius:8px;padding:.75rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><circle cx="12" cy="12" r="2"/></svg>
          <span style="font-weight:bold;color:var(--danger)">${t('dashboardStockBajo', { count: alertasStock.length })}</span>
        </div>
        <button onclick="navigate('inventario')" style="background:var(--danger);color:#fff;border:none;border-radius:6px;padding:.3rem .8rem;cursor:pointer;font-size:.75rem">${t('dashboardVer')}</button>
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
        <div class="stat-card" onclick="reparaciones({filtro:'semana'})" style="cursor:pointer"><div class="stat-value">${vehiculosSemana}</div><div class="stat-label">${t('dashboardEstaSemana')}</div></div>
        <div class="stat-card" onclick="reparaciones({filtro:'mes'})" style="cursor:pointer"><div class="stat-value">${vehiculosMes}</div><div class="stat-label">${t('dashboardEsteMes')}</div></div>
        <div class="stat-card" onclick="navigate('modo-taller')" style="cursor:pointer;background:rgba(0,229,255,.06);border-color:var(--accent)">
          <div class="stat-value" style="font-size:1.5rem;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div class="stat-label">${t('dashboardModoTaller')}</div>
        </div>
      </div>

      ${currentPerfil?.rol === 'admin' ? `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:.72rem;color:var(--text2);letter-spacing:1px;font-family:var(--font-head)">${t('dashIngresosMes')}</div>
          <div style="font-family:var(--font-head);font-size:1.8rem;font-weight:700;color:var(--success)">₲${gs(totalMes + totalQSMes + totalPOSMes)}</div>
          <div style="font-size:.7rem;color:var(--text2);margin-top:.2rem">OTs: ₲${gs(totalMes)} · QS: ₲${gs(totalQSMes)} · POS: ₲${gs(totalPOSMes)}</div>
        </div>
        <div style="font-size:2rem;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
      </div>
      ${totalGastosMes > 0 ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
        <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:12px;padding:.75rem;cursor:pointer" onclick="navigate('gastos')">
          <div style="font-size:.68rem;color:var(--danger);font-family:var(--font-head);letter-spacing:1px">${t('dashGastosMes')}</div>
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:var(--danger)">₲${gs(totalGastosMes)}</div>
        </div>
        <div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);border-radius:12px;padding:.75rem">
          <div style="font-size:.68rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px">${t('dashGananciaNeta')}</div>
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:${gananciaNeta >= 0 ? 'var(--success)' : 'var(--danger)'}">₲${gs(gananciaNeta)}</div>
        </div>
      </div>` : ''}` : ''}

      ${deudoresHTML}
      ${cuentasVencidasHTML}
      ${ultimosMovimientosHTML}

      <div style="font-family:var(--font-head);font-size:.9rem;color:var(--text2);margin-bottom:.6rem;letter-spacing:2px">${t('dashRecientes')}</div>
      ${recientes.length === 0 ? `<div class="empty"><p>${t('dashSinReps')}</p></div>` :
        recientes.map(r => `
        <div class="card" onclick="detalleReparacion('${r.id}')">
          <div class="card-header">
            <div class="card-avatar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div class="card-info">
              <div class="card-name">${h(r.descripcion)}</div>
              <div class="card-sub">${r.vehiculos ? h(r.vehiculos.marca) + ' ' + h(r.vehiculos.patente) : t('sinVehiculo')} · ${formatFecha(r.fecha)}</div>
            </div>
            <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
          </div>
        </div>`).join('')}
    </div>`;

  document.getElementById('main-content').innerHTML = html;
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
        sb.from('vehiculos').select('*, clientes(nombre,telefono), reparaciones(id,descripcion,estado,costo,fecha,meses_garantia)').eq('taller_id', tid()).ilike('patente', `%${patente}%`).limit(3)
      );
      if (!vehs || vehs.length === 0) {
        resultsEl.innerHTML = `<div style="background:var(--surface2);border-radius:10px;padding:.75rem;margin-bottom:1rem;font-size:.85rem;color:var(--text2)">${t('dashPatenteNoEncontrada')}</div>`;
        return;
      }
      let html = fromCache ? `<div style="font-size:.6rem;color:var(--warning);margin-bottom:.3rem;display:flex;align-items:center;gap:4px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        ${t('dashResultadosCache')}
      </div>` : '';
      html += vehs.map(v => {
        const reps = (v.reparaciones || []).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 5);
        
        let garantiaHTML = '';
        const ahora = new Date();
        const reparacionEnGarantia = reps.find(r => {
          if (r.estado !== 'finalizado') return false;
          const mesesGarantia = r.meses_garantia || 3;
          const fechaRep = new Date(r.fecha);
          const fechaVencimiento = new Date(fechaRep);
          fechaVencimiento.setMonth(fechaVencimiento.getMonth() + mesesGarantia);
          return fechaVencimiento > ahora;
        });
        if (reparacionEnGarantia) {
          const mesesGarantia = reparacionEnGarantia.meses_garantia || 3;
          garantiaHTML = `<div style="background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.3);border-radius:6px;padding:.25rem .5rem;margin-top:.3rem;font-size:.7rem;color:var(--accent);display:inline-block">⚠️ ${t('enGarantia')} (${mesesGarantia} ${t('meses')})</div>`;
        }
        
        return `
          <div style="background:var(--surface);border:1px solid var(--accent);border-radius:12px;padding:1rem;margin-bottom:1rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
              <div>
                <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);letter-spacing:2px">${h(v.patente)}</div>
                <div style="font-size:.82rem;color:var(--text2)">${h(v.marca || '')} ${h(v.modelo || '')} ${v.anio ? '· ' + v.anio : ''}</div>
                ${v.clientes ? `<div style="font-size:.8rem;color:var(--text2);display:flex;align-items:center;gap:4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  ${h(v.clientes.nombre)}
                </div>` : ''}
                ${garantiaHTML}
              </div>
              <button onclick="detalleVehiculo('${v.id}')" style="font-size:.72rem;background:none;border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:3px 8px;cursor:pointer">${t('dashVer')}</button>
            </div>
            <div style="font-size:.72rem;color:var(--text2);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.4rem">${t('dashHistorial')} (${reps.length})</div>
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
        <div style="font-size:2.5rem;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
      </div>
      ${repGastosMes>0?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
        <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:12px;padding:.75rem;cursor:pointer" onclick="navigate('gastos')">
          <div style="font-size:.68rem;color:var(--danger);font-family:var(--font-head);letter-spacing:1px">${t('dashGastosMes')}</div>
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:var(--danger)">₲${gs(repGastosMes)}</div>
        </div>
        <div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);border-radius:12px;padding:.75rem">
          <div style="font-size:.68rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px">${t('dashGananciaNeta')}</div>
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

// Asegurar disponibilidad global para navigation.js
window.reportes = reportes;
