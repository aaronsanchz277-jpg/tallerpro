// ─── FACTURACIÓN ─────────────────────────────────────────────────────────────
async function facturacion() {
  const { data } = await cachedQuery('facturas_list', () =>
    sb.from('facturas').select('*, clientes(nombre), reparaciones(descripcion)').eq('taller_id',tid()).order('created_at',{ascending:false})
  );

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('facTitulo')}</div>
    </div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('facSinDatos')}</p></div>` :
      (data||[]).map(f => `
      <div class="card" onclick="detalleFactura('${f.id}')">
        <div class="card-header">
          <div class="card-avatar">🧾</div>
          <div class="card-info">
            <div class="card-name">${f.clientes?h(f.clientes.nombre):'Sin cliente'}</div>
            <div class="card-sub">${formatFecha(f.fecha)} · ${f.pagada?t('facPagada'):t('repEstPendiente')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:var(--font-head);color:var(--accent)">₲${gs(f.total)}</div>
            <span class="card-badge ${f.pagada?'badge-green':'badge-yellow'}">${f.pagada?t('facPagada'):t('repEstPendiente')}</span>
          </div>
        </div>
      </div>`).join('')}`;
}

async function modalNuevaFactura(reparacionId) {
  closeModal();
  const { data:r } = await sb.from('reparaciones').select('*, clientes(nombre,telefono), vehiculos(patente,marca)').eq('id',reparacionId).single();
  if (!r) return;

  openModal(`
    <div class="modal-title">${t("modNuevaFactura")}</div>
    <div style="background:var(--surface2);border-radius:8px;padding:.75rem;margin-bottom:1rem">
      <div style="font-size:.8rem;color:var(--text2)">Reparación</div>
      <div style="font-weight:500">${h(r.descripcion)}</div>
      <div style="font-size:.75rem;color:var(--text2)">${r.clientes?h(r.clientes.nombre):''} · ${r.vehiculos?h(r.vehiculos.patente):''}</div>
    </div>
    <div class="form-group"><label class="form-label">${t("lblFecha")}</label><input class="form-input" id="f-fecha" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label class="form-label">${t("lblManoObra")}</label><input class="form-input" id="f-mano" type="number" value="${r.costo||0}" oninput="calcTotal()"></div>
    <div class="form-group"><label class="form-label">${t("lblRepuestos")}</label><input class="form-input" id="f-repuestos" type="number" value="0" oninput="calcTotal()"></div>
    <div class="form-group"><label class="form-label">${t("lblOtros")}</label><input class="form-input" id="f-otros" type="number" value="0" oninput="calcTotal()"></div>
    <div class="form-group"><label class="form-label">IVA %</label>
      <select class="form-input" id="f-iva" onchange="calcTotal()">
        <option value="10" selected>10% (estándar)</option>
        <option value="5">5% (reducido)</option>
        <option value="0">Exento</option>
      </select>
    </div>
    <div style="background:var(--surface2);border-radius:8px;padding:.75rem;margin-bottom:1rem">
      <div class="factura-item"><span>Mano de obra</span><span id="t-mano">₲${gs(r.costo)}</span></div>
      <div class="factura-item"><span>Repuestos</span><span id="t-rep">₲0</span></div>
      <div class="factura-item"><span>Otros</span><span id="t-otros">₲0</span></div>
      <div style="height:1px;background:var(--border);margin:.4rem 0"></div>
      <div class="factura-item"><span>Subtotal</span><span id="t-subtotal">₲${gs(r.costo)}</span></div>
      <div class="factura-item"><span>IVA (<span id="t-iva-pct">10</span>%)</span><span id="t-iva">₲${gs(Math.round((r.costo||0)*10/110))}</span></div>
      <div class="factura-total"><span>TOTAL</span><span id="t-total">₲${gs(r.costo)}</span></div>
    </div>
    <div class="form-group"><label class="form-label">${t("lblNotas")}</label><textarea class="form-input" id="f-notas" rows="2" placeholder="Observaciones..."></textarea></div>
    <button class="btn-primary" onclick="guardarFactura('${reparacionId}','${r.cliente_id||''}')">GUARDAR FACTURA</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

function calcTotal() {
  const mano = parseFloat(document.getElementById('f-mano').value)||0;
  const rep = parseFloat(document.getElementById('f-repuestos').value)||0;
  const otros = parseFloat(document.getElementById('f-otros').value)||0;
  const ivaPct = parseInt(document.getElementById('f-iva').value)||0;
  const total = mano+rep+otros;
  const iva = ivaPct > 0 ? Math.round(total * ivaPct / (100 + ivaPct)) : 0;
  document.getElementById('t-mano').textContent = '₲'+gs(mano);
  document.getElementById('t-rep').textContent = '₲'+gs(rep);
  document.getElementById('t-otros').textContent = '₲'+gs(otros);
  document.getElementById('t-subtotal').textContent = '₲'+gs(total);
  document.getElementById('t-iva-pct').textContent = ivaPct;
  document.getElementById('t-iva').textContent = '₲'+gs(iva);
  document.getElementById('t-total').textContent = '₲'+gs(total);
}

async function guardarFactura(reparacionId, clienteId) {
  if (guardando()) return;
  const mano = parseFloat(document.getElementById('f-mano').value)||0;
  const rep = parseFloat(document.getElementById('f-repuestos').value)||0;
  const otros = parseFloat(document.getElementById('f-otros').value)||0;
  const total = mano+rep+otros;
  // Obtener siguiente número de factura con retry para evitar race condition
  let numero = null;
  for (let intento = 0; intento < 3; intento++) {
    const { data: ultimaFact } = await sb.from('facturas').select('numero').eq('taller_id',tid()).order('numero',{ascending:false}).limit(1).maybeSingle();
    numero = (ultimaFact?.numero || 0) + 1;
    const data = { numero, reparacion_id:reparacionId, cliente_id:clienteId||null, fecha:document.getElementById('f-fecha').value, mano_obra:mano, repuestos:rep, otros, total, notas:document.getElementById('f-notas').value, pagada:false, taller_id:tid() };
    const { error } = await offlineInsert('facturas', data);
    if (!error) { toast('Presupuesto #'+numero+' guardada','success'); closeModal(); facturacion(); return; }
    if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
      continue; // Número duplicado, reintentar con siguiente
    }
    toast('Error: '+error.message,'error'); return;
  }
  toast('Error: no se pudo generar número único. Intentá de nuevo.','error');
}

async function detalleFactura(id) {
  const { data:f, error:qErr } = await safeQuery(() => sb.from('facturas').select('*, clientes(nombre,telefono,ruc), reparaciones(descripcion,vehiculos(patente,marca))').eq('id',id).single());
  if (!f) { if (qErr) toast('Error al cargar presupuesto','error'); navigate('facturacion'); return; }
  const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';
  const tallerRuc = currentPerfil?.talleres?.ruc || '';
  const tallerDir = currentPerfil?.talleres?.direccion || '';
  const tallerTel = currentPerfil?.talleres?.telefono || '';

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('facturacion')">${t('volver')}</button>
      <div class="detail-avatar">🧾</div>
      <div><div class="detail-name">Presupuesto ${f.numero?'#'+f.numero:''}</div><div class="detail-sub">${formatFecha(f.fecha)}</div></div>
    </div>
    <div id="factura-imprimible" style="background:var(--surface2);border-radius:12px;padding:1rem;margin-bottom:1rem;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem">
        <div>
          <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent);letter-spacing:2px">${h(tallerNombre)}</div>
          ${tallerRuc?`<div style="font-size:.75rem;color:var(--text2)">RUC: ${h(tallerRuc)}</div>`:''}
          ${tallerDir?`<div style="font-size:.72rem;color:var(--text2)">${h(tallerDir)}</div>`:''}
          ${tallerTel?`<div style="font-size:.72rem;color:var(--text2)">Tel: ${h(tallerTel)}</div>`:''}
        </div>
        <div style="text-align:right">
          ${f.numero?`<div style="font-family:var(--font-head);font-size:1rem;color:var(--text)">N° ${String(f.numero).padStart(3,'0')}</div>`:''}
          <div style="font-size:.75rem;color:var(--text2)">${formatFecha(f.fecha)}</div>
        </div>
      </div>
      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);margin-bottom:.4rem;letter-spacing:1px">CLIENTE</div>
      <div class="factura-item"><span style="color:var(--text2)">Nombre</span><span>${f.clientes?h(f.clientes.nombre):'-'}</span></div>
      ${f.clientes?.ruc?`<div class="factura-item"><span style="color:var(--text2)">RUC / CI</span><span>${h(f.clientes.ruc)}</span></div>`:''}
      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);margin:.5rem 0 .4rem;letter-spacing:1px">SERVICIO</div>
      <div class="factura-item"><span style="color:var(--text2)">Vehículo</span><span>${f.reparaciones?.vehiculos?h(f.reparaciones.vehiculos.patente)+' · '+h(f.reparaciones.vehiculos.marca):'-'}</span></div>
      <div class="factura-item"><span style="color:var(--text2)">Reparación</span><span>${f.reparaciones?h(f.reparaciones.descripcion):'-'}</span></div>
      <div style="height:1px;background:var(--border);margin:.5rem 0"></div>
      <div class="factura-item"><span>Mano de obra</span><span>₲${gs(f.mano_obra)}</span></div>
      <div class="factura-item"><span>Repuestos</span><span>₲${gs(f.repuestos)}</span></div>
      <div class="factura-item"><span>Otros</span><span>₲${gs(f.otros)}</span></div>
      <div style="height:1px;background:var(--border);margin:.4rem 0"></div>
      <div class="factura-item"><span style="color:var(--text2)">IVA (10%)</span><span style="color:var(--text2)">₲${gs(Math.round(f.total*10/110))}</span></div>
      <div class="factura-total"><span>TOTAL</span><span>₲${gs(f.total)}</span></div>
      ${f.notas?`<div style="margin-top:.5rem;font-size:.8rem;color:var(--text2);font-style:italic">${h(f.notas)}</div>`:''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem">
      <button class="btn-secondary" style="margin:0" onclick="window.print()">🖨️ Imprimir</button>
      <button class="btn-secondary" style="margin:0" onclick="compartirFactura('${id}',false)">📥 Descargar PDF</button>
    </div>
    <button onclick="compartirFactura('${id}',true)" style="width:100%;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.7rem;font-family:var(--font-head);font-size:.95rem;cursor:pointer;margin-bottom:.5rem;letter-spacing:1px">💬 Enviar por WhatsApp (con PDF)</button>
    ${!f.pagada?`<button class="btn-primary" onclick="marcarFacturaPagada('${id}')">${t('facMarcarPagada')}</button>`:`<div style="text-align:center;color:var(--success);font-family:var(--font-head);font-size:1.1rem;padding:1rem">${t('facPagada')}</div>`}
    ${f.reparacion_id?'':`<button onclick="crearTrabajoDesdePresupuesto('${id}')" style="width:100%;margin-top:.5rem;background:rgba(0,229,255,.1);color:var(--accent);border:1px solid rgba(0,229,255,.25);border-radius:10px;padding:.65rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer">🔧 Crear trabajo desde este presupuesto</button>`}`;
}

async function compartirFactura(id, viaShare = false) {
  const { data:f } = await sb.from('facturas').select('*, clientes(nombre,telefono,ruc), reparaciones(descripcion,vehiculos(patente,marca))').eq('id',id).single();
  if (!f) return;
  const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';
  const tallerRuc = currentPerfil?.talleres?.ruc || '';
  const tallerDir = currentPerfil?.talleres?.direccion || '';
  const tallerTel = currentPerfil?.talleres?.telefono || '';

  toast(t('generandoPdf'), 'info');

  try {
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.crossOrigin = 'anonymous';
        s.onload = resolve;
        s.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const m = 15; // margen
    const w = 180; // ancho útil
    let y = 15;

    // === HEADER: Franja superior con logo ===
    doc.setFillColor(22, 22, 35);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(0, 229, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(tallerNombre.toUpperCase(), m, 14);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 200);
    doc.setFont('helvetica', 'normal');
    const infoLines = [tallerRuc?'RUC: '+tallerRuc:'', tallerDir||'', tallerTel?'Tel: '+tallerTel:''].filter(Boolean);
    infoLines.forEach((line,i) => doc.text(line, m, 20 + i*4));
    // Presupuesto badge
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(f.numero ? 'PRESUPUESTO N° ' + String(f.numero).padStart(3,'0') : 'PRESUPUESTO', 195, 12, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Fecha: ' + formatFecha(f.fecha), 195, 18, { align: 'right' });
    doc.setTextColor(f.pagada?0:255, f.pagada?200:180, f.pagada?100:0);
    doc.text(f.pagada ? '● PAGADA' : '● PENDIENTE', 195, 24, { align: 'right' });

    y = 40;

    // === DATOS DEL CLIENTE ===
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(m, y, w, 28, 2, 2, 'F');
    doc.setTextColor(100, 105, 120);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', m + 4, y + 5);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 45);
    doc.text(f.clientes?.nombre || 'Sin cliente', m + 4, y + 12);
    doc.setTextColor(100, 105, 120);
    doc.setFontSize(8);
    if (f.clientes?.ruc) doc.text('RUC: ' + f.clientes.ruc, m + 4, y + 18);
    if (f.clientes?.telefono) doc.text('Tel: ' + f.clientes.telefono, m + 4, y + 23);
    // Vehículo al lado derecho
    if (f.reparaciones?.vehiculos) {
      doc.setTextColor(100, 105, 120);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('VEHÍCULO', m + 95, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 45);
      doc.text(f.reparaciones.vehiculos.patente + ' · ' + f.reparaciones.vehiculos.marca, m + 95, y + 12);
    }
    y += 34;

    // === DESCRIPCIÓN DEL TRABAJO ===
    if (f.reparaciones?.descripcion) {
      doc.setTextColor(100, 105, 120);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('DESCRIPCIÓN', m, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 45);
      y += 5;
      const descLines = doc.splitTextToSize(f.reparaciones.descripcion, w);
      doc.text(descLines, m, y);
      y += descLines.length * 5 + 5;
    }

    // === TABLA DE CONCEPTOS ===
    // Header tabla
    doc.setFillColor(22, 22, 35);
    doc.roundedRect(m, y, w, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCEPTO', m + 4, y + 5.5);
    doc.text('MONTO', 195 - 4, y + 5.5, { align: 'right' });
    y += 10;

    // Filas
    const conceptos = [
      ['Mano de obra', f.mano_obra],
      ['Repuestos', f.repuestos],
      ['Otros', f.otros],
    ].filter(([,v]) => v > 0);

    conceptos.forEach(([label, monto], i) => {
      if (i % 2 === 0) { doc.setFillColor(250, 250, 252); doc.rect(m, y - 3, w, 8, 'F'); }
      doc.setTextColor(50, 50, 65);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(label, m + 4, y + 2);
      doc.text('Gs. ' + gs(monto), 195 - 4, y + 2, { align: 'right' });
      y += 8;
    });

    // IVA
    const iva10 = Math.round(f.total * 10 / 110);
    doc.setDrawColor(200, 205, 215);
    doc.line(m, y, m + w, y);
    y += 5;
    doc.setTextColor(120, 125, 140);
    doc.setFontSize(8);
    doc.text('IVA incluido (10%)', m + 4, y + 2);
    doc.text('Gs. ' + gs(iva10), 195 - 4, y + 2, { align: 'right' });
    y += 8;

    // === TOTAL ===
    doc.setFillColor(0, 229, 255);
    doc.roundedRect(m, y, w, 12, 2, 2, 'F');
    doc.setTextColor(10, 10, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL', m + 5, y + 8);
    doc.text('Gs. ' + gs(f.total), 195 - 5, y + 8, { align: 'right' });
    y += 20;

    // === NOTAS ===
    if (f.notas) {
      doc.setTextColor(120, 125, 140);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      const notaLines = doc.splitTextToSize('Notas: ' + f.notas, w);
      doc.text(notaLines, m, y);
      y += notaLines.length * 4 + 5;
    }

    // === LÍNEA DE FIRMA ===
    y = Math.max(y + 15, 230);
    doc.setDrawColor(180, 185, 195);
    doc.line(m, y, m + 70, y);
    doc.line(m + 110, y, m + w, y);
    doc.setTextColor(130, 135, 150);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Firma del cliente', m + 20, y + 4);
    doc.text('Firma del taller', m + 130, y + 4);

    // === FOOTER ===
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 280, 210, 17, 'F');
    doc.setTextColor(150, 155, 170);
    doc.setFontSize(7);
    doc.text('Documento generado por TallerPro · Sistema de Gestión para Talleres', 105, 288, { align: 'center' });

    // Compartir o descargar
    const pdfBlob = doc.output('blob');
    const fileName = `Presupuesto_${f.numero?f.numero+'_':''}${f.clientes?.nombre?.replace(/\s/g,'_') || 'cliente'}_${f.fecha || 'hoy'}.pdf`;
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
    const textoShare = `Presupuesto ${f.numero?'#'+f.numero+' ':''}de ${tallerNombre} - ₲${gs(f.total)} - ${formatFecha(f.fecha)}`;

    if (viaShare && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      // En celular: abre el menú de compartir con el PDF adjunto (WhatsApp, email, etc)
      await navigator.share({ title: textoShare, text: textoShare, files: [file] });
    } else if (viaShare && !navigator.share) {
      // En PC: descargar PDF + abrir WhatsApp con texto
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      if (f.clientes?.telefono) {
        const tel = f.clientes.telefono.replace(/\D/g,'');
        window.open(`https://wa.me/595${tel}?text=${encodeURIComponent(textoShare + '. Te envío el PDF por separado.')}`);
      }
      toast('PDF descargado. Adjuntalo en WhatsApp.', 'success');
    } else {
      // Solo descargar
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      toast(t('pdfDescargado'), 'success');
    }

  } catch(e) {
    toast('Error al generar PDF: ' + e.message, 'error');
  }
}

async function marcarFacturaPagada(id) {
  await offlineUpdate('facturas', { pagada:true }, 'id', id);
  toast('Factura marcada como pagada','success'); detalleFactura(id);
}

async function crearTrabajoDesdePresupuesto(facturaId) {
  const { data:f } = await sb.from('facturas').select('*, clientes(id,nombre), reparaciones(id,descripcion,vehiculo_id)').eq('id',facturaId).single();
  if (!f) return;
  const desc = f.reparaciones?.descripcion || 'Trabajo desde presupuesto #'+(f.numero||'');
  const { data: newRep, error } = await sb.from('reparaciones').insert({
    descripcion: desc,
    tipo_trabajo: 'Mecánica general',
    vehiculo_id: f.reparaciones?.vehiculo_id || null,
    cliente_id: f.cliente_id || null,
    costo: f.total || 0,
    costo_repuestos: f.repuestos || 0,
    estado: 'pendiente',
    fecha: new Date().toISOString().split('T')[0],
    taller_id: tid()
  }).select('id').single();
  if (error) { toast('Error: '+error.message,'error'); return; }
  // Vincular factura con la reparación
  await sb.from('facturas').update({ reparacion_id: newRep.id }).eq('id', facturaId);
  clearCache('reparaciones');
  toast('Trabajo creado desde presupuesto','success');
  detalleReparacion(newRep.id);
}

