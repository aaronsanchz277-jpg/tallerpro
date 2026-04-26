// ─── WIZARD SIMPLIFICADO PARA NUEVA REPARACIÓN ─────────────────────────────
let _wizardStep = 1;
let _wizardData = { cliente_id: null, vehiculo_id: null, patente_nueva: '', descripcion: '', costo: 0 };

function wizardRenderPaso1() {
  return `
    <div style="text-align:center;padding:.5rem 0">
      <div style="font-size:3rem;margin-bottom:.5rem">👤</div>
      <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);margin-bottom:1rem">Seleccionar cliente</div>
      <div class="form-group">
        <select class="form-input" id="wizard-cliente" style="font-size:1rem;padding:.8rem">
          <option value="">Buscar cliente...</option>
        </select>
      </div>
      <div style="margin-top:.5rem">
        <button onclick="wizardToggleNuevoCliente()" style="background:none;border:1px dashed var(--border);color:var(--text2);border-radius:8px;padding:.5rem;width:100%;font-size:.8rem;cursor:pointer">+ Agregar cliente nuevo</button>
      </div>
      <div id="wizard-nuevo-cliente" style="display:none;margin-top:.5rem">
        <input class="form-input" id="wizard-nombre-cliente" placeholder="Nombre completo" style="margin-bottom:.3rem">
        <input class="form-input" id="wizard-tel-cliente" placeholder="Teléfono (opcional)">
      </div>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:1rem">
      <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" onclick="wizardNextStep()">Siguiente →</button>
    </div>
  `;
}

function wizardRenderPaso2() {
  return `
    <div style="text-align:center;padding:.5rem 0">
      <div style="font-size:3rem;margin-bottom:.5rem">🚙</div>
      <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);margin-bottom:1rem">Seleccionar vehículo</div>
      <div class="form-group">
        <select class="form-input" id="wizard-vehiculo" style="font-size:1rem;padding:.8rem">
          <option value="">Seleccionar vehículo...</option>
        </select>
      </div>
      <div style="margin-top:.5rem">
        <button onclick="wizardToggleNuevoVehiculo()" style="background:none;border:1px dashed var(--border);color:var(--text2);border-radius:8px;padding:.5rem;width:100%;font-size:.8rem;cursor:pointer">+ Agregar vehículo nuevo</button>
      </div>
      <div id="wizard-nuevo-vehiculo" style="display:none;margin-top:.5rem">
        <input class="form-input" id="wizard-patente" placeholder="Patente *" style="margin-bottom:.3rem;text-transform:uppercase">
        <input class="form-input" id="wizard-marca" placeholder="Marca (ej: Toyota)">
      </div>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:1rem">
      <button class="btn-secondary" onclick="wizardPrevStep()">← Atrás</button>
      <button class="btn-primary" onclick="wizardNextStep()">Siguiente →</button>
    </div>
  `;
}

function wizardRenderPaso3() {
  return `
    <div style="text-align:center;padding:.5rem 0">
      <div style="font-size:3rem;margin-bottom:.5rem">🔧</div>
      <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);margin-bottom:1rem">Descripción del trabajo</div>
      <div class="form-group">
        <textarea class="form-input" id="wizard-desc" placeholder="Ej: Cambio de aceite, revisar frenos..." rows="3" style="font-size:1rem"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Monto a cobrar (opcional)</label>
        <input class="form-input" id="wizard-costo" type="number" placeholder="Monto en guaraníes" style="font-size:1rem">
      </div>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:1rem">
      <button class="btn-secondary" onclick="wizardPrevStep()">← Atrás</button>
      <button class="btn-primary" onclick="wizardGuardar()">✅ Guardar trabajo</button>
    </div>
  `;
}

function updateWizardDots(step) {
  const dots = document.querySelectorAll('#modal-overlay .modal-content > div:last-child span');
  dots.forEach((dot, i) => {
    dot.style.background = i < step ? 'var(--accent)' : 'var(--border)';
  });
}

