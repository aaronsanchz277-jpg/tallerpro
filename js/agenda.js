 // ─── AGENDA DE CITAS ────────────────────────────────────────────────────────
async function agenda({ filtro='hoy' }={}) {
  const hoy = fechaHoy();
  const primerSemana = (() => { const d=new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split('T')[0]; })();
  const finSemana = (() => { const d=new Date(); d.setDate(d.getDate()+(6-d.getDay())); return d.toISOString().split('T')[0]; })();

  let q = sb.from('citas').select('*, clientes(nombre,telefono), vehiculos(patente,marca)').eq('taller_id',tid()).order('fecha',{ascending:true}).order('hora',{ascending:true});
  if (filtro === 'hoy') q = q.eq('fecha', hoy);
  else if (filtro === 'semana') q = q.gte('fecha', primerSemana).lte('fecha', finSemana);
  const { data } = await q;

  function citaBadge(c) {
    const badges = { pendiente:'badge-yellow', confirmada:'badge-blue', completada:'badge-green', cancelada:'badge-red' };
    const labels = { pendiente:t('agendaPendiente'), confirmada:t('agendaConfirmada'), completada:t('agendaCompletada'), cancelada:t('agendaCancelada') };
    return `<span class="card-badge ${badges[c.estado]||'badge-yellow'}">${labels[c.estado]||c.estado}</span>`;
  }

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('agendaTitulo')}</div>
      <div style="display:flex;gap:.4rem">
        ${currentPerfil?.rol==='admin'?`<button onclick="modalConfigTaller()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.5rem .7rem;cursor:pointer;font-size:.8rem">⚙️</button>`:''}
        <button class="btn-add" onclick="modalNuevaCita()">${t('agendaNueva')}</button>
      </div>
    </div>
    <div class="tabs">
      <button class="tab ${filtro==='hoy'?'active':''}" onclick="agenda({filtro:'hoy'})">${t('agendaHoy')}</button>
      <button class="tab ${filtro==='semana'?'active':''}" onclick="agenda({filtro:'semana'})">${t('agendaSemana')}</button>
      <button class="tab ${filtro==='todas'?'active':''}" onclick="agenda({filtro:'todas'})">${t('agendaTodas')}</button>
    </div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('agendaSinDatos')}</p></div>` :
      (data||[]).map(c => `
      <div class="card" onclick="detalleCita('${c.id}')">
        <div class="card-header">
          <div class="card-avatar">📅</div>
          <div class="card-info">
            <div class="card-name">${h(c.descripcion)}</div>
            <div class="card-sub">${formatFecha(c.fecha)} ${c.hora?'· '+c.hora.slice(0,5):''} ${c.clientes?'· '+h(c.clientes.nombre):''}</div>
            <div class="card-sub">${c.vehiculos?h(c.vehiculos.patente)+' · '+h(c.vehiculos.marca):''}</div>
          </div>
          ${citaBadge(c)}
        </div>
      </div>`).join('')}`;
}

