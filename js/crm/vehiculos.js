// ─── VEHICULOS ───────────────────────────────────────────────────────────────

async function vehiculos({ search='', offset=0 }={}) {
  const cacheKey = `vehiculos_${search}_${offset}`;
  const { data, count } = await cachedQuery(cacheKey, () => {
    let q = sb.from('vehiculos').select('*, clientes(nombre)', {count:'exact'}).eq('taller_id', tid()).order('patente');
    if (search) q = q.ilike('patente', `%${escapeLikePattern(search)}%`);
    return q.range(offset, offset + PAGE_SIZE - 1);
  });

  const canEdit = ['admin','empleado'].includes(currentPerfil?.rol);
  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('vehTitulo')} ${count ? `<span style="font-size:.75rem;color:var(--text2)">(${count})</span>` : ''}</div>
      ${canEdit ? `<div style="display:flex;gap:.4rem">
        <button class="btn-secondary" style="margin:0;padding:.5rem .7rem;font-size:.78rem" onclick="modalImportarExcel('vehiculos')" title="Importar desde Excel">📥 Importar</button>
        <button class="btn-add" onclick="modalNuevoVehiculo()">+ Nuevo</button>
      </div>` : ''}
    </div>
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="${t('dashBuscarPatente')}" value="${h(search)}" oninput="debounce('veh',()=>vehiculos({search:this.value}))" class="form-input" style="padding-left:2.5rem">
    </div>
    ${(count===0 && !search && canEdit && typeof bannerImportarVacio === 'function') ? bannerImportarVacio('vehiculos') : ''}
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('vehSinDatos')}</p></div>` :
      (data||[]).map(v => `
      <div class="card" onclick="detalleVehiculo('${v.id}')">
        <div class="card-header">
          <div class="card-avatar" style="font-size:.8rem;letter-spacing:1px">${h(v.patente)}</div>
          <div class="card-info">
            <div class="card-name">${h(v.marca)} ${h(v.modelo||'')}</div>
            <div class="card-sub">${h(v.anio||'')} · ${v.clientes?h(v.clientes.nombre):t('vehSinProp')}</div>
          </div>
          ${v.foto_url ? `<img src="${safeFotoUrl(v.foto_url)}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">` : ''}
        </div>
      </div>`).join('')}
    ${renderPagination(count||0, offset, '_navVeh')}`;
}
function _navVeh(o) { vehiculos({offset:o}); }

