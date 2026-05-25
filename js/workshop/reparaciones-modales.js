async function modalNuevaReparacion() {
  openModal(`<div class="modal-content p-6 text-center"><div class="spinner mb-2"></div><p>Cargando formulario...</p></div>`);

  try {
    const tallerId = tid();
    const [clienteSelectHTML, vehiculoSelectHTML, { data: empleados }] = await Promise.all([
      renderClienteSelect('rep-cliente', '', true),
      renderVehiculoSelect('rep-vehiculo', '', null, true),
      sb.from('empleados').select('id,nombre').eq('taller_id', tallerId)
    ]);

    const fechaHTML = renderFechaInput('rep-fecha');
    const montoHTML = renderMontoInput('rep-costo', '', 'Monto');

    let mecanicoOptions = '<option value="">Sin asignar</option>';
    (empleados || []).forEach(e => {
      mecanicoOptions += `<option value="${e.id}">${h(e.nombre)}</option>`;
    });

    const html = `
      <div class="modal-nueva-reparacion">
        <div class="modal-title">Nueva orden de reparación</div>

        <div class="form-group">
          <label class="form-label">
            Vehículo
            <button type="button" id="btn-nuevo-vehiculo" style="margin-left:0.5em; text-decoration:underline; color:blue; background:none; border:none; cursor:pointer;">+ nuevo</button>
          </label>
          <div id="vehiculo-select-container">${vehiculoSelectHTML}</div>
          <div id="nuevo-vehiculo-form" style="display:none; margin-top:0.5rem; padding:0.75rem; border:1px solid #ccc; border-radius:4px; background:#f9f9f9;">
            <input id="nv-patente" class="form-input" placeholder="Patente" autocomplete="off" style="margin-bottom:0.5rem;">
            <input id="nv-marca" class="form-input" placeholder="Marca / Modelo" style="margin-bottom:0.5rem;">
            <div style="display:flex; gap:0.5rem;">
              <button type="button" id="btn-guardar-nuevo-vehiculo" class="btn-primary" style="font-size:0.875rem;">Guardar vehículo</button>
              <button type="button" id="btn-cancelar-nuevo-vehiculo" class="btn-secondary" style="font-size:0.875rem;">Cancelar</button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Cliente <span style="color:gray; font-weight:normal;">(opcional, se completa con el dueño del vehículo)</span></label>
          <div id="cliente-select-container">${clienteSelectHTML}</div>
        </div>

        <div class="form-group">
          <label class="form-label">Descripción del trabajo <span style="color:red;">*</span></label>
          <input type="text" id="rep-descripcion" class="form-input" required>
        </div>

        <div class="form-group">
          <label class="form-label">Mecánico asignado</label>
          <select id="rep-mecanico" class="form-input">${mecanicoOptions}</select>
        </div>

        <div class="form-group">
          <label class="form-label">Foto de la orden en papel</label>
          <input type="file" id="rep-foto" accept="image/*" capture="environment" class="form-input">
          <img id="rep-foto-preview" style="display:none; max-height:10rem; border-radius:4px; margin-top:0.5rem;" />
        </div>

        <div class="form-group">
          <label class="form-label">Monto</label>
          ${montoHTML}
        </div>

        <div class="form-group">
          <label class="form-label">Fecha</label>
          ${fechaHTML}
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.75rem; padding-top:0.5rem;">
          <button type="button" id="btn-cancelar-nueva" class="btn-secondary">Cancelar</button>
          <button type="button" id="btn-guardar-nueva" class="btn-primary">Guardar</button>
        </div>
      </div>
    `;

    openModal(html);
    formGuard_vigilarFormulario();

    document.getElementById('btn-cancelar-nueva').addEventListener('click', () => {
      formGuard_reset();
      closeModal();
    });
    document.getElementById('btn-guardar-nueva').addEventListener('click', guardarNuevaOrden);

    const fotoInput = document.getElementById('rep-foto');
    const fotoPreview = document.getElementById('rep-foto-preview');
    fotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = ev => {
          fotoPreview.src = ev.target.result;
          fotoPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        fotoPreview.style.display = 'none';
      }
    });

    const attachVehiculoChange = () => {
      const vehiculoSelect = document.getElementById('rep-vehiculo');
      if (vehiculoSelect) {
        vehiculoSelect.removeEventListener('change', vehiculoChangeHandler);
        vehiculoSelect.addEventListener('change', vehiculoChangeHandler);
      }
    };

    const vehiculoChangeHandler = async function() {
      const vehId = this.value;
      const clienteSelect = document.getElementById('rep-cliente');
      if (!vehId) {
        if (clienteSelect) clienteSelect.value = '';
        return;
      }
      try {
        const { data: veh, error } = await sb
          .from('vehiculos')
          .select('cliente_id')
          .eq('id', vehId)
          .single();
        if (!error && veh?.cliente_id && clienteSelect) {
          clienteSelect.value = veh.cliente_id;
        } else if (clienteSelect) {
          clienteSelect.value = '';
        }
      } catch (e) {
        console.error(e);
      }
    };

    attachVehiculoChange();

    document.getElementById('btn-nuevo-vehiculo').addEventListener('click', () => {
      document.getElementById('nuevo-vehiculo-form').style.display = 'block';
    });

    document.getElementById('btn-cancelar-nuevo-vehiculo').addEventListener('click', () => {
      document.getElementById('nuevo-vehiculo-form').style.display = 'none';
      document.getElementById('nv-patente').value = '';
      document.getElementById('nv-marca').value = '';
    });

    document.getElementById('btn-guardar-nuevo-vehiculo').addEventListener('click', async () => {
      const patente = normalizarPatente(document.getElementById('nv-patente').value.trim());
      const marca = document.getElementById('nv-marca').value.trim();
      if (!validateRequired(patente, 'Patente')) return;

      const existente = await buscarVehiculoExistente(tallerId, patente, null);
      if (existente) {
        const decision = await confirmarDuplicado({
          titulo: 'Vehículo duplicado',
          mensajeHtml: `Ya existe un vehículo con patente <strong>${h(patente)}</strong>. ¿Desea usar el existente o crear uno nuevo?`
        });
        if (decision === 'cancelar') return;
        if (decision === 'usar') {
          const vehiculoSelect = document.getElementById('rep-vehiculo');
          if (vehiculoSelect) vehiculoSelect.value = existente.id;
          document.getElementById('nuevo-vehiculo-form').style.display = 'none';
          attachVehiculoChange();
          return;
        }
      }

      const { data: nuevoVeh, error: insErr } = await sb
        .from('vehiculos')
        .insert({ taller_id: tallerId, patente, marca })
        .select('id')
        .single();

      if (insErr) {
        toast('Error al crear vehículo: ' + insErr.message, 'error');
        return;
      }

      const nuevoSelectHTML = await renderVehiculoSelect('rep-vehiculo', nuevoVeh.id, null, true);
      document.getElementById('vehiculo-select-container').innerHTML = nuevoSelectHTML;
      attachVehiculoChange();
      document.getElementById('nuevo-vehiculo-form').style.display = 'none';
      toast('Vehículo creado', 'success');
      invalidateComponentCache();
    });

  } catch (e) {
    toast('Error al cargar el formulario: ' + e.message, 'error');
    closeModal();
  }
}