async function modalNuevaReparacionSimple() {
  window._wizardStep = 1;
  window._wizardData = { cliente_id: null, vehiculo_id: null, patente_nueva: '', descripcion: '', costo: 0 };

  openModal(`
    <div class="modal-title" style="text-align:center">Nuevo trabajo</div>
    <div id="wizard-content">${wizardRenderPaso1()}</div>
    <div style="display:flex;justify-content:center;gap:.3rem;margin-top:.5rem">
      <span style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></span>
      <span style="width:8px;height:8px;border-radius:50%;background:var(--border)"></span>
      <span style="width:8px;height:8px;border-radius:50%;background:var(--border)"></span>
    </div>
  `);

  const clientes = await getClientes();
  const selCliente = document.getElementById('wizard-cliente');
  if (selCliente) {
    selCliente.innerHTML = '<option value="">Buscar cliente...</option>' + 
      clientes.map(c => `<option value="${c.id}">${h(c.nombre)}${c.telefono ? ' · ' + c.telefono : ''}</option>`).join('');
  }
}

function wizardToggleNuevoCliente() {
  const div = document.getElementById('wizard-nuevo-cliente');
  if (div) {
    div.style.display = div.style.display === 'none' ? 'block' : 'none';
    const sel = document.getElementById('wizard-cliente');
    if (sel) sel.disabled = div.style.display === 'block';
  }
}

function wizardToggleNuevoVehiculo() {
  const div = document.getElementById('wizard-nuevo-vehiculo');
  if (div) {
    div.style.display = div.style.display === 'none' ? 'block' : 'none';
    const sel = document.getElementById('wizard-vehiculo');
    if (sel) sel.disabled = div.style.display === 'block';
  }
}

async function wizardNextStep() {
  const step = window._wizardStep;
  
  if (step === 1) {
    const selCliente = document.getElementById('wizard-cliente');
    const clienteId = selCliente ? selCliente.value : null;
    const nombreNuevoInput = document.getElementById('wizard-nombre-cliente');
    const nombreNuevo = nombreNuevoInput ? nombreNuevoInput.value.trim() : '';
    
    if (!clienteId && !nombreNuevo) {
      toast('Seleccioná un cliente o creá uno nuevo', 'error');
      return;
    }
    
    if (nombreNuevo) {
      const telInput = document.getElementById('wizard-tel-cliente');
      const telefono = telInput ? telInput.value : null;
      const existente = await buscarClienteExistente(tid(), { telefono });
      if (existente) {
        const eleccion = await confirmarDuplicado({
          titulo: 'Ya existe un cliente parecido',
          mensajeHtml: `Encontramos a <b>${h(existente.nombre)}</b> con el mismo teléfono <b>${h(existente.telefono || telefono)}</b>.<br><br>¿Querés usar ese cliente o crear uno nuevo igual?`
        });
        if (eleccion === 'cancelar') return;
        if (eleccion === 'usar') {
          window._wizardData.cliente_id = existente.id;
          toast('Usando cliente existente: ' + existente.nombre, 'success');
        } else {
          const { data: nuevo } = await sb.from('clientes').insert({
            nombre: nombreNuevo,
            telefono,
            taller_id: tid()
          }).select('id').single();
          window._wizardData.cliente_id = nuevo.id;
          invalidateComponentCache();
        }
      } else {
        const { data: nuevo } = await sb.from('clientes').insert({
          nombre: nombreNuevo,
          telefono,
          taller_id: tid()
        }).select('id').single();
        window._wizardData.cliente_id = nuevo.id;
        invalidateComponentCache();
      }
    } else {
      window._wizardData.cliente_id = clienteId;
    }
    
    window._wizardStep = 2;
    const content = document.getElementById('wizard-content');
    if (content) content.innerHTML = wizardRenderPaso2();
    
    const vehiculos = await getVehiculos();
    const vehiculosCliente = vehiculos.filter(v => v.cliente_id === window._wizardData.cliente_id);
    const selVehiculo = document.getElementById('wizard-vehiculo');
    if (selVehiculo) {
      selVehiculo.innerHTML = '<option value="">Seleccionar vehículo...</option>' +
        vehiculosCliente.map(v => `<option value="${v.id}">${h(v.patente)} · ${h(v.marca)} ${h(v.modelo||'')}</option>`).join('');
    }
    
    updateWizardDots(2);
  } else if (step === 2) {
    const selVehiculo = document.getElementById('wizard-vehiculo');
    const vehiculoId = selVehiculo ? selVehiculo.value : null;
    const patenteInput = document.getElementById('wizard-patente');
    const patenteNueva = normalizarPatente(patenteInput ? patenteInput.value : '');
    const marcaInput = document.getElementById('wizard-marca');
    const marcaNueva = marcaInput ? marcaInput.value.trim() : '';
    
    if (!vehiculoId && !patenteNueva) {
      toast('Seleccioná un vehículo o creá uno nuevo', 'error');
      return;
    }
    
    if (patenteNueva) {
      const existente = await buscarVehiculoExistente(tid(), patenteNueva);
      if (existente) {
        const propietario = existente.clientes?.nombre ? h(existente.clientes.nombre) : 'sin propietario';
        const otroCliente = existente.cliente_id && existente.cliente_id !== window._wizardData.cliente_id;
        const aviso = otroCliente
          ? `<br><br><b style="color:var(--warning)">Atención:</b> esa patente está a nombre de <b>${propietario}</b>, no del cliente seleccionado.`
          : '';
        const eleccion = await confirmarDuplicado({
          titulo: 'Ya existe esa patente',
          mensajeHtml: `La patente <b>${h(existente.patente)}</b> ya está registrada (${h(existente.marca||'')} ${h(existente.modelo||'')}) a nombre de <b>${propietario}</b>.${aviso}<br><br>¿Querés usar ese vehículo o crear otro igual?`
        });
        if (eleccion === 'cancelar') return;
        if (eleccion === 'usar') {
          window._wizardData.vehiculo_id = existente.id;
          toast('Usando vehículo existente: ' + existente.patente, 'success');
        } else {
          const { data: nuevo } = await sb.from('vehiculos').insert({
            patente: patenteNueva,
            marca: marcaNueva || 'Sin marca',
            cliente_id: window._wizardData.cliente_id,
            taller_id: tid()
          }).select('id').single();
          window._wizardData.vehiculo_id = nuevo.id;
          invalidateComponentCache();
        }
      } else {
        const { data: nuevo } = await sb.from('vehiculos').insert({
          patente: patenteNueva,
          marca: marcaNueva || 'Sin marca',
          cliente_id: window._wizardData.cliente_id,
          taller_id: tid()
        }).select('id').single();
        window._wizardData.vehiculo_id = nuevo.id;
        invalidateComponentCache();
      }
    } else {
      window._wizardData.vehiculo_id = vehiculoId;
    }
    
    window._wizardStep = 3;
    const content = document.getElementById('wizard-content');
    if (content) content.innerHTML = wizardRenderPaso3();
    updateWizardDots(3);
  }
}