async function detalleCita(id) {
  const { data:c } = await sb.from('citas').select('*, clientes(nombre,telefono), vehiculos(patente,marca)').eq('id',id).single();
  if (!c) return;
  const tel = c.clientes?.telefono?.replace(/\D/g,'');
  const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('agenda')">${t('volver')}</button>
      <div class="detail-avatar">📅</div>
      <div><div class="detail-name">${h(c.descripcion)}</div><div class="detail-sub">${formatFecha(c.fecha)} ${c.hora?'· '+c.hora.slice(0,5):''}</div></div>
    </div>
    <div class="info-grid">
      <div class="info-item"><div class="label">${t('agendaFecha')}</div><div class="value">${formatFecha(c.fecha)}</div></div>
      <div class="info-item"><div class="label">${t('agendaHora')}</div><div class="value">${c.hora?c.hora.slice(0,5):'-'}</div></div>
      <div class="info-item"><div class="label">${t('lblCliente')}</div><div class="value">${c.clientes?h(c.clientes.nombre):'-'}</div></div>
      <div class="info-item"><div class="label">${t('lblVehiculo')}</div><div class="value">${c.vehiculos?h(c.vehiculos.patente):'-'}</div></div>
    </div>
    ${c.notas?`<div class="info-item" style="margin-bottom:1rem"><div class="label">${t('lblNotas')}</div><div class="value">${h(c.notas)}</div></div>`:''}
    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
      ${c.estado==='pendiente'?`<button class="btn-primary" style="flex:1" onclick="cambiarEstadoCita('${id}','confirmada')">${t('agendaConfirmar')}</button>`:''}
      ${c.estado==='confirmada'?`<button class="btn-primary" style="flex:1" onclick="cambiarEstadoCita('${id}','completada')">${t('agendaCompletar')}</button>`:''}
      ${c.estado!=='cancelada'&&c.estado!=='completada'?`<button class="btn-secondary" style="margin:0" onclick="cambiarEstadoCita('${id}','cancelada')">${t('agendaCancelar')}</button>`:''}
      ${c.estado==='confirmada'?`<button onclick="crearRepDesdeCita('${c.cliente_id||''}','${c.vehiculo_id||''}','${h(c.descripcion||'')}')" style="flex:1;background:rgba(0,229,255,.12);color:var(--accent);border:1px solid rgba(0,229,255,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.82rem;cursor:pointer">🔧 Crear reparación</button>`:''}
      ${tel&&c.estado==='pendiente'?`<button onclick="window.open('https://wa.me/${tel}?text=${encodeURIComponent(t('agendaMsgWsp')+' '+formatFecha(c.fecha)+(c.hora?' a las '+c.hora.slice(0,5):'')+'. '+tallerNombre+'.')}')" style="flex:1;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer">${t('agendaConfirmarWsp')}</button>`:''}
      <button class="btn-danger" style="margin:0" onclick="eliminarCita('${id}')">${t('eliminarBtn')}</button>
    </div>`;
}

async function cambiarEstadoCita(id, estado) {
  await safeCall(async () => {
    await offlineUpdate('citas', { estado }, 'id', id);
    clearCache('citas');
    toast('✓', 'success');
    detalleCita(id);
  }, null, 'No se pudo cambiar el estado');
}

async function crearRepDesdeCita(clienteId, vehiculoId, descripcion) {
  await safeCall(async () => {
    const { error } = await offlineInsert('reparaciones', {
      descripcion: descripcion || 'Trabajo',
      tipo_trabajo: 'Mecánica general',
      cliente_id: clienteId || null,
      vehiculo_id: vehiculoId || null,
      costo: 0, costo_repuestos: 0,
      estado: 'pendiente',
      fecha: new Date().toISOString().split('T')[0],
      taller_id: tid()
    });
    if (error) { toast('Error: '+error.message,'error'); return; }
    clearCache('reparaciones');
    toast('Trabajo creado desde el turno','success');
    navigate('reparaciones');
  }, null, 'No se pudo crear la reparación');
}

async function eliminarCita(id) {
  confirmar(t('confirmar'), async () => {
    await safeCall(async () => {
      await offlineDelete('citas', 'id', id);
      toast('Eliminada');
      navigate('agenda');
    }, null, 'No se pudo eliminar la cita');
  });
}

async function modalNuevaCita() {
  const [{ data:vehs }, { data:cls }, { data:config }] = await Promise.all([
    sb.from('vehiculos').select('id,patente,marca').eq('taller_id',tid()).order('patente'),
    sb.from('clientes').select('id,nombre').eq('taller_id',tid()).order('nombre'),
    sb.from('config_taller').select('*').eq('taller_id',tid()).maybeSingle()
  ]);
  const durDef = config?.duracion_turno || 60;
  const clienteSelect = await renderClienteSelect('f-cliente', null, true);
  const vehiculoSelect = await renderVehiculoSelect('f-vehiculo', null, null, true);
  
  openModal(`
    <div class="modal-title">${t('agendaNueva')}</div>
    <div class="form-group"><label class="form-label">${t('agendaDescripcion')}</label><input class="form-input" id="f-desc" placeholder="Cambio de aceite"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t('agendaFecha')}</label><input class="form-input" id="f-fecha" type="date" value="${fechaHoy()}" onchange="cargarHorasDisponibles()"></div>
      <div class="form-group"><label class="form-label">${t('agendaHora')}</label><select class="form-input" id="f-hora"><option>Cargando...</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Duración (min)</label><input class="form-input" id="f-duracion" type="number" value="${durDef}" min="15" step="15"></div>
    <div class="form-group"><label class="form-label">${t('lblCliente')}</label>${clienteSelect}</div>
    <div class="form-group"><label class="form-label">${t('lblVehiculo')}</label>${vehiculoSelect}</div>
    <div class="form-group"><label class="form-label">${t('lblNotas')}</label><textarea class="form-input" id="f-notas" rows="2"></textarea></div>
    <button class="btn-primary" onclick="guardarCitaConSafeCall()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
  setTimeout(cargarHorasDisponibles, 50);
}

