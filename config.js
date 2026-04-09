// ─── INVENTARIO ──────────────────────────────────────────────────────────────
async function inventario({ search='', offset=0, zona='' }={}) {
  const cacheKey = `inventario_${search}_${offset}_${zona}`;
  const { data, count } = await cachedQuery(cacheKey, () => {
    let q = sb.from('inventario').select('*', {count:'exact'}).eq('taller_id',tid()).order('nombre');
    if (search) q = q.ilike('nombre',`%${search}%`);
    if (zona) q = q.eq('zona', zona);
    return q.range(offset, offset + PAGE_SIZE - 1);
  });

  // Obtener todas las zonas únicas
  const { data: allItems } = await sb.from('inventario').select('zona').eq('taller_id',tid()).limit(1000);
  const zonas = [...new Set((allItems||[]).map(i=>i.zona).filter(Boolean))].sort();

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('invTitulo')} ${count ? `<span style="font-size:.75rem;color:var(--text2)">(${count})</span>` : ''}</div>
      <div style="display:flex;gap:.3rem">
        <button onclick="barcode_scan()" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.4rem .6rem;cursor:pointer;color:var(--accent);font-size:.9rem" title="Escanear">📷</button>
        <button onclick="modalEntradaMercaderia()" style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:8px;padding:.4rem .6rem;cursor:pointer;color:var(--success);font-size:.72rem;font-family:var(--font-head)">📥 Entrada</button>
        <button class="btn-add" onclick="modalNuevoItem()">+ Nuevo</button>
      </div>
    </div>
    ${zonas.length > 0 ? `<div style="display:flex;gap:.3rem;margin-bottom:.75rem;overflow-x:auto;padding-bottom:.3rem">
      <button onclick="inventario({zona:''})" style="background:${!zona?'var(--accent)':'var(--surface2)'};color:${!zona?'#000':'var(--text2)'};border:1px solid ${!zona?'var(--accent)':'var(--border)'};border-radius:8px;padding:.3rem .6rem;font-size:.72rem;cursor:pointer;white-space:nowrap">Todos</button>
      ${zonas.map(z => `<button onclick="inventario({zona:'${h(z)}'})" style="background:${zona===z?'var(--accent)':'var(--surface2)'};color:${zona===z?'#000':'var(--text2)'};border:1px solid ${zona===z?'var(--accent)':'var(--border)'};border-radius:8px;padding:.3rem .6rem;font-size:.72rem;cursor:pointer;white-space:nowrap">📍 ${h(z)}</button>`).join('')}
    </div>` : ''}
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="${t('invBuscar')}" value="${h(search)}" oninput="debounce('inv',()=>inventario({search:this.value,zona:'${zona}'}))" class="form-input" style="padding-left:2.5rem">
    </div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('invSinDatos')}</p></div>` :
      (data||[]).map(item => {
        const bajo = parseFloat(item.cantidad)<=parseFloat(item.stock_minimo);
        return `<div class="inv-card" onclick="modalEditarItem('${item.id}')">
          <div class="inv-icon">📦</div>
          <div class="inv-info">
            <div class="inv-name">${h(item.nombre)}</div>
            <div class="inv-meta">${h(item.categoria||t('sinCategoria'))}${item.zona?' · 📍'+h(item.zona):''} · ₲${gs(item.precio_unitario)} c/u</div>
          </div>
          <div class="inv-stock">
            <div class="inv-qty ${bajo?'stock-low':'stock-ok'}">${item.cantidad}</div>
            <div class="inv-unit">${h(item.unidad)}</div>
            ${bajo?'<div style="font-size:.65rem;color:var(--danger)">⚠ BAJO</div>':''}
          </div>
        </div>`;
      }).join('')}
    ${renderPagination(count||0, offset, '_navInv')}`;
}
function _navInv(o) { inventario({offset:o}); }

