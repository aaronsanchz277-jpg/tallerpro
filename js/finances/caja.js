// ─── CAJA DEL DÍA + CIERRE DE CAJA ──────────────────────────────────────────
// Pantalla principal de Finanzas: muestra ingresos, egresos, saldo y un
// timeline cronológico unificado de los movimientos del día (sumando
// pagos_reparacion, ventas, gastos_taller y movimientos_financieros).
// Botón "Cerrar caja" siempre visible en la cabecera.

const CIERRE_LS_PREFIX = 'tp_cierre_caja_';

function _cierreLSKey(fecha) {
  return CIERRE_LS_PREFIX + (tid() || 'sin-taller') + '_' + fecha;
}

function _cierreEstado(fecha) {
  try {
    const raw = localStorage.getItem(_cierreLSKey(fecha));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function _guardarCierreLocal(fecha, datos) {
  try {
    localStorage.setItem(_cierreLSKey(fecha), JSON.stringify({
      cerrado_por: currentPerfil?.nombre || '',
      cerrado_at: new Date().toISOString(),
      ...datos
    }));
  } catch (e) { console.warn('No se pudo guardar cierre local', e); }
}

function _borrarCierreLocal(fecha) {
  try { localStorage.removeItem(_cierreLSKey(fecha)); } catch {}
}

// ─── PANTALLA "CAJA DEL DÍA" ────────────────────────────────────────────────
async function cajaDelDia(params = {}) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede ver la caja')) {
    if (typeof navigate === 'function') navigate('dashboard');
    return;
  }

  const fecha = params.fecha || fechaHoy();
  const contenido = document.getElementById('main-content');
  contenido.innerHTML = `
    <div style="padding:.25rem 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;flex-wrap:wrap;gap:.5rem">
        <div>
          <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text)">💵 Caja del día</div>
          <div style="font-size:.72rem;color:var(--text2)">${formatFecha(fecha)}</div>
        </div>
        <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">
          <input type="date" id="caja-fecha" value="${fecha}" onchange="cajaDelDia({fecha:this.value})" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.4rem;color:var(--text);font-size:.78rem">
          <button id="btn-cerrar-caja" onclick="cajaDelDia_cerrarCaja('${fecha}')" style="background:var(--warning);color:#000;border:none;border-radius:8px;padding:.45rem .8rem;font-size:.78rem;cursor:pointer;font-family:var(--font-head);font-weight:600">🔒 Cerrar caja</button>
        </div>
      </div>

      <div id="caja-banner-cerrada" style="display:none;background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.25);border-radius:10px;padding:.6rem .8rem;margin-bottom:.75rem;justify-content:space-between;align-items:center;gap:.5rem">
        <div style="font-size:.78rem;color:var(--success)" id="caja-banner-texto"></div>
        <button onclick="cajaDelDia_reabrirCaja('${fecha}')" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:.3rem .6rem;font-size:.7rem;cursor:pointer">Reabrir</button>
      </div>

      <div style="display:flex;gap:.4rem;margin-bottom:.75rem;flex-wrap:wrap">
        <button onclick="navigate('finanzas-movimientos')" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:.4rem .7rem;font-size:.75rem;cursor:pointer;font-family:var(--font-head)">📊 Todos los movimientos</button>
        <button onclick="conciliador_modalConciliacion()" style="background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.25);color:var(--accent);border-radius:8px;padding:.4rem .7rem;font-size:.75rem;cursor:pointer;font-family:var(--font-head)">🔍 Conciliar</button>
        <button onclick="finanzas_modalCategorias()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:.4rem .7rem;font-size:.75rem;cursor:pointer;font-family:var(--font-head)">📌 Categorías</button>
      </div>

      <div id="caja-contenido">
        <div style="text-align:center;padding:2rem;color:var(--text2)">Cargando caja del día...</div>
      </div>
    </div>
  `;

  await cajaDelDia_cargarDatos(fecha);
}