async function guardarCitaConSafeCall() {
  await safeCall(async () => {
    await guardarCita();
  }, null, 'No se pudo agendar la cita');
}

async function cargarHorasDisponibles() {
  const fecha = document.getElementById('f-fecha')?.value;
  const sel = document.getElementById('f-hora');
  if (!fecha || !sel) return;
  sel.innerHTML = '<option>Cargando...</option>';

  const result = await getAvailableSlots(fecha, tid());
  if (result.feriado) {
    sel.innerHTML = '<option value="">🚫 Feriado — cerrado</option>';
    return;
  }
  if (result.slots.length === 0) {
    sel.innerHTML = '<option value="">Sin horarios disponibles</option>';
    return;
  }
  sel.innerHTML = result.slots.map(s => `<option value="${h(s.hora)}" ${s.disponible?'':'disabled'} style="${s.disponible?'':'color:var(--danger);opacity:.5'}">${h(s.hora.slice(0,5))} ${s.disponible?'✓':'— ocupado'}</option>`).join('');
}

async function getAvailableSlots(fecha, tallerId) {
  const [{ data:config }, { data:citas }, { data:feriado }] = await Promise.all([
    sb.from('config_taller').select('*').eq('taller_id', tallerId).maybeSingle(),
    sb.from('citas').select('hora, duracion, estado').eq('taller_id', tallerId).eq('fecha', fecha).in('estado', ['pendiente','confirmada']),
    sb.from('feriados').select('id').eq('taller_id', tallerId).eq('fecha', fecha).maybeSingle()
  ]);

  if (feriado) return { slots: [], feriado: true };

  const apertura = config?.hora_apertura || '08:00';
  const cierre = config?.hora_cierre || '18:00';
  const durTurno = config?.duracion_turno || 60;
  const capacidad = config?.capacidad || 1;
  const diasLab = (config?.dias_laborales || '1,2,3,4,5,6').split(',').map(Number);

  const diaSemana = new Date(fecha + 'T12:00').getDay();
  if (!diasLab.includes(diaSemana)) return { slots: [], feriado: false };

  const slots = [];
  const [aH, aM] = apertura.split(':').map(Number);
  const [cH, cM] = cierre.split(':').map(Number);
  let minuto = aH * 60 + aM;
  const fin = cH * 60 + cM;

  while (minuto + durTurno <= fin) {
    const horaStr = String(Math.floor(minuto/60)).padStart(2,'0') + ':' + String(minuto%60).padStart(2,'0');
    const ocupadas = (citas||[]).filter(c => {
      if (!c.hora) return false;
      const cMin = parseInt(c.hora.split(':')[0])*60 + parseInt(c.hora.split(':')[1]);
      const cDur = c.duracion || durTurno;
      return minuto < cMin + cDur && minuto + durTurno > cMin;
    }).length;
    slots.push({ hora: horaStr + ':00', disponible: ocupadas < capacidad });
    minuto += durTurno;
  }
  return { slots, feriado: false };
}

