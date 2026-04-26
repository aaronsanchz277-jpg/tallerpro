// ─── IMPORTACIÓN DE CLIENTES Y VEHÍCULOS DESDE EXCEL/CSV ────────────────────
//
// Flujo wizard de 4 pasos:
//   1) Bienvenida + descargar plantilla + subir archivo
//   2) Vista previa + mapeo de columnas (Excel -> campo de la base)
//   3) Resumen de validación (nuevos / duplicados / errores)
//   4) Inserción en lotes + resumen final
//
// Las claves para que esto escale a 800+ filas:
//   - Cargar TODOS los clientes y vehículos actuales del taller a memoria
//     una sola vez (no N queries de buscar duplicado).
//   - Generar UUIDs en el cliente (crypto.randomUUID) para poder vincular
//     vehículos a clientes nuevos sin esperar el round-trip de Postgres.
//   - Insertar en lotes de ~100. Si el lote falla, reintentar fila por
//     fila para no perder filas válidas.
//   - Online-only: la importación masiva no tiene sentido offline.

const _IMPORT_BATCH = 100;
const _IMPORT_MAX_FILE_MB = 5;

// Estado del wizard, vive solo durante el flujo del modal.
let _importState = null;

// Sinónimos para detección automática del mapeo (case-insensitive, sin tildes).
const _IMPORT_FIELD_SYNONYMS = {
  nombre:   ['nombre','cliente','razon social','razon','name','propietario','dueno','dueño','dueño/a','full name','nombre completo','nombre y apellido'],
  telefono: ['telefono','teléfono','tel','celular','cel','movil','móvil','phone','whatsapp','wpp','wsp','wa','contacto'],
  email:    ['email','correo','mail','e-mail','correo electronico','correo electrónico'],
  ruc:      ['ruc','ci','cedula','cédula','cuit','dni','documento','doc','nit'],
  patente:  ['patente','placa','matricula','matrícula','chapa','license','license plate','dominio'],
  marca:    ['marca','brand','make','fabricante'],
  modelo:   ['modelo','model','version','versión'],
  anio:     ['anio','año','ano','year','modelo año','modelo anio'],
  color:    ['color','colour']
};

const _IMPORT_FIELD_LABELS = {
  nombre:   'Nombre del cliente',
  telefono: 'Teléfono',
  email:    'Email',
  ruc:      'RUC / CI',
  patente:  'Patente del vehículo',
  marca:    'Marca',
  modelo:   'Modelo',
  anio:     'Año',
  color:    'Color'
};

// Quita tildes y lowercase.
function _normHeader(s) {
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ').trim();
}

function _detectFieldFromHeader(headerRaw) {
  const norm = _normHeader(headerRaw);
  if (!norm) return null;
  for (const [field, syns] of Object.entries(_IMPORT_FIELD_SYNONYMS)) {
    if (syns.includes(norm)) return field;
  }
  // Heurística suave: el header CONTIENE el sinónimo (p.ej. "Tel. Cel.").
  for (const [field, syns] of Object.entries(_IMPORT_FIELD_SYNONYMS)) {
    if (syns.some(syn => norm.includes(syn))) return field;
  }
  return null;
}

// ─── Botón / banner público en clientes y vehículos ─────────────────────────

// Banner llamativo para listados vacíos. Se ve solo cuando el taller no tiene
// nada cargado todavía — clave para onboarding.
function bannerImportarVacio(tipo) {
  const titulo = tipo === 'clientes'
    ? '¿Ya tenés tus clientes en Excel?'
    : '¿Ya tenés tus vehículos en Excel?';
  return `
    <div style="background:linear-gradient(135deg,rgba(0,229,255,.08),rgba(0,229,255,.02));border:1px solid rgba(0,229,255,.25);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.4rem">
        <span style="font-size:1.4rem">📥</span>
        <strong style="color:var(--accent);font-family:var(--font-head)">${titulo}</strong>
      </div>
      <p style="font-size:.85rem;color:var(--text2);margin:0 0 .8rem 0">Cargá todos juntos en lugar de uno por uno. Aceptamos .xlsx y .csv.</p>
      <button class="btn-primary" style="margin:0;width:auto;padding:.5rem 1rem" onclick="modalImportarExcel('${tipo}')">Importar desde Excel</button>
    </div>`;
}

