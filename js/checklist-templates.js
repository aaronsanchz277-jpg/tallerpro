// ─── CHECKLISTS PERSONALIZABLES ──────────────────────────────────────────────
async function modalGestionarChecklists() {
  const { data: plantillas } = await sb.from('checklist_plantillas').select('*').eq('taller_id', tid()).order('nombre');
  
  openModal(`
    <div class="modal-title">📋 Plantillas de inspección</div>
    <div style="margin-bottom:1rem">
      ${(plantillas||[]).map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
          <span>${h(p.nombre)} (${p.items?.length||0} ítems)</span>
          <div>
            <button onclick="modalEditarPlantilla('${p.id}')" style="background:none;border:none;color:var(--accent);cursor:pointer">✏️</button>
            <button onclick="eliminarPlantilla('${p.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer">✕</button>
          </div>
        </div>`).join('')}
    </div>
    <button class="btn-primary" onclick="modalNuevaPlantilla()">+ Nueva plantilla</button>
    <button class="btn-secondary" onclick="closeModal()">Cerrar</button>
  `);
}

async function modalNuevaPlantilla(id = null) {
  let plantilla = { nombre: '', items: [], tipo_trabajo: '' };
  if (id) {
    const { data } = await sb.from('checklist_plantillas').select('*').eq('id', id).single();
    if (data) plantilla = data;
  }
  window._plantillaItems = plantilla.items || [];
  
  openModal(`
    <div class="modal-title">${id ? 'Editar' : 'Nueva'} plantilla</div>
    <div class="form-group"><label class="form-label">Nombre</label><input class="form-input" id="pl-nombre" value="${h(plantilla.nombre)}" placeholder="Inspección básica"></div>
    <div class="form-group"><label class="form-label">Tipo de trabajo (opcional)</label>
      <select class="form-input" id="pl-tipo">
        <option value="">Cualquier trabajo</option>
        ${TIPOS_TRABAJO.map(t => `<option value="${t}" ${plantilla.tipo_trabajo===t?'selected':''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="sub-section-title">ÍTEMS</div>
    <div id="pl-items-list">${renderPlantillaItems()}</div>
    <div style="display:flex;gap:.3rem;margin:.5rem 0">
      <input class="form-input" id="pl-new-item" placeholder="Nuevo ítem...">
      <button onclick="plantillaAddItem()" class="btn-add" style="padding:.4rem .8rem">+</button>
    </div>
    <button class="btn-primary" onclick="guardarPlantilla('${id}')">Guardar</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
  `);
}

function renderPlantillaItems() {
  return window._plantillaItems.map((item, i) => `
    <div style="display:flex;align-items:center;gap:.3rem;padding:.3rem 0">
      <span style="flex:1">${h(item)}</span>
      <button onclick="plantillaRemoveItem(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer">✕</button>
    </div>
  `).join('');
}

function plantillaAddItem() {
  const input = document.getElementById('pl-new-item');
  const val = input.value.trim();
  if (!val) return;
  window._plantillaItems.push(val);
  input.value = '';
  document.getElementById('pl-items-list').innerHTML = renderPlantillaItems();
}

function plantillaRemoveItem(i) {
  window._plantillaItems.splice(i, 1);
  document.getElementById('pl-items-list').innerHTML = renderPlantillaItems();
}

async function guardarPlantilla(id) {
  const nombre = document.getElementById('pl-nombre').value.trim();
  if (!nombre) { toast('El nombre es obligatorio','error'); return; }
  
  const data = {
    nombre,
    tipo_trabajo: document.getElementById('pl-tipo').value || null,
    items: window._plantillaItems,
    taller_id: tid()
  };
  
  const { error } = id 
    ? await sb.from('checklist_plantillas').update(data).eq('id', id)
    : await sb.from('checklist_plantillas').insert(data);
    
  if (error) { toast('Error: '+error.message,'error'); return; }
  toast(id ? 'Plantilla actualizada' : 'Plantilla creada','success');
  closeModal();
  modalGestionarChecklists();
}

async function eliminarPlantilla(id) {
  confirmar('¿Eliminar esta plantilla?', async () => {
    await sb.from('checklist_plantillas').delete().eq('id', id);
    toast('Plantilla eliminada','success');
    modalGestionarChecklists();
  });
}

// Modificar modalChecklistRecepcion para usar plantillas
async function modalChecklistRecepcion(repId) {
  const { data: r } = await sb.from('reparaciones').select('checklist_recepcion, tipo_trabajo').eq('id', repId).single();
  const checklist = r?.checklist_recepcion || {};
  
  // Cargar plantilla según tipo de trabajo
  const { data: plantilla } = await sb.from('checklist_plantillas')
    .select('items')
    .eq('taller_id', tid())
    .eq('tipo_trabajo', r?.tipo_trabajo)
    .maybeSingle();
  
  const items = plantilla?.items?.length ? plantilla.items : [
    'Nivel de aceite','Nivel de refrigerante','Nivel de combustible',
    'Frenos','Luces','Neumáticos','Batería',
    'Carrocería','Interior','Aire acondicionado'
  ];
  
  openModal(`
    <div class="modal-title">📋 Revisión de Recepción</div>
    <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">Marcar el estado de cada punto</div>
    ${items.map(item => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border)">
      <span style="font-size:.85rem;flex:1">${h(item)}</span>
      <div style="display:flex;gap:.3rem">
        <button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.style.opacity='.4');this.style.opacity='1';this.dataset.val='ok'" data-val="${checklist[item]||''}" style="padding:.25rem .5rem;border-radius:6px;border:1px solid var(--success);background:${checklist[item]==='ok'?'rgba(0,255,136,.2)':'transparent'};color:var(--success);font-size:.75rem;cursor:pointer;opacity:${checklist[item]==='ok'?'1':'.4'}">✓ OK</button>
        <button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.style.opacity='.4');this.style.opacity='1';this.dataset.val='problema'" data-val="${checklist[item]||''}" style="padding:.25rem .5rem;border-radius:6px;border:1px solid var(--danger);background:${checklist[item]==='problema'?'rgba(255,68,68,.15)':'transparent'};color:var(--danger);font-size:.75rem;cursor:pointer;opacity:${checklist[item]==='problema'?'1':'.4'}">⚠</button>
      </div>
    </div>`).join('')}
    <div class="form-group" style="margin-top:1rem"><label class="form-label">Km del vehículo</label><input class="form-input" id="f-km-recepcion" type="number" value="${h(checklist['_km']||'')}" placeholder="Ej: 45000"></div>
    <div class="form-group"><label class="form-label">Observaciones</label><textarea class="form-input" id="f-obs-recepcion" rows="2">${h(checklist['_observaciones']||'')}</textarea></div>
    <button class="btn-primary" onclick="guardarChecklist('${repId}')">GUARDAR</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
  `);
}
