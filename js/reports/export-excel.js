// ─── EXPORTACIÓN A EXCEL ────────────────────────────────────────────────────
function exportarAExcel(datos, nombreArchivo = 'reporte') {
  if (!datos || !datos.length) {
    toast('No hay datos para exportar', 'error');
    return;
  }
  
  // Crear worksheet
  const headers = Object.keys(datos[0]);
  const wsData = [headers, ...datos.map(row => headers.map(h => row[h] || ''))];
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
  
  // Descargar
  XLSX.writeFile(wb, `${nombreArchivo}_${fechaHoy()}.xlsx`);
  toast('📊 Reporte exportado', 'success');
}

// Cargar librería SheetJS dinámicamente
let _xlsxLoaded = false;
async function loadXLSX() {
  if (_xlsxLoaded || window.XLSX) { _xlsxLoaded = true; return; }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
    s.onload = () => { _xlsxLoaded = true; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Función para agregar botón de Excel en reportes
async function exportarReporteExcel(datos, titulo) {
  await loadXLSX();
  exportarAExcel(datos, titulo);
}