// ─── PASO 1: Bienvenida + descargar plantilla + subir archivo ───────────────

async function modalImportarExcel(tipoOrigen = 'clientes') {
  if (!requireOnline('importar datos')) return;
  if (!['admin','empleado'].includes(currentPerfil?.rol)) {
    toast('Solo el admin o empleado puede importar', 'error');
    return;
  }
  _importState = { tipoOrigen, archivo: null, headers: [], rows: [], mapping: {}, validacion: null, resultado: null };

  openModal(`
    <div class="modal-title">📥 Importar desde Excel</div>
    <p style="color:var(--text2);font-size:.9rem;margin-bottom:.8rem">
      Cargá clientes y vehículos en lote desde un Excel <code>.xlsx</code> o <code>.csv</code>.
      Si una fila tiene patente y datos de cliente juntos, los vinculamos automáticamente.
    </p>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:.8rem;margin-bottom:.8rem">
      <div style="font-family:var(--font-head);font-size:.9rem;margin-bottom:.4rem">1️⃣ ¿No sabés cómo armar el Excel?</div>
      <p style="font-size:.8rem;color:var(--text2);margin:0 0 .5rem 0">Descargá la plantilla, completala con tus datos y volvé a subirla.</p>
      <button class="btn-secondary" style="margin:0;width:auto;padding:.5rem .8rem" onclick="descargarPlantillaImport()">⬇ Descargar plantilla</button>
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:.8rem;margin-bottom:.8rem">
      <div style="font-family:var(--font-head);font-size:.9rem;margin-bottom:.4rem">2️⃣ Subí tu archivo</div>
      <input type="file" id="f-import-archivo" accept=".xlsx,.xls,.csv" class="form-input" style="padding:.4rem" onchange="onArchivoImportSeleccionado(this)">
      <p style="font-size:.75rem;color:var(--text2);margin:.5rem 0 0 0">Máximo ${_IMPORT_MAX_FILE_MB} MB. Formatos: .xlsx, .xls, .csv</p>
    </div>

    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
  `);
}

async function descargarPlantillaImport() {
  await safeCall(async () => {
    await loadXLSX();
    const headers = ['Nombre','Telefono','Email','RUC','Patente','Marca','Modelo','Año','Color'];
    const ejemplos = [
      ['Juan Pérez', '0981 123 456', 'juan@mail.com', '80012345-6', 'ABC123', 'Toyota', 'Corolla', 2020, 'Blanco'],
      ['María Gómez', '0982 333 444', '', '', 'XYZ789', 'Ford', 'Ranger', 2018, 'Negro']
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...ejemplos]);
    // Anchos sugeridos para que se vea decente al abrir.
    ws['!cols'] = [{wch:22},{wch:14},{wch:22},{wch:14},{wch:10},{wch:12},{wch:12},{wch:6},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes y Vehiculos');
    XLSX.writeFile(wb, `plantilla_importar_tallerpro.xlsx`);
    toast('Plantilla descargada', 'success');
  }, null, 'No se pudo descargar la plantilla');
}

