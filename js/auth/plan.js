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
