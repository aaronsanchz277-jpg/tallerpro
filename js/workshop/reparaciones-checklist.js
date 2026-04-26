// ─── CHECKLIST DE RECEPCIÓN Y FICHA ──────────────────────────────────────────
async function modalChecklistRecepcion(repId) {
  const { data:r } = await sb.from('reparaciones').select('checklist_recepcion').eq('id',repId).single();
  const checklist = r?.checklist_recepcion || {};
  const items = [
    'Nivel de aceite','Nivel de refrigerante','Nivel de combustible',
    'Frenos','Luces','Neumáticos','Batería',
    'Carrocería (golpes/rayas)','Interior/tapizado',
    'Aire acondicionado','Limpiaparabrisas','Espejos'
  ];
  openModal(`
    <div class="modal-title">📋 Revisión de Recepción</div>
    <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">Marcar el estado de cada punto al recibir el vehículo</div>
    ${items.map(item => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border)">
      <span style="font-size:.85rem;flex:1">${item}</span>
      <div style="display:flex;gap:.3rem">
        <button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.style.opacity='.4');this.style.opacity='1';this.dataset.val='ok'" data-val="${checklist[item]||''}" style="padding:.25rem .5rem;border-radius:6px;border:1px solid var(--success);background:${checklist[item]==='ok'?'rgba(0,255,136,.2)':'transparent'};color:var(--success);font-size:.75rem;cursor:pointer;opacity:${checklist[item]==='ok'?'1':'.4'}">✓ OK</button>
        <button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.style.opacity='.4');this.style.opacity='1';this.dataset.val='problema'" data-val="${checklist[item]||''}" style="padding:.25rem .5rem;border-radius:6px;border:1px solid var(--danger);background:${checklist[item]==='problema'?'rgba(255,68,68,.15)':'transparent'};color:var(--danger);font-size:.75rem;cursor:pointer;opacity:${checklist[item]==='problema'?'1':'.4'}">⚠</button>
      </div>
    </div>`).join('')}
    <div class="form-group" style="margin-top:1rem"><label class="form-label">Km del vehículo</label><input class="form-input" id="f-km-recepcion" type="number" value="${h(checklist['_km']||'')}" placeholder="Ej: 45000"></div>
    <div class="form-group"><label class="form-label">Observaciones</label><textarea class="form-input" id="f-obs-recepcion" rows="2" placeholder="Detalles adicionales...">${h(checklist['_observaciones']||'')}</textarea></div>
    <button class="btn-primary" onclick="guardarChecklist('${repId}')">GUARDAR CHECKLIST</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarChecklist(repId) {
  const items = document.querySelectorAll('#modal-overlay .modal-content > div[style*="border-bottom"]');
  const checklist = {};
  items.forEach(row => {
    const label = row.querySelector('span').textContent;
    const btns = row.querySelectorAll('button');
    const okBtn = btns[0], probBtn = btns[1];
    if (okBtn.style.opacity === '1') checklist[label] = 'ok';
    else if (probBtn.style.opacity === '1') checklist[label] = 'problema';
  });
  const km = document.getElementById('f-km-recepcion')?.value;
  const obs = document.getElementById('f-obs-recepcion')?.value;
  if (km) checklist['_km'] = km;
  if (obs) checklist['_observaciones'] = obs;
  await safeCall(async () => {
    await offlineUpdate('reparaciones', { checklist_recepcion: checklist }, 'id', repId);
    toast('Checklist guardado','success'); 
    closeModal(); 
    detalleReparacion(repId);
  }, null, 'No se pudo guardar el checklist');
}