async function detalleVehiculo(id) {
  let v, reps, mants;
  try {
    const results = await Promise.all([
      sb.from('vehiculos').select('*, clientes(nombre,telefono)').eq('id',id).single(),
      sb.from('reparaciones').select('*').eq('vehiculo_id',id).order('created_at',{ascending:false}),
      sb.from('mantenimientos').select('*').eq('vehiculo_id',id).order('fecha_realizado',{ascending:false}).limit(10)
    ]);
    v = results[0].data; reps = results[1].data; mants = results[2].data;
  } catch(e) { toast('Error al cargar vehículo','error'); navigate('vehiculos'); return; }
  if (!v) { toast('Vehículo no encontrado','error'); navigate('vehiculos'); return; }
  const isAdmin = currentPerfil?.rol==='admin';
  const canEdit = ['admin','empleado'].includes(currentPerfil?.rol);
  const totalGastado = (reps||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
  // Para calcular la ganancia REAL hay que restar también lo pagado a los
  // mecánicos asignados a cada reparación (campo `pago` en
  // `reparacion_mecanicos`). Lo traemos en una sola query agrupado por
  // reparación y armamos un mapa repId -> total pagado.
  const repIds = (reps||[]).map(r => r.id);
  const pagoMecPorRep = {};
  if (repIds.length > 0) {
    const { data: rmecs } = await sb.from('reparacion_mecanicos').select('reparacion_id,pago').in('reparacion_id', repIds);
    (rmecs||[]).forEach(rm => {
      pagoMecPorRep[rm.reparacion_id] = (pagoMecPorRep[rm.reparacion_id] || 0) + parseFloat(rm.pago || 0);
    });
  }
  const gananciaDeRep = r => parseFloat(r.costo||0) - parseFloat(r.costo_repuestos||0) - (pagoMecPorRep[r.id] || 0);
  const totalGanancia = (reps||[]).reduce((s,r)=>s+gananciaDeRep(r),0);

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('vehiculos')">${t('volver')}</button>
      ${v.foto_url ? `<img src="${safeFotoUrl(v.foto_url)}" style="width:56px;height:56px;object-fit:cover;border-radius:12px;border:2px solid var(--accent)">` : `<div class="detail-avatar" style="font-size:.9rem">${h(v.patente)}</div>`}
      <div><div class="detail-name">${h(v.marca)} ${h(v.modelo||'')}</div><div class="detail-sub">${h(v.anio||'')}</div></div>
    </div>
    ${v.foto_url ? `<img src="${safeFotoUrl(v.foto_url)}" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;margin-bottom:1rem;border:1px solid var(--border)">` : ''}
    <div class="info-grid">
      <div class="info-item"><div class="label">Patente</div><div class="value">${h(v.patente)}</div></div>
      <div class="info-item"><div class="label">Marca</div><div class="value">${h(v.marca||'-')}</div></div>
      <div class="info-item"><div class="label">Modelo</div><div class="value">${h(v.modelo||'-')}</div></div>
      <div class="info-item"><div class="label">Año</div><div class="value">${h(v.anio||'-')}</div></div>
      <div class="info-item"><div class="label">Propietario</div><div class="value">${v.clientes?h(v.clientes.nombre):t('vehSinProp')}</div></div>
      <div class="info-item"><div class="label">Total facturado</div><div class="value" style="color:var(--accent)">₲${gs(totalGastado)}</div></div>
    </div>
    ${canEdit ? `<div style="display:flex;gap:.5rem;margin-bottom:1rem">
      <button class="btn-secondary" style="margin:0" onclick="modalEditarVehiculo('${id}')">${t('editarBtn')}</button>
      ${isAdmin ? `<button class="btn-danger" style="margin:0" onclick="eliminarVehiculo('${id}')">${t('eliminarBtn')}</button>` : ''}
    </div>` : ''}

    <div class="sub-section">
      <div class="sub-section-title">📋 HISTORIAL COMPLETO (${(reps||[]).length + (mants||[]).length})</div>
      ${(reps||[]).length===0 && (mants||[]).length===0 ? '<p style="color:var(--text2);font-size:.85rem">Sin historial</p>' : ''}
      ${(reps||[]).map(r => { const tieneCostos = parseFloat(r.costo_repuestos||0) > 0 || (pagoMecPorRep[r.id] || 0) > 0; return `<div class="card" style="margin-bottom:.5rem" onclick="detalleReparacion('${r.id}')"><div class="card-header"><div class="card-avatar">🔧</div><div class="card-info"><div class="card-name">${h(r.descripcion)}</div><div class="card-sub">₲${gs(r.costo)}${tieneCostos?' · Ganancia: ₲'+gs(gananciaDeRep(r)):''} · ${formatFecha(r.fecha)}</div></div><span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span></div></div>`; }).join('')}
      ${(mants||[]).map(m => `<div class="card" style="margin-bottom:.5rem"><div class="card-header"><div class="card-avatar">🛡️</div><div class="card-info"><div class="card-name">${h(m.tipo||'Mantenimiento')}</div><div class="card-sub">${m.kilometraje?m.kilometraje+' km · ':''}${m.fecha_realizado?formatFecha(m.fecha_realizado):''}</div></div><span class="card-badge badge-blue">Preventivo</span></div></div>`).join('')}
    </div>`;
}

async function modalNuevoVehiculo() {
  const clienteSelect = await renderClienteSelect('f-cliente', null, true);
  
  openModal(`
    <div class="modal-title">${t("modNuevoVehiculo")}</div>
    <div class="form-group"><label class="form-label">Patente *</label><input class="form-input" id="f-patente" placeholder="ABC 123" style="text-transform:uppercase"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t("lblMarca")}</label><input class="form-input" id="f-marca" placeholder="Toyota"></div>
      <div class="form-group"><label class="form-label">${t("lblModelo")}</label><input class="form-input" id="f-modelo" placeholder="Corolla"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t("lblAnio")}</label><input class="form-input" id="f-anio" type="number" placeholder="2020"></div>
      <div class="form-group"><label class="form-label">${t("lblColor")}</label><input class="form-input" id="f-color" placeholder="Blanco"></div>
    </div>
    <div class="form-group"><label class="form-label">${t("lblPropietario")}</label>${clienteSelect}</div>
    <div class="form-group">
      <label class="form-label">${t("lblFotoVeh")}</label>
      <input type="file" id="f-foto-file" accept="image/*" capture="environment" class="form-input" style="padding:.4rem" onchange="previewFoto(this,'f-foto-b64','foto-prev')">
      <div id="foto-prev" style="margin-top:.5rem"></div>
      <input type="hidden" id="f-foto-b64">
    </div>
    <button class="btn-primary" onclick="guardarVehiculoConSafeCall()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarVehiculoConSafeCall() {
  await safeCall(async () => {
    await guardarVehiculo();
  }, null, 'No se pudo guardar el vehículo');
}

async function uploadFoto(vehiculoId) {
  if (!_pendingFotoFile) return null;
  const filePath = `${tid()}/${vehiculoId}_${Date.now()}.jpg`;
  const { data, error } = await sb.storage.from('vehiculos').upload(filePath, _pendingFotoFile, {
    contentType: 'image/jpeg',
    upsert: true
  });
  if (error) { console.error('Upload error:', error); toast('Error al subir foto','error'); return null; }
  const { data: urlData } = sb.storage.from('vehiculos').getPublicUrl(filePath);
  _pendingFotoFile = null;
  return urlData.publicUrl;
}

