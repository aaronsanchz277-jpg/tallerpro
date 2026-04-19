// ─── MODO TALLER (Vista para TV) ────────────────────────────────────────────
async function modoTaller() {
  document.body.classList.add('modo-taller');
  
  async function actualizarVista() {
    const { data: reps } = await sb.from('reparaciones')
      .select('*, vehiculos(patente,marca,modelo), clientes(nombre)')
      .eq('taller_id', tid()).in('estado', ['pendiente','en_progreso','esperando_repuestos']).order('created_at');
    
    const { data: stockBajo } = await sb.from('inventario')
      .select('nombre,cantidad').eq('taller_id', tid()).lte('cantidad', sb.raw('stock_minimo'));
    
    const columnas = { pendiente: [], en_progreso: [], esperando_repuestos: [] };
    reps?.forEach(r => { if (columnas[r.estado]) columnas[r.estado].push(r); });
    
    const ahora = new Date();
    
    document.getElementById('main-content').innerHTML = `
      <div style="padding:1rem;min-height:100vh;background:var(--bg)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <div style="font-family:var(--font-head);font-size:2rem;color:var(--accent)">${currentPerfil?.talleres?.nombre || 'TallerPro'}</div>
          <div style="font-size:3rem;font-family:var(--font-mono)" id="reloj-taller">${ahora.toLocaleTimeString('es-PY', {hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        
        ${stockBajo?.length ? `
        <div style="background:var(--danger);color:#fff;padding:1rem;border-radius:12px;margin-bottom:1rem;font-size:1.2rem;animation:pulse 2s infinite">
          ⚠️ STOCK BAJO: ${stockBajo.map(s => `${s.nombre} (${s.cantidad})`).join(' · ')}
        </div>` : ''}
        
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
          ${['pendiente','en_progreso','esperando_repuestos'].map(est => `
            <div style="background:var(--surface);border-radius:16px;padding:1rem">
              <div style="font-size:1.2rem;color:var(--accent);margin-bottom:1rem">${estadoLabel(est).toUpperCase()} (${columnas[est].length})</div>
              ${columnas[est].map(r => `
                <div style="background:var(--surface2);border-radius:12px;padding:.8rem;margin-bottom:.5rem">
                  <div style="font-weight:bold">${h(r.descripcion)}</div>
                  <div style="font-size:.8rem;color:var(--text2)">${r.vehiculos?.patente} · ${r.clientes?.nombre || ''}</div>
                  <div style="font-size:.7rem;color:var(--accent2)">⏱️ Ingresó: ${tiempoTranscurrido(r.created_at)}</div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
        
        <button onclick="salirModoTaller()" style="position:fixed;bottom:20px;right:20px;background:var(--surface2);border:1px solid var(--border);color:var(--text2);padding:.5rem 1rem;border-radius:20px;cursor:pointer">Salir</button>
      </div>
    `;
  }
  
  await actualizarVista();
  window._modoTallerInterval = setInterval(actualizarVista, 30000);
  setInterval(() => {
    const reloj = document.getElementById('reloj-taller');
    if (reloj) reloj.textContent = new Date().toLocaleTimeString('es-PY', {hour:'2-digit',minute:'2-digit'});
  }, 1000);
}

function salirModoTaller() {
  document.body.classList.remove('modo-taller');
  clearInterval(window._modoTallerInterval);
  navigate('dashboard');
}

function tiempoTranscurrido(fecha) {
  const diff = Date.now() - new Date(fecha).getTime();
  const horas = Math.floor(diff / 3600000);
  const minutos = Math.floor((diff % 3600000) / 60000);
  return horas > 0 ? `${horas}h ${minutos}m` : `${minutos}m`;
}