async function modalFichaRecepcion(repId) {
  const { data:rep } = await sb.from('reparaciones').select('*, vehiculos(patente,marca,modelo,color), clientes(nombre,telefono)').eq('id',repId).single();
  if(!rep) return;
  openModal(`
    <div class="modal-title">📋 FICHA DE RECEPCIÓN</div>
    <div style="background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);border-radius:8px;padding:.6rem;margin-bottom:1rem;font-size:.82rem">
      <strong>${rep.vehiculos?h(rep.vehiculos.marca)+' '+h(rep.vehiculos.patente):''}</strong> · ${rep.clientes?h(rep.clientes.nombre):'Sin cliente'}
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Kilometraje</label><input class="form-input" id="fr-km" type="number" placeholder="0"></div>
      <div class="form-group"><label class="form-label">Combustible</label>
        <select class="form-input" id="fr-comb"><option>RESERVA</option><option>1/4</option><option selected>1/2</option><option>3/4</option><option>LLENO</option></select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Fecha aprox. entrega</label><input class="form-input" id="fr-entrega" type="date"></div>
    <div class="sub-section-title" style="margin-top:.75rem">ACCESORIOS</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-bottom:.75rem">
      ${['Gato','Matafuego','Herramientas','Autoradio','Rueda auxilio','Alfombras','Vidrios OK','Doc. vehículo','Luces OK','Limpiaparabrisas'].map(a=>`
        <label style="display:flex;align-items:center;gap:.4rem;background:var(--surface2);border-radius:6px;padding:.35rem .5rem;font-size:.75rem;cursor:pointer">
          <input type="checkbox" class="fr-acc" value="${a}"> ${a}
        </label>`).join('')}
    </div>
    <div class="sub-section-title">ESTADO INTERIOR</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-bottom:.75rem">
      ${['Tablero','Asientos','Puertas','Techo','Parabrisas','Consola'].map(p=>`
        <div class="form-group" style="margin:0"><label class="form-label" style="font-size:.65rem">${p}</label>
          <select class="form-input fr-estado-int" data-parte="${p}" style="padding:.3rem;font-size:.78rem">
            <option>Bueno</option><option>Regular</option><option>Malo</option>
          </select>
        </div>`).join('')}
    </div>
    <div class="form-group"><label class="form-label">Daños / Averías</label><textarea class="form-input" id="fr-danos" rows="3" placeholder="Describir daños visibles..."></textarea></div>
    <div class="form-group"><label class="form-label">Observaciones</label><textarea class="form-input" id="fr-obs" rows="2"></textarea></div>
    <button class="btn-primary" style="background:var(--success)" onclick="confirmarIngreso('${repId}')">✓ CONFIRMAR INGRESO AL TALLER</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function confirmarIngreso(repId) {
  await safeCall(async () => {
    const accesorios = [...document.querySelectorAll('.fr-acc:checked')].map(c=>c.value);
    const estadoInterior = {};
    document.querySelectorAll('.fr-estado-int').forEach(s=>{estadoInterior[s.getAttribute('data-parte')]=s.value;});
    const ficha = {
      kilometraje:document.getElementById('fr-km').value,combustible:document.getElementById('fr-comb').value,
      fecha_entrega_aprox:document.getElementById('fr-entrega').value,accesorios,estado_interior:estadoInterior,
      danos:document.getElementById('fr-danos').value,observaciones:document.getElementById('fr-obs').value,
      fecha_ingreso:new Date().toISOString()
    };
    await sb.from('reparaciones').update({ ficha_recepcion:ficha, estado:'en_progreso' }).eq('id',repId);
    clearCache('reparaciones');toast('✓ Vehículo ingresado al taller','success');closeModal();detalleReparacion(repId);
  }, null, 'Error al confirmar ingreso');
}

function verFichaRecepcion(repId) {
  sb.from('reparaciones').select('ficha_recepcion, vehiculos(patente,marca), clientes(nombre)').eq('id',repId).single().then(({data:rep})=>{
    if(!rep||!rep.ficha_recepcion){toast('No hay ficha de recepción','error');return;}
    const f=rep.ficha_recepcion;
    openModal(`
      <div class="modal-title">📋 FICHA DE RECEPCIÓN</div>
      <div style="font-size:.82rem;color:var(--text2);margin-bottom:.75rem">${rep.vehiculos?h(rep.vehiculos.marca)+' '+h(rep.vehiculos.patente):''} · ${rep.clientes?h(rep.clientes.nombre):''}</div>
      <div class="info-grid">
        <div class="info-item"><div class="label">Kilometraje</div><div class="value">${h(f.kilometraje||'-')} km</div></div>
        <div class="info-item"><div class="label">Combustible</div><div class="value">${h(f.combustible||'-')}</div></div>
        <div class="info-item"><div class="label">Fecha ingreso</div><div class="value">${f.fecha_ingreso?formatFecha(f.fecha_ingreso.split('T')[0]):'-'}</div></div>
        <div class="info-item"><div class="label">Entrega aprox.</div><div class="value">${f.fecha_entrega_aprox?formatFecha(f.fecha_entrega_aprox):'-'}</div></div>
      </div>
      ${f.accesorios?.length?`<div class="sub-section"><div class="sub-section-title">ACCESORIOS</div><div style="display:flex;flex-wrap:wrap;gap:.3rem">${f.accesorios.map(a=>`<span style="background:rgba(0,255,136,.1);color:var(--success);border-radius:4px;padding:2px 6px;font-size:.7rem">✓ ${h(a)}</span>`).join('')}</div></div>`:''}
      ${f.estado_interior?`<div class="sub-section"><div class="sub-section-title">ESTADO INTERIOR</div><div class="info-grid">${Object.entries(f.estado_interior).map(([k,v])=>`<div class="info-item"><div class="label">${h(k)}</div><div class="value" style="color:${v==='Bueno'?'var(--success)':v==='Regular'?'var(--warning)':'var(--danger)'}">${h(v)}</div></div>`).join('')}</div></div>`:''}
      ${f.danos?`<div class="sub-section"><div class="sub-section-title">DAÑOS</div><p style="font-size:.82rem;color:var(--text2)">${h(f.danos)}</p></div>`:''}
      ${f.observaciones?`<div class="sub-section"><div class="sub-section-title">OBSERVACIONES</div><p style="font-size:.82rem;color:var(--text2)">${h(f.observaciones)}</p></div>`:''}
      <div style="display:flex;gap:.5rem;margin-top:1rem">
        <button class="btn-primary" style="flex:1;margin:0" onclick="window.print()">🖨️ Imprimir</button>
        <button class="btn-secondary" style="flex:1;margin:0" onclick="closeModal()">Cerrar</button>
      </div>`);
  });
}

async function generarCartaConformidad(repId) {
  const { data:rep } = await sb.from('reparaciones').select('*, vehiculos(patente,marca,modelo), clientes(nombre)').eq('id',repId).single();
  if(!rep) return;
  const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';
  const fecha = new Date().toLocaleDateString('es-PY',{day:'2-digit',month:'long',year:'numeric'});
  openModal(`
    <div id="carta-conformidad" style="padding:.5rem">
      <div style="text-align:center;font-family:var(--font-head);font-size:1.2rem;color:var(--accent);margin-bottom:1rem;letter-spacing:2px">CARTA DE CONFORMIDAD</div>
      <div style="text-align:right;font-size:.82rem;color:var(--text2);margin-bottom:1rem">${fecha}</div>
      <div style="font-size:.85rem;line-height:1.8;color:var(--text)">
        <p>Por medio de la presente, yo <strong>${h(rep.clientes?.nombre||'________________')}</strong>, dejo constancia de que retiro el vehículo 
        <strong>${h(rep.vehiculos?.marca||'')} ${h(rep.vehiculos?.modelo||'')}</strong>, chapa <strong>${h(rep.vehiculos?.patente||'')}</strong>, 
        de las instalaciones de <strong>${h(tallerNombre)}</strong>, habiendo verificado los trabajos realizados y encontrándome conforme con los mismos.</p>
        <p style="margin-top:.75rem">Trabajo realizado: <strong>${h(rep.descripcion||'')}</strong></p>
        <p>Monto: <strong>${fm(rep.costo||0)}</strong></p>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:2.5rem;padding-top:1rem">
        <div style="text-align:center;width:45%"><div style="border-top:1px solid var(--text2);padding-top:.3rem;font-size:.78rem;color:var(--text2)">${h(tallerNombre)}</div></div>
        <div style="text-align:center;width:45%"><div style="border-top:1px solid var(--text2);padding-top:.3rem;font-size:.78rem;color:var(--text2)">Cliente</div></div>
      </div>
    </div>
    <div style="margin-top:1rem;display:flex;gap:.5rem">
      <button class="btn-primary" style="flex:1;margin:0" onclick="window.print()">🖨️ Imprimir</button>
      <button class="btn-primary" style="flex:1;margin:0;background:var(--success)" onclick="marcarEntregado('${repId}')">📨 Marcar Entregado</button>
      <button class="btn-secondary" style="flex:1;margin:0" onclick="closeModal()">Cerrar</button>
    </div>`);
}

async function marcarEntregado(repId) {
  await safeCall(async () => {
    await sb.from('reparaciones').update({ estado:'finalizado', fecha_entrega:new Date().toISOString() }).eq('id',repId);
    clearCache('reparaciones');toast('✓ Vehículo entregado','success');closeModal();navigate('reparaciones');
  }, null, 'Error al marcar entregado');
}
