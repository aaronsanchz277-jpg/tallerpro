// ─── VENTAS (Unificado: POS + QuickService) ─────────────────────────────────
// Integrado con Finanzas automáticamente (vía trigger en BD)

async function ventas({ filtro='todos', offset=0 }={}) {
  const cacheKey = `ventas_${filtro}_${offset}`;
  const { data, count } = await cachedQuery(cacheKey, () => {
    let q = sb.from('ventas').select('*, clientes(nombre), vehiculos(patente,marca)', {count:'exact'})
      .eq('taller_id', tid()).order('created_at', {ascending:false});
    if (filtro !== 'todos') q = q.eq('estado', filtro);
    return q.range(offset, offset + PAGE_SIZE - 1);
  });
  
  const totalHoy = (data||[]).filter(v => (v.created_at||'').startsWith(fechaHoy()))
    .reduce((s, v) => s + parseFloat(v.total||0), 0);

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">Ventas ${count ? `<span style="font-size:.75rem;color:var(--text2)">(${count})</span>` : ''}</div>
      <div style="display:flex;gap:.3rem">
        <button class="btn-add" onclick="modalNuevaVenta()">+ Venta</button>
        <button class="btn-add" style="background:var(--success)" onclick="modalNuevoServicioRapido()">⚡ Servicio Rápido</button>
      </div>
    </div>
    ${totalHoy > 0 ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.75rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:.7rem;color:var(--text2);font-family:var(--font-head);letter-spacing:1px">VENTAS HOY</div>
        <div style="font-family:var(--font-head);font-size:1.4rem;color:var(--success)">${fm(totalHoy)}</div></div>
      <div style="font-size:1.5rem">🛒</div>
    </div>` : ''}
    <div class="tabs">
      <button class="tab ${filtro==='todos'?'active':''}" onclick="ventas({filtro:'todos'})">Todos</button>
      <button class="tab ${filtro==='completado'?'active':''}" onclick="ventas({filtro:'completado'})">Completados</button>
      <button class="tab ${filtro==='facturado'?'active':''}" onclick="ventas({filtro:'facturado'})">Facturados</button>
    </div>
    ${(data||[]).length === 0 ? '<div class="empty"><p>No hay ventas registradas</p></div>' :
      (data||[]).map(v => `
      <div class="card" onclick="detalleVenta('${v.id}')">
        <div class="card-header">
          <div class="card-avatar">${v.es_servicio_rapido ? '⚡' : '🛒'}</div>
          <div class="card-info">
            <div class="card-name">${v.descripcion || (v.clientes ? h(v.clientes.nombre) : 'Venta mostrador')}</div>
            <div class="card-sub">${v.vehiculos ? h(v.vehiculos.patente) + ' · ' + h(v.vehiculos.marca) : ''} · ${formatFecha(v.created_at?.split('T')[0])}</div>
          </div>
          <div style="text-align:right">
            <span class="card-badge ${v.estado==='facturado'?'badge-green':'badge-yellow'}">${v.estado.toUpperCase()}</span>
            <div style="font-family:var(--font-head);font-size:.9rem;color:var(--accent);margin-top:4px">${fm(v.total||0)}</div>
          </div>
        </div>
      </div>`).join('')}
    ${renderPagination(count||0, offset, '_navVentas')}`;
}
function _navVentas(o) { ventas({offset:o}); }

async function detalleVenta(id) {
  const { data:v } = await sb.from('ventas').select('*, clientes(nombre,telefono), vehiculos(patente,marca,modelo)').eq('id',id).single();
  if (!v) return;
  const items = v.items || [];
  
  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('ventas')">← Volver</button>
      <div class="detail-avatar">${v.es_servicio_rapido ? '⚡' : '🛒'}</div>
      <div style="flex:1">
        <div class="detail-name">${v.descripcion || (v.clientes ? h(v.clientes.nombre) : 'Venta mostrador')}</div>
        <div class="detail-sub">${formatFecha(v.created_at?.split('T')[0])} · ${v.es_servicio_rapido ? 'Servicio Rápido' : 'Venta POS'}</div>
      </div>
      <span class="card-badge ${v.estado==='facturado'?'badge-green':'badge-yellow'}">${v.estado.toUpperCase()}</span>
    </div>
    <div class="info-grid">
      ${v.clientes ? `<div class="info-item"><div class="label">Cliente</div><div class="value">${h(v.clientes.nombre)}</div></div>` : ''}
      ${v.vehiculos ? `<div class="info-item"><div class="label">Vehículo</div><div class="value">${h(v.vehiculos.patente)} · ${h(v.vehiculos.marca)}</div></div>` : ''}
      <div class="info-item"><div class="label">Total</div><div class="value" style="color:var(--accent)">${fm(v.total||0)}</div></div>
      <div class="info-item"><div class="label">Método</div><div class="value">${h(v.metodo_pago||'efectivo')}</div></div>
    </div>
    <div class="sub-section"><div class="sub-section-title">ÍTEMS</div>
      ${items.map(i => `<div class="factura-item"><span>${h(i.descripcion||i.nombre)} x${i.cantidad}</span><span style="color:var(--accent)">${fm(parseFloat(i.precio||0)*i.cantidad)}</span></div>`).join('')}
      ${v.descuento > 0 ? `<div class="factura-item"><span style="color:var(--danger)">Descuento</span><span style="color:var(--danger)">-${fm(v.descuento)}</span></div>` : ''}
      <div class="factura-total"><span>TOTAL</span><span>${fm(v.total||0)}</span></div>
    </div>
    ${v.notas ? `<div class="info-item"><div class="label">Notas</div><div class="value">${h(v.notas)}</div></div>` : ''}
    <div style="display:flex;gap:.5rem;margin-top:1rem">
      ${v.estado==='completado' ? `<button class="btn-primary" style="flex:1;margin:0;background:var(--success)" onclick="facturarVenta('${v.id}')">🧾 Facturar</button>` : ''}
      <button class="btn-secondary" style="flex:1;margin:0" onclick="window.print()">🖨️ Imprimir</button>
      ${(currentPerfil?.rol==='admin' || (typeof tienePerm==='function' && tienePerm('anular_ventas'))) ? `<button class="btn-danger" style="flex:1;margin:0" onclick="eliminarVenta('${v.id}')">Eliminar</button>` : ''}
    </div>`;
}

// Modal venta normal (POS)
async function modalNuevaVenta() {
  const [{ data:cls }, { data:inv }] = await Promise.all([
    sb.from('clientes').select('id,nombre').eq('taller_id',tid()).order('nombre'),
    sb.from('inventario').select('id,nombre,precio_unitario,cantidad').eq('taller_id',tid()).order('nombre')
  ]);
  window._ventaItems = [];
  window._ventaInv = inv || [];
  
  const clienteSelect = await renderClienteSelect('venta-cli', null, true);
  
  openModal(`
    <div class="modal-title">🛒 NUEVA VENTA</div>
    <div class="form-group"><label class="form-label">Cliente (opcional)</label>${clienteSelect}</div>
    <div class="form-group"><label class="form-label">Método de pago</label>
      <select class="form-input" id="venta-metodo">
        <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Agregar producto</label>
      <select class="form-input" id="venta-prod-sel" onchange="ventaAgregarProducto()">
        <option value="">Seleccionar producto...</option>
        ${(inv||[]).map(p=>`<option value="${p.id}" data-precio="${p.precio_unitario||0}" data-stock="${p.cantidad||0}" data-nombre="${h(p.nombre)}">${h(p.nombre)} — ${fm(p.precio_unitario||0)} (stock: ${p.cantidad||0})</option>`).join('')}
      </select>
    </div>
    <div id="venta-items-list"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Descuento (${monedaActual().simbolo})</label><input class="form-input" id="venta-descuento" type="number" value="0" oninput="ventaUpdateTotal()"></div>
      <div class="form-group"><label class="form-label">TOTAL</label><div id="venta-total" style="font-family:var(--font-head);font-size:1.5rem;color:var(--accent);padding-top:.3rem">${fm(0)}</div></div>
    </div>
    <div class="form-group"><label class="form-label">Notas</label><input class="form-input" id="venta-notas" placeholder="Opcional"></div>
    <button class="btn-primary" style="background:var(--success)" onclick="guardarVentaConSafeCall()">✓ CONFIRMAR VENTA</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

// Modal servicio rápido
async function modalNuevoServicioRapido() {
  const [{ data:cls }, { data:vehs }, { data:inv }] = await Promise.all([
    sb.from('clientes').select('id,nombre').eq('taller_id',tid()).order('nombre'),
    sb.from('vehiculos').select('id,patente,marca,modelo,cliente_id').eq('taller_id',tid()).order('patente'),
    sb.from('inventario').select('id,nombre,precio_unitario,cantidad').eq('taller_id',tid()).order('nombre')
  ]);
  window._ventaItems = [];
  window._ventaInv = inv || [];
  
  const clienteSelect = await renderClienteSelect('qs-cli', null, true);
  const vehiculoSelect = await renderVehiculoSelect('qs-veh', null, null, true);
  
  openModal(`
    <div class="modal-title" style="color:var(--success)">⚡ SERVICIO RÁPIDO</div>
    <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="qs-desc" placeholder="Cambio de aceite + filtro"></div>
    <div class="form-group"><label class="form-label">Vehículo</label>${vehiculoSelect}</div>
    <div class="form-group"><label class="form-label">Cliente</label>${clienteSelect}</div>
    <div class="form-group"><label class="form-label">Agregar ítem</label>
      <select class="form-input" id="venta-prod-sel" onchange="ventaAgregarProducto()">
        <option value="">Seleccionar producto/servicio...</option>
        ${(inv||[]).map(p=>`<option value="${p.id}" data-precio="${p.precio_unitario||0}" data-stock="${p.cantidad||0}" data-nombre="${h(p.nombre)}">${h(p.nombre)} — ${fm(p.precio_unitario||0)}</option>`).join('')}
        <option value="__servicio__" data-precio="0" data-stock="999" data-nombre="Mano de obra">🔧 Mano de obra (personalizado)</option>
      </select>
    </div>
    <div id="venta-items-list"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Descuento</label><input class="form-input" id="venta-descuento" type="number" value="0" oninput="ventaUpdateTotal()"></div>
      <div class="form-group"><label class="form-label">TOTAL</label><div id="venta-total" style="font-family:var(--font-head);font-size:1.5rem;color:var(--accent);padding-top:.3rem">${fm(0)}</div></div>
    </div>
    <button class="btn-primary" style="background:var(--success)" onclick="guardarVentaConSafeCall(true)">✓ CONFIRMAR SERVICIO</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

function qsAutoCliente() {
  const s = document.getElementById('qs-veh');
  const c = s.options[s.selectedIndex]?.getAttribute('data-cli');
  if (c) document.getElementById('qs-cli').value = c;
}

function ventaAgregarProducto() {
  const sel = document.getElementById('venta-prod-sel');
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) return;
  
  let item;
  if (opt.value === '__servicio__') {
    const precio = prompt('Precio de la mano de obra (' + monedaActual().simbolo + '):', '0');
    if (precio === null) return;
    item = {
      id: null,
      nombre: 'Mano de obra',
      precio: parseFloat(precio) || 0,
      cantidad: 1,
      maxStock: 999,
      tipo: 'servicio'
    };
  } else {
    const existing = window._ventaItems.find(i => i.id === opt.value);
    if (existing) {
      existing.cantidad++;
      sel.value = '';
      ventaRenderItems();
      return;
    }
    item = {
      id: opt.value,
      nombre: opt.getAttribute('data-nombre'),
      precio: parseFloat(opt.getAttribute('data-precio')) || 0,
      cantidad: 1,
      maxStock: parseFloat(opt.getAttribute('data-stock')) || 999,
      tipo: 'producto'
    };
  }
  window._ventaItems.push(item);
  sel.value = '';
  ventaRenderItems();
}

function ventaUpdateCant(i, v) {
  window._ventaItems[i].cantidad = Math.max(1, Math.min(parseInt(v)||1, window._ventaItems[i].maxStock));
  ventaRenderItems();
}

function ventaRemoveItem(i) {
  window._ventaItems.splice(i, 1);
  ventaRenderItems();
}

function ventaRenderItems() {
  const total = window._ventaItems.reduce((s, i) => s + i.precio * i.cantidad, 0);
  document.getElementById('venta-total').textContent = fm(total);
  document.getElementById('venta-items-list').innerHTML = window._ventaItems.map((item, i) => `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.5rem;margin-bottom:.4rem;display:flex;justify-content:space-between;align-items:center">
      <div style="flex:1;min-width:0">
        <div style="font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(item.nombre)}</div>
        <div style="font-size:.72rem;color:var(--text2)">${fm(item.precio)} c/u</div>
      </div>
      <input class="form-input" style="width:50px;padding:.3rem;text-align:center;font-size:.82rem" type="number" value="${item.cantidad}" min="1" max="${item.maxStock}" oninput="ventaUpdateCant(${i},this.value)">
      <span style="font-family:var(--font-head);color:var(--accent);width:80px;text-align:right;font-size:.85rem">${fm(item.precio*item.cantidad)}</span>
      <button onclick="ventaRemoveItem(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;margin-left:.3rem">✕</button>
    </div>`).join('');
}

function ventaUpdateTotal() {
  const total = window._ventaItems.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const desc = parseFloat(document.getElementById('venta-descuento')?.value || 0);
  document.getElementById('venta-total').textContent = fm(Math.max(0, total - desc));
}

async function guardarVentaConSafeCall(esServicioRapido = false) {
  await safeCall(async () => {
    await guardarVenta(esServicioRapido);
  }, null, 'No se pudo confirmar la venta');
}

async function guardarVenta(esServicioRapido = false) {
  if (window._ventaItems.length === 0) { toast('Agregá al menos un ítem', 'error'); return; }
  
  const total = window._ventaItems.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const descuento = parseFloat(document.getElementById('venta-descuento')?.value || 0);
  const totalFinal = Math.max(0, total - descuento);
  
  // Descontar stock de productos en paralelo (en lugar de N awaits secuenciales)
  const stockUpdates = window._ventaItems
    .filter(item => item.id)
    .map(item => {
      const inv = window._ventaInv.find(p => p.id === item.id);
      if (!inv) return null;
      return sb.from('inventario').update({
        cantidad: Math.max(0, parseFloat(inv.cantidad) - item.cantidad)
      }).eq('id', item.id);
    })
    .filter(Boolean);
  if (stockUpdates.length) await Promise.all(stockUpdates);
  
  const data = {
    tipo: esServicioRapido ? 'mixto' : 'producto',
    es_servicio_rapido: esServicioRapido,
    descripcion: esServicioRapido ? (document.getElementById('qs-desc')?.value || 'Servicio rápido') : null,
    cliente_id: document.getElementById(esServicioRapido ? 'qs-cli' : 'venta-cli')?.value || null,
    vehiculo_id: esServicioRapido ? (document.getElementById('qs-veh')?.value || null) : null,
    items: window._ventaItems.map(i => ({ 
      nombre: i.nombre, 
      precio: i.precio, 
      cantidad: i.cantidad,
      tipo: i.tipo || 'producto'
    })),
    subtotal: total,
    descuento,
    total: totalFinal,
    metodo_pago: esServicioRapido ? 'efectivo' : (document.getElementById('venta-metodo')?.value || 'efectivo'),
    notas: document.getElementById('venta-notas')?.value || null,
    taller_id: tid(),
    estado: 'completado'
  };
  
  const { error } = await offlineInsert('ventas', data);
  if (error) { toast('Error: '+error.message,'error'); return; }
  
  // NOTA: La inserción en movimientos_financieros ahora la hace un TRIGGER en Supabase
  // (ver script SQL proporcionado)
  
  clearCache('ventas');
  clearCache('inventario');
  clearCache('finanzas');
  toast('✓ ¡Venta exitosa!', 'success');
  closeModal();
  ventas();
}

async function facturarVenta(id) {
  confirmar('¿Marcar esta venta como facturada?', async () => {
    await safeCall(async () => {
      await sb.from('ventas').update({ estado: 'facturado', fecha_facturacion: new Date().toISOString() }).eq('id', id);
      clearCache('ventas');
      toast('✓ Venta facturada', 'success');
      detalleVenta(id);
    }, null, 'No se pudo facturar la venta');
  });
}

async function eliminarVenta(id) {
  // Solo admin o empleado con permiso explícito de "anular_ventas"
  if (typeof esAdmin === 'function' && !esAdmin()
      && !(typeof tienePerm === 'function' && tienePerm('anular_ventas'))) {
    if (typeof toast === 'function') toast('No tenés permisos para anular ventas', 'error');
    return;
  }
  confirmar('¿Eliminar esta venta? También se eliminará el registro financiero asociado.', async () => {
    await safeCall(async () => {
      // El trigger en BD podría manejar la eliminación, pero por seguridad borramos manualmente el movimiento
      await sb.from('movimientos_financieros')
        .delete()
        .eq('referencia_id', id)
        .eq('referencia_tabla', 'ventas');
      
      await offlineDelete('ventas', 'id', id);
      clearCache('ventas');
      clearCache('finanzas');
      toast('Venta eliminada');
      navigate('ventas');
    }, null, 'No se pudo eliminar la venta');
  });
}
