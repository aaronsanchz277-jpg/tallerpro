// ─── MOD-3: ESCÁNER DE CÓDIGO DE BARRAS (para inventario) ───────────────────

let _barcodeScanner = null;

async function barcode_loadLib() {
  if (window.Quagga) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.4/dist/quagga.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('No se pudo cargar el escáner'));
    document.head.appendChild(script);
  });
}

async function barcode_scan(targetInputId) {
  try {
    await barcode_loadLib();
  } catch(e) {
    toast('Error cargando escáner. Verificá tu conexión.', 'error');
    return;
  }

  openModal(`
    <div class="modal-title">📷 Escanear producto</div>
    <div id="barcode-viewport" style="width:100%;height:250px;background:#000;border-radius:10px;overflow:hidden;position:relative"></div>
    <p style="font-size:.75rem;color:var(--text2);text-align:center;margin-top:.5rem">Apuntá la cámara al código de barras del repuesto</p>
    <button class="btn-secondary" onclick="barcode_stop();closeModal()">Cancelar</button>`);

  setTimeout(() => {
    Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: document.getElementById('barcode-viewport'),
        constraints: { facingMode: 'environment', width: 640, height: 480 }
      },
      decoder: {
        readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader', 'upc_reader', 'upc_e_reader']
      },
      locate: true
    }, (err) => {
      if (err) { toast('No se pudo acceder a la cámara', 'error'); closeModal(); return; }
      Quagga.start();
    });

    Quagga.onDetected((result) => {
      const code = result.codeResult.code;
      if (code) {
        barcode_stop();
        closeModal();
        // Si hay un campo target (desde inventario crear/editar), solo poner el código
        if (targetInputId) {
          const input = document.getElementById(targetInputId);
          if (input) { input.value = code; input.focus(); }
        }
        // Siempre buscar el producto
        barcode_accionProducto(code);
      }
    });
  }, 300);
}

function barcode_stop() {
  try { if (window.Quagga) Quagga.stop(); } catch(e) {}
}

async function barcode_accionProducto(code) {
  const { data } = await sb.from('inventario').select('*').eq('taller_id', tid()).eq('codigo_barras', code).maybeSingle();
  if (data) {
    const bajo = parseFloat(data.cantidad) <= parseFloat(data.stock_minimo);
    openModal(`
      <div class="modal-title">📦 ${h(data.nombre)}</div>
      <div class="info-grid" style="margin-bottom:1rem">
        <div class="info-item"><div class="label">Stock</div><div class="value" style="color:${bajo?'var(--danger)':'var(--success)'}">${data.cantidad} ${h(data.unidad||'')}</div></div>
        <div class="info-item"><div class="label">Precio</div><div class="value">${fm(data.precio_unitario)}</div></div>
        ${data.zona?`<div class="info-item"><div class="label">Zona</div><div class="value">📍 ${h(data.zona)}</div></div>`:''}
        ${data.categoria?`<div class="info-item"><div class="label">Categoría</div><div class="value">${h(data.categoria)}</div></div>`:''}
      </div>
      ${bajo?'<div style="background:rgba(255,68,68,.1);border-radius:8px;padding:.5rem;margin-bottom:1rem;font-size:.8rem;color:var(--danger);text-align:center">⚠ Stock bajo — pedir más</div>':''}
      <div style="display:flex;gap:.5rem;margin-bottom:.5rem">
        <button onclick="closeModal();modalDescontarStock('${data.id}','${hjs(data.nombre)}',${data.cantidad})" class="btn-primary" style="flex:1;margin:0">Descontar stock</button>
      </div>
      <div style="display:flex;gap:.5rem">
        <button onclick="closeModal();modalEditarItem('${data.id}')" class="btn-secondary" style="flex:1;margin:0">Editar producto</button>
        <button onclick="closeModal()" class="btn-secondary" style="margin:0">Cerrar</button>
      </div>`);
  } else {
    openModal(`
      <div class="modal-title">Código: ${h(code)}</div>
      <div style="text-align:center;padding:1rem 0">
        <div style="font-size:2rem;margin-bottom:.5rem">❓</div>
        <div style="font-size:.85rem;color:var(--text2);margin-bottom:1rem">No hay ningún producto con este código de barras en tu inventario.</div>
      </div>
      <button onclick="closeModal();modalNuevoItem()" class="btn-primary">Crear producto con este código</button>
      <button onclick="closeModal()" class="btn-secondary">Cancelar</button>`);
    // Pre-llenar el código en el próximo modal de nuevo item
    setTimeout(() => {
      const bc = document.getElementById('f-barcode');
      if (bc) bc.value = code;
    }, 200);
  }
}