async function onArchivoImportSeleccionado(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > _IMPORT_MAX_FILE_MB * 1024 * 1024) {
    toast(`Archivo muy grande (máx ${_IMPORT_MAX_FILE_MB} MB)`, 'error');
    input.value = '';
    return;
  }
  await safeCall(async () => {
    await loadXLSX();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type:'array', cellDates:false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) { toast('El archivo está vacío', 'error'); return; }
    const ws = wb.Sheets[sheetName];
    // header:1 → array de arrays. defval:'' para no perder posiciones.
    const aoa = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:true, blankrows:false });
    if (!aoa.length) { toast('La hoja está vacía', 'error'); return; }
    const headers = (aoa[0]||[]).map(h => String(h||'').trim());
    const rows = aoa.slice(1).filter(r => r.some(c => String(c||'').trim() !== ''));
    if (!rows.length) { toast('No hay filas con datos', 'error'); return; }

    _importState.archivo = file.name;
    _importState.headers = headers;
    _importState.rows = rows;
    // Detección automática de mapeo: índice de columna → field
    _importState.mapping = {};
    headers.forEach((h, i) => {
      const f = _detectFieldFromHeader(h);
      if (f && !Object.values(_importState.mapping).includes(f)) {
        _importState.mapping[i] = f;
      }
    });
    pasoMapeoImport();
  }, null, 'No se pudo leer el archivo');
}

// ─── PASO 2: Vista previa + mapeo ───────────────────────────────────────────

function pasoMapeoImport() {
  const { headers, rows, mapping } = _importState;
  const PREVIEW = Math.min(5, rows.length);
  const fieldOptions = ['', ...Object.keys(_IMPORT_FIELD_LABELS)];

  const headRow = headers.map((h, i) => `
    <th style="padding:.4rem;border-bottom:1px solid var(--border);text-align:left;font-size:.7rem;color:var(--text2);min-width:120px">
      <div style="margin-bottom:.3rem;font-weight:normal">${h ? h.replace(/</g,'&lt;') : `(col ${i+1})`}</div>
      <select id="map-${i}" onchange="actualizarMapeoImport(${i}, this.value)" style="width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:.3rem;font-size:.75rem">
        ${fieldOptions.map(f => `<option value="${f}" ${mapping[i]===f?'selected':''}>${f === '' ? '(ignorar)' : _IMPORT_FIELD_LABELS[f]}</option>`).join('')}
      </select>
    </th>`).join('');

  const bodyRows = rows.slice(0, PREVIEW).map(r => `
    <tr>${headers.map((_, i) => `<td style="padding:.4rem;border-bottom:1px solid var(--border);font-size:.78rem">${String(r[i]??'').replace(/</g,'&lt;')}</td>`).join('')}</tr>
  `).join('');

  openModal(`
    <div class="modal-title">📥 Importar — Mapear columnas (paso 2 de 3)</div>
    <p style="color:var(--text2);font-size:.85rem;margin-bottom:.6rem">
      Archivo: <b>${(_importState.archivo||'').replace(/</g,'&lt;')}</b> · ${rows.length} fila${rows.length===1?'':'s'} con datos.
    </p>
    <p style="color:var(--text2);font-size:.8rem;margin-bottom:.8rem">
      Confirmá qué columna del Excel corresponde a cada campo. Lo que dejes en <i>(ignorar)</i> no se importa.
      Para que la fila valga, tiene que tener al menos <b>Nombre</b> (cliente) o <b>Patente</b> (vehículo).
    </p>

    <div style="overflow:auto;max-width:100%;border:1px solid var(--border);border-radius:8px;margin-bottom:.8rem">
      <table style="border-collapse:collapse;width:100%">
        <thead><tr>${headRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    ${rows.length > PREVIEW ? `<p style="font-size:.75rem;color:var(--text2);margin:0 0 .8rem 0">Mostrando primeras ${PREVIEW} filas — el resto se procesa al confirmar.</p>` : ''}

    <div style="display:flex;gap:.5rem">
      <button class="btn-secondary" style="margin:0;flex:1" onclick="modalImportarExcel('${_importState.tipoOrigen}')">← Atrás</button>
      <button class="btn-primary" style="margin:0;flex:1" onclick="validarYResumirImport()">Continuar →</button>
    </div>
  `);
}

function actualizarMapeoImport(colIdx, field) {
  if (!_importState) return;
  // Quitar el field de cualquier otra columna que lo tenga (no se permiten duplicados).
  if (field) {
    for (const k of Object.keys(_importState.mapping)) {
      if (_importState.mapping[k] === field && parseInt(k,10) !== colIdx) {
        delete _importState.mapping[k];
        const sel = document.getElementById(`map-${k}`);
        if (sel) sel.value = '';
      }
    }
  }
  if (!field) delete _importState.mapping[colIdx];
  else _importState.mapping[colIdx] = field;
}

