// ─── MIS TRABAJOS (Empleado) ────────────────────────────────────────────────
async function misTrabajos({ filtro='en_progreso' }={}) {
  if (currentPerfil?.rol !== 'empleado') { dashboard(); return; }

  // Buscar asignaciones por mecanico_id (usuario) O empleado_id (manual)
  const { data: misAsignaciones } = await sb
    .from('reparacion_mecanicos')
    .select('reparacion_id')
    .or(`mecanico_id.eq.${currentUser.id},empleado_id.eq.${currentUser.id}`);

  const misRepIds = (misAsignaciones || []).map(a => a.reparacion_id);

  let data = [];
  if (misRepIds.length > 0) {
    let q = sb.from('reparaciones')
      .select('*, vehiculos(patente,marca), clientes(nombre)')
      .in('id', misRepIds)
      .order('created_at', { ascending: false });

    if (filtro !== 'todos') q = q.eq('estado', filtro);
    const res = await q;
    data = res.data || [];
  }

  const hoy = fechaHoy();
  const misRepsHoy = (data || []).filter(r => r.fecha === hoy);
  const total = (data || []).length;

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text);margin-bottom:.25rem">Mis Trabajos</div>
      <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">${total} reparaciones · ${misRepsHoy.length} hoy</div>
      <div class="tabs">
        <button class="tab ${filtro==='en_progreso'?'active':''}" onclick="misTrabajos({filtro:'en_progreso'})">En Progreso</button>
        <button class="tab ${filtro==='pendiente'?'active':''}" onclick="misTrabajos({filtro:'pendiente'})">Pendientes</button>
        <button class="tab ${filtro==='esperando_repuestos'?'active':''}" onclick="misTrabajos({filtro:'esperando_repuestos'})">Esp. repuestos</button>
        <button class="tab ${filtro==='finalizado'?'active':''}" onclick="misTrabajos({filtro:'finalizado'})">Finalizados</button>
        <button class="tab ${filtro==='todos'?'active':''}" onclick="misTrabajos({filtro:'todos'})">Todos</button>
      </div>
      ${data.length === 0 ? `<div class="empty"><p>No hay reparaciones ${filtro !== 'todos' ? 'con estado "' + estadoLabel(filtro) + '"' : ''}</p></div>` :
        data.map(r => `
        <div class="card" onclick="detalleReparacion('${r.id}')">
          <div class="card-header">
            <div class="card-avatar">${TIPO_ICONS[r.tipo_trabajo] || '🔧'}</div>
            <div class="card-info">
              <div class="card-name">${h(r.descripcion)}</div>
              <div class="card-sub">${r.vehiculos ? h(r.vehiculos.patente)+' · '+h(r.vehiculos.marca) : t('sinVehiculo')} · ${r.clientes ? h(r.clientes.nombre) : ''}</div>
              <div class="card-sub">${formatFecha(r.fecha)} ${r.costo ? '· ' + monedaActual().simbolo + gs(r.costo) : ''}</div>
            </div>
            <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
          </div>
        </div>`).join('')}
    </div>`;
}

// ─── SUPER-ADMIN: Panel de gestión de talleres ──────────────────────────────
// NOTA: _isSuperAdmin y checkSuperAdmin ya están definidos en auth.js

async function superAdminPanel() {
  if (typeof _isSuperAdmin === 'undefined' || !_isSuperAdmin) { navigate('dashboard'); return; }
  
  const [{ data: talleres }, { data: suscripciones }, { data: planes }] = await Promise.all([
    sb.from('talleres').select('*').order('created_at', {ascending:false}),
    sb.from('suscripciones').select('*'),
    sb.from('planes').select('*')
  ]);

  const subMap = {};
  (suscripciones||[]).forEach(s => { subMap[s.taller_id] = s; });
  const planMap = {};
  (planes||[]).forEach(p => { planMap[p.id] = p; });

  const hoy = new Date().toISOString().split('T')[0];

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="font-family:var(--font-head);font-size:1.5rem;color:var(--accent);margin-bottom:.25rem">🔑 SUPER ADMIN</div>
      <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">${(talleres||[]).length} talleres registrados</div>
      <div class="stats-grid" style="margin-bottom:1rem">
        <div class="stat-card"><div class="stat-value">${(talleres||[]).length}</div><div class="stat-label">TALLERES</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${(suscripciones||[]).filter(s=>s.estado==='activa').length}</div><div class="stat-label">ACTIVAS</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${(suscripciones||[]).filter(s=>s.estado==='trial').length}</div><div class="stat-label">TRIAL</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${(suscripciones||[]).filter(s=>s.estado==='vencida').length}</div><div class="stat-label">VENCIDAS</div></div>
      </div>
      ${(talleres||[]).map(taller => {
        const sub = subMap[taller.id];
        const plan = sub ? planMap[sub.plan_id] : null;
        const estadoLabel = { trial:'TRIAL', activa:'ACTIVA', vencida:'VENCIDA', cancelada:'CANCELADA' };
        return `
        <div class="card" style="cursor:default">
          <div class="card-header">
            <div class="card-avatar">${taller.nombre?h(taller.nombre).charAt(0).toUpperCase():'?'}</div>
            <div class="card-info">
              <div class="card-name">${h(taller.nombre)}</div>
              <div class="card-sub">${h(taller.telefono||'Sin teléfono')} · ${plan?h(plan.nombre):'Sin plan'}</div>
              <div class="card-sub">${sub?'Vence: '+(sub.fecha_vencimiento?formatFecha(sub.fecha_vencimiento):'Sin fecha'):''}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <span class="card-badge ${sub?.estado==='activa'?'badge-green':sub?.estado==='trial'?'badge-yellow':sub?.estado==='vencida'?'badge-red':'badge-blue'}">${sub?estadoLabel[sub.estado]||'?':'SIN PLAN'}</span>
              <button onclick="modalGestionarTaller('${taller.id}','${hjs(taller.nombre)}')" style="font-size:.65rem;background:var(--accent);color:#000;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-weight:600">Gestionar</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

