// ─── FINANZAS (CON MÚLTIPLES BALANCES) ───────────────────────────────────────
// Tercera tarjeta ahora muestra BALANCE NETO del balance seleccionado

const CATEGORIAS_FIJAS = {
  ingreso: ['Reparaciones', 'Servicios', 'Otros ingresos'],
  egreso: ['Repuestos', 'Sueldos', 'Alquiler', 'Servicios básicos', 'Gastos personales', 'Vales/Adelantos', 'Otros egresos']
};

let _finanzasFechaInicio = null;
let _finanzasFechaFin = null;
let _balanceSeleccionado = localStorage.getItem('finanzas_balance_id') || null;

async function finanzas_cargarBalancesSelect() {
  const { data } = await sb.from('balances').select('id,nombre,color').eq('taller_id', tid()).order('nombre');
  return data || [];
}

async function finanzas_initCategorias() {
  const { data: existing } = await sb.from('categorias_financieras').select('nombre').eq('taller_id', tid()).eq('es_fija', true);
  const existNames = (existing||[]).map(c => c.nombre);
  const toInsert = [];
  for (const [tipo, cats] of Object.entries(CATEGORIAS_FIJAS)) {
    for (const nombre of cats) {
      if (!existNames.includes(nombre)) {
        toInsert.push({ taller_id: tid(), nombre, tipo: tipo === 'ingreso' ? 'ingreso' : 'egreso', es_fija: true });
      }
    }
  }
  if (toInsert.length > 0) await sb.from('categorias_financieras').insert(toInsert);
}

function finanzas_initFechas() {
  if (!_finanzasFechaInicio) {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    _finanzasFechaInicio = inicioMes.toISOString().split('T')[0];
    _finanzasFechaFin = hoy.toISOString().split('T')[0];
  }
}

async function finanzas() {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede ver finanzas')) {
    if (typeof navigate === 'function') navigate('dashboard');
    return;
  }
  await finanzas_initCategorias();
  finanzas_initFechas();

  const balances = await finanzas_cargarBalancesSelect();
  const opcionesBalance = [
    { id: null, nombre: 'Todos los movimientos', color: '#888' },
    ...balances
  ];
  const selectedId = _balanceSeleccionado;

  const contenido = document.getElementById('main-content');
  contenido.innerHTML = `
    <div style="padding:.25rem 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;flex-wrap:wrap;gap:.4rem">
        <div style="display:flex;align-items:center;gap:.5rem">
          <button onclick="navigate('finanzas')" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.35rem .6rem;font-size:.72rem;cursor:pointer;font-family:var(--font-head)">← Caja del día</button>
          <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--text)">Movimientos</div>
        </div>
        <div style="display:flex;gap:.3rem">
          <button class="btn-add" onclick="finanzas_modalNuevo('ingreso')">+ Ingreso</button>
          <button class="btn-add" style="background:var(--danger)" onclick="finanzas_modalNuevo('egreso')">+ Egreso</button>
        </div>
      </div>
      
      <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1rem;background:var(--surface);padding:.5rem;border-radius:10px;border:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:.3rem;flex:1">
          <input type="date" id="finanzas-fecha-inicio" value="${_finanzasFechaInicio}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:.4rem;color:var(--text);font-size:.8rem;width:100%">
        </div>
        <span style="color:var(--text2)">→</span>
        <div style="display:flex;align-items:center;gap:.3rem;flex:1">
          <input type="date" id="finanzas-fecha-fin" value="${_finanzasFechaFin}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:.4rem;color:var(--text);font-size:.8rem;width:100%">
        </div>
        <button onclick="finanzas_aplicarRango()" style="background:var(--accent);color:#000;border:none;border-radius:6px;padding:.4rem .8rem;font-size:.8rem;cursor:pointer;font-family:var(--font-head)">Aplicar</button>
      </div>
      
      <div style="display:flex;gap:.3rem;margin-bottom:.75rem;flex-wrap:wrap;align-items:center">
        <button onclick="finanzas_setRangoRapido('este_mes')" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Este mes</button>
        <button onclick="finanzas_setRangoRapido('mes_anterior')" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Mes anterior</button>
        <button onclick="finanzas_setRangoRapido('ultimos_30')" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Últ. 30 días</button>
        <button onclick="finanzas_setRangoRapido('este_anio')" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Este año</button>
        <div style="flex:1"></div>
        <select id="finanzas-select-balance" onchange="finanzas_cambiarBalance(this.value)" style="background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:.25rem .75rem;font-size:.7rem;color:var(--text);cursor:pointer;max-width:180px">
          ${opcionesBalance.map(b => `<option value="${b.id || ''}" ${(selectedId === b.id) ? 'selected' : ''}>💰 ${h(b.nombre)}</option>`).join('')}
        </select>
        <button onclick="navigate('balances')" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.25rem .6rem;font-size:.7rem;cursor:pointer;color:var(--accent)">⚙️</button>
      </div>
      
      <div id="finanzas-contenido-dinamico">
        <div style="text-align:center;padding:2rem;color:var(--text2)">Cargando datos financieros...</div>
      </div>
    </div>
  `;

  await finanzas_cargarDatos();
}

