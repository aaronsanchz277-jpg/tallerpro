// ─── CLIENTES ────────────────────────────────────────────────────────────────

async function clientes({ search='', offset=0 }={}) {
  const cacheKey = `clientes_${search}_${offset}`;
  const { data, count } = await cachedQuery(cacheKey, () => {
    let q = sb.from('clientes').select('*', {count:'exact'}).eq('taller_id', tid()).order('nombre');
    if (search) q = q.ilike('nombre', `%${escapeLikePattern(search)}%`);
    return q.range(offset, offset + PAGE_SIZE - 1);
  });
  const canEdit = ['admin','empleado'].includes(currentPerfil?.rol);

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('cliTitulo')} ${count ? `<span style="font-size:.75rem;color:var(--text2)">(${count})</span>` : ''}</div>
      ${canEdit ? `<div style="display:flex;gap:.4rem">
        <button class="btn-secondary" style="margin:0;padding:.5rem .7rem;font-size:.78rem" onclick="modalImportarExcel('clientes')" title="Importar desde Excel">📥 Importar</button>
        <button class="btn-add" onclick="modalNuevoCliente()">${t('cliNuevo')}</button>
      </div>` : ''}
    </div>
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="${t('cliBuscar')}" value="${h(search)}" oninput="debounce('cli',()=>clientes({search:this.value}))" class="form-input" style="padding-left:2.5rem">
    </div>
    ${(count===0 && !search && canEdit && typeof bannerImportarVacio === 'function') ? bannerImportarVacio('clientes') : ''}
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('cliSinDatos')}</p></div>` :
      (data||[]).map(c => `
      <div class="card" onclick="detalleCliente('${c.id}')">
        <div class="card-header">
          <div class="card-avatar">${h(c.nombre).charAt(0).toUpperCase()}</div>
          <div class="card-info"><div class="card-name">${h(c.nombre)}</div><div class="card-sub">${h(c.telefono)||t('cliSinTel')}</div></div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text2)"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>`).join('')}
    ${renderPagination(count||0, offset, '_navClientes')}`;
}
function _navClientes(o) { clientes({offset:o}); }

async function detalleCliente(id) {
  let c, veh, reps, creditos, citas, mants;
  try {
    const results = await Promise.all([
      sb.from('clientes').select('*').eq('id',id).single(),
      sb.from('vehiculos').select('*').eq('cliente_id',id),
      sb.from('reparaciones').select('*').eq('cliente_id',id).order('created_at',{ascending:false}).limit(5),
      sb.from('fiados').select('*').eq('cliente_id',id).eq('pagado',false),
      sb.from('citas').select('fecha,hora,descripcion,estado').eq('cliente_id',id).gte('fecha',new Date().toISOString().split('T')[0]).order('fecha').limit(3),
      sb.from('mantenimientos').select('tipo,fecha_proxima,vehiculos(patente)').eq('taller_id',tid()).limit(50)
    ]);
    c = results[0].data; veh = results[1].data; reps = results[2].data; creditos = results[3].data; citas = results[4].data; mants = results[5].data;
  } catch(e) { toast('Error al cargar cliente','error'); navigate('clientes'); return; }
  if (!c) { toast('Cliente no encontrado','error'); navigate('clientes'); return; }

  // Lo guardamos en "recientes" (localStorage) para que aparezca en el dashboard
  // y en el buscador global sin volver a pegar a la red.
  if (typeof recordReciente === 'function') {
    recordReciente('clientes', { id: c.id, nombre: c.nombre, telefono: c.telefono });
  }

  const totalCrédito = (creditos||[]).reduce((s,f) => s+parseFloat(f.monto||0),0);
  const isAdmin = currentPerfil?.rol === 'admin';
  const canEdit = ['admin','empleado'].includes(currentPerfil?.rol);
  const vehIds = (veh||[]).map(v=>v.id);
  const mantsCli = (mants||[]).filter(m => vehIds.includes(m.vehiculo_id));

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('clientes')">${t('volver')}</button>
      <div class="detail-avatar">${h(c.nombre).charAt(0).toUpperCase()}</div>
      <div><div class="detail-name">${h(c.nombre)}</div><div class="detail-sub">${h(c.telefono||'')}</div></div>
    </div>
    <div class="info-grid">
      <div class="info-item"><div class="label">${t('cliTel')}</div><div class="value">${h(c.telefono||'-')}</div></div>
      <div class="info-item"><div class="label">${t('cliEmail')}</div><div class="value">${h(c.email||'-')}</div></div>
      <div class="info-item"><div class="label">${t('cliVehiculos')}</div><div class="value">${(veh||[]).length}</div></div>
      <div class="info-item"><div class="label">${t('cliFiadoPend')}</div><div class="value" style="color:${totalCrédito>0?'var(--danger)':'var(--success)'}">₲${gs(totalCrédito)}</div></div>
    </div>

    ${(citas||[]).length > 0 || totalCrédito > 0 ? `<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem">
      ${(citas||[]).map(ci => `<div style="background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);border-radius:8px;padding:.4rem .6rem;font-size:.72rem;color:var(--accent)">📅 ${formatFecha(ci.fecha)}${ci.hora?' '+ci.hora.slice(0,5):''} — ${h(ci.descripcion||'Turno')}</div>`).join('')}
      ${totalCrédito > 0 ? `<div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.2);border-radius:8px;padding:.4rem .6rem;font-size:.72rem;color:var(--danger)">⚠ Debe ₲${gs(totalCrédito)}</div>` : ''}
    </div>` : ''}

    ${canEdit ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.4rem;margin-bottom:.6rem">
      <button class="btn-secondary" style="margin:0" onclick="modalNuevaReparacionSimple({cliente_id:'${hjs(id)}'})">🔧 Nuevo trabajo</button>
      <button class="btn-secondary" style="margin:0" onclick="quickAgendarCita('${hjs(id)}')">📅 Agendar turno</button>
      ${totalCrédito > 0 ? `<button class="btn-secondary" style="margin:0;color:var(--warning);border-color:rgba(255,193,7,.4)" onclick="navigate('creditos')">💰 Cobrar fiado</button>` : ''}
    </div>
    <div style="display:flex;gap:.5rem;margin-bottom:1rem">
      <button class="btn-secondary" style="margin:0" onclick="modalEditarCliente('${id}')">${t('editarBtn')}</button>
      ${isAdmin ? `<button class="btn-danger" style="margin:0" onclick="eliminarCliente('${id}')">${t('eliminarBtn')}</button>` : ''}
      ${c.telefono ? `<button onclick="window.open('https://wa.me/595${c.telefono.replace(/\D/g,'')}')" style="flex:1;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.5rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer">💬 WhatsApp</button>` : ''}
    </div>` : c.telefono ? `<button onclick="window.open('https://wa.me/595${c.telefono.replace(/\D/g,'')}')" style="width:100%;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.9rem;cursor:pointer;margin-bottom:1rem">💬 WhatsApp</button>` : ''}
    
    <div class="sub-section">
      <div class="sub-section-title">${t('cliVehiculos2')}</div>
      ${(veh||[]).length===0 ? '<p style="color:var(--text2);font-size:.85rem">Sin vehículos</p>' :
        (veh||[]).map(v => `<div class="card" style="margin-bottom:.5rem" onclick="detalleVehiculo('${v.id}')"><div class="card-header"><div class="card-avatar" style="font-size:.8rem">${h(v.patente)}</div><div class="card-info"><div class="card-name">${h(v.marca)} ${h(v.modelo||'')}</div><div class="card-sub">${h(v.anio||'')}</div></div></div></div>`).join('')}
    </div>
    <div class="sub-section">
      <div class="sub-section-title">${t('cliUltReps')}</div>
      ${(reps||[]).length===0 ? '<p style="color:var(--text2);font-size:.85rem">Sin trabajos</p>' :
        (reps||[]).map(r => `<div class="card" style="margin-bottom:.5rem" onclick="detalleReparacion('${r.id}')"><div class="card-header"><div class="card-info"><div class="card-name">${h(r.descripcion)}</div><div class="card-sub">₲${gs(r.costo)} · ${formatFecha(r.fecha)}</div></div><span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span></div></div>`).join('')}
    </div>`;
}

function modalNuevoCliente() {
  openModal(`
    <div class="modal-title">${t("modNuevoCliente")}</div>
    <div class="form-group"><label class="form-label">Nombre *</label><input class="form-input" id="f-nombre" placeholder="Juan Pérez"></div>
    <div class="form-group"><label class="form-label">RUC / CI</label><input class="form-input" id="f-ruc" placeholder="80012345-6"></div>
    <div class="form-group"><label class="form-label">Teléfono</label>${phoneInput('f-tel','','0981 123 456')}</div>
    <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="f-email" type="email"></div>
    <button class="btn-primary" onclick="guardarCliente()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarCliente(id=null) {
  await safeCall(async () => {
    const nombre = document.getElementById('f-nombre').value.trim();
    if (!validateRequired(nombre, 'Nombre')) return;

    const ruc = document.getElementById('f-ruc')?.value || null;
    const telefono = document.getElementById('f-tel').value;
    const data = {
      nombre,
      ruc: ruc,
      telefono,
      email: document.getElementById('f-email').value,
      taller_id: tid()
    };

    // Anti-duplicados: solo en alta nueva, por teléfono normalizado o RUC.
    if (!id) {
      const existente = await buscarClienteExistente(tid(), { telefono, ruc });
      if (existente) {
        const motivo = (ruc && existente.ruc && String(existente.ruc).trim() === String(ruc).trim())
          ? `mismo RUC/CI <b>${h(String(ruc).trim())}</b>`
          : `mismo teléfono <b>${h(existente.telefono || telefono)}</b>`;
        const eleccion = await confirmarDuplicado({
          titulo: 'Ya existe un cliente parecido',
          mensajeHtml: `Encontramos a <b>${h(existente.nombre)}</b> con ${motivo}.<br><br>¿Querés usar ese cliente o crear uno nuevo igual?`
        });
        if (eleccion === 'cancelar') return;
        if (eleccion === 'usar') {
          toast('Usando cliente existente: ' + existente.nombre, 'success');
          closeModal();
          if (typeof detalleCliente === 'function') detalleCliente(existente.id);
          else clientes();
          return;
        }
        // 'crear' continúa
      }
    }

    const { error } = id ? await offlineUpdate('clientes', data, 'id', id) : await offlineInsert('clientes', data);
    if (error) { toast('Error: '+error.message,'error'); return; }

    clearCache('clientes');
    invalidateComponentCache();
    toast(id ? 'Cliente actualizado' : 'Cliente guardado', 'success');
    closeModal();
    clientes();
  }, 'btn-primary', 'No se pudo guardar el cliente');
}