async function guardarCita() {
  const desc = document.getElementById('f-desc').value.trim();
  if (!validateRequired(desc, 'Descripción')) return;
  
  const hora = document.getElementById('f-hora').value;
  if (!hora) { toast('Seleccioná un horario','error'); return; }
  
  const duracion = parseInt(document.getElementById('f-duracion')?.value) || 60;
  const data = {
    descripcion: desc,
    fecha: document.getElementById('f-fecha').value,
    hora,
    duracion,
    cliente_id: document.getElementById('f-cliente').value || null,
    vehiculo_id: document.getElementById('f-vehiculo').value || null,
    notas: document.getElementById('f-notas').value,
    taller_id: tid()
  };
  
  const { error } = await offlineInsert('citas', data);
  if (error) { toast('Error: '+error.message,'error'); return; }
  
  toast('Cita agendada','success');
  closeModal(); 
  agenda();
}

// ─── CONFIG TALLER (horarios, capacidad) ────────────────────────────────────
async function modalConfigTaller() {
  const [{ data:config }, { data:feriados }] = await Promise.all([
    sb.from('config_taller').select('*').eq('taller_id',tid()).maybeSingle(),
    sb.from('feriados').select('*').eq('taller_id',tid()).order('fecha')
  ]);
  const c = config || { hora_apertura:'08:00', hora_cierre:'18:00', duracion_turno:60, capacidad:1, dias_laborales:'1,2,3,4,5,6' };
  const dias = (c.dias_laborales||'').split(',').map(Number);
  const diasNombres = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  
  openModal(`
    <div class="modal-title">⚙️ ${t('agendaTitulo')} — Configuración</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Apertura</label><input class="form-input" id="f-apertura" type="time" value="${h(c.hora_apertura||'08:00')}"></div>
      <div class="form-group"><label class="form-label">Cierre</label><input class="form-input" id="f-cierre" type="time" value="${h(c.hora_cierre||'18:00')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Duración turno (min)</label><input class="form-input" id="f-dur-turno" type="number" value="${c.duracion_turno||60}" min="15" step="15"></div>
      <div class="form-group"><label class="form-label">Capacidad simultánea</label><input class="form-input" id="f-capacidad" type="number" value="${c.capacidad||1}" min="1"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Días laborales</label>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap">
        ${diasNombres.map((n,i) => `<label style="display:flex;align-items:center;gap:.3rem;font-size:.8rem;color:var(--text2);cursor:pointer"><input type="checkbox" class="dia-check" value="${i}" ${dias.includes(i)?'checked':''}> ${n}</label>`).join('')}
      </div>
    </div>
    <button class="btn-primary" onclick="guardarConfigTaller(${config?'true':'false'})">${t('guardar')}</button>

    <div style="margin-top:1.5rem;border-top:1px solid var(--border);padding-top:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
        <div style="font-family:var(--font-head);font-size:1rem;color:var(--accent)">🗓 Feriados</div>
      </div>
      <div class="form-row" style="margin-bottom:.75rem">
        <div class="form-group" style="margin:0"><input class="form-input" id="f-feriado-fecha" type="date"></div>
        <div class="form-group" style="margin:0"><input class="form-input" id="f-feriado-desc" placeholder="Descripción"></div>
      </div>
      <button onclick="agregarFeriadoConSafeCall()" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.5rem;font-size:.8rem;cursor:pointer;margin-bottom:.75rem">+ Agregar feriado</button>
      ${(feriados||[]).length === 0 ? '<p style="font-size:.8rem;color:var(--text2)">No hay feriados cargados</p>' :
        (feriados||[]).map(f => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
          <div>
            <span style="font-size:.85rem;color:var(--text)">${formatFecha(f.fecha)}</span>
            <span style="font-size:.75rem;color:var(--text2);margin-left:.5rem">${h(f.descripcion||'')}</span>
          </div>
          <button onclick="eliminarFeriadoConSafeCall('${f.id}')" style="font-size:.7rem;background:none;border:1px solid var(--border);color:var(--danger);border-radius:6px;padding:2px 8px;cursor:pointer">✕</button>
        </div>`).join('')}
    </div>
    <button class="btn-secondary" onclick="closeModal()" style="margin-top:1rem">${t('cancelar')}</button>`);
}

async function agregarFeriadoConSafeCall() {
  await safeCall(async () => {
    await agregarFeriado();
  }, null, 'No se pudo agregar el feriado');
}

async function agregarFeriado() {
  const fecha = document.getElementById('f-feriado-fecha').value;
  if (!validateRequired(fecha, 'Fecha')) return;
  
  const desc = document.getElementById('f-feriado-desc').value.trim();
  const { error } = await sb.from('feriados').insert({ fecha, descripcion: desc, taller_id: tid() });
  if (error) { toast('Error: '+error.message,'error'); return; }
  
  toast('Feriado agregado','success');
  closeModal(); 
  modalConfigTaller();
}

async function eliminarFeriadoConSafeCall(id) {
  await safeCall(async () => {
    await eliminarFeriado(id);
  }, null, 'No se pudo eliminar el feriado');
}

async function eliminarFeriado(id) {
  await sb.from('feriados').delete().eq('id', id);
  toast('Feriado eliminado');
  closeModal(); 
  modalConfigTaller();
}

async function guardarConfigTaller(exists) {
  await safeCall(async () => {
    const diasSel = Array.from(document.querySelectorAll('.dia-check:checked')).map(cb => cb.value).join(',');
    const data = {
      taller_id: tid(),
      hora_apertura: document.getElementById('f-apertura').value,
      hora_cierre: document.getElementById('f-cierre').value,
      duracion_turno: parseInt(document.getElementById('f-dur-turno').value) || 60,
      capacidad: parseInt(document.getElementById('f-capacidad').value) || 1,
      dias_laborales: diasSel || '1,2,3,4,5,6'
    };
    const { error } = exists
      ? await sb.from('config_taller').update(data).eq('taller_id', tid())
      : await sb.from('config_taller').insert(data);
    if (error) { toast('Error: '+error.message,'error'); return; }
    toast('Configuración guardada','success'); 
    closeModal(); 
    agenda();
  }, null, 'No se pudo guardar la configuración');
}

// ─── VISTA CLIENTE: MIS MANTENIMIENTOS ──────────────────────────────────────
async function misMantenimientos() {
  if (currentPerfil?.rol !== 'cliente') { dashboard(); return; }
  const { data: perfil } = await sb.from('perfiles').select('cliente_id').eq('id', currentUser.id).maybeSingle();
  if (!perfil?.cliente_id) {
    document.getElementById('main-content').innerHTML = `<div class="empty"><p>${t('cuentaPendiente')}</p></div>`;
    return;
  }
  const { data } = await sb.from('mantenimientos').select('*, vehiculos(patente,marca)').eq('cliente_id', perfil.cliente_id).order('proximo_fecha');
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('main-content').innerHTML = `
    <div class="section-header"><div class="section-title">${t('navMisMant')}</div></div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('mantSinDatos')}</p></div>` :
      (data||[]).map(m => `
      <div class="card">
        <div class="card-header">
          <div class="card-avatar">🔔</div>
          <div class="card-info">
            <div class="card-name">${h(m.tipo)}</div>
            <div class="card-sub">${m.vehiculos?h(m.vehiculos.patente)+' · '+h(m.vehiculos.marca):''}</div>
            <div class="card-sub">${m.proximo_fecha?'Próximo: '+formatFecha(m.proximo_fecha):''}</div>
          </div>
          <span class="card-badge ${m.proximo_fecha&&m.proximo_fecha<=hoy?'badge-red':'badge-yellow'}">${m.proximo_fecha&&m.proximo_fecha<=hoy?t('mantVencido'):t('mantProximo')}</span>
        </div>
      </div>`).join('')}`;
}

