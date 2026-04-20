// ─── UTILIDADES COMPARTIDAS PARA REPORTES ─────────────────────────────────────
let _reportesFechaInicio = null;
let _reportesFechaFin = null;

function initFechasReporte() {
  if (!_reportesFechaInicio) {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    _reportesFechaInicio = inicioMes.toISOString().split('T')[0];
    _reportesFechaFin = hoy.toISOString().split('T')[0];
  }
}

function getFechasReporte() {
  initFechasReporte();
  return { inicio: _reportesFechaInicio, fin: _reportesFechaFin };
}

function renderSelectorFechas(callbackFn) {
  initFechasReporte();
  return `
    <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1rem;background:var(--surface);padding:.5rem;border-radius:10px;border:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:.3rem;flex:1">
        <input type="date" id="report-fecha-inicio" value="${_reportesFechaInicio}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:.4rem;color:var(--text);font-size:.8rem;width:100%">
      </div>
      <span style="color:var(--text2)">→</span>
      <div style="display:flex;align-items:center;gap:.3rem;flex:1">
        <input type="date" id="report-fecha-fin" value="${_reportesFechaFin}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:.4rem;color:var(--text);font-size:.8rem;width:100%">
      </div>
      <button onclick="aplicarRangoFechas(() => ${callbackFn}())" style="background:var(--accent);color:#000;border:none;border-radius:6px;padding:.4rem .8rem;font-size:.8rem;cursor:pointer;font-family:var(--font-head)">Aplicar</button>
    </div>
    <div style="display:flex;gap:.3rem;margin-bottom:.75rem;flex-wrap:wrap">
      <button onclick="setRangoRapido('este_mes', () => ${callbackFn}())" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Este mes</button>
      <button onclick="setRangoRapido('mes_anterior', () => ${callbackFn}())" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Mes anterior</button>
      <button onclick="setRangoRapido('ultimos_30', () => ${callbackFn}())" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Últ. 30 días</button>
      <button onclick="setRangoRapido('este_anio', () => ${callbackFn}())" class="tab" style="font-size:.7rem;padding:.3rem .6rem">Este año</button>
    </div>
  `;
}

function setRangoRapido(tipo, callbackFn) {
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
  
  _reportesFechaInicio = inicio.toISOString().split('T')[0];
  _reportesFechaFin = fin.toISOString().split('T')[0];
  
  document.getElementById('report-fecha-inicio').value = _reportesFechaInicio;
  document.getElementById('report-fecha-fin').value = _reportesFechaFin;
  
  if (callbackFn) callbackFn();
}

function aplicarRangoFechas(callbackFn) {
  _reportesFechaInicio = document.getElementById('report-fecha-inicio').value;
  _reportesFechaFin = document.getElementById('report-fecha-fin').value;
  if (callbackFn) callbackFn();
}

async function exportarReportePDF(titulo, contenidoId) {
  toast('Generando PDF...', 'info');
  try {
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    
    const element = document.getElementById(contenidoId);
    if (!element) { toast('No se encontró el contenido', 'error'); return; }
    
    const clone = element.cloneNode(true);
    clone.style.backgroundColor = '#ffffff';
    clone.style.color = '#000000';
    clone.style.padding = '20px';
    clone.style.width = '100%';
    document.body.appendChild(clone);
    
    await doc.html(clone, {
      callback: function(doc) {
        doc.save(`${titulo.replace(/\s/g, '_')}_${_reportesFechaInicio}_${_reportesFechaFin}.pdf`);
        document.body.removeChild(clone);
        toast('PDF descargado', 'success');
      },
      x: 10,
      y: 10,
      width: 190,
      windowWidth: 800
    });
  } catch(e) {
    toast('Error al generar PDF: '+e.message, 'error');
  }
}

function formatearMoneda(valor) {
  return '₲' + gs(valor);
}

function formatearPorcentaje(valor, total) {
  if (total === 0) return '0%';
  return ((valor / total) * 100).toFixed(1) + '%';
}

// Fallback para reportes en caso de que no esté definida (robustez)
if (typeof window.reportes !== 'function') {
  window.reportes = async function() {
    console.warn('reportes no está completamente implementado');
    if (typeof navigate === 'function') navigate('dashboard');
  };
}
