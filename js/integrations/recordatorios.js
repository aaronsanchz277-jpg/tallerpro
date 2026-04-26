// ─── RECORDATORIOS AUTOMÁTICOS POR WHATSAPP ────────────────────────────────
const MENSAJES_PREDEFINIDOS = {
  cita: 'Hola {cliente}! Te recordamos tu cita para el {fecha} a las {hora}. Vehículo: {vehiculo}. ¡Te esperamos en {taller}!',
  reparacion_lista: 'Hola {cliente}! Tu vehículo {vehiculo} ya está listo para retirar. El trabajo realizado: {descripcion}. Total: ₲{total}.',
  mantenimiento: 'Hola {cliente}! Tu vehículo {vehiculo} tiene un mantenimiento programado: {tipo}. Próxima fecha: {fecha}. ¿Agendamos turno?',
  presupuesto: 'Hola {cliente}! Tenemos un presupuesto para tu vehículo {vehiculo}: {descripcion}. Total: ₲{total}. ¿Lo aprobás?',
  repuesto_listo: 'Hola {cliente}! Te avisamos desde {taller} que ya llegó el repuesto que esperabas para tu {vehiculo}. ¿Cuándo te queda cómodo traerlo para la instalación de "{descripcion}"?\n\nIngresá acá para confirmar y agendar: {link}'
};

function recordatorio_getMensaje(tipo, datos) {
  let plantilla = localStorage.getItem(`recordatorio_${tipo}`) || MENSAJES_PREDEFINIDOS[tipo] || '';
  return plantilla.replace(/\{(\w+)\}/g, (_, key) => datos[key] || '');
}

async function recordatorio_enviar(tipo, datos, telefono) {
  if (!telefono) { toast('El cliente no tiene teléfono registrado', 'error'); return; }
  const mensaje = recordatorio_getMensaje(tipo, datos);
  const tel = telefono.replace(/\D/g, '');
  window.open(`https://wa.me/595${tel}?text=${encodeURIComponent(mensaje)}`);
}

function modalConfigurarRecordatorios() {
  openModal(`
    <div class="modal-title">📨 Configurar mensajes automáticos</div>
    <div class="tabs" style="margin-bottom:1rem">
      <button class="tab active" onclick="switchRecordatorioTab('cita', this)">Citas</button>
      <button class="tab" onclick="switchRecordatorioTab('reparacion_lista', this)">Trabajo listo</button>
      <button class="tab" onclick="switchRecordatorioTab('mantenimiento', this)">Mantenimiento</button>
      <button class="tab" onclick="switchRecordatorioTab('presupuesto', this)">Presupuesto</button>
      <button class="tab" onclick="switchRecordatorioTab('repuesto_listo', this)">Repuesto llegó</button>
    </div>
    <div id="recordatorio-editor">
      <div class="form-group">
        <label class="form-label">Mensaje (usa {cliente}, {fecha}, etc.)</label>
        <textarea class="form-input" id="rec-msg" rows="4">${MENSAJES_PREDEFINIDOS.cita}</textarea>
      </div>
      <div style="font-size:.7rem;color:var(--text2);margin-bottom:1rem">
        Variables: {cliente}, {fecha}, {hora}, {vehiculo}, {descripcion}, {total}, {tipo}, {taller}, {link}
      </div>
    </div>
    <input type="hidden" id="rec-tipo" value="cita">
    <button class="btn-primary" onclick="guardarRecordatorio()">Guardar</button>
    <button class="btn-secondary" onclick="closeModal()">Cerrar</button>
  `);
}

function switchRecordatorioTab(tipo, btn) {
  document.querySelectorAll('#modal-overlay .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rec-tipo').value = tipo;
  const msg = localStorage.getItem(`recordatorio_${tipo}`) || MENSAJES_PREDEFINIDOS[tipo] || '';
  document.getElementById('rec-msg').value = msg;
}

function guardarRecordatorio() {
  const tipo = document.getElementById('rec-tipo').value;
  const msg = document.getElementById('rec-msg').value;
  localStorage.setItem(`recordatorio_${tipo}`, msg);
  toast('Mensaje guardado', 'success');
  closeModal();
}