function modalNuevoItem() {
  openModal(`
    <div class="modal-title">${t("modNuevoProducto")}</div>
    <div class="form-group"><label class="form-label">Nombre *</label><input class="form-input" id="f-nombre" placeholder="Aceite motor 5W30"></div>
    <div class="form-group"><label class="form-label">Código de barras</label>
      <div style="display:flex;gap:.4rem">
        <input class="form-input" id="f-barcode" placeholder="Escanear o escribir" style="flex:1">
        <button onclick="barcode_scan('f-barcode')" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0 .6rem;cursor:pointer;color:var(--accent);font-size:1.1rem" title="Escanear">📷</button>
      </div>
    </div>
    <div class="form-group"><label class="form-label">${t("lblCategoria")}</label><input class="form-input" id="f-cat" placeholder="Lubricantes, Frenos..."></div>
    <div class="form-group"><label class="form-label">Ubicación / Zona</label><select class="form-input" id="f-zona"><option value="">Sin zona</option></select></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t("lblCantidad")}</label><input class="form-input" id="f-qty" type="number" value="0" min="0"></div>
      <div class="form-group"><label class="form-label">${t("lblUnidad")}</label><input class="form-input" id="f-unidad" placeholder="unidad, litro..."></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t("lblStockMin")}</label><input class="form-input" id="f-min" type="number" value="5" min="0"></div>
      <div class="form-group"><label class="form-label">${t("lblPrecioUnit")}</label><input class="form-input" id="f-precio" type="number" min="0" value="0" min="0"></div>
    </div>
    <button class="btn-primary" onclick="guardarItem()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
  cargarZonasSelect('f-zona');
}

async function guardarItem(id=null) {
  if (guardando()) return;
  const nombre = document.getElementById('f-nombre').value.trim();
  if (!nombre) { toast('El nombre es obligatorio','error'); return; }
  const data = { nombre, categoria:document.getElementById('f-cat').value, zona:document.getElementById('f-zona')?.value||null, cantidad:parseFloat(document.getElementById('f-qty').value)||0, unidad:document.getElementById('f-unidad').value||'unidad', stock_minimo:parseFloat(document.getElementById('f-min').value)||5, precio_unitario:parseFloat(document.getElementById('f-precio').value)||0, codigo_barras:document.getElementById('f-barcode')?.value?.trim()||null, taller_id:tid() };
  const { error } = id ? await offlineUpdate('inventario', data, 'id', id) : await offlineInsert('inventario', data);
  if (error) { toast('Error: '+error.message,'error'); return; }
  toast('Producto guardado','success'); closeModal(); inventario();
}

async function modalEditarItem(id) {
  const { data:item } = await sb.from('inventario').select('*').eq('id',id).single();
  const isAdmin = currentPerfil?.rol==='admin';
  openModal(`
    <div class="modal-title">${t("modEditarProducto")}</div>
    <div class="form-group"><label class="form-label">Nombre *</label><input class="form-input" id="f-nombre" value="${h(item.nombre||'')}"></div>
    <div class="form-group"><label class="form-label">Código de barras</label>
      <div style="display:flex;gap:.4rem">
        <input class="form-input" id="f-barcode" value="${h(item.codigo_barras||'')}" placeholder="Escanear o escribir" style="flex:1">
        <button onclick="barcode_scan('f-barcode')" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0 .6rem;cursor:pointer;color:var(--accent);font-size:1.1rem" title="Escanear">📷</button>
      </div>
    </div>
    <div class="form-group"><label class="form-label">${t("lblCategoria")}</label><input class="form-input" id="f-cat" value="${h(item.categoria||'')}"></div>
    <div class="form-group"><label class="form-label">Ubicación / Zona</label><select class="form-input" id="f-zona"><option value="">Sin zona</option></select></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t("lblCantidad")}</label><input class="form-input" id="f-qty" type="number" value="${item.cantidad||0}" min="0"></div>
      <div class="form-group"><label class="form-label">${t("lblUnidad")}</label><input class="form-input" id="f-unidad" value="${h(item.unidad||'unidad')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t("lblStockMin")}</label><input class="form-input" id="f-min" type="number" value="${item.stock_minimo||5}" min="0"></div>
      <div class="form-group"><label class="form-label">${t("lblPrecioUnit")}</label><input class="form-input" id="f-precio" type="number" min="0" value="${item.precio_unitario||0}"></div>
    </div>
    <button class="btn-primary" onclick="guardarItem('${id}')">${t('actualizar')}</button>
    <div style="display:flex;gap:.5rem">
      <button class="btn-secondary" style="margin:0;flex:1" onclick="modalDescontarStock('${id}','${h(item.nombre)}',${item.cantidad})">- Descontar stock</button>
      ${isAdmin?`<button class="btn-danger" style="margin:0" onclick="eliminarItem('${id}')">${t('eliminarBtn')}</button>`:''}
    </div>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
  cargarZonasSelect('f-zona', item.zona);
}