async function modalGestionarTaller(tallerId, tallerNombre) {
  const [{ data: sub }, { data: planes }] = await Promise.all([
    sb.from('suscripciones').select('*').eq('taller_id', tallerId).maybeSingle(),
    sb.from('planes').select('*').order('precio')
  ]);

  openModal(`
    <div class="modal-title">Gestionar: ${tallerNombre}</div>
    <div class="form-group"><label class="form-label">Plan</label>
      <select class="form-input" id="f-sa-plan">
        ${(planes||[]).map(p => `<option value="${p.id}" ${sub?.plan_id===p.id?'selected':''}>${h(p.nombre)} — ₲${(p.precio||0).toLocaleString('es-PY')}/mes</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Estado</label>
      <select class="form-input" id="f-sa-estado">
        <option value="trial" ${sub?.estado==='trial'?'selected':''}>Trial</option>
        <option value="activa" ${sub?.estado==='activa'?'selected':''}>Activa</option>
        <option value="vencida" ${sub?.estado==='vencida'?'selected':''}>Vencida</option>
        <option value="cancelada" ${sub?.estado==='cancelada'?'selected':''}>Cancelada</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Fecha de vencimiento</label>
      <input class="form-input" id="f-sa-venc" type="date" value="${sub?.fecha_vencimiento||''}">
    </div>
    <div style="display:flex;gap:.5rem">
      <button onclick="activarPlan30Dias('${tallerId}','${sub?.id||''}')" style="flex:1;background:rgba(0,255,136,.15);color:var(--success);border:1px solid rgba(0,255,136,.3);border-radius:8px;padding:.6rem;font-family:var(--font-head);font-size:.8rem;cursor:pointer">+30 DÍAS</button>
      <button onclick="activarPlan365Dias('${tallerId}','${sub?.id||''}')" style="flex:1;background:rgba(0,229,255,.15);color:var(--accent);border:1px solid rgba(0,229,255,.3);border-radius:8px;padding:.6rem;font-family:var(--font-head);font-size:.8rem;cursor:pointer">+1 AÑO</button>
    </div>
    <button class="btn-primary" onclick="guardarGestionTaller('${tallerId}','${sub?.id||''}')" style="margin-top:.5rem">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarGestionTaller(tallerId, subId) {
  const planId = document.getElementById('f-sa-plan').value;
  const estado = document.getElementById('f-sa-estado').value;
  const venc = document.getElementById('f-sa-venc').value || null;
  
  if (subId) {
    await sb.from('suscripciones').update({ plan_id: planId, estado, fecha_vencimiento: venc }).eq('id', subId);
  } else {
    await sb.from('suscripciones').insert({ taller_id: tallerId, plan_id: planId, estado, fecha_vencimiento: venc });
  }
  toast('Suscripción actualizada','success');
  closeModal();
  superAdminPanel();
}

async function activarPlan30Dias(tallerId, subId) {
  const planId = document.getElementById('f-sa-plan').value;
  const venc = new Date(); venc.setDate(venc.getDate() + 30);
  const vencStr = venc.toISOString().split('T')[0];
  if (subId) {
    await sb.from('suscripciones').update({ plan_id: planId, estado: 'activa', fecha_vencimiento: vencStr }).eq('id', subId);
  } else {
    await sb.from('suscripciones').insert({ taller_id: tallerId, plan_id: planId, estado: 'activa', fecha_vencimiento: vencStr });
  }
  toast('✓ Activado por 30 días','success');
  closeModal(); superAdminPanel();
}

async function activarPlan365Dias(tallerId, subId) {
  const planId = document.getElementById('f-sa-plan').value;
  const venc = new Date(); venc.setDate(venc.getDate() + 365);
  const vencStr = venc.toISOString().split('T')[0];
  if (subId) {
    await sb.from('suscripciones').update({ plan_id: planId, estado: 'activa', fecha_vencimiento: vencStr }).eq('id', subId);
  } else {
    await sb.from('suscripciones').insert({ taller_id: tallerId, plan_id: planId, estado: 'activa', fecha_vencimiento: vencStr });
  }
  toast('✓ Activado por 1 año','success');
  closeModal(); superAdminPanel();
}

// ─── CONFIGURAR DATOS DEL TALLER (solo admin o superadmin) ───────────────────
const MONEDA_PRESETS = [
  { pais: 'PY', label: '🇵🇾 Paraguay (₲)',   simbolo: '₲',  locale: 'es-PY' },
  { pais: 'AR', label: '🇦🇷 Argentina ($)',  simbolo: '$',  locale: 'es-AR' },
  { pais: 'UY', label: '🇺🇾 Uruguay ($U)',   simbolo: '$U', locale: 'es-UY' },
  { pais: 'BO', label: '🇧🇴 Bolivia (Bs)',   simbolo: 'Bs', locale: 'es-BO' },
  { pais: 'CL', label: '🇨🇱 Chile ($)',      simbolo: '$',  locale: 'es-CL' },
  { pais: 'PE', label: '🇵🇪 Perú (S/)',      simbolo: 'S/', locale: 'es-PE' },
  { pais: 'CO', label: '🇨🇴 Colombia ($)',   simbolo: '$',  locale: 'es-CO' },
  { pais: 'MX', label: '🇲🇽 México ($)',     simbolo: '$',  locale: 'es-MX' }
];

async function modalConfigDatos() {
  const { data: taller } = await sb.from('talleres').select('*').eq('id', tid()).single();
  if (!taller) return;
  const paisActual = taller.pais || 'PY';
  _logoTallerPendingFile = null;
  _logoTallerQuitar = false;
  const tieneLogoCol = ('logo_url' in taller);
  const logoActual = taller.logo_url || '';
  const logoSection = tieneLogoCol ? `
    <div class="form-group">
      <label class="form-label">Logo del taller</label>
      <div id="logo-preview-wrap" style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem">
        <div id="logo-preview" style="width:64px;height:64px;border-radius:10px;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
          <span style="font-size:.7rem;color:var(--text2)">${logoActual ? '...' : 'sin logo'}</span>
        </div>
        <div style="flex:1;min-width:0">
          <input type="file" id="f-taller-logo" accept="image/png,image/jpeg,image/webp" class="form-input" style="padding:.4rem;font-size:.8rem" onchange="logoTallerPreview(this)">
          <div style="font-size:.7rem;color:var(--text2);margin-top:.3rem">PNG, JPG o WEBP. Máx 2MB.</div>
        </div>
      </div>
      ${logoActual ? `<button type="button" class="btn-secondary" onclick="quitarLogoTaller()" style="font-size:.78rem;padding:.4rem .6rem">Quitar logo</button>` : ''}
    </div>` : '';
  openModal(`
    <div class="modal-title">⚙️ Configurar Taller</div>
    <div class="form-group"><label class="form-label">Nombre del taller</label><input class="form-input" id="f-taller-nombre" value="${h(taller.nombre||'')}"></div>
    <div class="form-group"><label class="form-label">RUC</label><input class="form-input" id="f-taller-ruc" value="${h(taller.ruc||'')}" placeholder="80012345-6"></div>
    <div class="form-group"><label class="form-label">Teléfono / WhatsApp principal</label>${phoneInput('f-taller-tel',taller.telefono,'0981 123 456')}</div>
    <div class="form-group"><label class="form-label">Dirección</label><input class="form-input" id="f-taller-dir" value="${h(taller.direccion||'')}" placeholder="Av. Ejemplo 123"></div>
    <div class="form-group">
      <label class="form-label">País / Moneda</label>
      <select class="form-input" id="f-taller-pais">
        ${MONEDA_PRESETS.map(p => `<option value="${p.pais}" ${p.pais===paisActual?'selected':''}>${p.label}</option>`).join('')}
      </select>
    </div>
    ${logoSection}
    <div style="background:var(--surface2);border-radius:8px;padding:.75rem;margin-top:.5rem;margin-bottom:1rem">
      <div style="font-size:.75rem;color:var(--text2)">💡 El RUC y dirección aparecen en las facturas</div>
      <div style="font-size:.75rem;color:var(--text2)">💡 El teléfono se usa para WhatsApp</div>
      <div style="font-size:.75rem;color:var(--text2)">💡 La moneda se aplica en toda la app (montos, PDFs, dashboard)</div>
      ${tieneLogoCol ? `<div style="font-size:.75rem;color:var(--text2)">💡 El logo se muestra en la barra lateral y en el encabezado de los presupuestos PDF</div>` : ''}
    </div>
    <button class="btn-primary" onclick="guardarConfigDatos()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);

  if (tieneLogoCol && logoActual && typeof obtenerLogoTallerBase64 === 'function') {
    obtenerLogoTallerBase64().then(data => {
      const prev = document.getElementById('logo-preview');
      if (!prev) return;
      if (data) {
        prev.innerHTML = `<img src="${data.dataUrl}" alt="logo" style="max-width:100%;max-height:100%;object-fit:contain">`;
      } else {
        prev.innerHTML = `<span style="font-size:.7rem;color:var(--text2)">sin logo</span>`;
      }
    });
  }
}

let _logoTallerPendingFile = null;
let _logoTallerQuitar = false;

function logoTallerPreview(input) {
  const file = input.files && input.files[0];
  if (!file) { _logoTallerPendingFile = null; return; }
  const tiposOk = ['image/png', 'image/jpeg', 'image/webp'];
  if (!tiposOk.includes(file.type)) {
    toast('El logo debe ser PNG, JPG o WEBP', 'error');
    input.value = '';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    toast('El logo no puede pesar más de 2MB', 'error');
    input.value = '';
    return;
  }
  _logoTallerPendingFile = file;
  _logoTallerQuitar = false;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const prev = document.getElementById('logo-preview');
    if (prev) prev.innerHTML = `<img src="${ev.target.result}" alt="logo" style="max-width:100%;max-height:100%;object-fit:contain">`;
  };
  reader.readAsDataURL(file);
}

function quitarLogoTaller() {
  if (!confirm('¿Quitar el logo del taller? Volverá a mostrarse el texto TALLERPRO.')) return;
  _logoTallerPendingFile = null;
  _logoTallerQuitar = true;
  const prev = document.getElementById('logo-preview');
  if (prev) prev.innerHTML = `<span style="font-size:.7rem;color:var(--text2)">sin logo</span>`;
  const inp = document.getElementById('f-taller-logo');
  if (inp) inp.value = '';
  toast('Se quitará al guardar', 'info');
}

async function _logoTallerSubir(file, logoUrlAnterior) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const tallerId = tid();
  const path = `${tallerId}/logo-${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage.from('logos').upload(path, file, {
    contentType: file.type,
    upsert: true,
    cacheControl: '3600'
  });
  if (upErr) throw new Error('No se pudo subir el logo: ' + upErr.message);
  if (logoUrlAnterior) {
    const m = logoUrlAnterior.match(/\/logos\/(.+)$/);
    if (m && m[1] && m[1].startsWith(tallerId + '/') && m[1] !== path) {
      try { await sb.storage.from('logos').remove([m[1]]); } catch(_) { /* no-op */ }
    }
  }
  const { data: urlData } = sb.storage.from('logos').getPublicUrl(path);
  return urlData.publicUrl;
}

async function guardarConfigDatos() {
  const nombre = document.getElementById('f-taller-nombre').value.trim();
  const ruc = document.getElementById('f-taller-ruc').value.trim();
  const telefono = document.getElementById('f-taller-tel').value.trim();
  const direccion = document.getElementById('f-taller-dir').value.trim();
  const pais = document.getElementById('f-taller-pais').value;
  if (!nombre) { toast('El nombre es obligatorio','error'); return; }
  const preset = MONEDA_PRESETS.find(p => p.pais === pais) || MONEDA_PRESETS[0];

  let nuevoLogoUrl;
  const logoActual = currentPerfil?.talleres?.logo_url || null;
  if (_logoTallerPendingFile) {
    try {
      nuevoLogoUrl = await _logoTallerSubir(_logoTallerPendingFile, logoActual);
    } catch (e) {
      toast(e.message, 'error');
      return;
    }
  } else if (_logoTallerQuitar) {
    nuevoLogoUrl = null;
    if (logoActual) {
      const m = logoActual.match(/\/logos\/(.+)$/);
      const tallerId = tid();
      if (m && m[1] && m[1].startsWith(tallerId + '/')) {
        try { await sb.storage.from('logos').remove([m[1]]); } catch(_) { /* no-op */ }
      }
    }
  }

  const updatePayload = {
    nombre, ruc, telefono, direccion,
    pais: preset.pais,
    moneda_simbolo: preset.simbolo,
    moneda_locale:  preset.locale
  };
  if (nuevoLogoUrl !== undefined) updatePayload.logo_url = nuevoLogoUrl;

  const { error } = await sb.from('talleres').update(updatePayload).eq('id', tid());
  if (error) { toast('Error: '+error.message,'error'); return; }
  if (currentPerfil?.talleres) {
    currentPerfil.talleres.nombre = nombre;
    currentPerfil.talleres.telefono = telefono;
    currentPerfil.talleres.ruc = ruc;
    currentPerfil.talleres.direccion = direccion;
    currentPerfil.talleres.pais = preset.pais;
    currentPerfil.talleres.moneda_simbolo = preset.simbolo;
    currentPerfil.talleres.moneda_locale = preset.locale;
    if (nuevoLogoUrl !== undefined) currentPerfil.talleres.logo_url = nuevoLogoUrl;
  }
  if (nuevoLogoUrl !== undefined) {
    if (typeof invalidarLogoTallerCache === 'function') invalidarLogoTallerCache();
    if (typeof aplicarLogoTallerEnUI === 'function') aplicarLogoTallerEnUI();
  }
  _logoTallerPendingFile = null;
  _logoTallerQuitar = false;
  toast('Taller actualizado','success');
  closeModal();
  navigate('dashboard');
}

// ─── MI COBRO (Empleado) ────────────────────────────────────────────────────
// ─── Helper: semana lunes-sábado ────────────────────────────────────────────
// Dado "YYYY-MM-DD", devuelve { inicio: "YYYY-MM-DD", fin: "YYYY-MM-DD" }
// donde inicio es el lunes y fin el sábado de esa semana calendario.
function _getSemanaDeFecha(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);       // fecha local, sin desfase UTC
  const diaSemana = fecha.getDay();           // 0=Dom, 1=Lun … 6=Sab
  const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(y, m - 1, d + diffLunes);
  const sabado = new Date(lunes);
  sabado.setDate(lunes.getDate() + 5);
  const toStr = dt => dt.toISOString().split('T')[0];
  return { inicio: toStr(lunes), fin: toStr(sabado) };
}

// Agrupa un array de items en semanas lunes-sábado.
// getterFecha(item) => "YYYY-MM-DD"
// getterMonto(item) => number
// Devuelve array ordenado de más reciente a más antiguo.
function _agruparPorSemana(items, getterFecha, getterMonto) {
  const grupos = {};
  for (const item of items) {
    const fecha = getterFecha(item);
    if (!fecha) continue;
    const { inicio, fin } = _getSemanaDeFecha(fecha);
    const key = inicio + '|' + fin;
    if (!grupos[key]) grupos[key] = { inicio, fin, items: [], total: 0 };
    grupos[key].items.push(item);
    grupos[key].total += parseFloat(getterMonto(item) || 0);
  }
  return Object.values(grupos).sort((a, b) => b.inicio.localeCompare(a.inicio));
}

async function miCobro() {
  if (currentPerfil?.rol !== 'empleado') { dashboard(); return; }

  const main = document.getElementById('main-content');
  const empId = currentPerfil?.empleado_id;

  if (!empId) {
    main.innerHTML = `
      <div style="padding:.25rem 0">
        <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text);margin-bottom:.5rem">💵 Mi Cobro</div>
        <div class="card" style="cursor:default">
          <div style="font-size:.85rem;color:var(--text2);line-height:1.5">
            Tu cuenta todavía no está vinculada a una ficha de empleado del taller.
            <br><br>
            Pedile al administrador que la vincule desde <b>Configuración → Usuarios</b>
            o desde la lista de empleados (botón <b>📨 Invitar</b>).
          </div>
        </div>
      </div>`;
    return;
  }

  // ─── Período activo ──────────────────────────────────────────────────────
  let inicio, fin, periodoLabel, periodoFuente;
  try {
    const { data: periodoAbierto } = await sb.from('periodos_sueldo')
      .select('id, fecha_inicio, fecha_fin, estado')
      .eq('taller_id', currentPerfil.taller_id)
      .eq('estado', 'abierto')
      .order('fecha_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (periodoAbierto && periodoAbierto.fecha_inicio && periodoAbierto.fecha_fin) {
      inicio = periodoAbierto.fecha_inicio;
      fin    = periodoAbierto.fecha_fin;
      periodoLabel = `${formatFecha(inicio)} – ${formatFecha(fin)}`;
      periodoFuente = 'periodo';
    }
  } catch (_e) { /* ignoramos: usaremos fallback */ }

  if (!inicio || !fin) {
    const hoy = new Date();
    inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    fin    = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
    periodoLabel = hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    periodoFuente = 'mes';
  }

  // ─── Datos en paralelo ───────────────────────────────────────────────────
  const [empRes, valesRes, asignRes] = await Promise.all([
    sb.from('empleados').select('nombre,sueldo,rol').eq('id', empId).maybeSingle(),
    sb.from('vales_empleado').select('monto,fecha,concepto')
      .eq('empleado_id', empId)
      .gte('fecha', inicio).lte('fecha', fin)
      .order('fecha', { ascending: false }),
    sb.from('reparacion_mecanicos').select('pago,horas,reparacion_id,empleado_id,mecanico_id')
  ]);

  const emp = empRes.data;
  const vales = valesRes.data || [];
  const asignaciones = asignRes.data || [];

  // Resolver fechas de las reparaciones para filtrar por período
  const repIds = [...new Set(asignaciones.map(a => a.reparacion_id).filter(Boolean))];
  let repPorId = {};
  if (repIds.length > 0) {
    const { data: reps } = await sb.from('reparaciones')
      .select('id,fecha,descripcion,vehiculos(patente)')
      .in('id', repIds);
    (reps || []).forEach(r => { repPorId[r.id] = r; });
  }

  const comisionesDelPeriodo = asignaciones
    .map(a => {
      const r = repPorId[a.reparacion_id];
      if (!r || !r.fecha) return null;
      if (r.fecha < inicio || r.fecha > fin) return null;
      return {
        pago: parseFloat(a.pago || 0),
        horas: parseFloat(a.horas || 0),
        rep: r
      };
    })
    .filter(Boolean);

  const totalSueldo     = parseFloat(emp?.sueldo || 0);
  const totalComisiones = comisionesDelPeriodo.reduce((s, c) => s + c.pago, 0);
  const totalHoras      = comisionesDelPeriodo.reduce((s, c) => s + c.horas, 0);
  const totalVales      = vales.reduce((s, v) => s + parseFloat(v.monto || 0), 0);
  const totalNeto       = totalSueldo + totalComisiones - totalVales;

  const periodoBadge = periodoFuente === 'periodo'
    ? `<span style="font-size:.62rem;background:rgba(0,255,136,.12);color:var(--success);border:1px solid rgba(0,255,136,.3);border-radius:6px;padding:2px 6px;font-family:var(--font-head);margin-left:.4rem">PERÍODO ABIERTO</span>`
    : `<span style="font-size:.62rem;background:rgba(255,204,0,.12);color:var(--warning);border:1px solid rgba(255,204,0,.3);border-radius:6px;padding:2px 6px;font-family:var(--font-head);margin-left:.4rem">MES CORRIENTE</span>`;

  // ─── Agrupar comisiones y vales por semana lunes-sábado ───────────────────
  // Agrupar comisiones por semana
  const semanasComisiones = _agruparPorSemana(
    comisionesDelPeriodo,
    c => c.rep.fecha,
    c => c.pago
  );

  // Agrupar vales por semana
  const semanasVales = _agruparPorSemana(
    vales,
    v => v.fecha,
    v => v.monto
  );

  // Combinar ambas semanas (usar las semanas que tienen comisiones o vales)
  const todasLasSemanas = new Set();
  [...semanasComisiones, ...semanasVales].forEach(s => {
    todasLasSemanas.add(s.inicio + '|' + s.fin);
  });

  const semanasCombinadas = Array.from(todasLasSemanas)
    .map(key => {
      const [inicio, fin] = key.split('|');
      const semanaComisiones = semanasComisiones.find(s => s.inicio === inicio && s.fin === fin);
      const semanaVales = semanasVales.find(s => s.inicio === inicio && s.fin === fin);
      
      return {
        inicio,
        fin,
        comisiones: semanaComisiones?.items || [],
        totalComisiones: semanaComisiones?.total || 0,
        vales: semanaVales?.items || [],
        totalVales: semanaVales?.total || 0,
        neto: (semanaComisiones?.total || 0) - (semanaVales?.total || 0)
      };
    })
    .sort((a, b) => b.inicio.localeCompare(a.inicio));

  // Render de semanas combinadas
  const renderComisionesValesPorSemana = () => {
    if (comisionesDelPeriodo.length === 0 && vales.length === 0) {
      return `<div class="empty" style="padding:.75rem"><p style="font-size:.82rem">No tenés comisiones ni vales registrados en este período</p></div>`;
    }

    const LIMITE_SEMANAS = 4;
    const semanasVisibles = semanasCombinadas.slice(0, LIMITE_SEMANAS);
    const semanasOcultas = semanasCombinadas.slice(LIMITE_SEMANAS);

    const renderFilaTrabajo = c => {
      return `
        <div onclick="detalleReparacion('${c.rep.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:.4rem .75rem;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;gap:.5rem">
          <div style="min-width:0;flex:1">
            <div style="font-size:.78rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🔧 ${h(c.rep.descripcion || 'Trabajo')}</div>
            <div style="font-size:.64rem;color:var(--text2)">${formatFecha(c.rep.fecha)}${c.rep.vehiculos ? ' · ' + h(c.rep.vehiculos.patente) : ''}${c.horas > 0 ? ' · ⏱ ' + c.horas + ' hs' : ''}</div>
          </div>
          <span style="font-family:var(--font-head);color:var(--accent);font-size:.8rem;white-space:nowrap">+${fm(c.pago)}</span>
        </div>`;
    };

    const renderFilaVale = v => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem .75rem;border-bottom:1px solid rgba(255,255,255,.04);gap:.5rem">
        <div style="min-width:0;flex:1">
          <div style="font-size:.78rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">💸 ${h(v.concepto || 'Vale')}</div>
          <div style="font-size:.64rem;color:var(--text2)">${formatFecha(v.fecha)}</div>
        </div>
        <span style="font-family:var(--font-head);color:var(--warning);font-size:.8rem;white-space:nowrap">-${fm(v.monto || 0)}</span>
      </div>`;

    const renderSemana = (semana, index) => {
      const trabajosOrdenados = [...semana.comisiones].sort((a, b) =>
        b.rep.fecha.localeCompare(a.rep.fecha)
      );
      const valesOrdenados = [...semana.vales].sort((a, b) => b.fecha.localeCompare(a.fecha));
      const horasSemana = trabajosOrdenados.reduce((s, c) => s + c.horas, 0);
      
      return `
        <div style="margin-bottom:.75rem;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem .75rem;background:rgba(0,229,255,.06);border-bottom:1px solid var(--border)">
            <div>
              <span style="font-family:var(--font-head);font-size:.7rem;color:var(--accent);letter-spacing:.5px">📅 SEMANA ${index + 1}: Lun ${formatFecha(semana.inicio)} — Sáb ${formatFecha(semana.fin)}</span>
              ${horasSemana > 0 ? `<span style="font-size:.6rem;color:var(--text2);margin-left:.4rem">· ⏱ ${horasSemana.toFixed(1)} hs</span>` : ''}
            </div>
            <span style="font-family:var(--font-head);font-size:.85rem;color:${semana.neto >= 0 ? 'var(--success)' : 'var(--danger)'}">${semana.neto >= 0 ? '+' : ''}${fm(semana.neto)}</span>
          </div>
          
          ${trabajosOrdenados.length > 0 ? `
            <div style="background:rgba(0,255,136,.02);padding:.3rem .75rem .1rem">
              <div style="font-size:.65rem;color:var(--text2);font-family:var(--font-head);letter-spacing:.5px;margin-bottom:.2rem">COMISIONES DE LA SEMANA</div>
              ${trabajosOrdenados.map(renderFilaTrabajo).join('')}
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem .75rem .4rem;border-top:1px solid rgba(0,255,136,.1)">
                <span style="font-family:var(--font-head);font-size:.7rem;color:var(--success)">COMISIONES SEMANA ${index + 1}</span>
                <span style="font-family:var(--font-head);font-size:.8rem;color:var(--success)">+${fm(semana.totalComisiones)}</span>
              </div>
            </div>` : ''}
          
          ${valesOrdenados.length > 0 ? `
            <div style="background:rgba(255,204,0,.02);padding:.3rem .75rem .1rem">
              <div style="font-size:.65rem;color:var(--text2);font-family:var(--font-head);letter-spacing:.5px;margin-bottom:.2rem">VALES DE LA SEMANA</div>
              ${valesOrdenados.map(renderFilaVale).join('')}
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem .75rem .4rem;border-top:1px solid rgba(255,204,0,.1)">
                <span style="font-family:var(--font-head);font-size:.7rem;color:var(--warning)">VALES SEMANA ${index + 1}</span>
                <span style="font-family:var(--font-head);font-size:.8rem;color:var(--warning)">-${fm(semana.totalVales)}</span>
              </div>
            </div>` : ''}
          
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem .75rem;background:${semana.neto >= 0 ? 'rgba(0,255,136,.08)' : 'rgba(255,68,68,.08)'};border-top:1px solid var(--border)">
            <span style="font-family:var(--font-head);font-size:.7rem;color:${semana.neto >= 0 ? 'var(--success)' : 'var(--danger)'};letter-spacing:.5px">NETO SEMANA ${index + 1}</span>
            <span style="font-family:var(--font-head);font-size:.9rem;color:${semana.neto >= 0 ? 'var(--success)' : 'var(--danger)'};font-weight:700">${semana.neto >= 0 ? '+' : ''}${fm(semana.neto)}</span>
          </div>
        </div>`;
    };

    const semanasHTMLVisible = semanasVisibles.map(renderSemana).join('');
    const semanasHTMLOcultas = semanasOcultas.length > 0
      ? `<div id="comisiones-vales-extras" style="display:none">${semanasOcultas.map((s, i) => renderSemana(s, i + LIMITE_SEMANAS)).join('')}</div>
         <button onclick="this.previousElementSibling.style.display='block';this.style.display='none'" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--accent);border-radius:8px;padding:.4rem;font-size:.7rem;margin-top:.4rem;cursor:pointer;font-family:var(--font-head)">Ver ${semanasOcultas.length} semana${semanasOcultas.length !== 1 ? 's' : ''} más</button>`
      : '';

    const totalGeneralComisiones = semanasCombinadas.reduce((s, sem) => s + sem.totalComisiones, 0);
    const totalGeneralVales = semanasCombinadas.reduce((s, sem) => s + sem.totalVales, 0);
    const totalGeneralNeto = totalGeneralComisiones - totalGeneralVales;

    return semanasHTMLVisible + semanasHTMLOcultas +
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:.6rem;padding-top:.5rem;border-top:1px solid var(--border)">
        <div style="font-size:.7rem;color:var(--text2);line-height:1.2">TOTALES GENERALES<br><span style="font-size:.6rem;color:var(--text2)">(${semanasCombinadas.length} semanas)</span></div>
        <div style="text-align:right">
          <div style="font-family:var(--font-head);color:var(--accent);font-size:.8rem">+${fm(totalGeneralComisiones)}</div>
          <div style="font-family:var(--font-head);color:var(--warning);font-size:.8rem">-${fm(totalGeneralVales)}</div>
          <div style="font-family:var(--font-head);color:${totalGeneralNeto >= 0 ? 'var(--success)' : 'var(--danger)'};font-size:.9rem;font-weight:700">${totalGeneralNeto >= 0 ? '+' : ''}${fm(totalGeneralNeto)}</div>
        </div>
      </div>`;
  };

  main.innerHTML = `
    <div style="padding:.25rem 0">
      <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text);margin-bottom:.25rem">💵 Mi Cobro</div>
      <div style="font-size:.78rem;color:var(--text2);margin-bottom:1rem;text-transform:capitalize">${periodoLabel}${periodoBadge}</div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem">
          <div style="background:var(--surface2);border-radius:8px;padding:.6rem;text-align:center">
            <div style="font-size:.6rem;color:var(--text2);letter-spacing:1px">SUELDO BASE</div>
            <div style="font-family:var(--font-head);font-size:1rem;color:var(--success);margin-top:.2rem">${fm(totalSueldo)}</div>
          </div>
          <div style="background:rgba(0,229,255,.08);border-radius:8px;padding:.6rem;text-align:center">
            <div style="font-size:.6rem;color:var(--accent);letter-spacing:1px">COMISIONES</div>
            <div style="font-family:var(--font-head);font-size:1rem;color:var(--accent);margin-top:.2rem">+${fm(totalComisiones)}</div>
          </div>
          <div style="background:rgba(255,204,0,.08);border-radius:8px;padding:.6rem;text-align:center">
            <div style="font-size:.6rem;color:var(--warning);letter-spacing:1px">VALES TOMADOS</div>
            <div style="font-family:var(--font-head);font-size:1rem;color:var(--warning);margin-top:.2rem">-${fm(totalVales)}</div>
          </div>
          <div style="background:${totalNeto>=0?'rgba(0,255,136,.12)':'rgba(255,68,68,.12)'};border-radius:8px;padding:.6rem;text-align:center;border:1px solid ${totalNeto>=0?'rgba(0,255,136,.3)':'rgba(255,68,68,.3)'}">
            <div style="font-size:.6rem;color:${totalNeto>=0?'var(--success)':'var(--danger)'};letter-spacing:1px">A COBRAR</div>
            <div style="font-family:var(--font-head);font-size:1.1rem;color:${totalNeto>=0?'var(--success)':'var(--danger)'};margin-top:.2rem;font-weight:700">${fm(totalNeto)}</div>
          </div>
        </div>
      </div>

      <div style="font-family:var(--font-head);font-size:.72rem;color:var(--text2);letter-spacing:1px;margin:.5rem 0 .6rem">
        � COMISIONES Y VALES POR SEMANA (${semanasCombinadas.length} semana${semanasCombinadas.length !== 1 ? 's' : ''})
      </div>
      ${renderComisionesValesPorSemana()}

      <div style="font-size:.7rem;color:var(--text2);margin-top:1rem;text-align:center;line-height:1.5">
        Las comisiones surgen de las reparaciones donde el administrador te asignó un pago.<br>
        Si ves números que no cuadran, hablalo con el dueño del taller.
      </div>
    </div>`;
}

// ✅ EXPONER GLOBALMENTE
window.misTrabajos = misTrabajos;
window.miCobro = miCobro;


// ─── TAREA #63 · LOGO DEL TALLER (helpers globales) ─────────────────────────
let _logoTallerCache = null;
let _logoTallerInflight = null;

function invalidarLogoTallerCache() {
  _logoTallerCache = null;
  _logoTallerInflight = null;
}

function _logoTallerExtraerPath(url) {
  if (!url) return null;
  const m = url.match(/\/logos\/(.+)$/);
  return (m && m[1]) ? m[1] : null;
}

async function obtenerLogoTallerBase64() {
  const url = currentPerfil?.talleres?.logo_url || '';
  if (!url) return null;
  if (_logoTallerCache && _logoTallerCache.url === url) {
    return { dataUrl: _logoTallerCache.dataUrl, fmt: _logoTallerCache.fmt };
  }
  if (_logoTallerInflight) return _logoTallerInflight;
  const path = _logoTallerExtraerPath(url);
  if (!path) return null;
  _logoTallerInflight = (async () => {
    try {
      const { data: blob, error } = await sb.storage.from('logos').download(path);
      if (error || !blob) return null;
      let fmt = 'PNG';
      if (blob.type === 'image/jpeg') fmt = 'JPEG';
      else if (blob.type === 'image/webp') fmt = 'WEBP';
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      _logoTallerCache = { url, dataUrl, fmt };
      return { dataUrl, fmt };
    } catch (_) {
      return null;
    } finally {
      _logoTallerInflight = null;
    }
  })();
  return _logoTallerInflight;
}

async function aplicarLogoTallerEnUI() {
  const tieneLogo = !!(currentPerfil?.talleres?.logo_url);

  const pintar = (dataUrl) => {
    const sideHead = document.querySelector('#sidebar-header > div:first-child');
    if (sideHead) {
      if (dataUrl) {
        sideHead.outerHTML = `<div data-logo-slot="sidebar" style="display:flex;align-items:center;justify-content:flex-start"><img src="${dataUrl}" alt="logo" style="max-height:40px;max-width:100%;object-fit:contain"></div>`;
      } else {
        sideHead.outerHTML = `<div data-logo-slot="sidebar" style="font-family:var(--font-head);font-size:1.4rem;color:var(--accent);letter-spacing:3px">TALLERPRO</div>`;
      }
    }
    const top = document.querySelector('.topbar-logo');
    if (top) {
      if (dataUrl) {
        top.innerHTML = `<img src="${dataUrl}" alt="logo" style="max-height:28px;max-width:120px;object-fit:contain;display:block">`;
        top.style.padding = '0';
      } else {
        top.innerHTML = 'TALLERPRO';
        top.style.padding = '';
      }
    }
  };

  if (!tieneLogo) { pintar(null); return; }
  const data = await obtenerLogoTallerBase64();
  pintar(data ? data.dataUrl : null);
}

window.aplicarLogoTallerEnUI = aplicarLogoTallerEnUI;
window.invalidarLogoTallerCache = invalidarLogoTallerCache;
window.obtenerLogoTallerBase64 = obtenerLogoTallerBase64;
window.logoTallerPreview = logoTallerPreview;
window.quitarLogoTaller = quitarLogoTaller;
