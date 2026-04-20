// ─── MOD-1: FINANZAS (Ingresos y Egresos) ──────────────────────────────────

const CATEGORIAS_FIJAS = {
  ingreso: ['Reparaciones', 'Servicios', 'Otros ingresos'],
  egreso: ['Repuestos', 'Sueldos', 'Alquiler', 'Servicios básicos', 'Gastos personales', 'Vales/Adelantos', 'Otros egresos']
};

let _finanzasFechaInicio = null;
let _finanzasFechaFin = null;

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

async function finanzas() {
  await finanzas_initCategorias();
  
  // Inicializar fechas si no están definidas
  if (!_finanzasFechaInicio) {
    const hoy = new Date();
    _finanzasFechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    _finanzasFechaFin = hoy.toISOString().split('T')[0];
  }

  await cargarVistaFinanzas();
}

async function cargarVistaFinanzas() {
  const inicio = _finanzasFechaInicio;
  const fin = _finanzasFechaFin;

  const [{ data: movimientos }, { data: categorias }, balanceRes] = await Promise.all([
    sb.from('movimientos_financieros').select('*, categorias_financieras(nombre)')
      .eq('taller_id', tid()).gte('fecha', inicio).lte('fecha', fin).order('fecha', {ascending:false}),
    sb.from('categorias_financieras').select('*').eq('taller_id', tid()).order('nombre'),
    sb.rpc('get_balance', { p_taller_id: tid(), p_fecha_inicio: inicio, p_fecha_fin: fin })
  ]);

  const balance = balanceRes.data || { total_ingresos: 0, total_egresos: 0, balance_neto: 0 };

  // Agrupar por día para el resumen
  const porDia = {};
  (movimientos||[]).forEach(m => {
    const fecha = m.fecha;
    if (!porDia[fecha]) porDia[fecha] = { ingresos: 0, egresos: 0 };
    if (m.tipo === 'ingreso') porDia[fecha].ingresos += parseFloat(m.monto||0);
    else porDia[fecha].egresos += parseFloat(m.monto||0);
  });

  const dias = Object.keys(porDia).sort().reverse();
  const totalDias = dias.length;

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <!-- Selector de fechas -->
      <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1rem;background:var(--surface);padding:.5rem;border-radius:10px;border:1px solid var(--border)">
        <input type="date" id="finanzas-fecha-inicio" value="${inicio}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:.4rem;color:var(--text);font-size:.8rem;flex:1">
        <span style="color:var(--text2)">→</span>
        <input type="date" id="finanzas-fecha-fin" value="${fin}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:.4rem;color:var(--text);font-size:.8rem;flex:1">
        <button onclick="aplicarRangoFinanzas()" style="background:var(--accent);color:#000;border:none;border-radius:6px;padding:.4rem .8rem;font-size:.8rem;cursor:pointer;font-family:var(--font-head)">Aplicar</button>
      </div>

      <!-- Rangos rápidos -->
      <div style="display:flex;gap:.3rem;margin-bottom:.75rem;flex-wrap:wrap">
        <button onclick="setRangoFinanzas('este_mes')" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Este mes</button>
        <button onclick="setRangoFinanzas('mes_anterior')" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Mes anterior</button>
        <button onclick="setRangoFinanzas('ultimos_7')" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Últ. 7 días</button>
        <button onclick="setRangoFinanzas('ultimos_30')" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Últ. 30 días</button>
        <button onclick="setRangoFinanzas('este_anio')" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Este año</button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:2px">FINANZAS ${inicio !== fin ? formatFecha(inicio) + ' - ' + formatFecha(fin) : formatFecha(inicio)}</div>
        <div style="display:flex;gap:.4rem">
          <button class="btn-add" style="font-size:.75rem;padding:.4rem .7rem" onclick="finanzas_modalNuevo('ingreso')">+ Ingreso</button>
          <button onclick="finanzas_modalNuevo('egreso')" style="background:var(--danger);color:#fff;border:none;border-radius:8px;padding:.4rem .7rem;font-family:var(--font-head);font-size:.75rem;cursor:pointer;letter-spacing:.5px">+ Egreso</button>
        </div>
      </div>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:1rem">
        <div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:12px;padding:.75rem;text-align:center">
          <div style="font-size:.6rem;color:var(--success);letter-spacing:1px;font-family:var(--font-head)">INGRESOS</div>
          <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--success)">₲${gs(balance.total_ingresos)}</div>
        </div>
        <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.2);border-radius:12px;padding:.75rem;text-align:center">
          <div style="font-size:.6rem;color:var(--danger);letter-spacing:1px;font-family:var(--font-head)">EGRESOS</div>
          <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--danger)">₲${gs(balance.total_egresos)}</div>
        </div>
        <div style="background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);border-radius:12px;padding:.75rem;text-align:center">
          <div style="font-size:.6rem;color:var(--accent);letter-spacing:1px;font-family:var(--font-head)">BALANCE</div>
          <div style="font-family:var(--font-head);font-size:1.1rem;color:${balance.balance_neto >= 0 ? 'var(--success)' : 'var(--danger)'}">₲${gs(balance.balance_neto)}</div>
        </div>
      </div>

      <!-- Acciones -->
      <div style="display:flex;gap:.4rem;margin-bottom:1rem">
        <button class="btn-secondary" style="margin:0;font-size:.75rem;padding:.4rem .6rem" onclick="finanzas_modalCategorias()">⚙ Categorías</button>
        <button onclick="modalCierreCaja()" style="background:rgba(255,204,0,.1);border:1px solid rgba(255,204,0,.25);color:var(--warning);border-radius:8px;padding:.4rem .6rem;font-size:.75rem;cursor:pointer;font-family:var(--font-head)">💵 Cierre de caja</button>
        <button onclick="conciliador_modal()" style="background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);color:var(--accent);border-radius:8px;padding:.4rem .6rem;font-size:.75rem;cursor:pointer;font-family:var(--font-head)">🔍 Conciliar</button>
      </div>

      <!-- Resumen por día -->
      ${totalDias > 0 ? `
      <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1px;margin-bottom:.5rem">📅 RESUMEN POR DÍA</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:1rem">
        ${dias.map(fecha => {
          const d = porDia[fecha];
          const neto = d.ingresos - d.egresos;
          return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem .75rem;border-bottom:1px solid var(--border);cursor:pointer" onclick="finanzas_filtrarPorDia('${fecha}')">
            <div>
              <div style="font-size:.85rem;font-weight:500">${formatFecha(fecha)}</div>
              <div style="font-size:.68rem;color:var(--text2)">Ingresos: ₲${gs(d.ingresos)} · Egresos: ₲${gs(d.egresos)}</div>
            </div>
            <div style="font-family:var(--font-head);font-size:.95rem;color:${neto >= 0 ? 'var(--success)' : 'var(--danger)'}">₲${gs(neto)}</div>
          </div>`;
        }).join('')}
      </div>` : ''}

      <!-- Listado de movimientos -->
      <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1px;margin-bottom:.5rem">📋 ÚLTIMOS MOVIMIENTOS</div>
      ${(movimientos||[]).length > 0 ? `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        ${(movimientos||[]).slice(0, 20).map((m, i) => {
          const esIngreso = m.tipo === 'ingreso';
          return `
          <div style="display:flex;align-items:center;padding:.65rem .75rem;${i > 0 ? 'border-top:1px solid var(--border)' : ''};gap:.6rem;cursor:pointer" onclick="finanzas_modalEditar('${m.id}')">
            <div style="width:32px;height:32px;border-radius:8px;background:${esIngreso ? 'rgba(0,255,136,.1)' : 'rgba(255,68,68,.1)'};display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0">${esIngreso ? '↑' : '↓'}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.85rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(m.descripcion || m.concepto || 'Sin descripción')}</div>
              <div style="font-size:.68rem;color:var(--text2)">${formatFecha(m.fecha)} · ${h(m.categorias_financieras?.nombre || 'Sin categoría')}</div>
            </div>
            <div style="font-family:var(--font-head);font-size:.95rem;color:${esIngreso ? 'var(--success)' : 'var(--danger)'};flex-shrink:0">${esIngreso ? '+' : '-'}₲${gs(m.monto)}</div>
          </div>`;
        }).join('')}
      </div>
      ${(movimientos||[]).length > 20 ? `<div style="text-align:center;margin-top:.5rem;font-size:.75rem;color:var(--text2)">Mostrando 20 de ${movimientos.length} movimientos</div>` : ''}
      ` : '<div class="empty"><p>No hay movimientos en este período</p></div>'}
    </div>`;
}