// ─── VISTA CLIENTE: MIS CITAS (con reserva inteligente) ─────────────────────
async function misCitas() {
  if (currentPerfil?.rol !== 'cliente') { dashboard(); return; }
  const { data: perfil } = await sb.from('perfiles').select('cliente_id').eq('id', currentUser.id).maybeSingle();
  if (!perfil?.cliente_id) {
    document.getElementById('main-content').innerHTML = `<div class="empty"><p>${t('cuentaPendiente')}</p></div>`;
    return;
  }
  const [{ data }, { data: misVehs }] = await Promise.all([
    sb.from('citas').select('*, vehiculos(patente,marca)').eq('cliente_id', perfil.cliente_id).order('fecha',{ascending:true}),
    sb.from('vehiculos').select('id,patente,marca').eq('cliente_id', perfil.cliente_id).order('patente')
  ]);
  const badges = { pendiente:'badge-yellow', confirmada:'badge-blue', completada:'badge-green', cancelada:'badge-red' };
  const labels = { pendiente:t('agendaPendiente'), confirmada:t('agendaConfirmada'), completada:t('agendaCompletada'), cancelada:t('agendaCancelada') };
  window._misVehsCliente = misVehs || [];
  window._miClienteId = perfil.cliente_id;

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('navMisCitas')}</div>
      <button class="btn-add" onclick="modalPedirCita()">${t('agendaNueva')}</button>
    </div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('agendaSinDatos')}</p></div>` :
      (data||[]).map(c => `
      <div class="card">
        <div class="card-header">
          <div class="card-avatar">📅</div>
          <div class="card-info">
            <div class="card-name">${h(c.descripcion)}</div>
            <div class="card-sub">${formatFecha(c.fecha)} ${c.hora?'· '+c.hora.slice(0,5):''}</div>
            <div class="card-sub">${c.vehiculos?h(c.vehiculos.patente)+' · '+h(c.vehiculos.marca):''}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span class="card-badge ${badges[c.estado]||'badge-yellow'}">${labels[c.estado]||c.estado}</span>
            ${c.estado==='pendiente'?`<button onclick="event.stopPropagation();cancelarMiCita('${c.id}')" style="font-size:.65rem;background:none;border:1px solid var(--border);color:var(--danger);border-radius:6px;padding:2px 6px;cursor:pointer">${t('agendaCancelar')}</button>`:''}
          </div>
        </div>
      </div>`).join('')}`;
}

