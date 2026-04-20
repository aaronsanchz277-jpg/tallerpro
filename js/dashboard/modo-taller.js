// ─── MODO TALLER (Vista para TV) ────────────────────────────────────────────
let _modoTallerInterval = null;
let _modoTallerRelojInterval = null;

async function modoTaller() {
  if (_modoTallerInterval) clearInterval(_modoTallerInterval);
  if (_modoTallerRelojInterval) clearInterval(_modoTallerRelojInterval);

  document.body.classList.add('modo-taller');

  async function actualizarVista() {
    try {
      // Consulta de reparaciones activas (sin sb.raw, usando columna real 'created_at')
      const { data: reps } = await sb.from('reparaciones')
        .select('*, vehiculos(patente,marca,modelo), clientes(nombre)')
        .eq('taller_id', tid())
        .in('estado', ['pendiente', 'en_progreso', 'esperando_repuestos'])
        .order('created_at', { ascending: false });

      // Consulta de stock bajo: traemos todos los items y filtramos en JavaScript
      // (Evita completamente el uso de sb.raw y es 100% compatible)
      const { data: inventario } = await sb.from('inventario')
        .select('nombre,cantidad,stock_minimo')
        .eq('taller_id', tid());

      const stockBajo = (inventario || []).filter(item => {
        const cantidad = parseFloat(item.cantidad) || 0;
        const minimo = parseFloat(item.stock_minimo) || 5;
        return cantidad <= minimo;
      });

      const columnas = { pendiente: [], en_progreso: [], esperando_repuestos: [] };
      reps?.forEach(r => { if (columnas[r.estado]) columnas[r.estado].push(r); });

      const ahora = new Date();

      document.getElementById('main-content').innerHTML = `
        <div style="padding:1.5rem;min-height:100vh;background:var(--bg)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
            <div style="font-family:var(--font-head);font-size:2.5rem;color:var(--accent)">${h(currentPerfil?.talleres?.nombre || 'TallerPro')}</div>
            <div style="font-size:3.5rem;font-family:var(--font-mono);color:var(--text)" id="reloj-taller">${ahora.toLocaleTimeString('es-PY', {hour:'2-digit',minute:'2-digit'})}</div>
          </div>

          ${stockBajo.length ? `
          <div style="background:var(--danger);color:#fff;padding:1rem 1.5rem;border-radius:12px;margin-bottom:1.5rem;font-size:1.3rem;animation:pulse 2s infinite;display:flex;align-items:center;gap:1rem">
            <span>⚠️</span>
            <span><strong>STOCK BAJO:</strong> ${stockBajo.map(s => `${s.nombre} (${s.cantidad})`).join(' · ')}</span>
          </div>` : ''}

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.5rem">
            ${['pendiente', 'en_progreso', 'esperando_repuestos'].map(est => `
              <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem">
                <div style="font-size:1.4rem;color:var(--accent);margin-bottom:1.5rem;font-family:var(--font-head);letter-spacing:1px">
                  ${estadoLabel(est).toUpperCase()} (${columnas[est].length})
                </div>
                ${columnas[est].map(r => `
                  <div style="background:var(--surface2);border-radius:12px;padding:1rem;margin-bottom:.8rem">
                    <div style="font-weight:bold;font-size:1.1rem;margin-bottom:.3rem">${h(r.descripcion)}</div>
                    <div style="font-size:.9rem;color:var(--text2)">${r.vehiculos?.patente || ''} · ${r.clientes?.nombre || ''}</div>
                    <div style="font-size:.8rem;color:var(--accent2);margin-top:.5rem">⏱️ Ingresó: ${tiempoTranscurrido(r.created_at)}</div>
                  </div>
                `).join('')}
                ${columnas[est].length === 0 ? '<div style="color:var(--text2);font-size:1rem;padding:.5rem;text-align:center">— Sin trabajos —</div>' : ''}
              </div>
            `).join('')}
          </div>

          <button onclick="salirModoTaller()" style="position:fixed;bottom:30px;right:30px;background:var(--surface2);border:1px solid var(--border);color:var(--text2);padding:.8rem 1.5rem;border-radius:30px;cursor:pointer;font-size:1rem;font-family:var(--font-head);letter-spacing:1px">← SALIR</button>
        </div>
      `;
    } catch (error) {
      console.error('Error en modo taller:', error);
      document.getElementById('main-content').innerHTML = `<div class="empty"><p>Error al cargar el modo taller</p><button onclick="navigate('dashboard')">Volver</button></div>`;
    }
  }

  await actualizarVista();
  _modoTallerInterval = setInterval(actualizarVista, 30000);
  _modoTallerRelojInterval = setInterval(() => {
    const reloj = document.getElementById('reloj-taller');
    if (reloj) reloj.textContent = new Date().toLocaleTimeString('es-PY', {hour:'2-digit',minute:'2-digit'});
  }, 1000);
}

function salirModoTaller() {
  document.body.classList.remove('modo-taller');
  if (_modoTallerInterval) clearInterval(_modoTallerInterval);
  if (_modoTallerRelojInterval) clearInterval(_modoTallerRelojInterval);
  _modoTallerInterval = null;
  _modoTallerRelojInterval = null;
  navigate('dashboard');
}

function tiempoTranscurrido(fecha) {
  if (!fecha) return '?';
  const diff = Date.now() - new Date(fecha).getTime();
  const horas = Math.floor(diff / 3600000);
  const minutos = Math.floor((diff % 3600000) / 60000);
  if (horas > 24) {
    const dias = Math.floor(horas / 24);
    return `${dias}d ${horas % 24}h`;
  }
  return horas > 0 ? `${horas}h ${minutos}m` : `${minutos}m`;
}

window.modoTaller = modoTaller;
window.salirModoTaller = salirModoTaller;
