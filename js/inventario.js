// ─── ENTRADA DE MERCADERÍA (Compra a proveedor) ─────────────────────────────

async function modalEntradaMercaderia() {
  const { data: items } = await sb.from('inventario').select('id,nombre,cantidad,precio_unitario').eq('taller_id',tid()).order('nombre').limit(200);
  openModal(`
    <div class="modal-title">📥 Entrada de mercadería</div>
    <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">Registrá una compra de repuestos a un proveedor</div>
    <div class="form-group"><label class="form-label">Proveedor *</label><input class="form-input" id="f-ent-prov" placeholder="Distribuidora X"></div>
    <div class="form-group"><label class="form-label">Producto *</label>
      <select class="form-input" id="f-ent-item">
        <option value="">Seleccionar producto...</option>
        ${(items||[]).map(i => `<option value="${i.id}" data-stock="${i.cantidad}" data-precio="${i.precio_unitario}">${h(i.nombre)} (stock: ${i.cantidad})</option>`).join('')}
        <option value="__nuevo__">+ Crear producto nuevo</option>
      </select>
    </div>
    <div id="ent-nuevo-item" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:.75rem;margin-bottom:.75rem">
      <div class="form-group"><label class="form-label">Nombre del producto *</label><input class="form-input" id="f-ent-nombre" placeholder="Filtro de aceite..."></div>
      <div class="form-group"><label class="form-label">Categoría</label><input class="form-input" id="f-ent-cat" placeholder="Filtros, Lubricantes..."></div>
      <div class="form-group"><label class="form-label">Unidad</label><input class="form-input" id="f-ent-unidad" value="unidad" placeholder="unidad, litro..."></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Cantidad *</label><input class="form-input" id="f-ent-qty" type="number" min="1" value="1"></div>
      <div class="form-group"><label class="form-label">Costo unitario ₲</label><input class="form-input" id="f-ent-costo" type="number" min="0" placeholder="Precio de compra"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Factura / Ref</label><input class="form-input" id="f-ent-factura" placeholder="#001-001-0001234"></div>
      <div class="form-group"><label class="form-label">Fecha</label><input class="form-input" id="f-ent-fecha" type="date" value="${fechaHoy()}"></div>
    </div>
    <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1rem">
      <input type="checkbox" id="f-ent-deuda" style="width:18px;height:18px;accent-color:var(--accent)">
      <label for="f-ent-deuda" style="font-size:.82rem;color:var(--text2)">Queda como deuda (crear cuenta a pagar)</label>
    </div>
    <div style="background:var(--surface2);border-radius:8px;padding:.5rem;margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;font-size:.8rem">
        <span>Total compra:</span>
        <span id="ent-total" style="font-family:var(--font-head);color:var(--danger)">₲0</span>
      </div>
    </div>
    <button class="btn-primary" onclick="guardarEntrada()">Registrar entrada</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
    
  // Event listeners para calcular total en tiempo real
  setTimeout(() => {
    const qtyInput = document.getElementById('f-ent-qty');
    const costoInput = document.getElementById('f-ent-costo');
    const updateTotal = () => {
      const qty = parseFloat(qtyInput?.value) || 0;
      const costo = parseFloat(costoInput?.value) || 0;
      document.getElementById('ent-total').textContent = '₲' + gs(qty * costo);
    };
    qtyInput?.addEventListener('input', updateTotal);
    costoInput?.addEventListener('input', updateTotal);
    
    document.getElementById('f-ent-item').onchange = function() {
      document.getElementById('ent-nuevo-item').style.display = this.value === '__nuevo__' ? 'block' : 'none';
      if (this.value && this.value !== '__nuevo__') {
        const opt = this.selectedOptions[0];
        document.getElementById('f-ent-costo').value = opt.dataset.precio || '';
        updateTotal();
      }
    };
  }, 100);
}

async function guardarEntrada() {
  if (guardando()) return;
  
  const proveedor = document.getElementById('f-ent-prov').value.trim();
  if (!proveedor) { toast('El proveedor es obligatorio','error'); return; }
  
  let itemId = document.getElementById('f-ent-item').value;
  const qty = parseFloat(document.getElementById('f-ent-qty').value) || 0;
  if (qty <= 0) { toast('La cantidad debe ser mayor a 0','error'); return; }
  
  const costoUnit = parseFloat(document.getElementById('f-ent-costo').value) || 0;
  const factura = document.getElementById('f-ent-factura').value.trim();
  const fecha = document.getElementById('f-ent-fecha').value;
  const crearDeuda = document.getElementById('f-ent-deuda').checked;
  
  let nombreProducto = '';
  let precioAnterior = 0;
  let stockAnterior = 0;

  // Si es producto nuevo, crearlo primero
  if (itemId === '__nuevo__') {
    const nombre = document.getElementById('f-ent-nombre').value.trim();
    if (!nombre) { toast('El nombre del producto es obligatorio','error'); return; }
    const categoria = document.getElementById('f-ent-cat')?.value || '';
    const unidad = document.getElementById('f-ent-unidad')?.value || 'unidad';
    
    const { data: nuevo, error } = await sb.from('inventario').insert({
      nombre,
      categoria,
      unidad,
      cantidad: 0,
      precio_unitario: costoUnit,
      stock_minimo: 5,
      taller_id: tid()
    }).select('id').single();
    
    if (error) { toast('Error creando producto: '+error.message,'error'); return; }
    itemId = nuevo.id;
    nombreProducto = nombre;
    stockAnterior = 0;
  } else {
    // Obtener datos actuales del producto
    const { data: item } = await sb.from('inventario').select('nombre,cantidad,precio_unitario').eq('id', itemId).single();
    if (!item) { toast('Producto no encontrado','error'); return; }
    nombreProducto = item.nombre;
    stockAnterior = parseFloat(item.cantidad) || 0;
    precioAnterior = parseFloat(item.precio_unitario) || 0;
  }
  
  // Actualizar stock y precio de venta si cambió
  const nuevoStock = stockAnterior + qty;
  const updates = { cantidad: nuevoStock };
  if (costoUnit > 0 && costoUnit !== precioAnterior) {
    updates.precio_unitario = costoUnit;
  }
  await sb.from('inventario').update(updates).eq('id', itemId);
  
  // Registrar movimiento de inventario
  const { data: mov, error: movError } = await sb.from('movimientos_inventario').insert({
    taller_id: tid(),
    inventario_id: itemId,
    tipo: 'entrada',
    cantidad: qty,
    costo_unitario: costoUnit,
    proveedor,
    factura_ref: factura || null,
    fecha,
    notas: 'Compra a ' + proveedor
  }).select('id').single();
  
  if (movError) console.warn('Error registrando movimiento:', movError);
  
  const totalCompra = qty * costoUnit;
  const movimientoId = mov?.id;
  
  // ─── INTEGRACIÓN CON FINANZAS Y CUENTAS A PAGAR ───────────────────────────
  if (crearDeuda && totalCompra > 0) {
    // Crear cuenta a pagar
    const { data: cuenta, error: cuentaError } = await sb.from('cuentas_pagar').insert({
      taller_id: tid(),
      proveedor,
      monto: totalCompra,
      fecha_vencimiento: null,
      notas: `${nombreProducto} x${qty} (Costo unit: ₲${gs(costoUnit)})${factura ? ' — Fact: '+factura : ''}`,
      pagada: false
    }).select('id').single();
    
    if (cuentaError) {
      toast('Error creando cuenta a pagar: '+cuentaError.message, 'error');
    } else {
      toast('✓ Cuenta a pagar registrada', 'info');
    }
  } else if (totalCompra > 0) {
    // Pago al contado: registrar egreso en finanzas
    try {
      // Buscar o crear categoría "Repuestos"
      let categoriaId;
      const { data: cats } = await sb.from('categorias_financieras')
        .select('id')
        .eq('taller_id', tid())
        .eq('nombre', 'Repuestos')
        .limit(1);
      
      if (cats?.length) {
        categoriaId = cats[0].id;
      } else {
        const { data: nuevaCat } = await sb.from('categorias_financieras')
          .insert({ taller_id: tid(), nombre: 'Repuestos', tipo: 'egreso', es_fija: true })
          .select('id')
          .single();
        categoriaId = nuevaCat?.id;
      }
      
      if (categoriaId) {
        await sb.from('movimientos_financieros').insert({
          taller_id: tid(),
          tipo: 'egreso',
          categoria_id: categoriaId,
          monto: totalCompra,
          descripcion: `Compra: ${nombreProducto} x${qty} — ${proveedor}${factura ? ' (Fact: '+factura+')' : ''}`,
          fecha,
          referencia_id: movimientoId,
          referencia_tabla: 'movimientos_inventario'
        });
      }
    } catch (e) {
      console.warn('Error registrando egreso en finanzas:', e);
    }
  }
  
  // Si el costo unitario cambió, registrar en historial de precios
  if (costoUnit > 0 && costoUnit !== precioAnterior && itemId !== '__nuevo__') {
    await sb.from('historial_precios').insert({
      producto_id: itemId,
      precio_anterior: precioAnterior,
      precio_nuevo: costoUnit,
      motivo: 'Compra a ' + proveedor,
      taller_id: tid(),
      fecha: new Date().toISOString()
    }).catch(() => {});
  }
  
  clearCache('inventario');
  clearCache('cuentas');
  clearCache('finanzas');
  clearCache('dash_gastos_mes');
  clearCache('dash_stock');
  
  toast(`✓ Entrada registrada: ${qty} x ${nombreProducto} — Total: ₲${gs(totalCompra)}`, 'success');
  closeModal();
  inventario();
}
