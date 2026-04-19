// ─── ESCÁNER DE FACTURAS CON OCR (OCR.SPACE API GRATIS) ─────────────────────
const OCR_API_KEY = 'K86742158888957'; // API key gratuita de OCR.space (500 llamadas/día)

async function modalEscanearFactura() {
  openModal(`
    <div class="modal-title">📄 Escanear factura</div>
    <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">Subí una foto de la factura y extraeremos los datos automáticamente</div>
    <div class="form-group">
      <input type="file" id="ocr-file" accept="image/*" capture="environment" class="form-input">
    </div>
    <div id="ocr-preview" style="margin-bottom:1rem"></div>
    <button class="btn-primary" onclick="procesarOCR()">Analizar factura</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
  `);
  
  document.getElementById('ocr-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      document.getElementById('ocr-preview').innerHTML = `<img src="${url}" style="width:100%;max-height:200px;object-fit:contain;border-radius:8px">`;
    }
  });
}

async function procesarOCR() {
  const file = document.getElementById('ocr-file').files[0];
  if (!file) { toast('Seleccioná una imagen', 'error'); return; }
  
  toast('Procesando imagen...', 'info');
  
  const formData = new FormData();
  formData.append('apikey', OCR_API_KEY);
  formData.append('file', file);
  formData.append('language', 'spa');
  formData.append('isOverlayRequired', 'false');
  
  try {
    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    
    if (data.IsErroredOnProcessing || !data.ParsedResults?.[0]?.ParsedText) {
      toast('No se pudo leer la factura', 'error');
      return;
    }
    
    const texto = data.ParsedResults[0].ParsedText;
    
    // Extraer datos básicos con regex simples
    const proveedorMatch = texto.match(/(.+?)(?:\n|S\.A\.|S\.R\.L\.)/i);
    const proveedor = proveedorMatch ? proveedorMatch[1].trim() : '';
    
    const totalMatch = texto.match(/(?:TOTAL|TOTAL A PAGAR|A PAGAR)\s*[:$]?\s*([\d.,]+)/i);
    let total = 0;
    if (totalMatch) total = parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.')) || 0;
    
    const fechaMatch = texto.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    const fecha = fechaMatch ? fechaMatch[1] : '';
    
    // Pre-llenar formulario de gasto
    closeModal();
    setTimeout(() => {
      modalNuevoGasto({
        proveedor: proveedor,
        monto: total,
        fecha: fecha ? formatoFechaISO(fecha) : '',
        descripcion: 'Compra según factura'
      });
    }, 200);
    
    toast('Factura analizada', 'success');
  } catch (e) {
    toast('Error al procesar la imagen', 'error');
  }
}

function formatoFechaISO(fechaStr) {
  const partes = fechaStr.split(/[\/\-]/);
  if (partes.length === 3) {
    const dia = partes[0].padStart(2, '0');
    const mes = partes[1].padStart(2, '0');
    const anio = partes[2].length === 2 ? '20' + partes[2] : partes[2];
    return `${anio}-${mes}-${dia}`;
  }
  return fechaHoy();
}