async function cajaDelDia_cargarDatos(fecha) {
  const cont = document.getElementById('caja-contenido');
  if (!cont) return;

  try {
    const desde = fecha + 'T00:00:00';
    const hasta = fecha + 'T23:59:59';
    const [
      movRes,
      pagosRes,
      ventasRes,
      gastosRes,
      fiadosRes
    ] = await Promise.all([
      sb.from('movimientos_financieros')
        .select('id,tipo,monto,concepto,fecha,created_at,referencia_tabla,referencia_id,categorias_financieras(nombre)')
        .eq('taller_id', tid()).eq('fecha', fecha)
        .order('created_at', { ascending: false }),
      sb.from('pagos_reparacion')
        .select('id,monto,metodo,notas,fecha,created_at,reparacion_id,reparaciones(descripcion,vehiculos(patente))')
        .eq('taller_id', tid()).eq('fecha', fecha)
        .order('created_at', { ascending: false }),
      sb.from('ventas')
        .select('id,total,metodo_pago,descripcion,es_servicio_rapido,created_at,clientes(nombre),vehiculos(patente)')
        .eq('taller_id', tid()).eq('estado', 'completado')
        .gte('created_at', desde).lte('created_at', hasta)
        .order('created_at', { ascending: false }),
      sb.from('gastos_taller')
        .select('id,descripcion,monto,categoria,proveedor,fecha,created_at')
        .eq('taller_id', tid()).eq('fecha', fecha)
        .order('created_at', { ascending: false }),
      sb.from('fiados')
        .select('id,monto,descripcion,fecha_pago,clientes(nombre)')
        .eq('taller_id', tid()).eq('pagado', true)
        .gte('fecha_pago', desde).lte('fecha_pago', hasta)
    ]);

    const movimientos    = movRes.data    || [];
    const pagos          = pagosRes.data  || [];
    const ventas         = ventasRes.data || [];
    const gastos         = gastosRes.data || [];
    const creditosPagados= fiadosRes.data || [];

    // ── Totales por tipo de origen ─────────────────────────────────────────
    const totCobros   = pagos.reduce((s,p)=>s+parseFloat(p.monto||0),0);
    const totVentas   = ventas.reduce((s,v)=>s+parseFloat(v.total||0),0);
    const totGastos   = gastos.reduce((s,g)=>s+parseFloat(g.monto||0),0);
    const totFiados   = creditosPagados.reduce((s,f)=>s+parseFloat(f.monto||0),0);

    // Manuales: movimientos_financieros que no son réplica de otra tabla
    const movManuales = movimientos.filter(m => !m.referencia_tabla);
    const totManIng   = movManuales.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+parseFloat(m.monto||0),0);
    const totManEgr   = movManuales.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+parseFloat(m.monto||0),0);

    // Totales globales: usamos movimientos_financieros como fuente de
    // verdad (los triggers replican cobros, ventas y gastos ahí). Si la BD
    // del taller todavía no tiene los triggers corriendo, sumamos a mano
    // como fallback.
    let totalIngresos = movimientos.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+parseFloat(m.monto||0),0);
    let totalEgresos  = movimientos.filter(m=>m.tipo==='egreso' ).reduce((s,m)=>s+parseFloat(m.monto||0),0);

    const ingresosTrigger = totCobros + totVentas + totFiados + totManIng;
    const egresosTrigger  = totGastos + totManEgr;
    if (totalIngresos < ingresosTrigger - 1) totalIngresos = ingresosTrigger;
    if (totalEgresos  < egresosTrigger  - 1) totalEgresos  = egresosTrigger;

    const saldo = totalIngresos - totalEgresos;

    // ── Cobros por método (incluye pagos de reparación + ventas + fiados) ──
    const porMetodo = { Efectivo:0, Transferencia:0, Tarjeta:0, 'Crédito':0, Otro:0 };
    pagos.forEach(p => { const m = p.metodo || 'Efectivo'; porMetodo[m] = (porMetodo[m]||0) + parseFloat(p.monto||0); });
    ventas.forEach(v => {
      const raw = (v.metodo_pago || 'efectivo').toLowerCase();
      const map = { efectivo:'Efectivo', transferencia:'Transferencia', tarjeta:'Tarjeta', credito:'Crédito', 'crédito':'Crédito' };
      const m = map[raw] || 'Otro';
      porMetodo[m] = (porMetodo[m]||0) + parseFloat(v.total||0);
    });
    porMetodo['Efectivo'] += totFiados;

    const efectivoEnCaja = (porMetodo['Efectivo']||0) - totGastos - totManEgr;

    // ── Timeline cronológico unificado ─────────────────────────────────────
    const items = [];
    pagos.forEach(p => items.push({
      ts: p.created_at || (fecha+'T12:00:00'),
      tipo: 'ingreso',
      origen: 'cobro',
      titulo: `Cobro reparación · ${p.reparaciones?.vehiculos?.patente ? p.reparaciones.vehiculos.patente : ''} ${p.reparaciones?.descripcion ? '· '+p.reparaciones.descripcion : ''}`.trim(),
      sub: `${p.metodo || 'Efectivo'}${p.notas ? ' · '+p.notas : ''}`,
      monto: parseFloat(p.monto||0),
      onclick: p.reparacion_id ? `detalleReparacion('${p.reparacion_id}')` : ''
    }));
    ventas.forEach(v => items.push({
      ts: v.created_at,
      tipo: 'ingreso',
      origen: v.es_servicio_rapido ? 'servicio' : 'venta',
      titulo: (v.es_servicio_rapido ? '⚡ ' : '🛒 ') + (v.descripcion || (v.clientes?.nombre || 'Venta mostrador')),
      sub: `${v.metodo_pago || 'efectivo'}${v.vehiculos?.patente ? ' · '+v.vehiculos.patente : ''}`,
      monto: parseFloat(v.total||0),
      onclick: `detalleVenta('${v.id}')`
    }));
    creditosPagados.forEach(f => items.push({
      ts: f.fecha_pago,
      tipo: 'ingreso',
      origen: 'fiado',
      titulo: `Cobro fiado · ${f.clientes?.nombre || 'Cliente'}`,
      sub: f.descripcion || '',
      monto: parseFloat(f.monto||0),
      onclick: `navigate('creditos')`
    }));
    gastos.forEach(g => items.push({
      ts: g.created_at || (fecha+'T12:00:00'),
      tipo: 'egreso',
      origen: 'gasto',
      titulo: g.descripcion || 'Gasto',
      sub: `${g.categoria || 'Sin categoría'}${g.proveedor ? ' · '+g.proveedor : ''}`,
      monto: parseFloat(g.monto||0),
      onclick: `modalEditarGasto('${g.id}')`
    }));
    movManuales.forEach(m => items.push({
      ts: m.created_at || (fecha+'T12:00:00'),
      tipo: m.tipo,
      origen: 'manual',
      titulo: m.concepto || 'Movimiento manual',
      sub: m.categorias_financieras?.nombre || 'Sin categoría',
      monto: parseFloat(m.monto||0),
      onclick: `finanzas_modalEditar('${m.id}')`
    }));

    items.sort((a,b) => (b.ts||'').localeCompare(a.ts||''));

    const badge = (origen) => {
      const map = {
        cobro:    { bg:'rgba(0,255,136,.12)',  c:'var(--success)', l:'COBRO' },
        venta:    { bg:'rgba(0,229,255,.12)',  c:'var(--accent)',  l:'VENTA' },
        servicio: { bg:'rgba(0,255,136,.12)',  c:'var(--success)', l:'SERVICIO' },
        fiado:    { bg:'rgba(255,204,0,.12)',  c:'var(--warning)', l:'FIADO' },
        gasto:    { bg:'rgba(255,68,68,.12)',  c:'var(--danger)',  l:'GASTO' },
        manual:   { bg:'rgba(160,160,160,.15)',c:'var(--text2)',   l:'MANUAL' }
      };
      const x = map[origen] || map.manual;
      return `<span style="background:${x.bg};color:${x.c};font-size:.6rem;font-family:var(--font-head);letter-spacing:1px;padding:2px 6px;border-radius:6px">${x.l}</span>`;
    };

    const horaDe = (ts) => {
      if (!ts) return '';
      try { return new Date(ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}); }
      catch { return ''; }
    };

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:.75rem">
        <div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:12px;padding:.7rem;text-align:center">
          <div style="font-size:.6rem;color:var(--success);letter-spacing:1px;font-family:var(--font-head)">INGRESOS</div>
          <div style="font-family:var(--font-head);font-size:1.15rem;color:var(--success)">${fm(totalIngresos)}</div>
        </div>
        <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.2);border-radius:12px;padding:.7rem;text-align:center">
          <div style="font-size:.6rem;color:var(--danger);letter-spacing:1px;font-family:var(--font-head)">EGRESOS</div>
          <div style="font-family:var(--font-head);font-size:1.15rem;color:var(--danger)">${fm(totalEgresos)}</div>
        </div>
        <div style="background:${saldo>=0?'rgba(0,229,255,.08)':'rgba(255,68,68,.08)'};border:1px solid ${saldo>=0?'rgba(0,229,255,.25)':'rgba(255,68,68,.25)'};border-radius:12px;padding:.7rem;text-align:center">
          <div style="font-size:.6rem;color:${saldo>=0?'var(--accent)':'var(--danger)'};letter-spacing:1px;font-family:var(--font-head)">SALDO</div>
          <div style="font-family:var(--font-head);font-size:1.15rem;color:${saldo>=0?'var(--accent)':'var(--danger)'}">${fm(saldo)}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.4rem;margin-bottom:.75rem">
        ${_kpiMini('Cobros reparación', totCobros, 'var(--success)')}
        ${_kpiMini('Ventas / Servicios', totVentas, 'var(--accent)')}
        ${_kpiMini('Fiados cobrados', totFiados, 'var(--warning)')}
        ${_kpiMini('Gastos', totGastos, 'var(--danger)')}
        ${_kpiMini('Manuales (+)', totManIng, 'var(--success)')}
        ${_kpiMini('Manuales (−)', totManEgr, 'var(--danger)')}
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.7rem;margin-bottom:.75rem">
        <div style="font-size:.65rem;color:var(--text2);letter-spacing:1px;font-family:var(--font-head);margin-bottom:.4rem">COBROS POR MÉTODO</div>
        ${Object.entries(porMetodo).filter(([,v])=>v>0).map(([met,total]) => `
          <div style="display:flex;justify-content:space-between;padding:.25rem 0;font-size:.8rem">
            <span>${met==='Efectivo'?'💵':met==='Transferencia'?'🏦':met==='Tarjeta'?'💳':met==='Crédito'?'📋':'📎'} ${met}</span>
            <span style="font-family:var(--font-head);color:var(--success)">${fm(total)}</span>
          </div>`).join('') || '<div style="font-size:.78rem;color:var(--text2)">Sin cobros</div>'}
        <div style="display:flex;justify-content:space-between;padding:.4rem 0 0;border-top:1px solid var(--border);margin-top:.4rem;font-size:.8rem">
          <span style="color:var(--text2)">Efectivo en caja (cobros − gastos)</span>
          <span style="font-family:var(--font-head);color:${efectivoEnCaja>=0?'var(--accent)':'var(--danger)'}">${fm(efectivoEnCaja)}</span>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
        <div style="font-family:var(--font-head);font-size:.85rem;color:var(--accent);letter-spacing:1px">MOVIMIENTOS DEL DÍA (${items.length})</div>
      </div>

      ${items.length === 0 ? '<div class="empty"><p>Aún no hay movimientos hoy</p></div>' : `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
          ${items.map((it,i) => `
            <div ${it.onclick?`onclick="${it.onclick}"`:''}
                 style="${it.onclick?'cursor:pointer;':''}display:flex;align-items:center;padding:.6rem .75rem;${i>0?'border-top:1px solid var(--border);':''}gap:.6rem">
              <div style="width:36px;height:36px;border-radius:10px;background:${it.tipo==='ingreso'?'rgba(0,255,136,.1)':'rgba(255,68,68,.1)'};display:flex;align-items:center;justify-content:center;font-family:var(--font-head);color:${it.tipo==='ingreso'?'var(--success)':'var(--danger)'};font-size:1rem;flex-shrink:0">${it.tipo==='ingreso'?'↑':'↓'}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                  ${badge(it.origen)}
                  <span style="font-size:.82rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${h(it.titulo)}</span>
                </div>
                <div style="font-size:.68rem;color:var(--text2);margin-top:2px">${horaDe(it.ts)}${it.sub ? ' · '+h(it.sub) : ''}</div>
              </div>
              <div style="font-family:var(--font-head);font-size:.95rem;color:${it.tipo==='ingreso'?'var(--success)':'var(--danger)'};flex-shrink:0">${it.tipo==='ingreso'?'+':'-'}${fm(it.monto)}</div>
            </div>
          `).join('')}
        </div>
      `}
    `;

    // Banner si la caja del día está cerrada
    const cierre = _cierreEstado(fecha);
    const banner = document.getElementById('caja-banner-cerrada');
    const btnCerrar = document.getElementById('btn-cerrar-caja');
    if (cierre && banner) {
      const cuandoTxt = cierre.cerrado_at ? new Date(cierre.cerrado_at).toLocaleString('es-AR') : '';
      document.getElementById('caja-banner-texto').textContent =
        `🔒 Caja cerrada${cierre.cerrado_por ? ' por '+cierre.cerrado_por : ''}${cuandoTxt ? ' — '+cuandoTxt : ''}. Saldo declarado: ${fm(cierre.saldo||0)}`;
      banner.style.display = 'flex';
      if (btnCerrar) {
        btnCerrar.textContent = '✓ Cerrada';
        btnCerrar.disabled = true;
        btnCerrar.style.opacity = '.6';
        btnCerrar.style.cursor = 'default';
      }
    }
  } catch (error) {
    console.error('Error cargando caja del día:', error);
    cont.innerHTML = `<div class="empty"><p>Error al cargar la caja: ${h(error.message||'')}</p></div>`;
  }
}

function _kpiMini(label, monto, color) {
  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:.5rem .6rem">
    <div style="font-size:.55rem;color:var(--text2);letter-spacing:1px;font-family:var(--font-head)">${label}</div>
    <div style="font-family:var(--font-head);font-size:.95rem;color:${color}">${fm(monto||0)}</div>
  </div>`;
}

