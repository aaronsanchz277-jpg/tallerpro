// ─── ÍTEMS DE REPARACIÓN ────────────────────────────────────────────────────
async function cargarItemsReparacion(repId) {
  const { data } = await sb.from('reparacion_items').select('*').eq('reparacion_id', repId).order('created_at');
  return data || [];
}

function renderItemsReparacion(items) {
  if (!items || items.length === 0) return '<p style="color:var(--text2);font-size:.85rem">Sin ítems registrados</p>';
  return items.map(i => `
    <div class="factura-item">
      <span>${h(i.descripcion)} ${i.cantidad>1?`x${i.cantidad}`:''}</span>
      <span>₲${gs(i.total || i.precio_unitario * i.cantidad)}</span>
    </div>
  `).join('');
}

async function modalAgregarItemReparacion(repId) {
  const { data: inv } = await sb.from('inventario').select('id,nombre,precio_unitario,cantidad').eq('taller_id',tid()).order('nombre');
  openModal(`
    <div class="modal-title">Agregar ítem a la reparación</div>
    <div class="form-group"><label class="form-label">Tipo</label>
      <select class="form-input" id="item-tipo">
        <option value="servicio">Servicio</option>
        <option value="producto">Producto</option>
        <option value="adicional">Adicional</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="item-desc" placeholder="Ej: Cambio de aceite"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Cantidad</label><input class="form-input" id="item-cant" type="number" value="1" min="1"></div>
      <div class="form-group"><label class="form-label">Precio unit. ₲</label><input class="form-input" id="item-precio" type="number" value="0"></div>
    </div>
    <div class="form-group"><label class="form-label">O seleccionar del inventario</label>
      <select class="form-input" id="item-inv" onchange="llenarDesdeInventario()">
        <option value="">Seleccionar producto...</option>
        ${(inv||[]).map(p=>`<option value="${p.id}" data-nombre="${h(p.nombre)}" data-precio="${p.precio_unitario}">${h(p.nombre)} (stock: ${p.cantidad})</option>`).join('')}
      </select>
    </div>
    <button class="btn-primary" onclick="guardarItemReparacion('${repId}')">Agregar</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

function llenarDesdeInventario() {
  const sel = document.getElementById('item-inv');
  const opt = sel.options[sel.selectedIndex];
  if (opt && opt.value) {
    document.getElementById('item-desc').value = opt.getAttribute('data-nombre') || '';
    document.getElementById('item-precio').value = opt.getAttribute('data-precio') || '0';
    document.getElementById('item-tipo').value = 'producto';
  }
}

async function guardarItemReparacion(repId) {
  await safeCall(async () => {
    const tipo = document.getElementById('item-tipo').value;
    const desc = document.getElementById('item-desc').value.trim();
    const cant = parseFloat(document.getElementById('item-cant').value) || 1;
    const precio = parseFloat(document.getElementById('item-precio').value) || 0;
    if (!validateRequired(desc, 'Descripción')) return;
    
    const { error } = await sb.from('reparacion_items').insert({
      reparacion_id: repId,
      tipo,
      descripcion: desc,
      cantidad: cant,
      precio_unitario: precio,
      taller_id: tid()
    });
    if (error) { toast('Error: '+error.message,'error'); return; }
    
    const invId = document.getElementById('item-inv').value;
    if (invId && tipo === 'producto') {
      const { data: inv } = await sb.from('inventario').select('cantidad').eq('id', invId).single();
      if (inv) {
        await sb.from('inventario').update({ cantidad: Math.max(0, parseFloat(inv.cantidad) - cant) }).eq('id', invId);
      }
    }
    
    const { data: rep } = await sb.from('reparaciones').select('costo_repuestos').eq('id', repId).single();
    const nuevoCosto = parseFloat(rep?.costo_repuestos||0) + (tipo==='producto' ? precio*cant : 0);
    await sb.from('reparaciones').update({ costo_repuestos: nuevoCosto }).eq('id', repId);
    
    clearCache('reparaciones'); clearCache('inventario');
    toast('Ítem agregado', 'success');
    closeModal();
    detalleReparacion(repId);
  }, null, 'No se pudo agregar el ítem');
}