async function guardarVehiculo(id=null) {
  const patenteRaw = document.getElementById('f-patente').value.trim();
  const patente = normalizarPatente(patenteRaw);
  if (!validateRequired(patente, 'Patente')) return;

  const cid = document.getElementById('f-cliente').value;

  const existente = await buscarVehiculoExistente(tid(), patente, id);
  if (existente) {
    const propietario = existente.clientes?.nombre ? h(existente.clientes.nombre) : 'sin propietario';
    const eleccion = await confirmarDuplicado({
      titulo: 'Ya existe esa patente',
      mensajeHtml: `La patente <b>${h(existente.patente)}</b> ya está registrada (${h(existente.marca||'')} ${h(existente.modelo||'')}) a nombre de <b>${propietario}</b>.<br><br>¿Querés usar ese vehículo o crear otro igual?`
    });
    if (eleccion === 'cancelar') return;
    if (eleccion === 'usar') {
      toast('Usando vehículo existente: ' + existente.patente, 'success');
      closeModal();
      if (typeof detalleVehiculo === 'function') detalleVehiculo(existente.id);
      else vehiculos();
      return;
    }
    // 'crear' continúa
  }

  const vehiculoId = id || crypto.randomUUID();
  let fotoUrl = document.getElementById('f-foto-b64')?.value || null;
  if (_pendingFotoFile) {
    toast('Subiendo foto...','info');
    const url = await uploadFoto(vehiculoId);
    if (url) fotoUrl = url;
  }

  const data = {
    patente,
    marca: document.getElementById('f-marca').value,
    modelo: document.getElementById('f-modelo').value,
    anio: parseInt(document.getElementById('f-anio').value)||null,
    color: document.getElementById('f-color')?.value||null,
    cliente_id: cid||null,
    taller_id: tid(),
    foto_url: fotoUrl||null
  };
  if (!id) data.id = vehiculoId;
  
  const { error } = id ? await offlineUpdate('vehiculos', data, 'id', id) : await offlineInsert('vehiculos', data);
  if (error) { toast('Error: '+error.message,'error'); return; }
  
  toast('Vehículo guardado','success');
  invalidateComponentCache();
  closeModal(); 
  vehiculos();
}

async function modalEditarVehiculo(id) {
  const [{ data:v }] = await Promise.all([sb.from('vehiculos').select('*').eq('id',id).single()]);
  const clienteSelect = await renderClienteSelect('f-cliente', v.cliente_id, true);
  
  openModal(`
    <div class="modal-title">${t("modEditarVehiculo")}</div>
    <div class="form-group"><label class="form-label">Patente *</label><input class="form-input" id="f-patente" value="${h(v.patente||'')}" style="text-transform:uppercase"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t("lblMarca")}</label><input class="form-input" id="f-marca" value="${h(v.marca||'')}"></div>
      <div class="form-group"><label class="form-label">${t("lblModelo")}</label><input class="form-input" id="f-modelo" value="${h(v.modelo||'')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t("lblAnio")}</label><input class="form-input" id="f-anio" type="number" value="${h(v.anio||'')}"></div>
      <div class="form-group"><label class="form-label">${t("lblColor")}</label><input class="form-input" id="f-color" value="${h(v.color||'')}"></div>
    </div>
    <div class="form-group"><label class="form-label">${t("lblPropietario")}</label>${clienteSelect}</div>
    <div class="form-group">
      <label class="form-label">${t("lblNuevaFoto")}</label>
      <input type="file" id="f-foto-file" accept="image/*" capture="environment" class="form-input" style="padding:.4rem" onchange="previewFoto(this,'f-foto-b64','foto-prev')">
      <div id="foto-prev">${v.foto_url?`<img src="${safeFotoUrl(v.foto_url)}" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-top:.5rem">`:''}</div>
      <input type="hidden" id="f-foto-b64" value="${h(v.foto_url||'')}">
    </div>
    <button class="btn-primary" onclick="guardarVehiculoConSafeCall('${id}')">${t('actualizar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function eliminarVehiculo(id) {
  const { count: repCount } = await sb.from('reparaciones').select('*', {count:'exact', head:true}).eq('vehiculo_id', id);
  let mensaje = 'Esta acción eliminará el vehículo permanentemente.';
  if (repCount > 0) mensaje += `\n\n⚠️ ATENCIÓN: Se eliminarán ${repCount} trabajo(s) del historial.`;
  
  confirmar(mensaje, async () => {
    await safeCall(async () => {
      try {
        const { data: veh } = await sb.from('vehiculos').select('foto_url').eq('id',id).single();
        if (veh?.foto_url && veh.foto_url.includes('/storage/')) {
          const path = veh.foto_url.split('/vehiculos/').pop();
          if (path) await sb.storage.from('vehiculos').remove([path]);
        }
      } catch(e) { }
      
      await offlineDelete('vehiculos', 'id', id);
      clearCache('vehiculos');
      invalidateComponentCache();
      toast('Vehículo eliminado');
      navigate('vehiculos');
    }, null, 'No se pudo eliminar el vehículo');
  });
}
