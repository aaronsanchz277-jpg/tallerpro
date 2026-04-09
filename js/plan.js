// ─── MI PLAN (Suscripción) ──────────────────────────────────────────────────
async function miPlan() {
  const { data: planes } = await sb.from('planes').select('*').order('precio');
  const sub = currentSuscripcion;
  const plan = currentPlan;
  const hoy = new Date().toISOString().split('T')[0];
  const venc = sub?.fecha_vencimiento;
  const diasRestantes = venc ? Math.ceil((new Date(venc+'T23:59') - new Date()) / 86400000) : null;

  const estadoLabel = {
    trial: `🎁 PRUEBA GRATIS — ${diasRestantes||0} días restantes`,
    activa: `✓ ACTIVA — vence ${venc?formatFecha(venc):''}`,
    vencida: '⚠️ VENCIDA — funciones limitadas',
    cancelada: '✕ CANCELADA'
  };

  const estadoColor = {
    trial: 'var(--accent)',
    activa: 'var(--success)',
    vencida: 'var(--danger)',
    cancelada: 'var(--text2)'
  };

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="font-family:var(--font-head);font-size:1.5rem;color:var(--text);margin-bottom:.25rem">Mi Plan</div>

      <div style="background:var(--surface);border:2px solid ${sub?.estado==='activa'||sub?.estado==='trial'?'var(--accent)':'var(--danger)'};border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;${sub?.estado==='activa'||sub?.estado==='trial'?'box-shadow:0 0 12px rgba(0,229,255,.15)':''}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
          <div>
            <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--accent)">TallerPro</div>
            <div style="font-size:.8rem;color:${estadoColor[sub?.estado]||'var(--text2)'};margin-top:.25rem">${estadoLabel[sub?.estado]||'Sin suscripción'}</div>
          </div>
          <div style="font-family:var(--font-head);font-size:1.8rem;color:var(--accent)">₲250.000<span style="font-size:.7rem;color:var(--text2)">/mes</span></div>
        </div>
        ${sub?.fecha_vencimiento?`<div style="font-size:.8rem;color:var(--text2);margin-bottom:.75rem">Vence: ${formatFecha(sub.fecha_vencimiento)}</div>`:''}
        <div style="font-size:.85rem;color:var(--text);margin-bottom:.75rem">Todo incluido, sin límites:</div>
        <div style="display:flex;flex-wrap:wrap;gap:.4rem;font-size:.75rem">
          <span class="chip-success">✓ Usuarios ilimitados</span>
          <span class="chip-success">✓ Clientes ilimitados</span>
          <span class="chip-success">✓ Trabajos</span>
          <span class="chip-success">✓ Inventario</span>
          <span class="chip-success">✓ Presupuestos PDF</span>
          <span class="chip-success">✓ Créditos</span>
          <span class="chip-success">✓ WhatsApp</span>
          <span class="chip-success">✓ Agenda inteligente</span>
          <span class="chip-success">✓ Mantenimientos</span>
          <span class="chip-success">✓ Reportes</span>
          <span class="chip-success">✓ Checklist recepción</span>
          <span class="chip-success">✓ Fotos del vehículo</span>
          <span class="chip-success">✓ Aprobación digital</span>
          <span class="chip-success">✓ Emails automáticos</span>
          <span class="chip-success">✓ Funciona offline</span>
          <span class="chip-success">✓ 4 idiomas</span>
        </div>
      </div>

      <div style="background:var(--surface2);border-radius:10px;padding:1rem;font-size:.78rem;color:var(--text2);text-align:center">
        <div style="margin-bottom:.75rem;font-family:var(--font-head);font-size:.85rem;color:var(--text)">📲 Para activar tu plan:</div>
        <div style="font-size:.82rem;color:var(--text);margin-bottom:.3rem">1. Hacé la transferencia de <strong style="color:var(--accent)">₲250.000</strong> a:</div>
        <div style="background:var(--surface);border:1px solid var(--accent);border-radius:10px;padding:.75rem;margin:.5rem 0;text-align:left">
          <div style="font-size:.82rem;color:var(--text);margin-bottom:.3rem">👤 <strong style="color:var(--accent)">Aaron Sanchez</strong></div>
          <div style="font-size:.82rem;color:var(--text);margin-bottom:.3rem">🪪 CI: <strong>6.982.720</strong></div>
          <div style="font-size:.72rem;color:var(--text2)">Podés transferir por banco, billetera electrónica o giro</div>
        </div>
        <div id="qr-pago-container" style="margin-bottom:.75rem"></div>
        <div style="font-size:.82rem;color:var(--text);margin-bottom:.75rem">2. Mandanos el comprobante por WhatsApp</div>
        <button onclick="window.open('https://wa.me/595982333971?text=${encodeURIComponent('Hola! Quiero activar TallerPro (₲250.000/mes) para el taller: ' + (currentPerfil?.talleres?.nombre||'') + '. Adjunto comprobante.')}')" style="width:100%;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:8px;padding:.6rem;font-family:var(--font-head);font-size:.9rem;cursor:pointer">💬 Enviar comprobante por WhatsApp</button>
      </div>
    </div>`;
}

async function elegirPlan(planId) {
  const { data: planes } = await sb.from('planes').select('*');
  const plan = (planes||[]).find(p => p.id === planId);
  const tallerNombre = currentPerfil?.talleres?.nombre || '';
  
  openModal(`
    <div class="modal-title">Activar Plan ${h(plan?.nombre||'')}</div>
    <div style="text-align:center;margin-bottom:1rem">
      <div style="font-family:var(--font-head);font-size:2rem;color:var(--accent)">₲${gs(plan?.precio||0)}<span style="font-size:.8rem;color:var(--text2)">/mes</span></div>
    </div>
    <div style="background:var(--surface2);border-radius:10px;padding:1rem;margin-bottom:1rem">
      <div style="font-size:.85rem;color:var(--text);margin-bottom:.5rem;font-weight:600">Pasos para activar:</div>
      <div style="font-size:.82rem;color:var(--text2);margin-bottom:.3rem">1️⃣ Transferí <strong style="color:var(--accent)">₲${gs(plan?.precio||0)}</strong> a nuestra cuenta</div>
      <div style="font-size:.82rem;color:var(--text2);margin-bottom:.3rem">2️⃣ Hacé captura del comprobante</div>
      <div style="font-size:.82rem;color:var(--text2)">3️⃣ Envialo por WhatsApp tocando el botón de abajo</div>
    </div>
    <button onclick="window.open('https://wa.me/595982333971?text=${encodeURIComponent('Hola! Quiero activar el plan ' + (plan?.nombre||'') + ' (₲' + gs(plan?.precio||0) + '/mes) para el taller: ' + tallerNombre + '. Adjunto comprobante.')}')" style="width:100%;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.7rem;font-family:var(--font-head);font-size:.95rem;cursor:pointer;margin-bottom:.5rem">💬 Enviar comprobante por WhatsApp</button>
    <div style="font-size:.72rem;color:var(--text2);text-align:center;margin-bottom:1rem">Tu plan se activará en menos de 24 horas</div>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
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
        const estadoColor = { trial:'var(--warning)', activa:'var(--success)', vencida:'var(--danger)', cancelada:'var(--text2)' };
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

// ─── CONFIGURAR DATOS DEL TALLER ────────────────────────────────────────────
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