function wizardPrevStep() {
  if (window._wizardStep === 2) {
    window._wizardStep = 1;
    const content = document.getElementById('wizard-content');
    if (content) content.innerHTML = wizardRenderPaso1();
    updateWizardDots(1);
  } else if (window._wizardStep === 3) {
    window._wizardStep = 2;
    const content = document.getElementById('wizard-content');
    if (content) content.innerHTML = wizardRenderPaso2();
    updateWizardDots(2);
  }
}

async function wizardGuardar() {
  const descInput = document.getElementById('wizard-desc');
  const desc = descInput ? descInput.value.trim() : '';
  if (!desc) {
    toast('Describí el trabajo a realizar', 'error');
    return;
  }
  
  const costoInput = document.getElementById('wizard-costo');
  const costo = parseFloat(costoInput ? costoInput.value : '') || 0;
  
  await safeCall(async () => {
    const { data: rep, error } = await sb.from('reparaciones').insert({
      descripcion: desc,
      tipo_trabajo: 'Mecánica general',
      vehiculo_id: window._wizardData.vehiculo_id,
      cliente_id: window._wizardData.cliente_id,
      costo: costo,
      estado: 'pendiente',
      fecha: new Date().toISOString().split('T')[0],
      taller_id: tid()
    }).select('id').single();
    
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    
    if (currentPerfil?.rol === 'empleado') {
      await sb.from('reparacion_mecanicos').insert({
        reparacion_id: rep.id,
        mecanico_id: currentUser.id,
        nombre_mecanico: currentPerfil.nombre,
        horas: 0,
        pago: 0
      });
    }
    
    clearCache('reparaciones');
    toast('✅ Trabajo guardado correctamente', 'success');
    closeModal();
    navigate('reparaciones');
  }, null, 'No se pudo guardar el trabajo');
}
