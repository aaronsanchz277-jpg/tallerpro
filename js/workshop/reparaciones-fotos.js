// ─── FOTOS POR ETAPA ─────────────────────────────────────────────────────────
export function modalFotosEtapa(repId, etapa) {
  const labels = { recepcion:'Recepción', proceso:'En Proceso', entrega:'Entrega' };
  const colors = { recepcion:'var(--text2)', proceso:'var(--accent2)', entrega:'var(--success)' };
  openModal(`
    <div class="modal-title" style="color:${colors[etapa]}">📷 Fotos — ${labels[etapa]}</div>
    <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">${etapa==='recepcion'?'Estado del vehículo al recibirlo':etapa==='proceso'?'Fotos durante la reparación':'Estado del vehículo al entregar'}</div>
    <div class="form-group">
      <input type="file" id="f-fotos-etapa" accept="image/*" multiple capture="environment" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.5rem;color:var(--text);font-size:.85rem">
    </div>
    <div id="fotos-preview" style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:1rem"></div>
    <button class="btn-primary" onclick="subirFotosEtapa('${repId}','${etapa}')">SUBIR FOTOS</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);

  document.getElementById('f-fotos-etapa').addEventListener('change', (e) => {
    const preview = document.getElementById('fotos-preview');
    preview.innerHTML = '';
    Array.from(e.target.files).forEach(file => {
      const url = URL.createObjectURL(file);
      preview.innerHTML += `<img src="${url}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`;
    });
  });
}

export async function subirFotosEtapa(repId, etapa) {
  if (!requireOnline('subir fotos')) return;
  const input = document.getElementById('f-fotos-etapa');
  if (!input.files.length) { toast('Seleccioná al menos una foto','error'); return; }
  toast('Subiendo fotos...','info');
  await safeCall(async () => {
    const campo = etapa === 'recepcion' ? 'fotos_recepcion' : etapa === 'proceso' ? 'fotos_proceso' : 'fotos_entrega';
    const { data:r } = await sb.from('reparaciones').select(campo).eq('id',repId).single();
    const fotosExistentes = r?.[campo] || [];
    const nuevasFotos = [];

    for (const file of input.files) {
      const ext = file.name.split('.').pop();
      const path = `${etapa}/${repId}/${Date.now()}_${Math.random().toString(36).substr(2,9)}.${ext}`;
      const { error } = await sb.storage.from('fotos').upload(path, file);
      if (!error) {
        const { data } = sb.storage.from('fotos').getPublicUrl(path);
        nuevasFotos.push(data.publicUrl);
      }
    }
    const todasFotos = [...fotosExistentes, ...nuevasFotos];
    await offlineUpdate('reparaciones', { [campo]: todasFotos }, 'id', repId);
    toast(`${nuevasFotos.length} foto(s) subida(s)`,'success'); 
    closeModal(); 
    detalleReparacion(repId);
  }, null, 'Error al subir las fotos');
}
