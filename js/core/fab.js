// ─── FLOATING ACTION BUTTON (FAB) Y HOJA DE ACCIONES RÁPIDAS ────────────────
// Botón "+" flotante visible en todas las pantallas de la app para admin
// (y empleados con permiso `registrar_cobros`). Abre una hoja con accesos
// directos a los flujos más comunes: cobrar reparación, nueva venta,
// servicio rápido, gasto, movimiento manual, cobrar fiado.
// Cada acceso dispara la función original (sin duplicar lógica).

let _fabReady = false;

function fab_render() {
  let fab = document.getElementById('global-fab');
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'global-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Acciones rápidas');
    fab.style.cssText = `
      position:fixed;right:18px;bottom:88px;z-index:120;
      width:56px;height:56px;border-radius:50%;
      background:linear-gradient(145deg,var(--accent),#0099b8);
      color:#000;border:none;cursor:pointer;
      box-shadow:0 6px 18px rgba(0,229,255,.35),0 2px 6px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;
      font-size:30px;line-height:1;font-weight:700;
      transition:transform .15s ease, box-shadow .15s ease;
    `;
    fab.innerHTML = '+';
    fab.onclick = fab_abrirHoja;
    fab.onmouseenter = () => { fab.style.transform = 'scale(1.06)'; };
    fab.onmouseleave = () => { fab.style.transform = 'scale(1)'; };
    document.body.appendChild(fab);
  }
  fab_actualizarVisibilidad();
  _fabReady = true;
}

function fab_puedeUsar() {
  if (typeof currentPerfil === 'undefined' || !currentPerfil) return false;
  if (typeof esAdmin === 'function' && esAdmin()) return true;
  if (typeof esEmpleado === 'function' && esEmpleado()
      && typeof tienePerm === 'function' && tienePerm('registrar_cobros')) return true;
  return false;
}

function fab_actualizarVisibilidad() {
  const fab = document.getElementById('global-fab');
  if (!fab) return;
  const loginVisible = document.getElementById('login-screen')?.style.display !== 'none';
  const appVisible = document.getElementById('app')?.style.display !== 'none';
  fab.style.display = (!loginVisible && appVisible && fab_puedeUsar()) ? 'flex' : 'none';
}

function fab_abrirHoja() {
  if (!fab_puedeUsar()) return;
  const isAdmin = typeof esAdmin === 'function' && esAdmin();

  const acciones = [];
  // Para todos los autorizados
  acciones.push({
    icon: '💰', titulo: 'Cobrar reparación',
    sub: 'Buscar por patente o descripción',
    color: 'var(--success)',
    onclick: 'fab_cobrarReparacion()'
  });
  acciones.push({
    icon: '🛒', titulo: 'Nueva venta',
    sub: 'Productos del inventario',
    color: 'var(--accent)',
    onclick: 'closeModal();modalNuevaVenta()'
  });

  if (isAdmin) {
    acciones.push({
      icon: '⚡', titulo: 'Servicio rápido',
      sub: 'Mano de obra + repuestos sueltos',
      color: 'var(--success)',
      onclick: 'closeModal();modalNuevoServicioRapido()'
    });
    acciones.push({
      icon: '📤', titulo: 'Nuevo gasto',
      sub: 'Egreso del taller (alquiler, repuestos, etc.)',
      color: 'var(--danger)',
      onclick: 'closeModal();modalNuevoGasto()'
    });
    acciones.push({
      icon: '↑', titulo: 'Ingreso manual',
      sub: 'Movimiento financiero suelto',
      color: 'var(--success)',
      onclick: "closeModal();finanzas_modalNuevo('ingreso')"
    });
    acciones.push({
      icon: '↓', titulo: 'Egreso manual',
      sub: 'Movimiento financiero suelto',
      color: 'var(--danger)',
      onclick: "closeModal();finanzas_modalNuevo('egreso')"
    });
    acciones.push({
      icon: '📋', titulo: 'Cobrar fiado',
      sub: 'Marcar un crédito como pagado',
      color: 'var(--warning)',
      onclick: "closeModal();navigate('creditos')"
    });
  }

  const items = acciones.map(a => `
    <button onclick="${a.onclick}" style="display:flex;align-items:center;gap:.75rem;width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:.7rem .8rem;cursor:pointer;text-align:left;color:var(--text);margin-bottom:.5rem;transition:background .15s" onmouseover="this.style.background='rgba(0,229,255,.06)'" onmouseout="this.style.background='var(--surface2)'">
      <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:${a.color};flex-shrink:0">${a.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--font-head);font-size:.92rem;color:var(--text)">${a.titulo}</div>
        <div style="font-size:.7rem;color:var(--text2);margin-top:1px">${a.sub}</div>
      </div>
      <div style="color:var(--text2);font-size:1rem;flex-shrink:0">→</div>
    </button>
  `).join('');

  openModal(`
    <div class="modal-title">⚡ Acciones rápidas</div>
    <div style="font-size:.75rem;color:var(--text2);margin-bottom:.75rem">Tocá una acción para abrirla.</div>
    ${items}
    <button class="btn-secondary" style="margin-top:.4rem" onclick="closeModal()">Cancelar</button>
  `);
}