// ─── PASO 3: Validar y resumir ──────────────────────────────────────────────

async function validarYResumirImport() {
  await safeCall(async () => {
    const { headers, rows, mapping } = _importState;

    // Chequear que al menos haya un campo "ancla" mapeado.
    // Decisión deliberada (no es bug): aceptamos importar SOLO clientes
    // o SOLO vehículos. Un Excel real puede ser una agenda de clientes
    // sin patentes, o un parque automotor sin dueños cargados; obligar a
    // mapear ambos rompería esos casos. Cuando aparecen los dos en la
    // misma fila, los vinculamos automáticamente.
    const fieldsMapeados = Object.values(mapping);
    const hayNombre = fieldsMapeados.includes('nombre');
    const hayPatente = fieldsMapeados.includes('patente');
    if (!hayNombre && !hayPatente) {
      toast('Tenés que mapear al menos "Nombre del cliente" o "Patente del vehículo"', 'error');
      return;
    }

    // Cargar todo lo existente del taller a memoria una sola vez.
    const tallerId = tid();
    const [resCli, resVeh] = await Promise.all([
      sb.from('clientes').select('id,nombre,telefono,ruc').eq('taller_id', tallerId),
      sb.from('vehiculos').select('id,patente,cliente_id').eq('taller_id', tallerId)
    ]);
    if (resCli.error) { toast('No se pudieron cargar los clientes existentes', 'error'); return; }
    if (resVeh.error) { toast('No se pudieron cargar los vehículos existentes', 'error'); return; }

    // Índices para búsqueda O(1).
    const idxCliPorTel = new Map();
    const idxCliPorRuc = new Map();
    (resCli.data||[]).forEach(c => {
      const tn = normalizarTelefono(c.telefono);
      if (tn) idxCliPorTel.set(tn, c);
      const rn = (c.ruc||'').toString().trim();
      if (rn) idxCliPorRuc.set(rn, c);
    });
    const idxVehPorPat = new Map();
    (resVeh.data||[]).forEach(v => {
      const pn = normalizarPatente(v.patente);
      if (pn) idxVehPorPat.set(pn, v);
    });

    // Inverso del mapping: field → colIdx.
    const colDe = {};
    for (const [k, v] of Object.entries(mapping)) colDe[v] = parseInt(k, 10);
    const get = (row, field) => {
      const i = colDe[field];
      if (i === undefined) return '';
      const v = row[i];
      if (v === null || v === undefined) return '';
      return String(v).trim();
    };

    const anioMin = 1900;
    const anioMax = new Date().getFullYear() + 2;

    // Vamos a clasificar cada fila y a producir los lotes a insertar.
    const clientesNuevos = [];          // [{id, nombre, ...}]
    const clientesNuevosKey = new Map(); // dedup INTRA-Excel (mismo tel/ruc en dos filas)
    const vehiculosNuevos = [];         // [{id, patente, cliente_id, ...}]
    const vehiculosNuevosKey = new Set(); // dedup INTRA-Excel por patente
    const errores = [];                 // [{fila, motivo}]
    let cntCliExist = 0, cntVehExist = 0;

    rows.forEach((row, idx) => {
      const filaNum = idx + 2; // +1 por header, +1 por base 1 humana
      const nombre = get(row, 'nombre');
      const telefono = get(row, 'telefono');
      const email = get(row, 'email');
      const ruc = get(row, 'ruc');
      const patenteRaw = get(row, 'patente');
      const marca = get(row, 'marca');
      const modelo = get(row, 'modelo');
      const anioStr = get(row, 'anio');
      const color = get(row, 'color');

      const tieneCli = !!(nombre || ruc || telefono || email);
      const tienePat = !!patenteRaw;

      if (!tieneCli && !tienePat) {
        // Fila completamente vacía: ignorar silenciosamente (ya filtramos blankrows).
        return;
      }

      // ─── Pre-validar TODA la fila antes de tocar nada ───
      // Si hay cualquier problema bloqueante, se omite la fila ENTERA. Así
      // evitamos importar parcialmente (vehículo sin dueño porque el cliente
      // estaba mal, o vehículo con año nulo silencioso, etc.) — la promesa al
      // usuario es "filas con problemas se omiten, el resto se importa".
      const problemas = [];
      if (tieneCli && !nombre) {
        problemas.push('Datos de cliente sin nombre (es obligatorio)');
      }
      let anio = null;
      if (tienePat && anioStr) {
        const a = parseInt(anioStr, 10);
        if (isNaN(a) || a < anioMin || a > anioMax) {
          problemas.push(`Año "${anioStr}" fuera de rango (${anioMin}-${anioMax})`);
        } else {
          anio = a;
        }
      }
      let patN = '';
      if (tienePat) {
        patN = normalizarPatente(patenteRaw);
        if (!patN) problemas.push('Patente vacía o inválida después de normalizar');
      }
      if (problemas.length > 0) {
        errores.push({ fila: filaNum, motivo: problemas.join(' · ') });
        return; // omitir la fila completa
      }

      // Si la patente ya existe en el sistema, omitimos la fila ENTERA —
      // no procesamos al cliente tampoco. De lo contrario una fila como
      // "cliente nuevo + patente ya existente" crearía un cliente
      // fantasma sin vehículo (el vehículo no se reasigna y el cliente
      // queda flotando). El admin que quiera cambiar el dueño del
      // vehículo puede hacerlo manualmente desde su ficha.
      if (patN && idxVehPorPat.has(patN)) {
        cntVehExist++;
        return;
      }

      // ─── Resolver cliente (ya sin problemas) ───
      let clienteIdParaVehiculo = null;
      if (nombre) {
        const telN = normalizarTelefono(telefono);
        const rucN = ruc.trim();

        // Buscar duplicado en BD.
        let existente = null;
        if (rucN && idxCliPorRuc.has(rucN)) existente = idxCliPorRuc.get(rucN);
        else if (telN && idxCliPorTel.has(telN)) existente = idxCliPorTel.get(telN);

        // Buscar duplicado intra-Excel — SOLO si tenemos un identificador
        // fuerte (RUC o teléfono). Fusionar por nombre es peligroso: dos
        // "Juan Pérez" del mismo barrio terminarían como un solo cliente
        // mezclando vehículos. Si solo hay nombre, cada fila va como
        // cliente nuevo y el admin ya puede mergear manualmente después
        // si quiere.
        const intraKey = rucN ? `r:${rucN}` : (telN ? `t:${telN}` : null);
        if (!existente && intraKey && clientesNuevosKey.has(intraKey)) {
          clienteIdParaVehiculo = clientesNuevosKey.get(intraKey);
        } else if (existente) {
          clienteIdParaVehiculo = existente.id;
          cntCliExist++;
        } else {
          const newId = crypto.randomUUID();
          const cli = { id: newId, taller_id: tallerId, nombre, telefono: telefono || null, email: email || null, ruc: ruc || null };
          clientesNuevos.push(cli);
          if (intraKey) clientesNuevosKey.set(intraKey, newId);
          // También indexamos por tel/ruc para que la próxima fila con mismo tel/ruc lo reuse.
          if (telN) idxCliPorTel.set(telN, { id: newId, nombre });
          if (rucN) idxCliPorRuc.set(rucN, { id: newId, nombre });
          clienteIdParaVehiculo = newId;
        }
      }

      // ─── Resolver vehículo (ya sin problemas; patente no existe en BD) ───
      if (patN) {
        if (vehiculosNuevosKey.has(patN)) {
          // Patente repetida dentro del mismo Excel — primera gana.
          errores.push({ fila: filaNum, motivo: `Patente "${patN}" duplicada dentro del Excel (se importa la primera aparición)` });
          return;
        }
        const newId = crypto.randomUUID();
        vehiculosNuevos.push({
          id: newId, taller_id: tallerId, patente: patN,
          marca: marca || null, modelo: modelo || null,
          anio, color: color || null,
          cliente_id: clienteIdParaVehiculo
        });
        vehiculosNuevosKey.add(patN);
      }
    });

    _importState.validacion = { clientesNuevos, vehiculosNuevos, errores, cntCliExist, cntVehExist };
    pasoResumenImport();
  }, null, 'No se pudo validar el archivo');
}