function aplicarRangoFinanzas() {
  const inicio = document.getElementById('finanzas-fecha-inicio')?.value;
  const fin = document.getElementById('finanzas-fecha-fin')?.value;
  if (inicio && fin) {
    _finanzasFechaInicio = inicio;
    _finanzasFechaFin = fin;
    cargarVistaFinanzas();
  }
}

function setRangoFinanzas(tipo) {
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
    case 'ultimos_7':
      fin = hoy;
      inicio = new Date(hoy);
      inicio.setDate(hoy.getDate() - 7);
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
  
  cargarVistaFinanzas();
}

function finanzas_filtrarPorDia(fecha) {
  _finanzasFechaInicio = fecha;
  _finanzasFechaFin = fecha;
  cargarVistaFinanzas();
}

async function finanzas_modalNuevo(tipo) {
  const { data: cats } = await sb.from('categorias_financieras').select('id,nombre').eq('taller_id', tid()).or(`tipo.eq.${tipo},tipo.eq.ambos`).order('nombre');
  openModal(`
    <div class="modal-title">${tipo === 'ingreso' ? 'Nuevo Ingreso' : 'Nuevo Egreso'}</div>
    <input type="hidden" id="f-fin-tipo" value="${tipo}">
    <div class="form-group"><label class="form-label">Concepto *</label><input class="form-input" id="f-fin-concepto" placeholder="${tipo === 'ingreso' ? 'Pago reparación motor' : 'Compra de filtros'}"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Monto (₲) *</label>${renderMontoInput('f-fin-monto', '', '0')}</div>
      <div class="form-group"><label class="form-label">Fecha</label>${renderFechaInput('f-fin-fecha')}</div>
    </div>
    <div class="form-group"><label class="form-label">Categoría</label>
      <select class="form-input" id="f-fin-cat">
        <option value="">Sin categoría</option>
        ${(cats||[]).map(c => `<option value="${c.id}">${h(c.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Notas</label>${renderNotasTextarea('f-fin-notas')}</div>
    <button class="btn-primary" onclick="finanzas_guardarConSafeCall()">Guardar</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function finanzas_guardarConSafeCall() {
  await safeCall(async () => {
    await finanzas_guardar();
  }, null, 'No se pudo guardar el movimiento');
}

async function finanzas_guardar(id=null) {
  const concepto = document.getElementById('f-fin-concepto').value.trim();
  if (!validateRequired(concepto, 'Concepto')) return;
  
  const monto = parseFloat(document.getElementById('f-fin-monto').value);
  if (!validatePositiveNumber(monto, 'Monto')) return;
  
  const data = {
    tipo: document.getElementById('f-fin-tipo').value,
    descripcion: concepto,
    monto,
    fecha: document.getElementById('f-fin-fecha').value,
    categoria_id: document.getElementById('f-fin-cat').value || null,
    notas: document.getElementById('f-fin-notas').value,
    taller_id: tid()
  };
  
  const { error } = id
    ? await sb.from('movimientos_financieros').update(data).eq('id', id)
    : await sb.from('movimientos_financieros').insert(data);
    
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  
  toast('Movimiento guardado', 'success');
  clearCache('finanzas');
  closeModal(); 
  cargarVistaFinanzas();
}

async function finanzas_modalEditar(id) {
  const { data: m } = await sb.from('movimientos_financieros').select('*').eq('id', id).single();
  if (!m) return;
  const { data: cats } = await sb.from('categorias_financieras').select('id,nombre').eq('taller_id', tid()).or(`tipo.eq.${m.tipo},tipo.eq.ambos`).order('nombre');
  openModal(`
    <div class="modal-title">Editar ${m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</div>
    <input type="hidden" id="f-fin-tipo" value="${m.tipo}">
    <div class="form-group"><label class="form-label">Concepto *</label><input class="form-input" id="f-fin-concepto" value="${h(m.descripcion || m.concepto || '')}"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Monto (₲) *</label>${renderMontoInput('f-fin-monto', m.monto)}</div>
      <div class="form-group"><label class="form-label">Fecha</label>${renderFechaInput('f-fin-fecha', m.fecha)}</div>
    </div>
    <div class="form-group"><label class="form-label">Categoría</label>
      <select class="form-input" id="f-fin-cat">
        <option value="">Sin categoría</option>
        ${(cats||[]).map(c => `<option value="${c.id}" ${c.id===m.categoria_id?'selected':''}>${h(c.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Notas</label>${renderNotasTextarea('f-fin-notas', m.notas)}</div>
    <div style="display:flex;gap:.5rem">
      <button class="btn-primary" style="flex:1" onclick="finanzas_guardarConSafeCall('${id}')">Actualizar</button>
      ${currentPerfil?.rol === 'admin' ? `<button class="btn-danger" style="flex:1" onclick="finanzas_eliminarConSafeCall('${id}')">Eliminar</button>` : ''}
    </div>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function finanzas_eliminarConSafeCall(id) {
  confirmar('¿Eliminar este movimiento?', async () => {
    await safeCall(async () => {
      await sb.from('movimientos_financieros').delete().eq('id', id);
      toast('Eliminado', 'success');
      clearCache('finanzas');
      closeModal(); 
      cargarVistaFinanzas();
    }, null, 'No se pudo eliminar el movimiento');
  });
}

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

// ─── CONCILIADOR (integrado) ─────────────────────────────────────────────────
async function conciliador_modal() {
  const fecha = _finanzasFechaFin || fechaHoy();
  openModal(`
    <div class="modal-title">🔍 Conciliar movimientos</div>
    <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1rem">
      <label style="font-size:.8rem;color:var(--text2)">Fecha:</label>
      <input type="date" id="conc-fecha" value="${fecha}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:.4rem;color:var(--text);font-size:.8rem;flex:1">
      <button onclick="conciliador_verificar(document.getElementById('conc-fecha').value)" style="background:var(--accent);color:#000;border:none;border-radius:6px;padding:.4rem .8rem;font-size:.8rem;cursor:pointer;font-family:var(--font-head)">Verificar</button>
    </div>
    <div id="conc-resultado">
      <div style="text-align:center;padding:1rem;color:var(--text2)">Seleccioná una fecha y hacé clic en Verificar</div>
    </div>
    <button class="btn-secondary" style="margin-top:1rem" onclick="closeModal()">Cerrar</button>
  `);
}

async function conciliador_verificar(fecha) {
  const resultado = document.getElementById('conc-resultado');
  if (!resultado) return;
  
  resultado.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--text2)">Verificando ${formatFecha(fecha)}...</div>`;
  
  try {
    const resIngresos = await conciliador_verificarIngresos(fecha);
    const resEgresos = await conciliador_verificarEgresos(fecha);
    
    const totalPendientes = (resIngresos.pendientes?.length || 0) + (resEgresos.pendientes?.length || 0);
    
    let html = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;margin-bottom:.5rem">
          <span style="font-size:.85rem">Ingresos sin registrar:</span>
          <span style="font-family:var(--font-head);color:${resIngresos.pendientes?.length ? 'var(--danger)' : 'var(--success)'}">${resIngresos.pendientes?.length || 0}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:.85rem">Egresos sin registrar:</span>
          <span style="font-family:var(--font-head);color:${resEgresos.pendientes?.length ? 'var(--danger)' : 'var(--success)'}">${resEgresos.pendientes?.length || 0}</span>
        </div>
      </div>
    `;
    
    if (totalPendientes > 0) {
      html += `
        <button class="btn-primary" onclick="conciliador_repararTodo('${fecha}')">🔧 Reparar ${totalPendientes} movimiento(s)</button>
      `;
    } else {
      html += `<div style="text-align:center;padding:1rem;color:var(--success)">✓ Todos los movimientos están registrados correctamente</div>`;
    }
    
    resultado.innerHTML = html;
    window._concPendientes = { ingresos: resIngresos.pendientes, egresos: resEgresos.pendientes };
  } catch (e) {
    resultado.innerHTML = `<div style="color:var(--danger);text-align:center;padding:1rem">Error: ${e.message}</div>`;
  }
}

async function conciliador_repararTodo(fecha) {
  const resultado = document.getElementById('conc-resultado');
  if (!resultado) return;
  
  resultado.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--text2)">Reparando movimientos...</div>`;
  
  try {
    const pendientes = window._concPendientes;
    let reparados = 0;
    
    if (pendientes.ingresos?.length) {
      const res = await conciliador_repararPendientes(pendientes.ingresos);
      reparados += res.reparados;
    }
    if (pendientes.egresos?.length) {
      const res = await conciliador_repararEgresos(pendientes.egresos);
      reparados += res.reparados;
    }
    
    resultado.innerHTML = `
      <div style="text-align:center;padding:1rem;color:var(--success)">
        ✓ Se repararon ${reparados} movimiento(s)
      </div>
      <button class="btn-secondary" onclick="conciliador_verificar('${fecha}')">Verificar de nuevo</button>
    `;
    
    clearCache('finanzas');
  } catch (e) {
    resultado.innerHTML = `<div style="color:var(--danger);text-align:center;padding:1rem">Error: ${e.message}</div>`;
  }
}

// Funciones de conciliación (simplificadas, la versión completa está en conciliador.js)
async function conciliador_verificarIngresos(fecha) {
  // Versión resumida - usar la implementación completa de conciliador.js
  const fechaStr = fecha;
  const inicio = fechaStr + 'T00:00:00';
  const fin = fechaStr + 'T23:59:59';

  const { data: movs } = await sb.from('movimientos_financieros').select('*').eq('taller_id', tid()).eq('tipo', 'ingreso').gte('fecha', fechaStr).lte('fecha', fechaStr);
  const { data: ventas } = await sb.from('ventas').select('id,total,created_at').eq('taller_id', tid()).eq('estado', 'completado').gte('created_at', inicio).lte('created_at', fin);
  const { data: pagosRep } = await sb.from('pagos_reparacion').select('id,monto,fecha,metodo').eq('taller_id', tid()).gte('fecha', fechaStr).lte('fecha', fechaStr);

  const pendientes = [];
  
  (ventas||[]).forEach(v => {
    const existe = movs?.find(m => m.referencia_id === v.id && m.referencia_tabla === 'ventas');
    if (!existe) pendientes.push({ tipo: 'venta', id: v.id, monto: v.total, fecha: fechaStr });
  });

  (pagosRep||[]).forEach(p => {
    if (p.metodo === 'Crédito') return;
    const existe = movs?.find(m => m.referencia_id === p.id && m.referencia_tabla === 'pagos_reparacion');
    if (!existe) pendientes.push({ tipo: 'pago_reparacion', id: p.id, monto: p.monto, fecha: fechaStr });
  });

  return { pendientes };
}

async function conciliador_verificarEgresos(fecha) {
  const fechaStr = fecha;
  const { data: gastos } = await sb.from('gastos_taller').select('id,monto,fecha').eq('taller_id', tid()).gte('fecha', fechaStr).lte('fecha', fechaStr);
  const { data: movs } = await sb.from('movimientos_financieros').select('*').eq('taller_id', tid()).eq('tipo', 'egreso').gte('fecha', fechaStr).lte('fecha', fechaStr);

  const pendientes = [];
  (gastos||[]).forEach(g => {
    const existe = movs?.find(m => m.referencia_id === g.id && m.referencia_tabla === 'gastos_taller');
    if (!existe) pendientes.push({ tipo: 'gasto', id: g.id, monto: g.monto, fecha: fechaStr });
  });

  return { pendientes };
}

async function conciliador_repararPendientes(pendientes) {
  let reparados = 0;
  const categoriaId = await obtenerCategoriaFinanciera('Servicios', 'ingreso');
  
  for (const p of pendientes) {
    try {
      const existe = await sb.from('movimientos_financieros').select('id').eq('taller_id', tid()).eq('referencia_id', p.id).eq('referencia_tabla', p.tipo === 'venta' ? 'ventas' : 'pagos_reparacion').maybeSingle();
      if (!existe && categoriaId) {
        await sb.from('movimientos_financieros').insert({
          taller_id: tid(), tipo: 'ingreso', categoria_id: categoriaId, monto: p.monto,
          descripcion: p.tipo === 'venta' ? 'Venta' : 'Pago reparación', fecha: p.fecha,
          referencia_id: p.id, referencia_tabla: p.tipo === 'venta' ? 'ventas' : 'pagos_reparacion'
        });
        reparados++;
      }
    } catch (e) {}
  }
  return { reparados };
}

async function conciliador_repararEgresos(pendientes) {
  let reparados = 0;
  const categoriaId = await obtenerCategoriaFinanciera('Gastos generales', 'egreso');
  
  for (const p of pendientes) {
    try {
      const existe = await sb.from('movimientos_financieros').select('id').eq('taller_id', tid()).eq('referencia_id', p.id).eq('referencia_tabla', 'gastos_taller').maybeSingle();
      if (!existe && categoriaId) {
        await sb.from('movimientos_financieros').insert({
          taller_id: tid(), tipo: 'egreso', categoria_id: categoriaId, monto: p.monto,
          descripcion: 'Gasto', fecha: p.fecha,
          referencia_id: p.id, referencia_tabla: 'gastos_taller'
        });
        reparados++;
      }
    } catch (e) {}
  }
  return { reparados };
}