async function guardarNuevaOrden() {
  const descripcion = document.getElementById('rep-descripcion').value.trim();
  if (!validateRequired(descripcion, 'Descripción del trabajo')) return;

  const tallerId = tid();
  const vehiculoId = document.getElementById('rep-vehiculo').value || null;
  const clienteId = document.getElementById('rep-cliente').value || null;
  const mecanicoSelect = document.getElementById('rep-mecanico');
  const mecanicoId = mecanicoSelect.value || null;
  const mecanicoNombre = mecanicoId ? mecanicoSelect.selectedOptions[0]?.text : null;
  const fotoFile = document.getElementById('rep-foto').files[0];
  const costo = parseFloat(document.getElementById('rep-costo')?.value) || 0;
  const fecha = document.getElementById('rep-fecha')?.value || new Date().toISOString().split('T')[0];

  let fotosRecepcion = [];

  if (fotoFile) {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
    const ext = fotoFile.name.split('.').pop() || 'jpg';
    const path = `recepcion/${uuid}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await sb.storage
      .from('fotos')
      .upload(path, fotoFile, { cacheControl: '3600', upsert: false });

    if (!uploadErr) {
      const { data: { publicUrl } } = sb.storage.from('fotos').getPublicUrl(path);
      fotosRecepcion = [publicUrl];
    } else {
      toast('No se pudo subir la foto, la orden se creará sin ella.', 'warning');
    }
  }

  const { data: nuevaRep, error: insertErr } = await offlineInsert('reparaciones', {
    taller_id: tallerId,
    vehiculo_id: vehiculoId,
    cliente_id: clienteId,
    descripcion,
    tipo_trabajo: null,
    costo,
    costo_repuestos: 0,
    estado: 'pendiente',
    fecha,
    fotos_recepcion: fotosRecepcion,
    notas: null,
    kilometraje_ingreso: null,
    combustible_ingreso: null
  });

  if (insertErr) {
    toast('Error al crear la orden: ' + insertErr.message, 'error');
    return;
  }

  const reparacionId = nuevaRep?.id || nuevaRep?.[0]?.id;
  if (!reparacionId) {
    toast('Error: no se pudo obtener el ID de la orden', 'error');
    return;
  }

  if (mecanicoId) {
    const { error: mecErr } = await offlineInsert('reparacion_mecanicos', {
      reparacion_id: reparacionId,
      empleado_id: mecanicoId,
      nombre_mecanico: mecanicoNombre,
      horas: 0,
      pago: 0
    });
    if (mecErr) {
      toast('Orden creada, pero falló la asignación del mecánico: ' + mecErr.message, 'warning');
    }
  }

  clearCache('reparaciones');
  toast('Orden creada exitosamente', 'success');
  formGuard_reset();
  closeModal();
  reparaciones();
}