function pasoResumenImport() {
  const { clientesNuevos, vehiculosNuevos, errores, cntCliExist, cntVehExist } = _importState.validacion;
  const total = clientesNuevos.length + vehiculosNuevos.length;
  const erroresHtml = errores.length === 0 ? '' : `
    <div style="background:rgba(255,193,7,.06);border:1px solid rgba(255,193,7,.3);border-radius:10px;padding:.7rem;margin-bottom:.8rem">
      <div style="color:var(--warning);font-family:var(--font-head);font-size:.85rem;margin-bottom:.4rem">⚠ ${errores.length} fila${errores.length===1?'':'s'} con problemas (no se importan)</div>
      <div style="max-height:140px;overflow:auto;font-size:.78rem">
        ${errores.slice(0, 50).map(e => `<div style="padding:.2rem 0;border-bottom:1px dashed rgba(255,255,255,.06)"><b>Fila ${e.fila}:</b> ${e.motivo.replace(/</g,'&lt;')}</div>`).join('')}
        ${errores.length > 50 ? `<div style="padding:.3rem 0;color:var(--text2)">... y ${errores.length - 50} más</div>` : ''}
      </div>
    </div>`;

  openModal(`
    <div class="modal-title">📥 Importar — Confirmar (paso 3 de 3)</div>
    <p style="color:var(--text2);font-size:.85rem;margin-bottom:.8rem">Esto se va a importar:</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.8rem">
      <div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.25);border-radius:10px;padding:.7rem">
        <div style="font-size:1.6rem;font-family:var(--font-head);color:var(--accent)">${clientesNuevos.length}</div>
        <div style="font-size:.78rem;color:var(--text2)">clientes nuevos</div>
      </div>
      <div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.25);border-radius:10px;padding:.7rem">
        <div style="font-size:1.6rem;font-family:var(--font-head);color:var(--accent)">${vehiculosNuevos.length}</div>
        <div style="font-size:.78rem;color:var(--text2)">vehículos nuevos</div>
      </div>
    </div>

    ${(cntCliExist > 0 || cntVehExist > 0) ? `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:.7rem;margin-bottom:.8rem;font-size:.82rem;color:var(--text2)">
      ${cntCliExist > 0 ? `🔁 ${cntCliExist} cliente${cntCliExist===1?'':'s'} ya existe${cntCliExist===1?'':'n'} (vehículos nuevos quedan vinculados al existente)<br>` : ''}
      ${cntVehExist > 0 ? `🔁 ${cntVehExist} patente${cntVehExist===1?'':'s'} ya existe${cntVehExist===1?'':'n'} en el sistema (se omiten para no pisar datos)` : ''}
    </div>` : ''}

    ${erroresHtml}

    ${total === 0 ? `<p style="color:var(--danger);font-size:.85rem;margin-bottom:.8rem">No hay nada nuevo para importar.</p>` : ''}

    <div style="display:flex;gap:.5rem">
      <button class="btn-secondary" style="margin:0;flex:1" onclick="pasoMapeoImport()">← Atrás</button>
      <button class="btn-primary" style="margin:0;flex:1" onclick="ejecutarImport()" ${total === 0 ? 'disabled' : ''}>Importar ${total > 0 ? `${total} fila${total===1?'':'s'}` : ''}</button>
    </div>
  `);
}