async function cajaDelDia_cerrarCaja(fecha) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede cerrar caja')) return;
  if (_cierreEstado(fecha)) {
    toast('La caja de este día ya está cerrada', 'info');
    return;
  }
  // Tomamos los totales actualmente en pantalla
  confirmar(`¿Cerrar la caja del ${formatFecha(fecha)}? Vas a poder reabrirla si necesitás.`, async () => {
    try {
      // Recalcular para registrar valores definitivos
      const desde = fecha + 'T00:00:00';
      const hasta = fecha + 'T23:59:59';
      const [movRes, pagosRes, ventasRes, gastosRes, fiadosRes] = await Promise.all([
        sb.from('movimientos_financieros').select('tipo,monto,referencia_tabla').eq('taller_id', tid()).eq('fecha', fecha),
        sb.from('pagos_reparacion').select('monto,metodo').eq('taller_id', tid()).eq('fecha', fecha),
        sb.from('ventas').select('total').eq('taller_id', tid()).eq('estado','completado').gte('created_at', desde).lte('created_at', hasta),
        sb.from('gastos_taller').select('monto').eq('taller_id', tid()).eq('fecha', fecha),
        sb.from('fiados').select('monto').eq('taller_id', tid()).eq('pagado', true).gte('fecha_pago', desde).lte('fecha_pago', hasta)
      ]);
      const sum = (a,c='monto') => (a||[]).reduce((s,x)=>s+parseFloat(x[c]||0),0);
      const ingMov = sum((movRes.data||[]).filter(m=>m.tipo==='ingreso'));
      const egrMov = sum((movRes.data||[]).filter(m=>m.tipo==='egreso'));
      const ingFallback = sum(pagosRes.data) + sum(ventasRes.data,'total') + sum(fiadosRes.data);
      const egrFallback = sum(gastosRes.data);
      const totalIng = Math.max(ingMov, ingFallback);
      const totalEgr = Math.max(egrMov, egrFallback);
      const saldo = totalIng - totalEgr;
      _guardarCierreLocal(fecha, { ingresos: totalIng, egresos: totalEgr, saldo });
      toast('Caja cerrada ✓', 'success');
      cajaDelDia({ fecha });
    } catch (e) {
      toast('No se pudo cerrar la caja: ' + (e.message||''), 'error');
    }
  });
}

