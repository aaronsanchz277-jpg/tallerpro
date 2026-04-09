// ─── VISTA CLIENTE ────────────────────────────────────────────────────────────
async function misVehiculos() {
  // Buscar cliente_id desde el perfil
  const { data: perfil } = await sb.from('perfiles').select('cliente_id').eq('id', currentUser.id).maybeSingle();

  if (!perfil?.cliente_id) {
    document.getElementById('main-content').innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
        <p style="font-size:1rem;margin-bottom:.5rem">${t('cuentaPendiente')}</p>
        <p style="font-size:.8rem">${t('cuentaPendienteMsg')}/p>
      </div>`;
    return;
  }

  const { data } = await sb.from('vehiculos').select('*').eq('cliente_id', perfil.cliente_id);
  document.getElementById('main-content').innerHTML = `
    <div class="section-header"><div class="section-title">${t('misAutos')}</div></div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('vehSinDatos')}</p></div>` :
      (data||[]).map(v => `
      <div class="card">
        <div class="card-header">
          ${v.foto_url?`<img src="${safeFotoUrl(v.foto_url)}" style="width:44px;height:44px;object-fit:cover;border-radius:8px">`:`<div class="card-avatar" style="font-size:.8rem">${h(v.patente)}</div>`}
          <div class="card-info"><div class="card-name">${h(v.marca)} ${h(v.modelo||'')}</div><div class="card-sub">${h(v.patente)} · ${h(v.anio||'')}</div></div>
        </div>
      </div>`).join('')}`;
}

async function misReparaciones() {
  if (currentPerfil?.rol !== 'cliente') { dashboard(); return; }

  const { data: perfil } = await sb.from('perfiles').select('cliente_id').eq('id', currentUser.id).maybeSingle();

  if (!perfil?.cliente_id) {
    document.getElementById('main-content').innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
        <p style="font-size:1rem;margin-bottom:.5rem">${t('cuentaPendiente')}</p>
        <p style="font-size:.8rem">${t('cuentaPendienteMsg2')}</p>
      </div>`;
    return;
  }

  const { data } = await sb.from('reparaciones').select('*, vehiculos(patente,marca)').eq('cliente_id', perfil.cliente_id).order('created_at',{ascending:false});
  document.getElementById('main-content').innerHTML = `
    <div class="section-header"><div class="section-title">${t('misReps')}</div></div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('repSinDatos')}</p></div>` :
      (data||[]).map(r => `
      <div class="card">
        <div class="card-header">
          <div class="card-avatar">🔧</div>
          <div class="card-info">
            <div class="card-name">${h(r.descripcion)}</div>
            <div class="card-sub">${r.vehiculos?h(r.vehiculos.patente)+' · '+h(r.vehiculos.marca):''} · ${formatFecha(r.fecha)}</div>
          </div>
          <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
        </div>
      </div>`).join('')}`;
}

