// ─── WIZARD SIMPLIFICADO PARA NUEVA REPARACIÓN ─────────────────────────────
let _wizardStep = 1;
let _wizardData = { cliente_id: null, vehiculo_id: null, patente_nueva: '', descripcion: '', costo: 0 };

function wizardRenderPaso1() {
  // Combobox autocompletar (input visible + hidden con id) en lugar de un
  // <select> nativo: en talleres con muchos clientes, escribir es más rápido
  // que scrollear por todo el listado.
  const items = (window._wizardClientes || []).map(c => ({
    id: c.id,
    label: c.nombre + (c.telefono ? ' · ' + c.telefono : ''),
    sub: c.telefono || '',
    hidden: c.telefono || ''
  }));
  return `
    <div style="text-align:center;padding:.5rem 0">
      <div style="font-size:3rem;margin-bottom:.5rem">👤</div>
      <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);margin-bottom:1rem">Seleccionar cliente</div>
      <div class="form-group" style="text-align:left">
        ${renderComboboxAuto('wizard-cliente', items, { placeholder: 'Tipeá nombre o teléfono...' })}
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
  const vehiculos = window._wizardVehiculosCliente || [];
  const items = vehiculos.map(v => ({
    id: v.id,
    label: `${v.patente} · ${v.marca || ''} ${v.modelo || ''}`.trim(),
    sub: '',
    hidden: v.patente || ''
  }));
  return `
    <div style="text-align:center;padding:.5rem 0">
      <div style="font-size:3rem;margin-bottom:.5rem">🚙</div>
      <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);margin-bottom:1rem">Seleccionar vehículo</div>
      <div class="form-group" style="text-align:left">
        ${renderComboboxAuto('wizard-vehiculo', items, { placeholder: 'Tipeá patente o marca...' })}
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

// preset: { cliente_id } para arrancar directo en el paso 2 (vehículo).
async function modalNuevaReparacionSimple(preset = null) {
  // Precargamos clientes ANTES de pintar para que el combobox tenga datos.
  window._wizardClientes = await getClientes();

  if (preset && preset.cliente_id) {
    // Si nos llaman desde la ficha del cliente, saltamos el paso 1 y vamos
    // directo al paso 2 con el cliente ya elegido.
    window._wizardStep = 2;
    window._wizardData = { cliente_id: preset.cliente_id, vehiculo_id: null, patente_nueva: '', descripcion: '', costo: 0 };
    const vehiculos = await getVehiculos();
    window._wizardVehiculosCliente = vehiculos.filter(v => v.cliente_id === preset.cliente_id);
    const cli = window._wizardClientes.find(c => c.id === preset.cliente_id);
    openModal(`
      <div class="modal-title" style="text-align:center">Nuevo trabajo${cli ? ' · ' + h(cli.nombre) : ''}</div>
      <div id="wizard-content">${wizardRenderPaso2()}</div>
      <div style="display:flex;justify-content:center;gap:.3rem;margin-top:.5rem">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:var(--border)"></span>
      </div>
    `);
    return;
  }

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
}

function wizardToggleNuevoCliente() {
  const div = document.getElementById('wizard-nuevo-cliente');
  if (!div) return;
  div.style.display = div.style.display === 'none' ? 'block' : 'none';
  // Limpia el combobox cuando expandimos el bloque de "cliente nuevo" para
  // que no quede un id viejo seleccionado.
  if (div.style.display === 'block') {
    const search = document.getElementById('wizard-cliente-search');
    const hidden = document.getElementById('wizard-cliente');
    if (search) { search.value = ''; search.disabled = true; }
    if (hidden) hidden.value = '';
  } else {
    const search = document.getElementById('wizard-cliente-search');
    if (search) search.disabled = false;
  }
}

function wizardToggleNuevoVehiculo() {
  const div = document.getElementById('wizard-nuevo-vehiculo');
  if (!div) return;
  div.style.display = div.style.display === 'none' ? 'block' : 'none';
  if (div.style.display === 'block') {
    const search = document.getElementById('wizard-vehiculo-search');
    const hidden = document.getElementById('wizard-vehiculo');
    if (search) { search.value = ''; search.disabled = true; }
    if (hidden) hidden.value = '';
  } else {
    const search = document.getElementById('wizard-vehiculo-search');
    if (search) search.disabled = false;
  }
}

async function wizardNextStep() {
  const step = window._wizardStep;

  if (step === 1) {
    // El combobox guarda el id en el <input type="hidden"> con el mismo id.
    const hiddenCliente = document.getElementById('wizard-cliente');
    const clienteId = hiddenCliente ? hiddenCliente.value : null;
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
    
    // Cargamos vehículos del cliente y re-renderizamos paso 2 ya con los items.
    const vehiculos = await getVehiculos();
    window._wizardVehiculosCliente = vehiculos.filter(v => v.cliente_id === window._wizardData.cliente_id);
    window._wizardStep = 2;
    const content = document.getElementById('wizard-content');
    if (content) content.innerHTML = wizardRenderPaso2();
    updateWizardDots(2);
  } else if (step === 2) {
    const hiddenVehiculo = document.getElementById('wizard-vehiculo');
    const vehiculoId = hiddenVehiculo ? hiddenVehiculo.value : null;
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
