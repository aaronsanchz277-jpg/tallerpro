// ─── COMMAND PALETTE / BUSCADOR GLOBAL ──────────────────────────────────────
// Buscador unificado: clientes, vehículos, reparaciones (recientes/saldo) e
// inventario. Atajo "/" en escritorio, botón 🔍 agregado al bottom-nav en
// móvil (ver navigation.js). Filtra mientras se escribe sin pegarle a la red
// más de una vez por apertura: precarga listas livianas con limit razonable.

let _paletteData = null;   // Cache por apertura (no persistente entre sesiones)
let _paletteLoaded = false;

function palette_puedeUsar() {
  if (typeof currentPerfil === 'undefined' || !currentPerfil) return false;
  // Solo equipo del taller (admin/empleado). El cliente no necesita el palette.
  return currentPerfil.rol === 'admin' || currentPerfil.rol === 'empleado';
}

async function palette_open() {
  if (!palette_puedeUsar()) return;
  closeModal();
  openModal(`
    <div class="modal-title" style="display:flex;align-items:center;gap:.5rem">
      🔍 <span>Buscador global</span>
    </div>
    <div style="font-size:.72rem;color:var(--text2);margin-bottom:.5rem">Buscá clientes, vehículos, trabajos o repuestos. Atajo: <kbd style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:1px 5px;font-size:.7rem">/</kbd></div>
    <input id="palette-input" class="form-input" placeholder="Patente, nombre, descripción, repuesto..." autocomplete="off"
      oninput="palette_render(this.value)" onkeydown="palette_keys(event)">
    <div id="palette-results" style="margin-top:.6rem;max-height:55vh;overflow-y:auto">
      <div style="text-align:center;padding:1rem;color:var(--text2);font-size:.8rem">Cargando…</div>
    </div>
    <button class="btn-secondary" style="margin-top:.5rem" onclick="closeModal()">Cerrar</button>
  `);
  setTimeout(() => {
    const inp = document.getElementById('palette-input');
    if (inp) inp.focus();
  }, 60);

  await palette_cargar();
  palette_render('');
}

async function palette_cargar() {
  // Evitamos recargar si ya tenemos data fresca de hace <60s
  if (_paletteLoaded && _paletteData && (Date.now() - _paletteData._ts) < 60000) return;
  _paletteLoaded = false;
  try {
    const tallerId = tid();
    const [cliRes, vehRes, repRes, invRes] = await Promise.all([
      sb.from('clientes').select('id,nombre,telefono,ruc').eq('taller_id', tallerId).order('nombre').limit(500),
      sb.from('vehiculos').select('id,patente,marca,modelo,clientes(nombre)').eq('taller_id', tallerId).order('patente').limit(500),
      sb.from('reparaciones').select('id,descripcion,fecha,estado,vehiculos(patente,marca),clientes(nombre)').eq('taller_id', tallerId).order('created_at', { ascending: false }).limit(50),
      sb.from('inventario').select('id,nombre,codigo,zona,cantidad').eq('taller_id', tallerId).order('nombre').limit(500),
    ]);
    _paletteData = {
      _ts: Date.now(),
      clientes: cliRes.data || [],
      vehiculos: vehRes.data || [],
      reparaciones: repRes.data || [],
      inventario: invRes.data || []
    };
    _paletteLoaded = true;
  } catch (e) {
    _paletteData = { _ts: Date.now(), clientes: [], vehiculos: [], reparaciones: [], inventario: [] };
    _paletteLoaded = true;
  }
}