// ─── PASO 4: Ejecutar import ────────────────────────────────────────────────

async function ejecutarImport() {
  const { clientesNuevos, vehiculosNuevos } = _importState.validacion;

  // Bloqueamos el modal con un estado de progreso.
  openModal(`
    <div class="modal-title">⏳ Importando…</div>
    <p id="import-progress-msg" style="color:var(--text2);font-size:.9rem;margin-bottom:.6rem">Preparando…</p>
    <div style="background:var(--bg);height:8px;border-radius:4px;overflow:hidden;border:1px solid var(--border)">
      <div id="import-progress-bar" style="height:100%;background:var(--accent);width:0%;transition:width .3s"></div>
    </div>
    <p style="font-size:.75rem;color:var(--text2);margin-top:.6rem">No cierres esta pantalla.</p>
  `);

  const setProgress = (pct, msg) => {
    const bar = document.getElementById('import-progress-bar');
    const m = document.getElementById('import-progress-msg');
    if (bar) bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    if (m) m.textContent = msg;
  };

  const erroresInsert = [];
  let cliInsertados = 0, vehInsertados = 0;

  // Wrapper defensivo: si revienta la red en medio de la importación, igual
  // mostramos al usuario lo que sí se guardó y por qué se cortó.
  try {
    // ─── Insertar clientes ───
    if (clientesNuevos.length > 0) {
      const totalLotes = Math.ceil(clientesNuevos.length / _IMPORT_BATCH);
      for (let i = 0, lote = 0; i < clientesNuevos.length; i += _IMPORT_BATCH, lote++) {
        const batch = clientesNuevos.slice(i, i + _IMPORT_BATCH);
        setProgress(((lote+1) / totalLotes) * 50, `Subiendo clientes — lote ${lote+1} de ${totalLotes}`);
        const { error } = await sb.from('clientes').insert(batch);
        if (error) {
          // Reintentar uno por uno para no perder filas válidas.
          for (const row of batch) {
            const { error: e2 } = await sb.from('clientes').insert(row);
            if (e2) erroresInsert.push({ tipo: 'cliente', nombre: row.nombre, motivo: e2.message });
            else cliInsertados++;
          }
        } else {
          cliInsertados += batch.length;
        }
      }
    }

    // Si algún cliente falló, los vehículos vinculados a esos cliente_id
    // quedarían huérfanos y romperían la FK al insertarse. Resolvemos
    // re-consultando qué IDs realmente quedaron en la base. Si esa
    // consulta también falla, NO limpiamos a ciegas (eso destruye links
    // válidos): mejor avisamos y dejamos que el INSERT de vehículos falle
    // por FK fila a fila, así el usuario ve el motivo real.
    if (erroresInsert.length > 0) {
      const cidsUsados = [...new Set(vehiculosNuevos.map(v => v.cliente_id).filter(Boolean))];
      if (cidsUsados.length > 0) {
        const { data: existentes, error: errLookup } = await sb.from('clientes').select('id').in('id', cidsUsados);
        if (errLookup) {
          erroresInsert.push({ tipo: 'aviso', nombre: '', motivo: 'No pudimos verificar qué clientes se guardaron, así que algunos vehículos podrían fallar al insertarse y aparecer abajo' });
        } else {
          const setExistentes = new Set((existentes||[]).map(c => c.id));
          let limpiados = 0;
          vehiculosNuevos.forEach(v => {
            if (v.cliente_id && !setExistentes.has(v.cliente_id)) {
              v.cliente_id = null;
              limpiados++;
            }
          });
          if (limpiados > 0) {
            erroresInsert.push({ tipo: 'aviso', nombre: '', motivo: `${limpiados} vehículo(s) quedaron sin cliente porque su dueño falló al guardarse` });
          }
        }
      }
    }

    // ─── Insertar vehículos ───
    if (vehiculosNuevos.length > 0) {
      const totalLotes = Math.ceil(vehiculosNuevos.length / _IMPORT_BATCH);
      for (let i = 0, lote = 0; i < vehiculosNuevos.length; i += _IMPORT_BATCH, lote++) {
        const batch = vehiculosNuevos.slice(i, i + _IMPORT_BATCH);
        setProgress(50 + ((lote+1) / totalLotes) * 50, `Subiendo vehículos — lote ${lote+1} de ${totalLotes}`);
        const { error } = await sb.from('vehiculos').insert(batch);
        if (error) {
          for (const row of batch) {
            const { error: e2 } = await sb.from('vehiculos').insert(row);
            if (e2) erroresInsert.push({ tipo: 'vehiculo', nombre: row.patente, motivo: e2.message });
            else vehInsertados++;
          }
        } else {
          vehInsertados += batch.length;
        }
      }
    }

    setProgress(100, 'Listo');
  } catch (e) {
    // Excepción no capturada (red caída, JWT expirado, etc.). Reportamos
    // lo que se alcanzó a importar para que el usuario sepa el estado real.
    console.error('Importación interrumpida:', e);
    erroresInsert.push({ tipo: 'aviso', nombre: '', motivo: `La importación se cortó antes de terminar: ${e.message || e}. Lo que aparece como guardado abajo sí quedó en la base.` });
  }

  _importState.resultado = { cliInsertados, vehInsertados, erroresInsert };
  clearCache('clientes');
  clearCache('vehiculos');
  invalidateComponentCache();
  pasoFinalImport();
}