async function cancelarMiCita(id) {
  confirmar(t('confirmar'), async () => {
    await safeCall(async () => {
      await offlineUpdate('citas', { estado: 'cancelada' }, 'id', id);
      toast('Cita cancelada', 'success');
      misCitas();
    }, null, 'No se pudo cancelar la cita');
  });
}

async function modalPedirCita() {
  const vehs = window._misVehsCliente || [];
  const vehiculoSelect = vehs.length > 0 ? `
    <div class="form-group"><label class="form-label">${t('lblVehiculo')}</label>
      <select class="form-input" id="f-vehiculo">
        <option value="">${t('sinVehiculo')}</option>
        ${vehs.map(v => `<option value="${v.id}">${h(v.patente)} - ${h(v.marca)}</option>`).join('')}
      </select>
    </div>` : '<input type="hidden" id="f-vehiculo" value="">';
  
  openModal(`
    <div class="modal-title">${t('agendaNueva')}</div>
    <div class="form-group"><label class="form-label">${t('agendaDescripcion')}</label><input class="form-input" id="f-desc" placeholder="Cambio de aceite, revisión..."></div>
    <div class="form-group"><label class="form-label">${t('agendaFecha')}</label><input class="form-input" id="f-fecha" type="date" value="${fechaHoy()}" min="${fechaHoy()}" onchange="cargarSlotsCliente()"></div>
    <div class="form-group">
      <label class="form-label">${t('agendaHora')} — Horarios disponibles</label>
      <div id="slots-container" style="display:flex;flex-wrap:wrap;gap:.4rem;min-height:40px"><div class="loading" style="padding:.5rem">Cargando horarios...</div></div>
    </div>
    <input type="hidden" id="f-hora" value="">
    ${vehiculoSelect}
    <div class="form-group"><label class="form-label">${t('lblNotas')}</label><textarea class="form-input" id="f-notas" rows="2" placeholder="Detalles adicionales..."></textarea></div>
    <button class="btn-primary" onclick="guardarCitaClienteConSafeCall()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
  setTimeout(cargarSlotsCliente, 50);
}

async function guardarCitaClienteConSafeCall() {
  await safeCall(async () => {
    await guardarCitaCliente();
  }, null, 'No se pudo solicitar la cita');
}

async function cargarSlotsCliente() {
  const fecha = document.getElementById('f-fecha')?.value;
  const container = document.getElementById('slots-container');
  if (!fecha || !container) return;
  container.innerHTML = '<div class="loading" style="padding:.5rem">Cargando...</div>';
  document.getElementById('f-hora').value = '';

  const result = await getAvailableSlots(fecha, tid());
  if (result.feriado) {
    container.innerHTML = '<div style="font-size:.82rem;color:var(--danger);padding:.5rem">🚫 Este día es feriado — el taller está cerrado.</div>';
    return;
  }
  if (result.slots.length === 0) {
    container.innerHTML = '<div style="font-size:.82rem;color:var(--danger);padding:.5rem">Este día no hay horarios disponibles (día no laboral).</div>';
    return;
  }
  const disponibles = result.slots.filter(s => s.disponible);
  if (disponibles.length === 0) {
    container.innerHTML = '<div style="font-size:.82rem;color:var(--danger);padding:.5rem">Todos los horarios de este día están ocupados. Probá otro día.</div>';
    return;
  }
  container.innerHTML = result.slots.map(s => `
    <button onclick="seleccionarSlot(this,'${s.hora}')" class="slot-btn" ${s.disponible?'':'disabled'} style="padding:.4rem .7rem;border-radius:8px;font-size:.8rem;font-family:var(--font-head);cursor:${s.disponible?'pointer':'default'};border:1px solid ${s.disponible?'var(--border)':'var(--border)'};background:${s.disponible?'var(--surface2)':'var(--surface)'};color:${s.disponible?'var(--text)':'var(--text2)'};opacity:${s.disponible?'1':'.4'};transition:all .2s">
      ${s.hora.slice(0,5)} ${s.disponible?'':'✕'}
    </button>`).join('');
}

function seleccionarSlot(btn, hora) {
  document.querySelectorAll('.slot-btn').forEach(b => { b.style.background='var(--surface2)'; b.style.borderColor='var(--border)'; b.style.color='var(--text)'; });
  btn.style.background = 'var(--accent)';
  btn.style.borderColor = 'var(--accent)';
  btn.style.color = '#000';
  document.getElementById('f-hora').value = hora;
}

async function guardarCitaCliente() {
  const desc = document.getElementById('f-desc').value.trim();
  if (!validateRequired(desc, 'Descripción')) return;
  
  const hora = document.getElementById('f-hora').value;
  if (!hora) { toast('Seleccioná un horario','error'); return; }
  
  const { data:config } = await sb.from('config_taller').select('duracion_turno').eq('taller_id',tid()).maybeSingle();
  const data = {
    descripcion: desc,
    fecha: document.getElementById('f-fecha').value,
    hora,
    duracion: config?.duracion_turno || 60,
    cliente_id: window._miClienteId || null,
    vehiculo_id: document.getElementById('f-vehiculo')?.value || null,
    notas: document.getElementById('f-notas')?.value || '',
    taller_id: tid(),
    estado: 'pendiente'
  };
  
  const { error } = await offlineInsert('citas', data);
  if (error) { toast('Error: '+error.message,'error'); return; }
  
  toast('¡Cita solicitada! El taller la confirmará.','success');
  closeModal(); 
  misCitas();
}