async function cargarZonasSelect(selectId, valorActual) {
  const { data } = await sb.from('inventario').select('zona').eq('taller_id',tid()).limit(1000);
  const zonas = [...new Set((data||[]).map(i=>i.zona).filter(Boolean))].sort();
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Sin zona</option>' +
    zonas.map(z => `<option value="${h(z)}" ${z===valorActual?'selected':''}>${h(z)}</option>`).join('') +
    '<option value="__nueva__">+ Crear nueva zona...</option>';
  sel.onchange = function() {
    if (this.value === '__nueva__') {
      const nueva = prompt('Nombre de la nueva zona:');
      if (nueva?.trim()) {
        const opt = document.createElement('option');
        opt.value = nueva.trim(); opt.textContent = nueva.trim(); opt.selected = true;
        sel.insertBefore(opt, sel.lastElementChild);
      } else { this.value = valorActual || ''; }
    }
  };
}

function modalDescontarStock(id, nombre, stockActual) {
  // Cargar reparaciones activas para vincular
  sb.from('reparaciones').select('id,descripcion,vehiculos(patente)').eq('taller_id',tid()).in('estado',['pendiente','en_progreso','esperando_repuestos']).order('created_at',{ascending:false}).limit(20).then(({data:repsActivas}) => {
    openModal(`
      <div class="modal-title">${t("modDescontarStock")}</div>
      <p style="color:var(--text2);font-size:.85rem;margin-bottom:1rem">${nombre} · ${t('stockActual')}: <strong style="color:var(--accent)">${stockActual}</strong></p>
      <div class="form-group"><label class="form-label">${t("lblCantDescontar")}</label><input class="form-input" id="f-descuento" type="number" value="1" min="1" max="${stockActual}"></div>
      <div class="form-group"><label class="form-label">Para reparación (opcional)</label>
        <select class="form-input" id="f-desc-rep">
          <option value="">Sin vincular</option>
          ${(repsActivas||[]).map(r => `<option value="${r.id}">${h(r.descripcion)}${r.vehiculos?' — '+h(r.vehiculos.patente):''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label">${t("lblMotivo")}</label><input class="form-input" id="f-motivo" placeholder="Usado en reparación..."></div>
      <button class="btn-primary" onclick="descontarStock('${id}',${stockActual})">DESCONTAR</button>
      <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
  });
}

async function descontarStock(id, stockActual) {
  const descuento = parseFloat(document.getElementById('f-descuento').value)||0;
  if (descuento<=0) { toast('Ingresá una cantidad válida','error'); return; }
  if (descuento>stockActual) { toast('No hay suficiente stock','error'); return; }
  const repId = document.getElementById('f-desc-rep')?.value || null;
  const motivo = document.getElementById('f-motivo')?.value || '';
  const { error } = await offlineUpdate('inventario', { cantidad: stockActual - descuento }, 'id', id);
  if (error) { toast('Error','error'); return; }
  // Registrar el descuento vinculado a la reparación
  const { data: item } = await sb.from('inventario').select('nombre,precio_unitario').eq('id',id).single();
  if (repId && item) {
    // Sumar al costo_repuestos de la reparación
    const { data: rep } = await sb.from('reparaciones').select('costo_repuestos').eq('id',repId).single();
    const costoTotal = parseFloat(rep?.costo_repuestos||0) + (parseFloat(item.precio_unitario||0) * descuento);
    await sb.from('reparaciones').update({ costo_repuestos: costoTotal }).eq('id', repId);
  }
  clearCache('inventario');toast(`Stock actualizado${repId?' y vinculado al trabajo':''}`,'success'); closeModal(); inventario();
}

async function eliminarItem(id) {
  confirmar('Esta acción eliminará el producto permanentemente.', async () => {
    await offlineDelete('inventario', 'id', id);
    clearCache('inventario');toast('Producto eliminado'); inventario();
  });
}

// ─── ENTRADA DE MERCADERÍA ──────────────────────────────────────────────────
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
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Cantidad *</label><input class="form-input" id="f-ent-qty" type="number" min="1" value="1"></div>
      <div class="form-group"><label class="form-label">Costo unitario ₲</label><input class="form-input" id="f-ent-costo" type="number" min="0" placeholder="Precio de compra"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Factura / Ref</label><input class="form-input" id="f-ent-factura" placeholder="#001-001-0001234"></div>
      <div class="form-group"><label class="form-label">Fecha</label><input class="form-input" id="f-ent-fecha" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1rem">
      <input type="checkbox" id="f-ent-deuda" style="width:18px;height:18px;accent-color:var(--accent)">
      <label for="f-ent-deuda" style="font-size:.82rem;color:var(--text2)">Queda como deuda (crear cuenta a pagar)</label>
    </div>
    <button class="btn-primary" onclick="guardarEntrada()">Registrar entrada</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
  document.getElementById('f-ent-item').onchange = function() {
    document.getElementById('ent-nuevo-item').style.display = this.value === '__nuevo__' ? 'block' : 'none';
    if (this.value && this.value !== '__nuevo__') {
      const opt = this.selectedOptions[0];
      document.getElementById('f-ent-costo').value = opt.dataset.precio || '';
    }
  };
}

async function guardarEntrada() {
  if (guardando()) return;
  if (guardando()) return;
  const proveedor = document.getElementById('f-ent-prov').value.trim();
  if (!proveedor) { toast('El proveedor es obligatorio','error'); return; }
  let itemId = document.getElementById('f-ent-item').value;
  const qty = parseInt(document.getElementById('f-ent-qty').value) || 0;
  if (qty <= 0) { toast('La cantidad debe ser mayor a 0','error'); return; }
  const costoUnit = parseFloat(document.getElementById('f-ent-costo').value) || 0;
  const factura = document.getElementById('f-ent-factura').value;
  const fecha = document.getElementById('f-ent-fecha').value;
  const crearDeuda = document.getElementById('f-ent-deuda').checked;

  // Crear producto nuevo si es necesario
  if (itemId === '__nuevo__') {
    const nombre = document.getElementById('f-ent-nombre').value.trim();
    if (!nombre) { toast('El nombre del producto es obligatorio','error'); return; }
    const { data: nuevo, error } = await sb.from('inventario').insert({ nombre, cantidad: 0, precio_unitario: costoUnit, stock_minimo: 5, unidad: 'unidad', taller_id: tid() }).select('id').single();
    if (error) { toast('Error creando producto: '+error.message,'error'); return; }
    itemId = nuevo.id;
  }

  if (!itemId) { toast('Seleccioná un producto','error'); return; }

  // Sumar al stock
  const { data: item } = await sb.from('inventario').select('cantidad,nombre,precio_unitario').eq('id',itemId).single();
  const nuevoStock = parseFloat(item?.cantidad||0) + qty;
  await sb.from('inventario').update({ cantidad: nuevoStock, precio_unitario: costoUnit || item?.precio_unitario }).eq('id', itemId);

  // Registrar movimiento de entrada
  await sb.from('movimientos_inventario').insert({
    taller_id: tid(),
    inventario_id: itemId,
    tipo: 'entrada',
    cantidad: qty,
    costo_unitario: costoUnit,
    proveedor,
    factura_ref: factura || null,
    fecha,
    notas: 'Compra a ' + proveedor
  });

  // Crear cuenta a pagar si es deuda
  if (crearDeuda && costoUnit * qty > 0) {
    await sb.from('cuentas_pagar').insert({
      taller_id: tid(),
      proveedor,
      monto: costoUnit * qty,
      fecha_vencimiento: null,
      notas: (item?.nombre||'Productos') + ' x' + qty + (factura?' — Fact: '+factura:''),
      pagada: false
    });
  }

  // Registrar egreso en finanzas si NO es deuda (pagó al contado)
  if (!crearDeuda && costoUnit * qty > 0) {
    const { data: cats } = await sb.from('categorias_financieras').select('id').eq('taller_id',tid()).eq('nombre','Repuestos').limit(1);
    if (cats?.length) {
      await sb.from('movimientos_financieros').insert({ taller_id:tid(), tipo:'egreso', categoria_id:cats[0].id, monto:costoUnit*qty, descripcion:'Compra: '+(item?.nombre||'')+' x'+qty+' — '+proveedor, fecha });
    }
  }

  clearCache('inventario'); clearCache('cuentas'); clearCache('finanzas');
  toast(`✓ ${qty} unidades de ${item?.nombre||'producto'} ingresadas — ₲${gs(costoUnit*qty)}`,'success');
  closeModal(); inventario();
}

async function modalGestionarZonas() {
  const { data: items } = await sb.from('inventario').select('zona').eq('taller_id',tid()).limit(1000);
  const zonas = [...new Set((items||[]).map(i=>i.zona).filter(Boolean))].sort();
  openModal(`
    <div class="modal-title">📍 Gestionar Zonas</div>
    <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">Las zonas te permiten organizar tu inventario por ubicación física</div>
    <div id="zonas-list" style="margin-bottom:1rem">
      ${zonas.length === 0 ? '<div style="font-size:.82rem;color:var(--text2);padding:.5rem 0">No hay zonas creadas. Agregá una zona al crear o editar un producto.</div>' :
        zonas.map(z => {
          const count = (items||[]).filter(i=>i.zona===z).length;
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border)">
            <div><span style="font-size:.85rem">${h(z)}</span> <span style="font-size:.7rem;color:var(--text2)">(${count} productos)</span></div>
          </div>`;
        }).join('')}
    </div>
    <div style="font-size:.72rem;color:var(--text2);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.4rem">AGREGAR ZONA</div>
    <div style="display:flex;gap:.4rem">
      <input class="form-input" id="f-nueva-zona" placeholder="Estante A, Depósito 2..." style="flex:1">
      <button onclick="agregarZonaRapida()" class="btn-add" style="font-size:.8rem;padding:.4rem .8rem">+</button>
    </div>
    <div style="font-size:.7rem;color:var(--text2);margin-top:.3rem">La zona se crea cuando asignás un producto a ella.</div>
    <button class="btn-secondary" style="margin-top:1rem" onclick="closeModal()">Cerrar</button>`);
}

function agregarZonaRapida() {
  const zona = document.getElementById('f-nueva-zona').value.trim();
  if (!zona) { toast('Escribí un nombre de zona','error'); return; }
  toast('Zona "'+zona+'" disponible. Asignala a un producto.','success');
  closeModal();
}

