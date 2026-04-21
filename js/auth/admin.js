// ─── MIS TRABAJOS (Empleado) ────────────────────────────────────────────────
async function misTrabajos({ filtro='en_progreso' }={}) {
  if (currentPerfil?.rol !== 'empleado') { dashboard(); return; }

  const userId = currentUser.id;

  // Consulta 1: por mecanico_id
  const { data: porMecanico } = await sb
    .from('reparacion_mecanicos')
    .select('reparacion_id')
    .eq('mecanico_id', userId);

  // Consulta 2: por empleado_id
  const { data: porEmpleado } = await sb
    .from('reparacion_mecanicos')
    .select('reparacion_id')
    .eq('empleado_id', userId);

  // Unir IDs sin duplicados
  const idsMec = (porMecanico || []).map(a => a.reparacion_id);
  const idsEmp = (porEmpleado || []).map(a => a.reparacion_id);
  const misRepIds = [...new Set([...idsMec, ...idsEmp])];

  let data = [];
  if (misRepIds.length > 0) {
    let q = sb.from('reparaciones')
      .select('*, vehiculos(patente,marca), clientes(nombre)')
      .in('id', misRepIds)
      .order('created_at', { ascending: false });

    if (filtro !== 'todos') {
      q = q.eq('estado', filtro);
    }

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
              <div class="card-sub">${formatFecha(r.fecha)} ${r.costo ? '· ₲'+gs(r.costo) : ''}</div>
            </div>
            <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
          </div>
        </div>`).join('')}
    </div>`;
}

// ─── SUPER-ADMIN: Panel de gestión de talleres ──────────────────────────────
let _isSuperAdmin = false;

async function checkSuperAdmin() {
  const { data } = await sb.from('super_admins').select('user_id').eq('user_id', currentUser?.id).maybeSingle();
  _isSuperAdmin = !!data;
}

async function superAdminPanel() {
  if (!_isSuperAdmin) { navigate('dashboard'); return; }
  
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
              <button onclick="modalGestionarTaller('${taller.id}','${h(taller.nombre)}')" style="font-size:.65rem;background:var(--accent);color:#000;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-weight:600">Gestionar</button>
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
        ${(planes||[]).map(p => `<option value="${p.id}" ${sub?.plan_id===p.id?'selected':''}>${h(p.nombre)} — ₲${gs(p.precio)}/mes</option>`).join('')}
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
async function modalConfigDatos() {
  const { data: taller } = await sb.from('talleres').select('*').eq('id', tid()).single();
  if (!taller) return;
  openModal(`
    <div class="modal-title">⚙️ Configurar Taller</div>
    <div class="form-group"><label class="form-label">Nombre del taller</label><input class="form-input" id="f-taller-nombre" value="${h(taller.nombre||'')}"></div>
    <div class="form-group"><label class="form-label">RUC</label><input class="form-input" id="f-taller-ruc" value="${h(taller.ruc||'')}" placeholder="80012345-6"></div>
    <div class="form-group"><label class="form-label">Teléfono / WhatsApp principal</label>${phoneInput('f-taller-tel',taller.telefono,'0981 123 456')}</div>
    <div class="form-group"><label class="form-label">Dirección</label><input class="form-input" id="f-taller-dir" value="${h(taller.direccion||'')}" placeholder="Av. Ejemplo 123"></div>
    <div style="background:var(--surface2);border-radius:8px;padding:.75rem;margin-top:.5rem;margin-bottom:1rem">
      <div style="font-size:.75rem;color:var(--text2)">💡 El RUC y dirección aparecen en las facturas</div>
      <div style="font-size:.75rem;color:var(--text2)">💡 El teléfono se usa para WhatsApp</div>
    </div>
    <button class="btn-primary" onclick="guardarConfigDatos()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarConfigDatos() {
  const nombre = document.getElementById('f-taller-nombre').value.trim();
  const ruc = document.getElementById('f-taller-ruc').value.trim();
  const telefono = document.getElementById('f-taller-tel').value.trim();
  const direccion = document.getElementById('f-taller-dir').value.trim();
  if (!nombre) { toast('El nombre es obligatorio','error'); return; }
  const { error } = await sb.from('talleres').update({ nombre, ruc, telefono, direccion }).eq('id', tid());
  if (error) { toast('Error: '+error.message,'error'); return; }
  if (currentPerfil?.talleres) {
    currentPerfil.talleres.nombre = nombre;
    currentPerfil.talleres.telefono = telefono;
    currentPerfil.talleres.ruc = ruc;
    currentPerfil.talleres.direccion = direccion;
  }
  toast('Taller actualizado','success');
  closeModal();
  navigate('dashboard');
}
