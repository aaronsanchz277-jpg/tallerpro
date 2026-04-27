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
// País / Moneda: presets para los países hispanohablantes más comunes en
// los que opera la app. La elección define el símbolo (₲, $, Bs, etc.) y
// el locale que usa toLocaleString para los separadores de miles.
// Default Paraguay: mantiene el comportamiento histórico de la app.
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
  // Tarea #63: el campo logo_url puede no existir todavía si la migración
  // SQL no fue aplicada. En ese caso ocultamos la sección.
  const tieneLogoCol = ('logo_url' in taller);
  const logoActual = taller.logo_url || '';
  const logoSection = tieneLogoCol ? `
    <div class="form-group">
      <label class="form-label">Logo del taller</label>
      <div id="logo-preview-wrap" style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem">
        <div id="logo-preview" style="width:64px;height:64px;border-radius:10px;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
          ${logoActual
            ? `<img src="${h(logoActual)}" alt="logo" style="max-width:100%;max-height:100%;object-fit:contain">`
            : `<span style="font-size:.7rem;color:var(--text2)">sin logo</span>`}
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
}

// Tarea #63: vista previa del logo elegido y validación de tamaño/tipo.
// El archivo se guarda en _logoTallerPendingFile y solo se sube cuando el
// usuario apreta "Guardar". Si elige otro archivo, reemplaza el anterior.
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

// Sube el archivo al bucket `logos` con path `{taller_id}/logo-{ts}.{ext}`,
// borra el archivo anterior si existía dentro del mismo bucket, y devuelve
// la URL pública. Lanza Error en caso de fallo.
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
  // Borrar archivo viejo si era de este taller (mismo bucket).
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

  // Tarea #63: si hay archivo pendiente, subirlo antes del UPDATE.
  let nuevoLogoUrl;  // undefined = no tocar el campo
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
      // Defense-in-depth: aunque la RLS ya bloquea borrar archivos de otros
      // talleres, validamos que el path empiece con nuestro taller_id para
      // no enviar al storage requests obviamente cross-tenant.
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
  // Actualizar el perfil en memoria para que la moneda nueva tenga efecto
  // sin tener que cerrar sesión y volver a entrar.
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
  // Invalidar caches del logo y refrescar el render del header/sidebar.
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
// Tarea #17: pantalla del empleado para ver su sueldo base, comisiones del
// período (suma de `pago` en reparacion_mecanicos del taller, vinculadas a
// reparaciones cuya fecha cae dentro del período de sueldo activo), vales
// tomados y total a cobrar. Requiere que el perfil esté vinculado a una
// ficha de empleado (currentPerfil.empleado_id IS NOT NULL); de lo
// contrario muestra un mensaje pidiendo al admin que lo vincule.
//
// Período: usa el `periodos_sueldo` con estado='abierto' (consistente con
// el módulo Sueldos del admin). Si no hay ninguno abierto, cae al mes
// corriente como fallback razonable.
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
  // Buscamos un período abierto del taller (igual que hace Sueldos). Si no
  // hay, fallback al mes corriente.
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
  // Comisiones: reparacion_mecanicos restringido por RLS a SUS filas
  // (Tarea #17, policy `reparacion_mecanicos_empleado_select_own`).
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

  // Resolver fechas de las reparaciones para filtrar por período.
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

      <div style="font-family:var(--font-head);font-size:.72rem;color:var(--text2);letter-spacing:1px;margin:.5rem 0 .4rem;display:flex;justify-content:space-between;align-items:baseline">
        <span>🔧 COMISIONES DEL PERÍODO (${comisionesDelPeriodo.length})</span>
        ${totalHoras > 0 ? `<span style="color:var(--accent);font-size:.7rem">⏱ ${totalHoras.toFixed(1)} hs</span>` : ''}
      </div>
      ${comisionesDelPeriodo.length === 0
        ? `<div class="empty" style="padding:.75rem"><p style="font-size:.82rem">No tenés comisiones registradas en este período</p></div>`
        : comisionesDelPeriodo.map(c => `
          <div class="card" style="cursor:pointer" onclick="detalleReparacion('${c.rep.id}')">
            <div class="card-header">
              <div class="card-avatar">🔧</div>
              <div class="card-info">
                <div class="card-name">${h(c.rep.descripcion || 'Reparación')}</div>
                <div class="card-sub">${c.rep.vehiculos ? h(c.rep.vehiculos.patente) + ' · ' : ''}${formatFecha(c.rep.fecha)}${c.horas > 0 ? ` · ⏱ ${c.horas} hs` : ''}</div>
              </div>
              <div style="font-family:var(--font-head);color:var(--accent);font-size:.95rem">+${fm(c.pago)}</div>
            </div>
          </div>`).join('')}

      <div style="font-family:var(--font-head);font-size:.72rem;color:var(--text2);letter-spacing:1px;margin:1rem 0 .4rem">
        💸 VALES TOMADOS (${vales.length})
      </div>
      ${vales.length === 0
        ? `<div class="empty" style="padding:.75rem"><p style="font-size:.82rem">No tomaste vales este mes</p></div>`
        : vales.map(v => `
          <div class="card" style="cursor:default">
            <div class="card-header">
              <div class="card-avatar">💵</div>
              <div class="card-info">
                <div class="card-name">${h(v.concepto || 'Vale')}</div>
                <div class="card-sub">${formatFecha(v.fecha)}</div>
              </div>
              <div style="font-family:var(--font-head);color:var(--warning);font-size:.95rem">-${fm(v.monto)}</div>
            </div>
          </div>`).join('')}

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
// Render del logo en el sidebar y el topbar de la app: si hay logo_url,
// reemplaza el texto "TALLERPRO" por la imagen; si no, deja el texto.
// Idempotente — se llama desde buildNav y desde guardarConfigDatos.
function aplicarLogoTallerEnUI() {
  const logoUrl = currentPerfil?.talleres?.logo_url || '';
  // Sidebar header (index.html L184)
  const sideHead = document.querySelector('#sidebar-header > div:first-child');
  if (sideHead) {
    if (logoUrl) {
      sideHead.outerHTML = `<div data-logo-slot="sidebar" style="display:flex;align-items:center;justify-content:flex-start"><img src="${h(logoUrl)}" alt="logo" style="max-height:40px;max-width:100%;object-fit:contain"></div>`;
    } else {
      sideHead.outerHTML = `<div data-logo-slot="sidebar" style="font-family:var(--font-head);font-size:1.4rem;color:var(--accent);letter-spacing:3px">TALLERPRO</div>`;
    }
  }
  // Topbar (index.html L202)
  const top = document.querySelector('.topbar-logo');
  if (top) {
    if (logoUrl) {
      top.innerHTML = `<img src="${h(logoUrl)}" alt="logo" style="max-height:28px;max-width:120px;object-fit:contain;display:block">`;
      top.style.padding = '0';
    } else {
      top.innerHTML = 'TALLERPRO';
      top.style.padding = '';
    }
  }
}

// Cache en memoria del logo en formato Base64 (data URL) para usar en PDFs
// con jsPDF.addImage. Memoizado por sesión y por URL — si el admin cambia
// el logo, `invalidarLogoTallerCache()` lo limpia.
let _logoTallerCache = null; // { url, dataUrl, fmt }

function invalidarLogoTallerCache() { _logoTallerCache = null; }

// Devuelve { dataUrl, fmt } o null si el taller no tiene logo o falla la
// descarga (no se considera error fatal — el PDF se genera sin logo).
async function obtenerLogoTallerBase64() {
  const url = currentPerfil?.talleres?.logo_url || '';
  if (!url) return null;
  if (_logoTallerCache && _logoTallerCache.url === url) {
    return { dataUrl: _logoTallerCache.dataUrl, fmt: _logoTallerCache.fmt };
  }
  try {
    const resp = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    // Detectar formato para jsPDF: PNG | JPEG | WEBP. Default PNG.
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
  }
}

window.aplicarLogoTallerEnUI = aplicarLogoTallerEnUI;
window.invalidarLogoTallerCache = invalidarLogoTallerCache;
window.obtenerLogoTallerBase64 = obtenerLogoTallerBase64;
window.logoTallerPreview = logoTallerPreview;
window.quitarLogoTaller = quitarLogoTaller;
