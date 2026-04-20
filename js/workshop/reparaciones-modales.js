// ─── MODALES DE NUEVA/EDITAR REPARACIÓN ─────────────────────────────────────
import { TIPOS_TRABAJO, TIPO_ICONS } from './reparaciones-core.js';

export async function modalNuevaReparacion() {
  const clienteSelect = await renderClienteSelect('f-cliente', null, true);
  const vehiculoSelect = await renderVehiculoSelect('f-vehiculo', null, null, true);
  const estadoSelect = renderEstadoSelect('f-estado', 'pendiente');
  
  openModal(`
    <div class="modal-title">Nuevo Trabajo</div>
    <div class="form-group"><label class="form-label">Tipo de trabajo</label>
      <select class="form-input" id="f-tipo-trabajo">
        ${TIPOS_TRABAJO.map(t => `<option value="${t}">${TIPO_ICONS[t]||'📋'} ${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="f-desc" placeholder="Cambio de pastillas delanteras"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t("lblCosto")}</label>${renderMontoInput('f-costo', '', 'Total facturado')}</div>
      <div class="form-group"><label class="form-label">Costo repuestos</label>${renderMontoInput('f-costo-rep', '0', '0')}</div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Kilometraje actual</label><input class="form-input" id="f-km" type="number" placeholder="Ej: 45000"></div>
      <div class="form-group"><label class="form-label">Combustible</label>
        <select class="form-input" id="f-combustible">
          <option value="RESERVA">RESERVA</option><option value="1/4">1/4</option><option value="1/2" selected>1/2</option>
          <option value="3/4">3/4</option><option value="LLENO">LLENO</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">${t("lblFecha")}</label>${renderFechaInput('f-fecha')}</div>
    <div class="form-group"><label class="form-label">${t("lblEstado")}</label>${estadoSelect}</div>
    <div class="form-group"><label class="form-label">Cliente</label>${clienteSelect}</div>
    <div class="form-group"><label class="form-label">Vehículo</label>${vehiculoSelect}
      <button onclick="toggleNuevoVehRep()" id="btn-toggle-nv" style="margin-top:.4rem;width:100%;background:rgba(0,229,255,.08);color:var(--accent);border:1px solid rgba(0,229,255,.2);border-radius:8px;padding:.45rem;font-size:.78rem;cursor:pointer;font-family:var(--font-head)">+ Registrar vehículo nuevo</button>
    </div>
    <div id="nuevo-veh-rep" style="display:none;background:var(--surface2);border:1px solid var(--accent);border-radius:10px;padding:.75rem;margin-bottom:.75rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <div style="font-size:.72rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px">NUEVO VEHÍCULO</div>
        <button onclick="toggleNuevoVehRep()" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:.9rem">✕</button>
      </div>
      <div class="form-group"><label class="form-label">Patente *</label><input class="form-input" id="f-nv-patente" placeholder="ABC 123" style="text-transform:uppercase"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Marca *</label><input class="form-input" id="f-nv-marca" placeholder="Toyota"></div>
        <div class="form-group"><label class="form-label">Modelo</label><input class="form-input" id="f-nv-modelo" placeholder="Hilux"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Año</label><input class="form-input" id="f-nv-anio" type="number" placeholder="2020"></div>
        <div class="form-group"><label class="form-label">Color</label><input class="form-input" id="f-nv-color" placeholder="Blanco"></div>
      </div>
      <div style="font-size:.7rem;color:var(--text2);margin-top:.3rem">Se vinculará al cliente seleccionado arriba automáticamente.</div>
    </div>
    <div class="form-group"><label class="form-label">${t("lblNotas")}</label>${renderNotasTextarea('f-notas')}</div>
    <button class="btn-primary" onclick="guardarReparacionConSafeCall()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

export function toggleNuevoVehRep() {
  const el = document.getElementById('nuevo-veh-rep');
  const btn = document.getElementById('btn-toggle-nv');
  if (el.style.display === 'none') {
    el.style.display = 'block';
    if (btn) btn.textContent = '✕ Cancelar vehículo nuevo';
  } else {
    el.style.display = 'none';
    if (btn) btn.textContent = '+ Registrar vehículo nuevo';
  }
}

export async function guardarReparacionConSafeCall() {
  await safeCall(async () => {
    await guardarReparacion();
  }, null, 'No se pudo guardar el trabajo');
}

export async function guardarReparacion(id=null) {
  const desc = document.getElementById('f-desc').value.trim();
  if (!validateRequired(desc, 'Descripción')) return;
  
  let vid = document.getElementById('f-vehiculo').value;
  const cid = document.getElementById('f-cliente').value;

  const nvPatente = document.getElementById('f-nv-patente')?.value?.trim()?.toUpperCase();
  if (!vid && nvPatente) {
    const { data: nuevoVeh, error: vErr } = await sb.from('vehiculos').insert({
      patente: nvPatente,
      marca: document.getElementById('f-nv-marca')?.value || '',
      modelo: document.getElementById('f-nv-modelo')?.value || '',
      anio: parseInt(document.getElementById('f-nv-anio')?.value) || null,
      color: document.getElementById('f-nv-color')?.value || null,
      cliente_id: cid || null,
      taller_id: tid()
    }).select('id').single();
    if (vErr) { toast('Error creando vehículo: '+vErr.message,'error'); return; }
    vid = nuevoVeh.id;
    toast('Vehículo '+nvPatente+' creado','success');
    invalidateComponentCache();
  }

  const costoRep = parseFloat(document.getElementById('f-costo-rep')?.value) || 0;
  const tipoTrabajo = document.getElementById('f-tipo-trabajo')?.value || 'Mecánica general';
  const data = { 
    descripcion:desc, 
    tipo_trabajo:tipoTrabajo, 
    costo:parseFloat(document.getElementById('f-costo').value)||0, 
    costo_repuestos:costoRep, 
    fecha:document.getElementById('f-fecha').value, 
    estado:document.getElementById('f-estado').value, 
    vehiculo_id:vid||null, 
    cliente_id:cid||null, 
    notas:document.getElementById('f-notas').value, 
    taller_id:tid(), 
    kilometraje_ingreso:parseInt(document.getElementById('f-km')?.value)||null, 
    combustible_ingreso:document.getElementById('f-combustible')?.value||null 
  };
  
  const { data: saved, error } = id 
    ? await sb.from('reparaciones').update(data).eq('id',id).select('id').single() 
    : await sb.from('reparaciones').insert(data).select('id').single();
    
  if (error) { toast('Error: '+error.message,'error'); return; }

  if (!id && saved?.id && currentPerfil?.rol === 'empleado') {
    await sb.from('reparacion_mecanicos').insert({
      reparacion_id: saved.id,
      mecanico_id: currentUser.id,
      nombre_mecanico: currentPerfil.nombre,
      horas: 0,
      pago: 0
    });
  }

  clearCache('reparaciones');
  toast('Trabajo guardado','success');
  closeModal();
  reparaciones();
}

export async function modalEditarReparacion(id) {
  const [{ data:r }] = await Promise.all([sb.from('reparaciones').select('*').eq('id',id).single()]);
  const clienteSelect = await renderClienteSelect('f-cliente', r.cliente_id, true);
  const vehiculoSelect = await renderVehiculoSelect('f-vehiculo', r.vehiculo_id, null, true);
  const estadoSelect = renderEstadoSelect('f-estado', r.estado);
  
  openModal(`
    <div class="modal-title">Editar Trabajo</div>
    <div class="form-group"><label class="form-label">Tipo de trabajo</label>
      <select class="form-input" id="f-tipo-trabajo">
        ${TIPOS_TRABAJO.map(t => `<option value="${t}" ${t===(r.tipo_trabajo||'Mecánica general')?'selected':''}>${TIPO_ICONS[t]||'📋'} ${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="f-desc" value="${h(r.descripcion||'')}"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t("lblCosto")}</label>${renderMontoInput('f-costo', r.costo||0)}</div>
      <div class="form-group"><label class="form-label">Costo repuestos</label>${renderMontoInput('f-costo-rep', r.costo_repuestos||0)}</div>
    </div>
    <div class="form-group"><label class="form-label">${t("lblFecha")}</label>${renderFechaInput('f-fecha', r.fecha)}</div>
    <div class="form-group"><label class="form-label">${t("lblEstado")}</label>${estadoSelect}</div>
    <div class="form-group"><label class="form-label">Vehículo</label>${vehiculoSelect}</div>
    <div class="form-group"><label class="form-label">Cliente</label>${clienteSelect}</div>
    <div class="form-group"><label class="form-label">${t("lblNotas")}</label>${renderNotasTextarea('f-notas', r.notas)}</div>
    <button class="btn-primary" onclick="guardarReparacionConSafeCall('${id}')">${t('actualizar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

export async function eliminarReparacion(id) {
  confirmar('Esta acción eliminará el trabajo permanentemente.', async () => {
    await safeCall(async () => {
      await offlineDelete('reparaciones', 'id', id);
      clearCache('reparaciones');
      toast('Trabajo eliminado');
      navigate('reparaciones');
    }, null, 'No se pudo eliminar el trabajo');
  });
}