// ─── ACCESO RÁPIDO: COBRAR REPARACIÓN DESDE FUERA DEL DETALLE ───────────────
async function fab_cobrarReparacion() {
  // Trae las últimas reparaciones con saldo pendiente del taller
  // y deja al usuario buscarlas por patente o descripción.
  closeModal();
  openModal(`
    <div class="modal-title">💰 Cobrar reparación</div>
    <div style="font-size:.78rem;color:var(--text2);margin-bottom:.6rem">Buscá por patente, cliente, descripción o nº de reparación.</div>
    <input class="form-input" id="fab-cobrar-search" placeholder="Patente, cliente, descripción o nº reparación..." autocomplete="off" oninput="fab_cobrarReparacion_filtrar(this.value)">
    <div id="fab-cobrar-list" style="margin-top:.75rem;max-height:50vh;overflow-y:auto">
      <div style="text-align:center;padding:1rem;color:var(--text2);font-size:.8rem">Cargando reparaciones...</div>
    </div>
    <button class="btn-secondary" style="margin-top:.5rem" onclick="closeModal()">Cancelar</button>
  `);

  try {
    // Ordenamos por fecha ascendente: las reparaciones más viejas con saldo
    // pendiente aparecen primero (es lo que el taller necesita cobrar antes).
    const { data } = await sb.from('reparaciones')
      .select('id,descripcion,costo,fecha,estado,vehiculos(patente,marca),clientes(nombre)')
      .eq('taller_id', tid())
      .neq('estado', 'cancelado')
      .gt('costo', 0)
      .order('fecha', { ascending: true })
      .limit(150);

    const reps = data || [];
    if (reps.length === 0) {
      document.getElementById('fab-cobrar-list').innerHTML =
        '<div class="empty"><p>No hay reparaciones para cobrar</p></div>';
      return;
    }

    // Trae los pagos y calcula saldo
    const ids = reps.map(r => r.id);
    const { data: pagosData } = await sb.from('pagos_reparacion')
      .select('reparacion_id,monto')
      .in('reparacion_id', ids);
    const pagosByRep = {};
    (pagosData || []).forEach(p => {
      pagosByRep[p.reparacion_id] = (pagosByRep[p.reparacion_id] || 0) + parseFloat(p.monto || 0);
    });

    window._fabRepsPendientes = reps.map(r => {
      const pagado = pagosByRep[r.id] || 0;
      const saldo = parseFloat(r.costo || 0) - pagado;
      return {
        id: r.id,
        idCorto: (r.id || '').replace(/-/g, '').slice(0, 8),
        patente: r.vehiculos?.patente || '',
        marca: r.vehiculos?.marca || '',
        cliente: r.clientes?.nombre || '',
        descripcion: r.descripcion || '',
        fecha: r.fecha || '',
        estado: r.estado || '',
        costo: parseFloat(r.costo || 0),
        pagado,
        saldo
      };
    });

    fab_cobrarReparacion_filtrar('');
  } catch (e) {
    document.getElementById('fab-cobrar-list').innerHTML =
      `<div class="empty"><p>Error: ${h(e.message || '')}</p></div>`;
  }
}