async function modalEditarCliente(id) {
  const { data:c } = await sb.from('clientes').select('*').eq('id',id).single();
  openModal(`
    <div class="modal-title">${t("modEditarCliente")}</div>
    <div class="form-group"><label class="form-label">Nombre *</label><input class="form-input" id="f-nombre" value="${h(c.nombre||'')}"></div>
    <div class="form-group"><label class="form-label">RUC / CI</label><input class="form-input" id="f-ruc" value="${h(c.ruc||'')}" placeholder="80012345-6"></div>
    <div class="form-group"><label class="form-label">Teléfono</label>${phoneInput('f-tel',c.telefono,'0981 123 456')}</div>
    <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="f-email" value="${h(c.email||'')}"></div>
    <button class="btn-primary" onclick="guardarCliente('${id}')">${t('actualizar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function eliminarCliente(id) {
  // Verificar dependencias
  const [{ count: vehCount }, { count: repCount }] = await Promise.all([
    sb.from('vehiculos').select('*', {count:'exact', head:true}).eq('cliente_id', id),
    sb.from('reparaciones').select('*', {count:'exact', head:true}).eq('cliente_id', id)
  ]);
  
  let mensaje = 'Esta acción eliminará el cliente permanentemente.';
  if (vehCount > 0) mensaje += `\n\n⚠️ ATENCIÓN: Se eliminarán ${vehCount} vehículo(s) asociado(s).`;
  if (repCount > 0) mensaje += `\n\n⚠️ También se eliminarán ${repCount} trabajo(s) del historial.`;
  
  confirmar(mensaje, async () => {
    await safeCall(async () => {
      // Eliminar vehículos asociados (opcional, según tu lógica de negocio)
      if (vehCount > 0) {
        await sb.from('vehiculos').delete().eq('cliente_id', id);
      }
      await offlineDelete('clientes', 'id', id);
      clearCache('clientes');
      clearCache('vehiculos');
      invalidateComponentCache();
      toast('Cliente eliminado');
      navigate('clientes');
    }, null, 'No se pudo eliminar el cliente');
  });
}
