// ─── DASHBOARD (función principal) ───────────────────────────────────────────
// Helpers de fecha, KPIs configurables y `_dashboardBalanceId` viven en
// dashboard-config.js (cargado antes). El buscador de patente vive en
// buscar-patente.js y el "Resumen Rápido" en reportes.js.

async function dashboard() {
  const rol = currentPerfil?.rol;
  const tallerNombre = currentPerfil?.talleres?.nombre || 'Tu Taller';
  if (rol === 'cliente') { misReparaciones(); return; }

  // Tarea #62: si el usuario eligió "Cargá tu primer trabajo" en el banner
  // post-asistente, dejamos un flag para disparar el tour del dashboard la
  // próxima vez que vuelva acá. Lo ejecutamos one-shot (lo borramos al
  // dispararlo) para no repetirlo en cada visita al dashboard.
  try {
    if (localStorage.getItem('tallerpro_tutorial_pendiente') &&
        !localStorage.getItem('tallerpro_tutorial_visto') &&
        typeof iniciarTutorial === 'function') {
      localStorage.removeItem('tallerpro_tutorial_pendiente');
      setTimeout(() => iniciarTutorial(), 600);
    }
  } catch (e) {}

  const hoy = fechaHoy();
  const primerMes = primerDiaMes();

  // Obtener estadísticas básicas + stats con balance seleccionado
  const [statsRes, statsBalanceRes, balancesRes] = await Promise.all([
    cachedQuery('dash_stats_base', () => sb.rpc('get_dashboard_stats', { p_taller_id: tid() })),
    sb.rpc('get_dashboard_stats_balance', { 
      p_taller_id: tid(), 
      p_balance_id: _dashboardBalanceId || null 
    }),
    sb.from('balances').select('id,nombre,color').eq('taller_id', tid()).order('nombre')
  ]);
  
  const stats = statsRes.data || {};
  const statsBalance = statsBalanceRes.data || {};
  const balances = balancesRes.data || [];
  
  if (statsRes.error) {
    console.error('Error cargando dashboard:', statsRes.error);
    document.getElementById('main-content').innerHTML = `<div class="empty"><p>${t('errorCargarDashboard')}</p></div>`;
    return;
  }

  // Combinar stats: usamos los valores base, pero reemplazamos ingresos_mes con el valor filtrado
  let ingresosMesFiltrado = statsBalance.ingresos_mes || 0;
  let gananciaNeta = statsBalance.ganancia_neta || 0;

  // Tarea #75: las RPCs `get_dashboard_stats[_balance]` se calculan en el
  // servidor sumando todos los movimientos del mes. Como la columna nueva
  // `afecta_balance` recién se está rolando, restamos en cliente los
  // movimientos marcados como "no afecta balance" para que los KPIs
  // ignoren préstamos personales / retiros / reembolsos. Si la columna
  // todavía no existe en el Supabase del taller, salteamos y avisamos
  // una sola vez al admin.
  try {
    const colExiste = (typeof detectarAfectaBalance === 'function')
      ? await detectarAfectaBalance() : true;
    if (!colExiste) {
      if (typeof avisarAfectaBalanceFaltante === 'function') avisarAfectaBalanceFaltante();
    } else {
      // Si hay un balance específico seleccionado, sólo descontamos los
      // movimientos asignados a ese balance; "Todos los balances" = todos
      // los del taller (mismo scope que la RPC sin balance).
      const { data: noAfectan, error: noAfectanErr } = await sb
        .from('movimientos_financieros')
        .select('tipo,monto,afecta_balance,movimiento_balance(balance_id)')
        .eq('taller_id', tid())
        .eq('afecta_balance', false)
        .gte('fecha', primerMes)
        .lte('fecha', hoy);
      if (!noAfectanErr && Array.isArray(noAfectan)) {
        let ingNo = 0, egrNo = 0;
        noAfectan.forEach(m => {
          if (_dashboardBalanceId) {
            const enBal = (m.movimiento_balance || []).some(mb => mb.balance_id === _dashboardBalanceId);
            if (!enBal) return;
          }
          const v = parseFloat(m.monto || 0);
          if (m.tipo === 'ingreso') ingNo += v;
          else if (m.tipo === 'egreso') egrNo += v;
        });
        ingresosMesFiltrado = Math.max(0, ingresosMesFiltrado - ingNo);
        // ganancia_neta = ingresos - costos. Si removemos un ingreso, baja;
        // si removemos un egreso, sube.
        gananciaNeta = gananciaNeta - ingNo + egrNo;
      }
    }
  } catch (e) {
    // Columna `afecta_balance` aún no migrada; mantener KPIs originales.
  }
  
  const kpiConfig = await cargarDashboardConfig();
  
  // Construir opciones del selector de balances
  const opcionesBalance = [
    { id: '', nombre: 'Todos los balances', color: '#888' },
    ...balances
  ];
  const balanceSelectHtml = `
    <select id="dashboard-balance-select" onchange="dashboard_cambiarBalance(this.value)" style="background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:.25rem .75rem;font-size:.7rem;color:var(--text);cursor:pointer;margin-left:.5rem;">
      ${opcionesBalance.map(b => `<option value="${b.id}" ${(_dashboardBalanceId === b.id) ? 'selected' : ''}>💰 ${h(b.nombre)}</option>`).join('')}
    </select>
  `;

  const totalClientes = stats.total_clientes || 0;
  const totalVehiculos = stats.total_vehiculos || 0;
  const enProgreso = stats.en_progreso || 0;
  const totalCrédito = stats.creditos_pendientes || 0;
  const repsHoyCount = stats.reparaciones_hoy || 0;
  const alertasStock = stats.stock_bajo || [];
  const recientes = stats.recientes || [];
  const vehiculosHoy = stats.vehiculos_hoy || 0;
  const vehiculosSemana = stats.vehiculos_semana || 0;
  const vehiculosMes = stats.vehiculos_mes || 0;

  // Actualizar stats para los KPIs
  stats.ingresos_mes = ingresosMesFiltrado;
  stats.ganancia_neta = gananciaNeta;

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
            <div style="font-family:var(--font-head);color:var(--warning);font-size:1rem">${fm(totalDeuda)}</div>
          </div>
          ${deudores.slice(0, 3).map(d => `<div style="font-size:.78rem;color:var(--text2);padding:.15rem 0">${h(d.clientes?.nombre || t('sinCliente'))} — <span style="color:var(--warning)">${t('debe')} ${fm(d.saldo)}</span></div>`).join('')}
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
          <div style="font-family:var(--font-head);color:var(--danger);font-size:1rem">${fm(totalUrgente)}</div>
        </div>
        ${urgentes.slice(0, 3).map(c => `<div style="font-size:.78rem;color:var(--text2);padding:.15rem 0">${h(c.proveedor)} — ${fm(c.monto)}${c.fecha_vencimiento < hoyStr ? ' <span style="color:var(--danger)">' + t('dashVencida') + '</span>' : ' ' + t('dashVence') + ' ' + formatFecha(c.fecha_vencimiento)}</div>`).join('')}
      </div>`;
    }
  }

  let ultimosMovimientosHTML = '';
  if (currentPerfil?.rol === 'admin') {
    try {
      const { data: ultimosMovs } = await safeQuery(() =>
        sb.from('movimientos_financieros')
          .select('*, categorias_financieras(nombre)')
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
            ${ultimosMovs.map(m => {
              const noBal = m.afecta_balance === false;
              const noBalBadge = (noBal && typeof badgeNoAfectaBalance === 'function') ? ' ' + badgeNoAfectaBalance() : '';
              return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.35rem 0;border-bottom:1px solid var(--border);font-size:.78rem;${noBal?'opacity:.7;':''}">
                <div style="display:flex;align-items:center;gap:.4rem;max-width:70%">
                  <span style="color:${m.tipo === 'ingreso' ? 'var(--success)' : 'var(--danger)'};font-weight:bold">${m.tipo === 'ingreso' ? '↑' : '↓'}</span>
                  <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(m.concepto || m.categorias_financieras?.nombre || t('movimiento'))}${noBalBadge}</span>
                </div>
                <span style="font-family:var(--font-head);color:${m.tipo === 'ingreso' ? 'var(--success)' : 'var(--danger)'}">${m.tipo === 'ingreso' ? '+' : '-'}${fm(m.monto)}</span>
              </div>
            `;}).join('')}
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
        <div style="display:flex;gap:.3rem;align-items:center">
          ${typeof getTemaToggle === 'function' ? getTemaToggle() : ''}
          ${currentPerfil?.rol === 'admin' ? `<button onclick="modalConfigurarKPIs()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .6rem;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v16h16"/><path d="m9 12 2 2 4-4"/></svg>
          </button>` : ''}
          ${currentPerfil?.rol === 'admin' ? `<button onclick="modalConfigDatos()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .6rem;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>` : ''}
          ${balanceSelectHtml}
        </div>
      </div>
      <div style="font-size:.75rem;color:var(--text2);margin-bottom:1rem">${t('bienvenido')}, ${h(currentPerfil?.nombre || '')}</div>`;

  if (statsRes.fromCache) {
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

      ${typeof getSetupPendienteCard === 'function' ? getSetupPendienteCard() : ''}
      ${getInstallBanner()}
      ${getSuscripcionBanner()}
      ${typeof getPushBanner === 'function' ? getPushBanner() : ''}

      ${(currentPerfil?.rol === 'admin' || currentPerfil?.rol === 'empleado') ? `
      <div onclick="navigate('para-hoy')" style="background:linear-gradient(145deg, rgba(0,229,255,.10), rgba(0,229,255,.04));border:1px solid rgba(0,229,255,.35);border-radius:12px;padding:.85rem 1rem;margin-bottom:1rem;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:.6rem">
        <div style="display:flex;align-items:center;gap:.65rem">
          <div style="width:38px;height:38px;border-radius:10px;background:rgba(0,229,255,.12);display:flex;align-items:center;justify-content:center;font-size:1.2rem">📋</div>
          <div>
            <div style="font-family:var(--font-head);font-size:.95rem;color:var(--accent)">Para hoy</div>
            <div style="font-size:.72rem;color:var(--text2)">Tus pendientes del día en un toque</div>
          </div>
        </div>
        <span style="font-size:1.1rem;color:var(--accent)">→</span>
      </div>` : ''}

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

      ${currentPerfil?.rol === 'admin' ? `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:.72rem;color:var(--text2);letter-spacing:1px;font-family:var(--font-head)">${t('dashIngresosMes')}</div>
          <div style="font-family:var(--font-head);font-size:1.8rem;font-weight:700;color:var(--success)">${fm(ingresosMesFiltrado)}</div>
          <div style="font-size:.7rem;color:var(--text2);margin-top:.2rem">${_dashboardBalanceId ? 'Balance seleccionado' : 'Todos los balances'}</div>
        </div>
        <div style="font-size:2rem;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
      </div>
      ` : ''}

      ${deudoresHTML}
      ${cuentasVencidasHTML}
      ${ultimosMovimientosHTML}

      ${(() => {
        // "Recientes" del usuario: clientes y trabajos vistos por última vez
        // (de localStorage). Permite saltar de un toque sin volver a buscar.
        const recCli = (typeof getRecientes === 'function' ? getRecientes('clientes', 5) : []) || [];
        const recRep = (typeof getRecientes === 'function' ? getRecientes('reparaciones', 5) : []) || [];
        if (recCli.length === 0 && recRep.length === 0) return '';
        const chip = (icon, titulo, sub, onclick) => `
          <div onclick="${onclick}" style="display:flex;align-items:center;gap:.55rem;padding:.55rem .65rem;background:var(--surface2);border:1px solid var(--border);border-radius:10px;cursor:pointer;min-width:200px;flex:1">
            <div style="width:30px;height:30px;border-radius:8px;background:rgba(0,229,255,.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.82rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(titulo)}</div>
              ${sub ? `<div style="font-size:.65rem;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(sub)}</div>` : ''}
            </div>
          </div>`;
        const all = [
          ...recCli.map(c => chip('👤', c.nombre || 'Cliente', c.telefono || '', `detalleCliente('${hjs(c.id)}')`)),
          ...recRep.map(r => chip('🔧', r.descripcion || 'Trabajo', r.patente || '', `detalleReparacion('${hjs(r.id)}')`)),
        ];
        return `
          <div style="font-family:var(--font-head);font-size:.9rem;color:var(--text2);margin:.4rem 0 .5rem;letter-spacing:2px">RECIENTES</div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem">${all.join('')}</div>`;
      })()}

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