function palette_render(q) {
  const cont = document.getElementById('palette-results');
  if (!cont || !_paletteData) return;
  const term = (q || '').trim().toLowerCase();

  // Si no hay término, mostramos "Recientes" (clientes + reparaciones tocadas).
  if (!term) {
    const recCli = (typeof getRecientes === 'function' ? getRecientes('clientes', 5) : []) || [];
    const recRep = (typeof getRecientes === 'function' ? getRecientes('reparaciones', 5) : []) || [];
    if (recCli.length === 0 && recRep.length === 0) {
      cont.innerHTML = `<div class="empty" style="padding:1rem"><p style="font-size:.85rem">Empezá a tipear para buscar.</p></div>`;
      return;
    }
    let html = '';
    if (recCli.length) {
      html += `<div style="font-family:var(--font-head);font-size:.65rem;color:var(--text2);letter-spacing:1.5px;margin:.4rem 0 .3rem">CLIENTES RECIENTES</div>`;
      html += recCli.map(c => palette_row({
        icon: '👤', titulo: c.nombre, sub: c.telefono || '',
        onclick: `palette_go('clientes','${hjs(c.id)}')`
      })).join('');
    }
    if (recRep.length) {
      html += `<div style="font-family:var(--font-head);font-size:.65rem;color:var(--text2);letter-spacing:1.5px;margin:.6rem 0 .3rem">TRABAJOS RECIENTES</div>`;
      html += recRep.map(r => palette_row({
        icon: '🔧', titulo: r.descripcion || 'Trabajo', sub: r.patente || '',
        onclick: `palette_go('reparaciones','${hjs(r.id)}')`
      })).join('');
    }
    cont.innerHTML = html;
    return;
  }

  const compact = term.replace(/[\s-]/g, '');
  const matches = (s) => (s || '').toLowerCase().includes(term);
  const matchCompact = (s) => compact && (s || '').toLowerCase().replace(/[\s-]/g, '').includes(compact);

  const cli = (_paletteData.clientes || []).filter(c =>
    matches(c.nombre) || matches(c.telefono) || matches(c.ruc)).slice(0, 10);
  const veh = (_paletteData.vehiculos || []).filter(v =>
    matchCompact(v.patente) || matches(v.marca) || matches(v.modelo) || matches(v.clientes?.nombre)).slice(0, 10);
  const reps = (_paletteData.reparaciones || []).filter(r =>
    matches(r.descripcion) || matchCompact(r.vehiculos?.patente) || matches(r.clientes?.nombre)).slice(0, 10);
  const inv = (_paletteData.inventario || []).filter(i =>
    matches(i.nombre) || matches(i.codigo) || matches(i.zona)).slice(0, 10);

  if (!cli.length && !veh.length && !reps.length && !inv.length) {
    cont.innerHTML = `<div class="empty" style="padding:1rem"><p style="font-size:.85rem">Sin coincidencias para "${h(q)}"</p></div>`;
    return;
  }

  const sect = (titulo, arr, render) => arr.length ? `
    <div style="font-family:var(--font-head);font-size:.65rem;color:var(--text2);letter-spacing:1.5px;margin:.5rem 0 .3rem">${titulo}</div>
    ${arr.map(render).join('')}` : '';

  // El highlight (highlightMatch) ya hace match literal y compacto (ignora
  // `-` y espacios), así que pasamos el término tal cual y también resalta
  // patentes formateadas como AB-123 cuando el usuario tipeó "ab123".
  cont.innerHTML =
    sect('CLIENTES', cli, c => palette_row({
      icon: '👤', titulo: c.nombre, sub: [c.telefono, c.ruc].filter(Boolean).join(' · '),
      onclick: `palette_go('clientes','${hjs(c.id)}')`, term
    })) +
    sect('VEHÍCULOS', veh, v => palette_row({
      icon: '🚗', titulo: `${v.patente || ''}${v.marca ? ' · ' + v.marca : ''}${v.modelo ? ' ' + v.modelo : ''}`,
      sub: v.clientes?.nombre || '',
      onclick: `palette_go('vehiculos','${hjs(v.id)}')`, term
    })) +
    sect('TRABAJOS', reps, r => palette_row({
      icon: '🔧', titulo: r.descripcion || 'Trabajo',
      sub: `${r.vehiculos?.patente || ''}${r.clientes ? ' · ' + r.clientes.nombre : ''}${r.fecha ? ' · ' + formatFecha(r.fecha) : ''}`,
      onclick: `palette_go('reparaciones','${hjs(r.id)}')`, term
    })) +
    sect('REPUESTOS', inv, i => palette_row({
      icon: '📦', titulo: i.nombre,
      sub: `${i.codigo ? '#' + i.codigo + ' · ' : ''}${i.zona ? '📍 ' + i.zona + ' · ' : ''}${(i.cantidad ?? 0)} en stock`,
      onclick: `palette_go('inventario','${hjs(i.id)}')`, term
    }));
}

function palette_row({ icon, titulo, sub, onclick, term }) {
  // Si hay término, resaltamos las coincidencias (escapado seguro adentro).
  const tituloHtml = term ? hh(titulo, term) : h(titulo);
  const subHtml = sub ? (term ? hh(sub, term) : h(sub)) : '';
  return `<div class="palette-item" onclick="${onclick}" style="display:flex;gap:.6rem;align-items:center;padding:.55rem .65rem;background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-bottom:.35rem;cursor:pointer">
    <div style="width:32px;height:32px;border-radius:8px;background:rgba(0,229,255,.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:.85rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tituloHtml}</div>
      ${sub ? `<div style="font-size:.7rem;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${subHtml}</div>` : ''}
    </div>
    <div style="color:var(--text2);font-size:1rem;flex-shrink:0">→</div>
  </div>`;
}

function palette_go(tipo, id) {
  closeModal();
  setTimeout(() => {
    if (tipo === 'clientes' && typeof detalleCliente === 'function') return detalleCliente(id);
    if (tipo === 'vehiculos' && typeof detalleVehiculo === 'function') return detalleVehiculo(id);
    if (tipo === 'reparaciones' && typeof detalleReparacion === 'function') return detalleReparacion(id);
    if (tipo === 'inventario' && typeof navigate === 'function') return navigate('inventario');
  }, 50);
}

function palette_keys(ev) {
  if (ev.key === 'Escape') { closeModal(); }
  if (ev.key === 'Enter') {
    const cont = document.getElementById('palette-results');
    if (!cont) return;
    const first = cont.querySelector('.palette-item');
    if (first) { first.click(); ev.preventDefault(); }
  }
}

// Atajo "/" para abrir el palette desde cualquier parte de la app.
// Ignoramos cuando el foco está en un input/textarea o cuando hay otro modal.
document.addEventListener('keydown', (ev) => {
  if (ev.key !== '/') return;
  const tag = (ev.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || ev.target?.isContentEditable) return;
  if (document.getElementById('modal-overlay')) return;
  if (!palette_puedeUsar()) return;
  ev.preventDefault();
  palette_open();
});

window.palette_open = palette_open;
window.palette_render = palette_render;
window.palette_go = palette_go;
window.palette_keys = palette_keys;
window.palette_puedeUsar = palette_puedeUsar;