function pasoFinalImport() {
  const { cliInsertados, vehInsertados, erroresInsert } = _importState.resultado;
  const tipoOrigen = _importState.tipoOrigen;
  const exito = cliInsertados + vehInsertados;
  const erroresHtml = erroresInsert.length === 0 ? '' : `
    <div style="background:rgba(255,68,68,.06);border:1px solid rgba(255,68,68,.3);border-radius:10px;padding:.7rem;margin-bottom:.8rem">
      <div style="color:var(--danger);font-family:var(--font-head);font-size:.85rem;margin-bottom:.4rem">${erroresInsert.length} con problemas al guardar</div>
      <div style="max-height:140px;overflow:auto;font-size:.78rem">
        ${erroresInsert.slice(0, 30).map(e => `<div style="padding:.2rem 0;border-bottom:1px dashed rgba(255,255,255,.06)">${e.tipo === 'aviso' ? '' : `<b>${(e.tipo==='cliente'?'Cliente':'Vehículo')} ${(e.nombre||'').replace(/</g,'&lt;')}:</b> `}${(e.motivo||'').replace(/</g,'&lt;')}</div>`).join('')}
        ${erroresInsert.length > 30 ? `<div style="padding:.3rem 0;color:var(--text2)">... y ${erroresInsert.length - 30} más</div>` : ''}
      </div>
    </div>`;

  openModal(`
    <div class="modal-title">${exito > 0 ? '✅ Importación completada' : '⚠ No se importó nada'}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.8rem">
      <div style="background:rgba(76,175,80,.08);border:1px solid rgba(76,175,80,.3);border-radius:10px;padding:.8rem">
        <div style="font-size:1.6rem;font-family:var(--font-head);color:var(--success)">${cliInsertados}</div>
        <div style="font-size:.78rem;color:var(--text2)">clientes guardados</div>
      </div>
      <div style="background:rgba(76,175,80,.08);border:1px solid rgba(76,175,80,.3);border-radius:10px;padding:.8rem">
        <div style="font-size:1.6rem;font-family:var(--font-head);color:var(--success)">${vehInsertados}</div>
        <div style="font-size:.78rem;color:var(--text2)">vehículos guardados</div>
      </div>
    </div>
    ${erroresHtml}
    <button class="btn-primary" onclick="cerrarYRefrescarImport()">Cerrar y ver listado</button>
  `);

  if (exito > 0) toast(`✓ ${exito} fila${exito===1?'':'s'} importada${exito===1?'':'s'}`, 'success');
}

function cerrarYRefrescarImport() {
  const tipo = _importState?.tipoOrigen || 'clientes';
  closeModal();
  _importState = null;
  if (typeof navigate === 'function') navigate(tipo);
  else if (tipo === 'vehiculos' && typeof vehiculos === 'function') vehiculos();
  else if (typeof clientes === 'function') clientes();
}