function finanzas_cambiarBalance(balanceId) {
  _balanceSeleccionado = balanceId || null;
  localStorage.setItem('finanzas_balance_id', _balanceSeleccionado || '');
  finanzas_cargarDatos();
}

async function finanzas_cargarDatos() {
  const contenedor = document.getElementById('finanzas-contenido-dinamico');
  if (!contenedor) return;

  const inicio = _finanzasFechaInicio;
  const fin = _finanzasFechaFin;
  const balanceId = _balanceSeleccionado;

  try {
    const { data: movimientos } = await sb.from('movimientos_financieros')
      .select('*, categorias_financieras(nombre), movimiento_balance(balance_id)')
      .eq('taller_id', tid())
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });

    let movimientosFiltrados = movimientos || [];
    if (balanceId) {
      movimientosFiltrados = movimientosFiltrados.filter(m => 
        (m.movimiento_balance || []).some(mb => mb.balance_id === balanceId)
      );
    }

    const totalIngresos = movimientosFiltrados.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + parseFloat(m.monto||0), 0);
    const totalEgresos = movimientosFiltrados.filter(m => m.tipo === 'egreso').reduce((s, m) => s + parseFloat(m.monto||0), 0);
    const balanceNeto = totalIngresos - totalEgresos;

    const movsPorFecha = {};
    movimientosFiltrados.forEach(m => {
      const fecha = m.fecha;
      if (!movsPorFecha[fecha]) movsPorFecha[fecha] = { ingresos: 0, egresos: 0, items: [] };
      if (m.tipo === 'ingreso') movsPorFecha[fecha].ingresos += parseFloat(m.monto||0);
      else movsPorFecha[fecha].egresos += parseFloat(m.monto||0);
      movsPorFecha[fecha].items.push(m);
    });

    const fechasOrdenadas = Object.keys(movsPorFecha).sort((a,b) => b.localeCompare(a));

    let html = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:1rem">
        <div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:12px;padding:.75rem;text-align:center">
          <div style="font-size:.6rem;color:var(--success);letter-spacing:1px;font-family:var(--font-head)">INGRESOS ${balanceId ? '(Balance)' : ''}</div>
          <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--success)">₲${gs(totalIngresos)}</div>
        </div>
        <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.2);border-radius:12px;padding:.75rem;text-align:center">
          <div style="font-size:.6rem;color:var(--danger);letter-spacing:1px;font-family:var(--font-head)">EGRESOS ${balanceId ? '(Balance)' : ''}</div>
          <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--danger)">₲${gs(totalEgresos)}</div>
        </div>
        <div style="background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);border-radius:12px;padding:.75rem;text-align:center">
          <div style="font-size:.6rem;color:var(--accent);letter-spacing:1px;font-family:var(--font-head)">BALANCE NETO ${balanceId ? '(Balance)' : ''}</div>
          <div style="font-family:var(--font-head);font-size:1.1rem;color:${balanceNeto >= 0 ? 'var(--success)' : 'var(--danger)'}">₲${gs(balanceNeto)}</div>
        </div>
      </div>

      <div style="display:flex;gap:.4rem;margin-bottom:1rem;flex-wrap:wrap">
        <button class="btn-secondary" style="margin:0;font-size:.75rem;padding:.4rem .6rem" onclick="finanzas_modalCategorias()">📌 Categorías</button>
        <button onclick="modalCierreCaja()" style="background:rgba(255,204,0,.1);border:1px solid rgba(255,204,0,.25);color:var(--warning);border-radius:8px;padding:.4rem .6rem;font-size:.75rem;cursor:pointer;font-family:var(--font-head)">💵 Cierre de caja</button>
        <button onclick="conciliador_modalConciliacion()" style="background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.25);color:var(--accent);border-radius:8px;padding:.4rem .6rem;font-size:.75rem;cursor:pointer;font-family:var(--font-head)">🔍 Conciliar</button>
        <button onclick="cuentas_modalRevisarPagadasSinEgreso()" title="Herramienta de mantenimiento: detecta y repara cuentas que figuran como pagadas sin tener su egreso en Finanzas (datos importados, pagos por SQL manual, etc.). En operación normal no aparece nada para reparar." style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .6rem;font-size:.75rem;cursor:pointer;font-family:var(--font-head)">🧾 Cuentas viejas</button>
      </div>
      <div id="finanzas-banner-cuentas-viejas"></div>
    `;

    if (fechasOrdenadas.length > 0) {
      html += fechasOrdenadas.map(fecha => {
        const grupo = movsPorFecha[fecha];
        const netoDia = grupo.ingresos - grupo.egresos;
        return `
        <div style="margin-bottom:1.5rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;background:var(--surface2);padding:.4rem .6rem;border-radius:8px">
            <div style="font-family:var(--font-head);font-size:.9rem;color:var(--accent);letter-spacing:1px">${formatFecha(fecha)}</div>
            <div style="display:flex;gap:1rem;font-size:.75rem">
              <span style="color:var(--success)">+₲${gs(grupo.ingresos)}</span>
              <span style="color:var(--danger)">-₲${gs(grupo.egresos)}</span>
              <span style="color:${netoDia >= 0 ? 'var(--accent)' : 'var(--danger)'};font-weight:bold">=₲${gs(netoDia)}</span>
            </div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
            ${grupo.items.map((m, i) => {
              const esIngreso = m.tipo === 'ingreso';
              const afectaCaja = m.afecta_caja !== false;
              const balancesAsignados = (m.movimiento_balance || []).map(mb => mb.balance_id);
              return `
              <div style="display:flex;align-items:center;padding:.65rem .75rem;${i > 0 ? 'border-top:1px solid var(--border)' : ''};gap:.6rem;cursor:pointer" onclick="finanzas_modalEditar('${m.id}')">
                <div style="width:32px;height:32px;border-radius:8px;background:${esIngreso ? 'rgba(0,255,136,.1)' : 'rgba(255,68,68,.1)'};display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0">${esIngreso ? '↑' : '↓'}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:.85rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                    ${h(m.concepto)} 
                    ${!afectaCaja ? '<span style="color:var(--warning);font-size:.65rem;">(contable)</span>' : ''}
                  </div>
                  <div style="font-size:.68rem;color:var(--text2)">${h(m.categorias_financieras?.nombre || 'Sin categoría')}</div>
                  ${balancesAsignados.length > 0 ? `<div style="font-size:.65rem;color:var(--accent)">💰 ${balancesAsignados.length} balance(s)</div>` : ''}
                </div>
                <div style="font-family:var(--font-head);font-size:.95rem;color:${esIngreso ? 'var(--success)' : 'var(--danger)'};flex-shrink:0">${esIngreso ? '+' : '-'}₲${gs(m.monto)}</div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('');
    } else {
      html += '<div class="empty"><p>No hay movimientos en este período</p></div>';
    }

    contenedor.innerHTML = html;

    // Detector pasivo: si hay cuentas viejas pagadas sin egreso, mostrar banner.
    // Va aparte y silencioso: si falla no rompe la pantalla de finanzas.
    finanzas_renderBannerCuentasViejas().catch(() => {});
  } catch (error) {
    console.error('❌ Error en finanzas_cargarDatos:', error);
    contenedor.innerHTML = `<div class="empty"><p>Error al cargar los datos: ${error.message}</p></div>`;
  }
}

async function finanzas_renderBannerCuentasViejas() {
  const slot = document.getElementById('finanzas-banner-cuentas-viejas');
  if (!slot || typeof cuentas_detectarPagadasSinEgreso !== 'function') return;
  const res = await cuentas_detectarPagadasSinEgreso();
  if (!res.ok || !res.items?.length) { slot.innerHTML = ''; return; }
  const total = res.items.reduce((s, c) => s + parseFloat(c.monto || 0), 0);
  slot.innerHTML = `
    <div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.3);border-radius:10px;padding:.7rem .85rem;margin-bottom:1rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
      <div style="font-size:1.4rem">⚠️</div>
      <div style="flex:1;min-width:200px">
        <div style="font-family:var(--font-head);font-size:.78rem;color:var(--warning);letter-spacing:1px">REVISAR CUENTAS</div>
        <div style="font-size:.78rem;color:var(--text)">Hay <strong>${res.items.length}</strong> cuenta(s) marcada(s) como pagada(s) sin egreso registrado en Finanzas (₲${gs(total)} total). Suele pasar con datos importados o pagos cargados por fuera de la app.</div>
      </div>
      <button onclick="cuentas_modalRevisarPagadasSinEgreso()" style="background:var(--warning);color:#000;border:none;border-radius:8px;padding:.4rem .8rem;font-size:.75rem;cursor:pointer;font-family:var(--font-head)">Revisar</button>
    </div>
  `;
}

function finanzas_aplicarRango() {
  _finanzasFechaInicio = document.getElementById('finanzas-fecha-inicio').value;
  _finanzasFechaFin = document.getElementById('finanzas-fecha-fin').value;
  finanzas_cargarDatos();
}

function finanzas_setRangoRapido(tipo) {
  const hoy = new Date();
  let inicio, fin;
  switch(tipo) {
    case 'este_mes':
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fin = hoy;
      break;
    case 'mes_anterior':
      inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      break;
    case 'ultimos_30':
      fin = hoy;
      inicio = new Date(hoy);
      inicio.setDate(hoy.getDate() - 30);
      break;
    case 'este_anio':
      inicio = new Date(hoy.getFullYear(), 0, 1);
      fin = hoy;
      break;
  }
  _finanzasFechaInicio = inicio.toISOString().split('T')[0];
  _finanzasFechaFin = fin.toISOString().split('T')[0];
  document.getElementById('finanzas-fecha-inicio').value = _finanzasFechaInicio;
  document.getElementById('finanzas-fecha-fin').value = _finanzasFechaFin;
  finanzas_cargarDatos();
}

// ─── MODALES (NUEVO/EDITAR) ─────────────────────────────────────────────────
async function finanzas_modalNuevo(tipo) {
  const [catsRes, balancesRes] = await Promise.all([
    sb.from('categorias_financieras').select('id,nombre').eq('taller_id', tid()).or(`tipo.eq.${tipo},tipo.eq.ambos`).order('nombre'),
    sb.from('balances').select('id,nombre,color').eq('taller_id', tid()).order('nombre')
  ]);
  const cats = catsRes.data || [];
  const balances = balancesRes.data || [];
  
  const uniqueId = 'nuevo-' + Date.now();
  openModal(`
    <div class="modal-title">${tipo === 'ingreso' ? 'Nuevo Ingreso' : 'Nuevo Egreso'}</div>
    <input type="hidden" id="f-fin-tipo" value="${tipo}">
    <div class="form-group"><label class="form-label">Concepto *</label><input class="form-input" id="f-fin-concepto" placeholder="${tipo === 'ingreso' ? 'Pago reparación motor' : 'Compra de filtros'}" autocomplete="off"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Monto (₲) *</label>${renderMontoInput('f-fin-monto', '', '0')}</div>
      <div class="form-group"><label class="form-label">Fecha</label>${renderFechaInput('f-fin-fecha')}</div>
    </div>
    <div class="form-group"><label class="form-label">Categoría</label>
      <select class="form-input" id="f-fin-cat">
        <option value="">Sin categoría</option>
        ${cats.map(c => `<option value="${c.id}">${h(c.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">¿Afecta caja?</label>
      <select class="form-input" id="f-fin-afecta-caja">
        <option value="true" selected>Sí (dinero físico)</option>
        <option value="false">No (solo registro contable)</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Balances (podés marcar varios)</label>
      <div style="max-height:150px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:.5rem;background:var(--surface2)">
        ${balances.map(b => `
          <label style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;cursor:pointer">
            <input type="checkbox" class="bal-check-${uniqueId}" value="${b.id}" style="accent-color:${b.color||'var(--accent)'}">
            <span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:${b.color||'var(--accent)'};margin-right:4px"></span>
            ${h(b.nombre)}
          </label>
        `).join('')}
        ${balances.length === 0 ? '<p style="color:var(--text2);font-size:.8rem;padding:.3rem">No hay balances. Creá uno en Configuración.</p>' : ''}
      </div>
    </div>
    <div class="form-group"><label class="form-label">Notas</label>${renderNotasTextarea('f-fin-notas')}</div>
    <button class="btn-primary" onclick="event.stopPropagation(); window.finanzas_guardarConSafeCall(null, '${uniqueId}')">Guardar</button>
    <button class="btn-secondary" onclick="event.stopPropagation(); closeModal()">Cancelar</button>`);
}

async function finanzas_guardarConSafeCall(id = null, uniqueId = null) {
  await safeCall(async () => {
    await finanzas_guardar(id, uniqueId);
  }, null, 'No se pudo guardar el movimiento');
}

async function finanzas_guardar(id = null, uniqueId = null) {
  const concepto = document.getElementById('f-fin-concepto').value.trim();
  if (!validateRequired(concepto, 'Concepto')) return;
  
  const monto = parseFloat(document.getElementById('f-fin-monto').value);
  if (!validatePositiveNumber(monto, 'Monto')) return;
  
  const data = {
    tipo: document.getElementById('f-fin-tipo').value,
    concepto,
    monto,
    fecha: document.getElementById('f-fin-fecha').value,
    categoria_id: document.getElementById('f-fin-cat').value || null,
    notas: document.getElementById('f-fin-notas').value,
    afecta_caja: document.getElementById('f-fin-afecta-caja')?.value === 'true',
    taller_id: tid()
  };

  let movimientoId = id;
  let error;
  if (id) {
    const res = await sb.from('movimientos_financieros').update(data).eq('id', id);
    error = res.error;
  } else {
    const res = await sb.from('movimientos_financieros').insert(data).select('id').single();
    error = res.error;
    if (!error && res.data) movimientoId = res.data.id;
  }
    
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  
  if (movimientoId) {
    let balancesSeleccionados = [];
    if (uniqueId) {
      const checkboxes = document.querySelectorAll(`.bal-check-${uniqueId}:checked`);
      balancesSeleccionados = Array.from(checkboxes).map(cb => cb.value);
    } else {
      const checkboxes = document.querySelectorAll('.bal-check-editar:checked');
      balancesSeleccionados = Array.from(checkboxes).map(cb => cb.value);
    }
    
    await sb.from('movimiento_balance').delete().eq('movimiento_id', movimientoId);
    
    if (balancesSeleccionados.length > 0) {
      const inserts = balancesSeleccionados.map(balanceId => ({
        movimiento_id: movimientoId,
        balance_id: balanceId
      }));
      await sb.from('movimiento_balance').insert(inserts);
    }
  }
  
  toast(id ? 'Movimiento actualizado' : 'Movimiento guardado', 'success');
  clearCache('finanzas');
  closeModal();
  
  setTimeout(() => {
    finanzas_cargarDatos();
    if (currentPage === 'dashboard' && typeof dashboard === 'function') {
      dashboard();
    }
  }, 300);
}

async function finanzas_modalEditar(id) {
  const [{ data: m }, { data: cats }, { data: balances }, { data: relaciones }] = await Promise.all([
    sb.from('movimientos_financieros').select('*').eq('id', id).single(),
    sb.from('categorias_financieras').select('id,nombre').eq('taller_id', tid()).or(`tipo.eq.ingreso,tipo.eq.egreso,tipo.eq.ambos`).order('nombre'),
    sb.from('balances').select('id,nombre,color').eq('taller_id', tid()).order('nombre'),
    sb.from('movimiento_balance').select('balance_id').eq('movimiento_id', id)
  ]);
  if (!m) return;
  
  const balancesAsignados = new Set((relaciones||[]).map(r => r.balance_id));
  
  openModal(`
    <div class="modal-title">Editar ${m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</div>
    <input type="hidden" id="f-fin-tipo" value="${m.tipo}">
    <div class="form-group"><label class="form-label">Concepto *</label><input class="form-input" id="f-fin-concepto" value="${h(m.concepto)}"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Monto (₲) *</label>${renderMontoInput('f-fin-monto', m.monto)}</div>
      <div class="form-group"><label class="form-label">Fecha</label>${renderFechaInput('f-fin-fecha', m.fecha)}</div>
    </div>
    <div class="form-group"><label class="form-label">Categoría</label>
      <select class="form-input" id="f-fin-cat">
        <option value="">Sin categoría</option>
        ${cats.map(c => `<option value="${c.id}" ${c.id===m.categoria_id?'selected':''}>${h(c.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">¿Afecta caja?</label>
      <select class="form-input" id="f-fin-afecta-caja">
        <option value="true" ${m.afecta_caja !== false ? 'selected' : ''}>Sí (dinero físico)</option>
        <option value="false" ${m.afecta_caja === false ? 'selected' : ''}>No (solo registro contable)</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Balances (podés marcar varios)</label>
      <div style="max-height:150px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:.5rem;background:var(--surface2)">
        ${balances.map(b => `
          <label style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;cursor:pointer">
            <input type="checkbox" class="bal-check-editar" value="${b.id}" ${balancesAsignados.has(b.id) ? 'checked' : ''} style="accent-color:${b.color||'var(--accent)'}">
            <span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:${b.color||'var(--accent)'};margin-right:4px"></span>
            ${h(b.nombre)}
          </label>
        `).join('')}
        ${balances.length === 0 ? '<p style="color:var(--text2);font-size:.8rem;padding:.3rem">No hay balances. Creá uno en Configuración.</p>' : ''}
      </div>
    </div>
    <div class="form-group"><label class="form-label">Notas</label>${renderNotasTextarea('f-fin-notas', m.notas)}</div>
    <button class="btn-primary" onclick="event.stopPropagation(); window.finanzas_guardarConSafeCall('${id}')">Actualizar</button>
    ${currentPerfil?.rol === 'admin' ? `<button class="btn-danger" onclick="event.stopPropagation(); finanzas_eliminarConSafeCall('${id}')">Eliminar</button>` : ''}
    <button class="btn-secondary" onclick="event.stopPropagation(); closeModal()">Cancelar</button>`);
}

async function finanzas_eliminarConSafeCall(id) {
  confirmar('¿Eliminar este movimiento?', async () => {
    await safeCall(async () => {
      await sb.from('movimiento_balance').delete().eq('movimiento_id', id);
      await sb.from('movimientos_financieros').delete().eq('id', id);
      toast('Eliminado', 'success');
      clearCache('finanzas');
      closeModal();
      setTimeout(() => {
        finanzas_cargarDatos();
        if (currentPage === 'dashboard' && typeof dashboard === 'function') {
          dashboard();
        }
      }, 300);
    }, null, 'No se pudo eliminar el movimiento');
  });
}

// ─── CATEGORÍAS ─────────────────────────────────────────────────────────────
async function finanzas_modalCategorias() {
  const { data: cats } = await sb.from('categorias_financieras').select('*').eq('taller_id', tid()).order('tipo').order('nombre');
  openModal(`
    <div class="modal-title">Categorías</div>
    <div style="margin-bottom:1rem">
      ${(cats||[]).map(c => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border)">
          <div>
            <span style="font-size:.85rem">${h(c.nombre)}</span>
            <span style="font-size:.65rem;color:var(--text2);margin-left:.3rem">(${c.tipo})</span>
          </div>
          ${!c.es_fija ? `<button onclick="finanzas_eliminarCatConSafeCall('${c.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.75rem">✕</button>` : '<span style="font-size:.6rem;color:var(--text2)">fija</span>'}
        </div>`).join('')}
    </div>
    <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);margin-bottom:.5rem">AGREGAR NUEVA</div>
    <div class="form-group"><label class="form-label">Nombre</label><input class="form-input" id="f-cat-nombre" placeholder="Nombre de categoría"></div>
    <div class="form-group"><label class="form-label">Tipo</label>
      <select class="form-input" id="f-cat-tipo">
        <option value="ingreso">Ingreso</option>
        <option value="egreso">Egreso</option>
        <option value="ambos">Ambos</option>
      </select>
    </div>
    <button class="btn-primary" onclick="finanzas_guardarCatConSafeCall()">Agregar</button>
    <button class="btn-secondary" onclick="closeModal()">Cerrar</button>`);
}

async function finanzas_guardarCatConSafeCall() {
  await safeCall(async () => {
    await finanzas_guardarCat();
  }, null, 'No se pudo agregar la categoría');
}

async function finanzas_guardarCat() {
  const nombre = document.getElementById('f-cat-nombre').value.trim();
  if (!validateRequired(nombre, 'Nombre')) return;
  
  const { error } = await sb.from('categorias_financieras').insert({
    taller_id: tid(),
    nombre,
    tipo: document.getElementById('f-cat-tipo').value,
    es_fija: false
  });
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  
  toast('Categoría agregada', 'success');
  finanzas_modalCategorias();
}

async function finanzas_eliminarCatConSafeCall(id) {
  await safeCall(async () => {
    await finanzas_eliminarCat(id);
  }, null, 'No se pudo eliminar la categoría');
}

async function finanzas_eliminarCat(id) {
  await sb.from('categorias_financieras').delete().eq('id', id);
  toast('Categoría eliminada', 'success');
  finanzas_modalCategorias();
}

// ========== DECLARACIONES GLOBALES ==========
window.finanzas = finanzas;
window.finanzas_modalNuevo = finanzas_modalNuevo;
window.finanzas_modalEditar = finanzas_modalEditar;
window.finanzas_guardarConSafeCall = finanzas_guardarConSafeCall;
window.finanzas_guardar = finanzas_guardar;
window.finanzas_eliminarConSafeCall = finanzas_eliminarConSafeCall;
window.finanzas_modalCategorias = finanzas_modalCategorias;
window.finanzas_aplicarRango = finanzas_aplicarRango;
window.finanzas_setRangoRapido = finanzas_setRangoRapido;
window.finanzas_cambiarBalance = finanzas_cambiarBalance;
