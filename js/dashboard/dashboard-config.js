// ─── HELPERS FECHA + CONFIGURACIÓN DE KPIS DEL DASHBOARD ─────────────────────
// Cargado ANTES que dashboard.js (la función `dashboard()` usa `cargarDashboardConfig`,
// `renderDashboardKPIs`, `fechaHoy`, `primerDiaMes` y `formatFecha`).
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
    creditos: () => `<div class="stat-card" onclick="navigate('creditos')"><div class="stat-value" style="color:var(--danger)">${fm(stats.creditos_pendientes)}</div><div class="stat-label">${t('kpiCreditos')}</div></div>`,
    ingresos_mes: () => `<div class="stat-card"><div class="stat-value" style="color:var(--success)">${fm(stats.ingresos_mes)}</div><div class="stat-label">${t('kpiIngresosMes')}</div></div>`,
    ganancia_neta: () => `<div class="stat-card"><div class="stat-value" style="color:${stats.ganancia_neta >= 0 ? 'var(--success)' : 'var(--danger)'}">${fm(stats.ganancia_neta)}</div><div class="stat-label">${t('kpiGananciaNeta')}</div></div>`,
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

// Variable global para el balance seleccionado en el Dashboard
let _dashboardBalanceId = localStorage.getItem('dashboard_balance_id') || '';

async function dashboard_cambiarBalance(balanceId) {
  _dashboardBalanceId = balanceId;
  localStorage.setItem('dashboard_balance_id', balanceId);
  await dashboard();
}
window.dashboard_cambiarBalance = dashboard_cambiarBalance;
