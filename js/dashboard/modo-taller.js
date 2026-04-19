// ─── MODO TALLER (Vista para TV sin botones de edición) ─────────────────────
let _modoTallerActivo = false;
let _modoTallerInterval = null;

async function activarModoTaller() {
  _modoTallerActivo = true;
  document.querySelector('.topbar').style.display = 'none';
  document.querySelector('.bottom-nav').style.display = 'none';
  document.getElementById('sidebar').style.display = 'none';
  
  await cargarVistaTaller();
  
  _modoTallerInterval = setInterval(cargarVistaTaller, 30000); // Refrescar cada 30 segundos
}

function desactivarModoTaller() {
  _modoTallerActivo = false;
  if (_modoTallerInterval) clearInterval(_modoTallerInterval);
  document.querySelector('.topbar').style.display = 'flex';
  document.querySelector('.bottom-nav').style.display = 'flex';
  document.getElementById('sidebar').style.display = 'block';
  navigate('dashboard');
}

async function cargarVistaTaller() {
  const hoy = fechaHoy();
  const [
    { data: repsActivas },
    { data: stockBajo },
    { data: vehiculosHoy }
  ] = await Promise.all([
    sb.from('reparaciones').select('*, vehiculos(patente,marca,modelo), clientes(nombre), reparacion_mecanicos(nombre_mecanico)')
      .eq('taller_id', tid()).in('estado', ['pendiente','en_progreso','esperando_repuestos']).order('created_at', {ascending: false}),
    sb.from('inventario').select('nombre,cantidad,stock_minimo').eq('taller_id', tid()).lte('cantidad', sb.raw('stock_minimo')),
    sb.from('reparaciones').select('id').eq('taller_id', tid()).eq('fecha', hoy)
  ]);

  const ahora = new Date();
  const hora = ahora.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
  const fecha = ahora.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' });

  // Calcular tiempo promedio en taller
  let tiempoPromedio = 0;
  const repsConIngreso = (repsActivas || []).filter(r => r.ficha_recepcion?.fecha_ingreso);
  if (repsConIngreso.length > 0) {
    const totalDias = repsConIngreso.reduce((s, r) => {
      const ingreso = new Date(r.ficha_recepcion.fecha_ingreso);
      const diff = Math.ceil((ahora - ingreso) / (1000 * 60 * 60 * 24));
      return s + diff;
    }, 0);
    tiempoPromedio = Math.round(totalDias / repsConIngreso.length);
  }

  const columnas = {
    pendiente: { titulo: 'PENDIENTES', color: 'var(--warning)', icon: '🟡', items: [] },
    en_progreso: { titulo: 'EN DESARROLLO', color: 'var(--accent2)', icon: '🔶', items: [] },
    esperando_repuestos: { titulo: 'ESPERANDO REPUESTOS', color: 'var(--accent)', icon: '🔵', items: [] }
  };

  (repsActivas || []).forEach(r => {
    if (columnas[r.estado]) columnas[r.estado].items.push(r);
  });

  const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';

  let html = `
    <div style="padding:1.5rem;min-height:100vh;background:var(--bg)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
        <div>
          <div style="font-family:var(--font-head);font-size:2.5rem;color:var(--accent);letter-spacing:4px">${h(tallerNombre)}</div>
          <div style="font-size:1rem;color:var(--text2);text-transform:capitalize">${fecha}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--font-head);font-size:3rem;color:var(--text)">${hora}</div>
          <div style="font-size:.9rem;color:var(--text2)">🚗 ${vehiculosHoy?.length || 0} vehículos hoy · ⏱️ ${tiempoPromedio} días promedio</div>
        </div>
      </div>

      ${stockBajo?.length > 0 ? `
      <div style="background:rgba(255,68,68,.15);border:2px solid var(--danger);border-radius:16px;padding:1rem;margin-bottom:1.5rem">
        <div style="font-size:1.2rem;color:var(--danger);font-family:var(--font-head);margin-bottom:.5rem">⚠️ STOCK BAJO</div>
        <div style="display:flex;gap:1rem;flex-wrap:wrap">
          ${stockBajo.map(i => `<span style="background:rgba(255,68,68,.2);padding:.3rem .8rem;border-radius:20px;font-size:.9rem">${h(i.nombre)}: ${i.cantidad}</span>`).join('')}
        </div>
      </div>
      ` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
        ${Object.values(columnas).map(col => `
          <div style="background:var(--surface);border:1px solid ${col.color};border-radius:16px;padding:1rem">
            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;font-family:var(--font-head);font-size:1.2rem;color:${col.color}">
              <span>${col.icon}</span> ${col.titulo} <span style="background:var(--surface2);padding:2px 10px;border-radius:20px;font-size:.8rem;margin-left:auto">${col.items.length}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:.5rem">
              ${col.items.length === 0 ? `<div style="color:var(--text2);padding:.5rem;text-align:center">Sin trabajos</div>` : 
                col.items.map(r => `
                  <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:.8rem">
                    <div style="font-weight:600;font-size:.95rem;margin-bottom:.3rem">${h(r.descripcion)}</div>
                    <div style="font-size:.75rem;color:var(--text2)">${r.vehiculos ? h(r.vehiculos.patente) + ' · ' + h(r.vehiculos.marca) : 'Sin vehículo'}</div>
                    <div style="font-size:.75rem;color:var(--text2)">${r.clientes ? '👤 ' + h(r.clientes.nombre) : ''}</div>
                    ${r.reparacion_mecanicos?.length ? `<div style="font-size:.7rem;color:var(--accent);margin-top:.3rem">🔧 ${r.reparacion_mecanicos.map(m => m.nombre_mecanico).join(', ')}</div>` : ''}
                    <div style="font-size:.7rem;color:var(--text2);margin-top:.3rem">📅 Ingresó: ${r.ficha_recepcion?.fecha_ingreso ? formatFecha(r.ficha_recepcion.fecha_ingreso.split('T')[0]) : r.fecha}</div>
                  </div>
                `).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div style="position:fixed;bottom:1rem;right:1rem">
        <button onclick="desactivarModoTaller()" style="background:var(--danger);color:#fff;border:none;border-radius:8px;padding:.5rem 1rem;font-size:.8rem;cursor:pointer">✕ Salir del modo taller</button>
      </div>
    </div>
  `;

  document.getElementById('main-content').innerHTML = html;
}

// Agregar botón en el menú de configuración (admin)
function getModoTallerButton() {
  if (currentPerfil?.rol !== 'admin') return '';
  return `<button onclick="activarModoTaller()" style="width:100%;margin-top:.5rem;background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.3);color:var(--accent);border-radius:8px;padding:.5rem;font-size:.75rem;cursor:pointer">📺 Activar Modo Taller (TV)</button>`;
}
