// ─── MODO TALLER (Vista para TV) ────────────────────────────────────────────
// Versión corregida: etiquetas de estado limpias y tipografía mejorada.

let _modoTallerInterval = null;
let _modoTallerRelojInterval = null;

// Mapeo local de estados (evita dependencias problemáticas)
const ESTADO_LABELS = {
  pendiente: 'PENDIENTE',
  en_progreso: 'EN PROGRESO',
  esperando_repuestos: 'ESPERANDO REPUESTOS',
  finalizado: 'FINALIZADO'
};

async function modoTaller() {
  if (_modoTallerInterval) clearInterval(_modoTallerInterval);
  if (_modoTallerRelojInterval) clearInterval(_modoTallerRelojInterval);

  document.body.classList.add('modo-taller');

  async function actualizarVista() {
    try {
      const { data: reps } = await sb.from('reparaciones')
        .select('*, vehiculos(patente,marca,modelo), clientes(nombre)')
        .eq('taller_id', tid())
        .in('estado', ['pendiente', 'en_progreso', 'esperando_repuestos'])
        .order('created_at', { ascending: false });

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
        <div style="padding:2rem;min-height:100vh;background:var(--bg);font-family:var(--font-body)">
          <!-- Cabecera con nombre y reloj -->
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2rem;border-bottom:1px solid var(--border);padding-bottom:1rem">
            <div style="font-family:var(--font-head);font-size:3rem;font-weight:700;color:var(--accent);letter-spacing:2px;text-transform:uppercase">
              ${h(currentPerfil?.talleres?.nombre || 'TallerPro')}
            </div>
            <div style="font-size:4rem;font-family:'Courier New', monospace;font-weight:600;color:var(--text);letter-spacing:4px" id="reloj-taller">
              ${ahora.toLocaleTimeString('es-PY', {hour:'2-digit',minute:'2-digit'})}
            </div>
          </div>

          <!-- Alerta de stock bajo -->
          ${stockBajo.length ? `
          <div style="background:var(--danger);color:#fff;padding:1.2rem 2rem;border-radius:16px;margin-bottom:2rem;font-size:1.4rem;font-weight:500;display:flex;align-items:center;gap:1.5rem;box-shadow:0 4px 12px rgba(255,68,68,.3)">
            <span style="font-size:2rem">⚠️</span>
            <span><strong style="font-weight:700">STOCK BAJO:</strong> ${stockBajo.map(s => `${s.nombre} (${s.cantidad})`).join('  ·  ')}</span>
          </div>` : ''}

          <!-- Columnas Kanban -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:2rem">
            ${['pendiente', 'en_progreso', 'esperando_repuestos'].map(est => `
              <div style="background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:1.8rem;box-shadow:0 8px 24px rgba(0,0,0,.2)">
                <div style="font-size:1.6rem;font-weight:700;color:var(--accent);margin-bottom:1.8rem;font-family:var(--font-head);letter-spacing:1.5px;border-bottom:2px solid var(--accent);padding-bottom:.8rem">
                  ${ESTADO_LABELS[est]} (${columnas[est].length})
                </div>
                <div style="display:flex;flex-direction:column;gap:1rem">
                  ${columnas[est].map(r => `
                    <div style="background:var(--surface2);border-radius:16px;padding:1.2rem;border-left:6px solid ${est === 'pendiente' ? 'var(--warning)' : est === 'en_progreso' ? 'var(--accent2)' : 'var(--accent)'}">
                      <div style="font-weight:700;font-size:1.2rem;margin-bottom:.4rem;color:var(--text)">${h(r.descripcion)}</div>
                      <div style="font-size:1rem;color:var(--text2);margin-bottom:.6rem">${r.vehiculos?.patente || ''} · ${r.clientes?.nombre || ''}</div>
                      <div style="font-size:.9rem;color:var(--accent2);display:flex;align-items:center;gap:.4rem">
                        <span>⏱️</span> Ingresó hace ${tiempoTranscurrido(r.created_at)}
                      </div>
                    </div>
                  `).join('')}
                  ${columnas[est].length === 0 ? '<div style="color:var(--text2);font-size:1.1rem;padding:1rem;text-align:center;opacity:.7">— Sin trabajos —</div>' : ''}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Botón salir -->
          <button onclick="salirModoTaller()" style="position:fixed;bottom:30px;right:30px;background:var(--surface2);border:1px solid var(--border);color:var(--text2);padding:.8rem 2rem;border-radius:40px;cursor:pointer;font-size:1.1rem;font-family:var(--font-head);font-weight:600;letter-spacing:1.5px;backdrop-filter:blur(8px);box-shadow:0 4px 12px rgba(0,0,0,.3);transition:all .2s" onmouseover="this.style.background='var(--danger)';this.style.color='#fff'" onmouseout="this.style.background='var(--surface2)';this.style.color='var(--text2)'">← SALIR</button>
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