function fab_cobrarReparacion_filtrar(q) {
  const cont = document.getElementById('fab-cobrar-list');
  if (!cont) return;
  const reps = window._fabRepsPendientes || [];
  const term = (q || '').trim().toLowerCase();
  const conSaldo = reps.filter(r => r.saldo > 0);
  const termCompacto = term.replace(/[\s-]/g, '');
  const lista = (term
    ? conSaldo.filter(r =>
        (r.patente.toLowerCase().includes(term)) ||
        (r.cliente.toLowerCase().includes(term)) ||
        (r.descripcion.toLowerCase().includes(term)) ||
        (termCompacto && (r.idCorto || '').toLowerCase().includes(termCompacto)) ||
        (termCompacto && (r.id || '').toLowerCase().replace(/-/g, '').includes(termCompacto)))
    : conSaldo
  ).slice(0, 50);

  if (lista.length === 0) {
    cont.innerHTML = `<div class="empty"><p>${term ? 'Sin coincidencias' : 'No hay reparaciones con saldo pendiente'}</p></div>`;
    return;
  }

  // "Días sin cobrar" desde la fecha de la reparación: ayuda a priorizar las
  // deudas más antiguas en el panel del FAB.
  const hoy = new Date();
  cont.innerHTML = lista.map(r => {
    let diasTxt = '';
    if (r.fecha) {
      const f = new Date(r.fecha);
      const dias = Math.max(0, Math.floor((hoy - f) / 86400000));
      const color = dias >= 30 ? 'var(--danger)' : dias >= 7 ? 'var(--warning)' : 'var(--text2)';
      diasTxt = `<span style="color:${color};font-weight:600">⏱ ${dias}d sin cobrar</span>`;
    }
    return `
    <div onclick="fab_cobrarRep_seleccionar('${r.id}')" style="display:flex;align-items:center;gap:.6rem;padding:.55rem .65rem;background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-bottom:.4rem;cursor:pointer">
      <div style="width:36px;height:36px;border-radius:8px;background:rgba(0,229,255,.08);display:flex;align-items:center;justify-content:center;color:var(--accent);font-family:var(--font-head);font-size:.78rem;flex-shrink:0">${h((r.patente||'').slice(0,5)) || '—'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.85rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(r.descripcion || 'Reparación')}</div>
        <div style="font-size:.68rem;color:var(--text2)">#${r.idCorto} · ${h(r.cliente)} · ${h(r.marca)} ${r.fecha ? '· '+formatFecha(r.fecha) : ''}</div>
        ${diasTxt ? `<div style="font-size:.65rem;margin-top:2px">${diasTxt}</div>` : ''}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-family:var(--font-head);font-size:.85rem;color:${r.saldo > 0 ? 'var(--danger)' : 'var(--success)'}">${r.saldo > 0 ? 'Saldo ₲'+gs(r.saldo) : '✓ Pagado'}</div>
        <div style="font-size:.65rem;color:var(--text2)">de ₲${gs(r.costo)}</div>
      </div>
    </div>`;
  }).join('');
}

function fab_cobrarRep_seleccionar(id) {
  closeModal();
  setTimeout(() => modalPagosReparacion(id), 50);
}

window.fab_render = fab_render;
window.fab_actualizarVisibilidad = fab_actualizarVisibilidad;
window.fab_abrirHoja = fab_abrirHoja;
window.fab_puedeUsar = fab_puedeUsar;
window.fab_cobrarReparacion = fab_cobrarReparacion;
window.fab_cobrarReparacion_filtrar = fab_cobrarReparacion_filtrar;
window.fab_cobrarRep_seleccionar = fab_cobrarRep_seleccionar;

// Auto-init: cuando el script carga, intentamos renderizarlo. Si todavía
// no hay sesión, no se mostrará (fab_actualizarVisibilidad lo oculta).
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fab_render);
  } else {
    fab_render();
  }
}
