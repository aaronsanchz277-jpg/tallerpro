// ─── MOD-1: FINANZAS (Ingresos y Egresos) ──────────────────────────────────

const CATEGORIAS_FIJAS = {
  ingreso: ['Reparaciones', 'Servicios', 'Otros ingresos'],
  egreso: ['Repuestos', 'Sueldos', 'Alquiler', 'Servicios básicos', 'Gastos personales', 'Vales/Adelantos', 'Otros egresos']
};

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
  const hoy = new Date();
  const primerMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const fin = hoy.toISOString().split('T')[0];

  const [{ data: movimientos }, { data: categorias }, balanceRes] = await Promise.all([
    sb.from('movimientos_financieros').select('*, categorias_financieras(nombre)').eq('taller_id', tid()).gte('fecha', primerMes).lte('fecha', fin).order('fecha', {ascending:false}),
    sb.from('categorias_financieras').select('*').eq('taller_id', tid()).order('nombre'),
    sb.rpc('get_balance', { p_taller_id: tid(), p_fecha_inicio: primerMes, p_fecha_fin: fin })
  ]);

  const balance = balanceRes.data || { total_ingresos: 0, total_egresos: 0, balance_neto: 0 };

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:2px">FINANZAS DEL MES</div>
        <div style="display:flex;gap:.4rem">
          <button class="btn-add" style="font-size:.75rem;padding:.4rem .7rem" onclick="finanzas_modalNuevo('ingreso')">+ Ingreso</button>
          <button onclick="finanzas_modalNuevo('egreso')" style="background:var(--danger);color:#fff;border:none;border-radius:8px;padding:.4rem .7rem;font-family:var(--font-head);font-size:.75rem;cursor:pointer;letter-spacing:.5px">+ Egreso</button>
        </div>
      </div>

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

      <div style="display:flex;gap:.4rem;margin-bottom:1rem">
        <button class="btn-secondary" style="margin:0;font-size:.75rem;padding:.4rem .6rem" onclick="finanzas_modalCategorias()">⚙ Categorías</button>
        <button onclick="modalCierreCaja()" style="background:rgba(255,204,0,.1);border:1px solid rgba(255,204,0,.25);color:var(--warning);border-radius:8px;padding:.4rem .6rem;font-size:.75rem;cursor:pointer;font-family:var(--font-head)">💵 Cierre de caja</button>
      </div>

      ${(movimientos||[]).length > 0 ? `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        ${(movimientos||[]).map((m, i) => {
          const esIngreso = m.tipo === 'ingreso';
          return `
          <div style="display:flex;align-items:center;padding:.65rem .75rem;${i > 0 ? 'border-top:1px solid var(--border)' : ''};gap:.6rem" onclick="finanzas_modalEditar('${m.id}')">
            <div style="width:32px;height:32px;border-radius:8px;background:${esIngreso ? 'rgba(0,255,136,.1)' : 'rgba(255,68,68,.1)'};display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0">${esIngreso ? '↑' : '↓'}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.85rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(m.concepto)}</div>
              <div style="font-size:.68rem;color:var(--text2)">${formatFecha(m.fecha)} · ${h(m.categorias_financieras?.nombre || 'Sin categoría')}</div>
            </div>
            <div style="font-family:var(--font-head);font-size:.95rem;color:${esIngreso ? 'var(--success)' : 'var(--danger)'};flex-shrink:0">${esIngreso ? '+' : '-'}₲${gs(m.monto)}</div>
          </div>`;
        }).join('')}
      </div>` : '<div class="empty"><p>No hay movimientos este mes</p></div>'}
    </div>`;
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
    concepto,
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
  finanzas();
}

async function finanzas_modalEditar(id) {
  const { data: m } = await sb.from('movimientos_financieros').select('*').eq('id', id).single();
  if (!m) return;
  const { data: cats } = await sb.from('categorias_financieras').select('id,nombre').eq('taller_id', tid()).or(`tipo.eq.${m.tipo},tipo.eq.ambos`).order('nombre');
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
        ${(cats||[]).map(c => `<option value="${c.id}" ${c.id===m.categoria_id?'selected':''}>${h(c.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Notas</label>${renderNotasTextarea('f-fin-notas', m.notas)}</div>
    <button class="btn-primary" onclick="finanzas_guardarConSafeCall('${id}')">Actualizar</button>
    ${currentPerfil?.rol === 'admin' ? `<button class="btn-danger" onclick="finanzas_eliminarConSafeCall('${id}')">Eliminar</button>` : ''}
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function finanzas_eliminarConSafeCall(id) {
  confirmar('¿Eliminar este movimiento?', async () => {
    await safeCall(async () => {
      await sb.from('movimientos_financieros').delete().eq('id', id);
      toast('Eliminado', 'success');
      clearCache('finanzas');
      closeModal(); 
      finanzas();
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
