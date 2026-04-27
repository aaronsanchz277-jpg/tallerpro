// ─── NAVIGATION ──────────────────────────────────────────────────────────────
function buildNav() {
  const rol = currentPerfil?.rol;
  const bottomItems = [];
  const sidebarSections = [];

  // === BOTTOM NAV (4 items más usados) ===
  bottomItems.push({ id: 'dashboard', label: t('navInicio'), icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>' });

  if (rol === 'admin' || rol === 'empleado') {
    bottomItems.push({ id: 'reparaciones', label: t('navReparaciones'), icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' });
    bottomItems.push({ id: 'clientes', label: t('navClientes'), icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' });
    bottomItems.push({ id: 'agenda', label: t('navAgenda'), icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' });
  }

  if (rol === 'cliente') {
    bottomItems.push({ id: 'mis-reparaciones', label: t('navMisReps'), icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' });
    bottomItems.push({ id: 'mis-vehiculos', label: t('navMisAutos'), icon: '<path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2h-2"/><circle cx="8.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>' });
    bottomItems.push({ id: 'mis-citas', label: t('navMisCitas'), icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' });
  }

  // === SIDEBAR (todas las secciones organizadas) ===
  if (rol === 'admin' || rol === 'empleado') {
    sidebarSections.push({ title: 'PRINCIPAL', items: [
      { id:'dashboard', label:'Inicio', icon:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>' },
      { id:'para-hoy', label:'📋 Para hoy', icon:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/>' },
      { id:'reparaciones', label:'Trabajos', icon:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
      { id:'panel-trabajo', label:'Panel de Trabajo', icon:'<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>' },
      { id:'clientes', label:'Clientes', icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' },
      { id:'vehiculos', label:'Vehículos', icon:'<rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-3M1 16h1M6 16h12"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' },
    ]});
    sidebarSections.push({ title: 'GESTIÓN', items: [
      { id:'agenda', label:'Turnos', icon:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
      { id:'mantenimientos', label:'Mantenimientos', icon:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
      { id:'inventario', label:'Inventario', icon:'<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' },
    ]});
    if (rol === 'admin') {
      sidebarSections.push({ title: 'CLIENTES', items: [
        { id:'solicitudes', label:'📥 Solicitudes de cliente', icon:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
      ]});
    }
  }

  if (rol === 'empleado') {
    sidebarSections.push({ title: 'MIS DATOS', items: [
      { id:'mis-trabajos', label:'Mis Trabajos', icon:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>' },
      { id:'mi-cobro', label:'Mi Cobro', icon:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
      { id:'mi-perfil', label:'Mi Perfil', icon:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
    ]});
    // Empleados con permiso "registrar_cobros" ven el centro de cobros pendientes.
    if (typeof tienePerm === 'function' && tienePerm('registrar_cobros')) {
      sidebarSections.push({ title: 'COBROS', items: [
        { id:'por-cobrar', label:'💰 Por cobrar', icon:'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
      ]});
    }
  }

  if (rol === 'admin') {
    sidebarSections.push({ title: 'VENTAS', items: [
      { id:'presupuestos', label:'Presupuestos', icon:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
      { id:'ventas', label:'Ventas', icon:'<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' },
    ]});
    sidebarSections.push({ title: 'FINANZAS', items: [
      { id:'por-cobrar', label:'💰 Por cobrar', icon:'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
      { id:'por-pagar', label:'📤 Por pagar', icon:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
      { id:'finanzas', label:'💵 Caja del día', icon:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
      { id:'finanzas-movimientos', label:'Movimientos', icon:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' },
      { id:'creditos', label:'Créditos', icon:'<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' },
      { id:'gastos', label:'Gastos', icon:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>' },
      { id:'cuentas-pagar', label:'Cuentas a pagar', icon:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
      { id:'sueldos', label:'Sueldos', icon:'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
      { id:'balances', label:'💰 Balances', icon:'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' }, // 👈 NUEVA RUTA
    ]});
    sidebarSections.push({ title: 'REPORTES', items: [
      { id:'reportes', label:'Resumen Rápido', icon:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>' },
      { id:'reporte-rentabilidad', label:'Rentabilidad', icon:'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
      { id:'reporte-flujo-caja', label:'Flujo de Caja', icon:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
      { id:'reporte-comparativas', label:'Comparativas', icon:'<path d="M2 12h20M12 2v20M4 4l4 4-4 4M20 4l-4 4 4 4"/>' },
      { id:'reporte-tendencias', label:'Tendencias', icon:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' },
    ]});
    sidebarSections.push({ title: 'HERRAMIENTAS', items: [
      { id:'modo-taller', label:'📺 Modo Taller (TV)', icon:'<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' },
      { id: null, label:'📋 Plantillas Checklist', icon:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>', onclick:'modalGestionarChecklists()' },
      { id: null, label:'📨 Mensajes WhatsApp', icon:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>', onclick:'modalConfigurarRecordatorios()' },
      { id: null, label:'📄 Escanear Factura', icon:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="12" cy="15" r="2"/>', onclick:'modalEscanearFactura()' },
      { id: null, label:'📅 Google Calendar', icon:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', onclick:'modalConfigurarGoogleCalendar()' },
      { id: null, label:'🔄 Buscar actualizaciones', icon:'<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>', onclick:'checkForUpdate()' },
    ]});
    sidebarSections.push({ title: 'CONFIGURACIÓN', items: [
      { id:'empleados', label:'Empleados', icon:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
      { id:'usuarios', label:'Usuarios', icon:'<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>' },
      { id:'mi-plan', label:'Mi Plan', icon:'<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>' },
      { id:'mi-perfil', label:'Mi Perfil', icon:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
    ]});
  }

  if (rol === 'cliente') {
    sidebarSections.push({ title: 'MIS DATOS', items: [
      { id:'mis-reparaciones', label:t('navMisReps'), icon:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
      { id:'mis-presupuestos', label:'Mis presupuestos', icon:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
      { id:'mis-vehiculos', label:t('navMisAutos'), icon:'<rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-3"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' },
      { id:'mis-mantenimientos', label:t('navMisMant'), icon:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
      { id:'mis-citas', label:t('navMisCitas'), icon:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
      { id:'mi-perfil', label:'Mi Perfil', icon:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
    ]});
  }

  if (typeof _isSuperAdmin !== 'undefined' && _isSuperAdmin) {
    sidebarSections.push({ title: 'SISTEMA', items: [
      { id:'super-admin', label:'Super Admin', icon:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
    ]});
  }

  if (typeof _isSuperAdmin !== 'undefined' && _isSuperAdmin && typeof tallerpro_testUI === 'function') {
    sidebarSections.push({ title: 'DEV', items: [
      { id:'_tests', label:'🧪 Tests', icon:'<path d="M9 2h6l-2 5h4l-7 9 2-6H7z"/>', onclick:'tallerpro_testUI()' },
    ]});
  }

  // RENDER BOTTOM NAV (+ botón "Buscar" para staff: dispara command palette)
  const buscarBtn = (rol === 'admin' || rol === 'empleado') ? `
    <button class="nav-btn" onclick="palette_open && palette_open()" id="nav-buscar" title="Buscar (atajo: /)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      Buscar
    </button>` : '';
  document.getElementById('bottom-nav').innerHTML = bottomItems.map(n => `
    <button class="nav-btn" onclick="navigate('${n.id}')" id="nav-${n.id}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${n.icon}</svg>
      ${n.label}
    </button>`).join('') + buscarBtn;

  // RENDER SIDEBAR
  const nombre = currentPerfil?.nombre || '';
  const rolLabel = { admin:'Administrador', empleado:'Empleado', cliente:'Cliente' }[rol] || '';
  const rolClass = { admin:'role-admin', empleado:'role-empleado', cliente:'role-cliente' }[rol] || '';
  document.getElementById('sidebar-user').textContent = nombre;
  document.getElementById('sidebar-role').innerHTML = `<span class="topbar-role ${rolClass}">${rolLabel}</span>`;
  
  document.getElementById('sidebar-items').innerHTML = sidebarSections.map(section => `
    <div style="margin-bottom:.5rem">
      <div style="font-size:.6rem;color:var(--text2);letter-spacing:2px;font-family:var(--font-head);padding:.6rem .75rem .25rem">${section.title}</div>
      ${section.items.map(item => `
        <button onclick="closeSidebar();${item.onclick || `navigate('${item.id}')`}" id="side-${item.id}" style="width:100%;display:flex;align-items:center;gap:.65rem;padding:.55rem .75rem;background:none;border:none;cursor:pointer;border-radius:10px;transition:background .15s;text-align:left" onmouseover="this.style.background='rgba(0,229,255,.06)'" onmouseout="this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text2)" stroke-width="1.5" width="18" height="18">${item.icon}</svg>
          <span style="font-size:.85rem;color:var(--text);font-weight:400;flex:1">${item.label}</span>
          <span id="badge-${item.id}" style="display:none"></span>
        </button>`).join('')}
    </div>`).join('');

  // Cargar contadores en background (no bloquea el render del menú)
  setTimeout(() => { try { cargarBadgesNav(); } catch(_){} }, 0);

  // Tarea #63: si el taller subió un logo, mostrarlo en sidebar y topbar.
  if (typeof aplicarLogoTallerEnUI === 'function') {
    try { aplicarLogoTallerEnUI(); } catch(_) { /* no-op */ }
  }
}

// ─── BADGES DE CONTADOR EN SIDEBAR/BOTTOM-NAV ───────────────────────────────
// Carga asíncrona de pendientes para que el usuario vea de un vistazo qué le
// queda por revisar sin tener que entrar a cada sección.
async function cargarBadgesNav() {
  const rol = currentPerfil?.rol;
  const tallerId = tid();
  if (!tallerId) return;

  if (rol === 'admin') {
    try {
      const [pendientes, turnos] = await Promise.all([
        sb.from('perfiles').select('id', { count: 'exact', head: true })
          .eq('taller_id', tallerId).eq('rol', 'cliente').is('cliente_id', null),
        sb.from('citas').select('id', { count: 'exact', head: true })
          .eq('taller_id', tallerId).eq('estado', 'pendiente'),
      ]);
      const total = (pendientes.count || 0) + (turnos.count || 0);
      pintarBadgeNav('side-solicitudes', total, 'var(--warning)');
    } catch (_) { /* silencioso */ }

    // Centro de cobros: cuántas cosas están pendientes de cobrar y de pagar.
    if (typeof porCobrar_contar === 'function') {
      porCobrar_contar().then(n => pintarBadgeNav('side-por-cobrar', n, 'var(--danger)')).catch(()=>{});
    }
    if (typeof porPagar_contar === 'function') {
      porPagar_contar().then(n => pintarBadgeNav('side-por-pagar', n, 'var(--warning)')).catch(()=>{});
    }
  }

  if (rol === 'empleado' && typeof tienePerm === 'function' && tienePerm('registrar_cobros')) {
    if (typeof porCobrar_contar === 'function') {
      porCobrar_contar().then(n => pintarBadgeNav('side-por-cobrar', n, 'var(--danger)')).catch(()=>{});
    }
  }

  if (rol === 'cliente') {
    try {
      const { data: perfil } = await sb.from('perfiles')
        .select('cliente_id').eq('id', currentUser.id).maybeSingle();
      if (!perfil?.cliente_id) return;

      const [pptosV2, repsPend, citasConf] = await Promise.all([
        sb.from('presupuestos_v2').select('id', { count: 'exact', head: true })
          .eq('cliente_id', perfil.cliente_id).eq('estado', 'generado'),
        sb.from('reparaciones').select('id', { count: 'exact', head: true })
          .eq('cliente_id', perfil.cliente_id).eq('aprobacion_cliente', 'pendiente').gt('costo', 0),
        sb.from('citas').select('id', { count: 'exact', head: true })
          .eq('cliente_id', perfil.cliente_id)
          .eq('estado', 'confirmada')
          .gte('fecha', new Date().toISOString().split('T')[0]),
      ]);

      const pptosTotal = (pptosV2.count || 0) + (repsPend.count || 0);
      pintarBadgeNav('side-mis-presupuestos', pptosTotal, 'var(--warning)');
      pintarBadgeNav('side-mis-citas', citasConf.count || 0, 'var(--accent)');
    } catch (_) { /* silencioso */ }
  }
}

function pintarBadgeNav(buttonId, count, color = 'var(--accent)') {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  const span = btn.querySelector(`#badge-${buttonId.replace('side-', '')}`);
  if (!span) return;
  if (!count || count <= 0) {
    span.style.display = 'none';
    span.textContent = '';
    return;
  }
  span.style.cssText = `display:inline-block;background:${color};color:#000;font-family:var(--font-head);font-size:.65rem;font-weight:700;padding:1px 7px;border-radius:10px;min-width:18px;text-align:center`;
  span.textContent = count > 99 ? '99+' : String(count);
}

function openSidebar() {
  document.getElementById('sidebar').style.left = '0';
  const overlay = document.getElementById('sidebar-overlay');
  overlay.style.display = 'block';
  setTimeout(() => overlay.style.opacity = '1', 10);
  document.querySelectorAll('#sidebar-items button').forEach(b => b.style.background = 'none');
  const active = document.getElementById('side-' + currentPage);
  if (active) active.style.background = 'rgba(0,229,255,.08)';
}

function closeSidebar() {
  document.getElementById('sidebar').style.left = '-280px';
  const overlay = document.getElementById('sidebar-overlay');
  overlay.style.opacity = '0';
  setTimeout(() => overlay.style.display = 'none', 300);
}

async function navigate(page, params = {}) {
  const rol = currentPerfil?.rol;
  const adminOnly = ['finanzas','finanzas-movimientos','creditos','cuentas-pagar','reportes','empleados','usuarios','mi-plan','gastos','presupuestos','ventas','sueldos','reporte-rentabilidad','reporte-flujo-caja','reporte-comparativas','reporte-tendencias','modo-taller','balances','solicitudes','por-pagar'];
  if (adminOnly.includes(page) && rol !== 'admin') { toast('No tenés acceso a esta sección','error'); navigate('dashboard'); return; }

  // "Por cobrar": admin O empleado con permiso "registrar_cobros".
  if (page === 'por-cobrar') {
    const okEmp = rol === 'empleado' && typeof tienePerm === 'function' && tienePerm('registrar_cobros');
    if (rol !== 'admin' && !okEmp) { toast('No tenés acceso a esta sección','error'); navigate('dashboard'); return; }
  }

  const staffOnly = ['reparaciones','clientes','vehiculos','inventario','agenda','mantenimientos','panel-trabajo','para-hoy'];
  if (staffOnly.includes(page) && rol === 'cliente') { navigate('mis-reparaciones'); return; }
  
  const clienteOnly = ['mis-reparaciones','mis-vehiculos','mis-mantenimientos','mis-citas','mis-presupuestos'];
  if (clienteOnly.includes(page) && rol !== 'cliente') { navigate('dashboard'); return; }

  // Cleanup al salir de "modo-taller": limpia intervals + clase del body
  if (currentPage === 'modo-taller' && page !== 'modo-taller') {
    if (typeof _modoTallerInterval !== 'undefined' && _modoTallerInterval) {
      clearInterval(_modoTallerInterval); _modoTallerInterval = null;
    }
    if (typeof _modoTallerRelojInterval !== 'undefined' && _modoTallerRelojInterval) {
      clearInterval(_modoTallerRelojInterval); _modoTallerRelojInterval = null;
    }
    document.body.classList.remove('modo-taller');
  }

  currentPage = page;
  // Si hay una versión nueva esperando y el usuario cerró el toast, reaparece
  // al cambiar de pantalla (Tarea #64). El helper respeta el cooldown de 5min.
  if (typeof window._tpMaybeShowUpdateBanner === 'function') {
    try { window._tpMaybeShowUpdateBanner(); } catch (e) {}
  }
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  
  document.getElementById('main-content').innerHTML = getSkeleton(page);
  const pages = { 
    dashboard, clientes, vehiculos, reparaciones, inventario, creditos, empleados, 
    presupuestos, reportes, usuarios, mantenimientos, agenda,
    finanzas: cajaDelDia,
    'finanzas-movimientos': finanzas,
    'cuentas-pagar': cuentasPagar, 
    'mis-vehiculos': misVehiculos, 
    'mis-reparaciones': misReparaciones, 
    'mis-mantenimientos': misMantenimientos, 
    'mis-citas': misCitas, 
    'mis-presupuestos': misPresupuestos,
    'solicitudes': solicitudesCliente,
    'mi-plan': miPlan, 
    'super-admin': superAdminPanel, 
    'mis-trabajos': misTrabajos,
    'mi-cobro': miCobro,
    'mi-perfil': miPerfil, 
    ventas, 
    gastos, 
    'panel-trabajo': panelTrabajo,
    sueldos,
    'reporte-rentabilidad': reporteRentabilidad,
    'reporte-flujo-caja': reporteFlujoCaja,
    'reporte-comparativas': reporteComparativas,
    'reporte-tendencias': reporteTendencias,
    'modo-taller': modoTaller,
    'balances': balances,  // 👈 NUEVA RUTA
    'por-cobrar': porCobrar,
    'por-pagar': porPagar,
    'para-hoy': paraHoy
  };
  const pageFn = pages[page];
  if (pageFn) {
    try {
      await pageFn(params);
    } catch (e) {
      console.error('Error navegando a', page, e);
      toast('Error al cargar la página', 'error');
    }
  } else {
    console.warn('Página no encontrada:', page);
    navigate('dashboard');
  }
  if (typeof fab_actualizarVisibilidad === 'function') fab_actualizarVisibilidad();
}

// Función global para buscar actualizaciones manualmente
async function checkForUpdate() {
  if (!navigator.serviceWorker) {
    toast('Tu navegador no soporta actualizaciones automáticas', 'error');
    return;
  }
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    toast('No se pudo acceder al Service Worker', 'error');
    return;
  }
  toast('Verificando actualizaciones...', 'info');
  await reg.update();
  setTimeout(() => {
    if (reg.waiting) {
      toast('¡Nueva versión lista! Actualizá la página.', 'success');
      if (typeof showUpdateBanner === 'function') showUpdateBanner();
    } else {
      toast('Ya tenés la última versión', 'success');
    }
  }, 1500);
}