function cajaDelDia_reabrirCaja(fecha) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede reabrir la caja')) return;
  confirmar(`¿Reabrir la caja del ${formatFecha(fecha)}?`, () => {
    _borrarCierreLocal(fecha);
    toast('Caja reabierta', 'success');
    cajaDelDia({ fecha });
  });
}

// ─── MODAL "CIERRE DE CAJA" (compatibilidad: dashboard/tutorial lo usan) ────
async function modalCierreCaja(fechaSeleccionada = null) {
  const fecha = fechaSeleccionada || fechaHoy();

  openModal(`
    <div class="modal-title">💵 Cierre de caja</div>
    <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1rem">
      <label style="font-size:.8rem;color:var(--text2)">Fecha:</label>
      <input type="date" id="cierre-fecha" value="${fecha}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:.4rem;color:var(--text);font-size:.8rem;flex:1">
      <button id="cierre-ver-btn" style="background:var(--accent);color:#000;border:none;border-radius:6px;padding:.4rem .8rem;font-size:.8rem;cursor:pointer;font-family:var(--font-head)">Ver</button>
    </div>
    <div id="cierre-contenido">
      <div style="text-align:center;padding:1rem;color:var(--text2)">Cargando datos del ${formatFecha(fecha)}...</div>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:1rem">
      <button class="btn-primary" style="margin:0;flex:1" onclick="closeModal();navigate('finanzas')">Ir a Caja del día</button>
      <button class="btn-secondary" style="margin:0;flex:1" onclick="closeModal()">Cerrar</button>
    </div>
  `);

  setTimeout(() => {
    const verBtn = document.getElementById('cierre-ver-btn');
    const fechaInput = document.getElementById('cierre-fecha');
    if (verBtn && fechaInput) verBtn.onclick = () => modalCierreCaja(fechaInput.value);
  }, 50);

  await cargarDatosCierreCaja(fecha);
}

