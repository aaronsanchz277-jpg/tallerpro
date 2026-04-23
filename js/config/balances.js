// ─── GESTIÓN DE BALANCES (MÚLTIPLES CAJAS) ──────────────────────────────────
async function balances() {
  const { data: lista } = await sb.from('balances')
    .select('*')
    .eq('taller_id', tid())
    .order('nombre');

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">💰 Balances (Cajas)</div>
      <button class="btn-add" onclick="modalNuevoBalance()">+ Nuevo Balance</button>
    </div>
    <p style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">Creá diferentes balances para separar tus ingresos y gastos (ej: Efectivo, Banco, Personal).</p>
    ${(lista||[]).length === 0 ? '<div class="empty"><p>No hay balances creados. Creá uno para empezar.</p></div>' :
      lista.map(b => `
      <div class="card" onclick="modalEditarBalance('${b.id}')">
        <div class="card-header">
          <div class="card-avatar" style="background:${b.color||'var(--accent)'}"></div>
          <div class="card-info">
            <div class="card-name">${h(b.nombre)}</div>
            <div class="card-sub">${h(b.descripcion||'')}</div>
          </div>
        </div>
      </div>`).join('')}
  `;
}

function modalNuevoBalance() {
  openModal(`
    <div class="modal-title">Nuevo Balance</div>
    <div class="form-group"><label class="form-label">Nombre *</label><input class="form-input" id="bal-nombre" placeholder="Efectivo Caja"></div>
    <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="bal-desc" placeholder="Dinero en efectivo"></div>
    <div class="form-group"><label class="form-label">Color</label><input class="form-input" id="bal-color" type="color" value="#00e5ff"></div>
    <button class="btn-primary" onclick="guardarBalance()">Guardar</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function modalEditarBalance(id) {
  const { data: b } = await sb.from('balances').select('*').eq('id', id).single();
  if (!b) return;
  openModal(`
    <div class="modal-title">Editar Balance</div>
    <div class="form-group"><label class="form-label">Nombre *</label><input class="form-input" id="bal-nombre" value="${h(b.nombre)}"></div>
    <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="bal-desc" value="${h(b.descripcion||'')}"></div>
    <div class="form-group"><label class="form-label">Color</label><input class="form-input" id="bal-color" type="color" value="${b.color||'#00e5ff'}"></div>
    <button class="btn-primary" onclick="guardarBalance('${id}')">Actualizar</button>
    <button class="btn-danger" onclick="eliminarBalance('${id}')">Eliminar</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function guardarBalance(id = null) {
  const nombre = document.getElementById('bal-nombre').value.trim();
  if (!nombre) { toast('El nombre es obligatorio', 'error'); return; }
  
  const data = {
    nombre,
    descripcion: document.getElementById('bal-desc').value,
    color: document.getElementById('bal-color').value,
    taller_id: tid()
  };
  
  const { error } = id 
    ? await sb.from('balances').update(data).eq('id', id)
    : await sb.from('balances').insert(data);
    
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  
  toast(id ? 'Balance actualizado' : 'Balance creado', 'success');
  closeModal();
  balances();
}

async function eliminarBalance(id) {
  confirmar('¿Eliminar este balance? Los movimientos vinculados quedarán sin este balance.', async () => {
    await sb.from('balances').delete().eq('id', id);
    toast('Balance eliminado', 'success');
    closeModal();
    balances();
  });
}

window.balances = balances;