async function cargarDatosCierreCaja(fecha) {
  const contenido = document.getElementById('cierre-contenido');
  if (!contenido) return;

  try {
    const [
      { data: movimientos },
      { data: pagosReparacion },
      { data: ventas },
      { data: creditosPagados }
    ] = await Promise.all([
      sb.from('movimientos_financieros').select('tipo,monto,concepto,categorias_financieras(nombre)').eq('taller_id', tid()).eq('fecha', fecha),
      sb.from('pagos_reparacion').select('monto,metodo').eq('taller_id', tid()).eq('fecha', fecha),
      sb.from('ventas').select('total,metodo_pago').eq('taller_id', tid()).eq('estado', 'completado').gte('created_at', fecha).lte('created_at', fecha + 'T23:59:59'),
      sb.from('fiados').select('monto').eq('taller_id', tid()).eq('pagado', true).gte('fecha_pago', fecha).lte('fecha_pago', fecha + 'T23:59:59')
    ]);

    const sumarMontos = (arr, campo = 'monto') => (arr || []).reduce((acc, item) => acc + (parseFloat(item[campo]) || 0), 0);
    const porMetodo = { Efectivo: 0, Transferencia: 0, Tarjeta: 0, Crédito: 0, Otro: 0 };

    (pagosReparacion || []).forEach(p => { const metodo = p.metodo || 'Efectivo'; porMetodo[metodo] = (porMetodo[metodo] || 0) + parseFloat(p.monto || 0); });
    (ventas || []).forEach(v => { const metodo = v.metodo_pago || 'Efectivo'; porMetodo[metodo] = (porMetodo[metodo] || 0) + parseFloat(v.total || 0); });
    porMetodo['Efectivo'] += sumarMontos(creditosPagados, 'monto');

    const ingresosHoy = (movimientos || []).filter(m => m.tipo === 'ingreso').reduce((s, m) => s + parseFloat(m.monto || 0), 0);
    const egresosHoy = (movimientos || []).filter(m => m.tipo === 'egreso').reduce((s, m) => s + parseFloat(m.monto || 0), 0);
    const netoHoy = ingresosHoy - egresosHoy;

    const egresosPorCat = {};
    (movimientos || []).filter(m => m.tipo === 'egreso').forEach(m => {
      const cat = m.categorias_financieras?.nombre || 'Otros';
      egresosPorCat[cat] = (egresosPorCat[cat] || 0) + parseFloat(m.monto || 0);
    });

    const efectivoEnCaja = (porMetodo['Efectivo'] || 0) - egresosHoy;

    contenido.innerHTML = `
      <div style="background:${netoHoy >= 0 ? 'rgba(0,255,136,.06)' : 'rgba(255,68,68,.06)'};border:1px solid ${netoHoy >= 0 ? 'rgba(0,255,136,.2)' : 'rgba(255,68,68,.2)'};border-radius:12px;padding:1rem;margin-bottom:1rem;text-align:center">
        <div style="font-size:.65rem;color:${netoHoy >= 0 ? 'var(--success)' : 'var(--danger)'};letter-spacing:1px;font-family:var(--font-head)">RESULTADO DEL DÍA</div>
        <div style="font-family:var(--font-head);font-size:2rem;color:${netoHoy >= 0 ? 'var(--success)' : 'var(--danger)'}">${fm(netoHoy)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
        <div style="background:rgba(0,255,136,.06);border-radius:10px;padding:.6rem;text-align:center"><div style="font-size:.6rem;color:var(--success)">ENTRADAS</div><div style="font-family:var(--font-head);font-size:1.1rem;color:var(--success)">${fm(ingresosHoy)}</div></div>
        <div style="background:rgba(255,68,68,.06);border-radius:10px;padding:.6rem;text-align:center"><div style="font-size:.6rem;color:var(--danger)">SALIDAS</div><div style="font-family:var(--font-head);font-size:1.1rem;color:var(--danger)">${fm(egresosHoy)}</div></div>
      </div>
      <div style="font-size:.7rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.4rem">COBROS POR MÉTODO</div>
      ${Object.entries(porMetodo).filter(([, v]) => v > 0).map(([met, total]) => `<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.82rem"><span>${met === 'Efectivo' ? '💵' : met === 'Transferencia' ? '🏦' : met === 'Tarjeta' ? '💳' : met === 'Crédito' ? '📋' : '📎'} ${met}</span><span style="font-family:var(--font-head);color:var(--success)">${fm(total)}</span></div>`).join('') || '<div style="font-size:.8rem;color:var(--text2);padding:.3rem 0">Sin cobros este día</div>'}
      ${Object.keys(egresosPorCat).length > 0 ? `<div style="font-size:.7rem;color:var(--danger);font-family:var(--font-head);letter-spacing:1px;margin:.75rem 0 .4rem">GASTOS POR CATEGORÍA</div>${Object.entries(egresosPorCat).map(([cat, total]) => `<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.82rem"><span>${cat}</span><span style="font-family:var(--font-head);color:var(--danger)">-${fm(total)}</span></div>`).join('')}` : ''}
      <div style="background:var(--surface2);border-radius:10px;padding:.75rem;margin-top:1rem;text-align:center">
        <div style="font-size:.65rem;color:var(--accent);letter-spacing:1px;font-family:var(--font-head)">EFECTIVO EN CAJA</div>
        <div style="font-family:var(--font-head);font-size:1.5rem;color:${efectivoEnCaja >= 0 ? 'var(--accent)' : 'var(--danger)'}">${fm(efectivoEnCaja)}</div>
        <div style="font-size:.65rem;color:var(--text2)">Efectivo cobrado menos gastos del día</div>
      </div>
    `;
  } catch (error) {
    contenido.innerHTML = `<div style="color:var(--danger);text-align:center;padding:1rem">Error al cargar los datos: ${error.message}</div>`;
  }
}

window.cajaDelDia = cajaDelDia;
window.cajaDelDia_cargarDatos = cajaDelDia_cargarDatos;
window.cajaDelDia_cerrarCaja = cajaDelDia_cerrarCaja;
window.cajaDelDia_reabrirCaja = cajaDelDia_reabrirCaja;
window.modalCierreCaja = modalCierreCaja;
window.cargarDatosCierreCaja = cargarDatosCierreCaja;
