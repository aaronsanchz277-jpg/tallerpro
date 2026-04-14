// ─── ASISTENTE IA v2 (Secretaria virtual con voz, jopara, contexto) ─────────

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
let _iaMessages = [];
let _iaListening = false;
let _groqKey = null;

async function ia_loadKey() {
  if (_groqKey) return _groqKey;
  const { data } = await sb.from('config_keys').select('valor').eq('taller_id', tid()).eq('clave', 'groq_api_key').maybeSingle();
  _groqKey = data?.valor || null;
  return _groqKey;
}

function ia_init() {
  const rol = currentPerfil?.rol;
  if (rol !== 'admin' && rol !== 'empleado') return;
  if (document.getElementById('ia-fab')) return;
  const fab = document.createElement('div');
  fab.id = 'ia-fab';
  fab.onclick = ia_toggleChat;
  fab.innerHTML = '🤖';
  fab.style.cssText = 'position:fixed;bottom:75px;right:16px;width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#0099cc);display:flex;align-items:center;justify-content:center;font-size:1.4rem;cursor:pointer;z-index:99;box-shadow:0 4px 20px rgba(0,229,255,.35);transition:transform .2s';
  document.body.appendChild(fab);

  const chat = document.createElement('div');
  chat.id = 'ia-chat';
  chat.style.cssText = 'display:none;position:fixed;bottom:135px;right:16px;width:320px;max-height:450px;background:var(--surface);border:1px solid var(--border);border-radius:16px;z-index:99;box-shadow:0 8px 40px rgba(0,0,0,.4);flex-direction:column;overflow:hidden';
  chat.innerHTML = `
    <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div style="font-family:var(--font-head);color:var(--accent);font-size:.95rem">Asistente IA</div>
      <button onclick="ia_toggleChat()" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:1rem">✕</button>
    </div>
    <div id="ia-msgs" style="flex:1;overflow-y:auto;padding:.75rem;display:flex;flex-direction:column;gap:.5rem;min-height:200px;max-height:300px">
      <div style="background:rgba(0,229,255,.08);border-radius:12px 12px 12px 4px;padding:.6rem .8rem;font-size:.82rem;color:var(--text);max-width:85%">
        Mba'éichapa! Soy tu asistente. Hablame normal 🇵🇾<br><br>
        <span style="color:var(--text2)">"Entró una Toyota Hilux ABC 123"<br>
        "Cambio de aceite, 200 mil"<br>
        "¿Cuánto hicimos hoy?"<br>
        "¿Qué aceite lleva un Vitz?"</span>
      </div>
    </div>
    <div style="padding:.5rem;border-top:1px solid var(--border);display:flex;gap:.4rem">
      <button id="ia-mic-btn" onclick="ia_toggleVoz()" style="width:40px;height:40px;border-radius:50%;background:var(--surface2);border:1px solid var(--border);cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0">🎙️</button>
      <input id="ia-input" class="form-input" placeholder="Escribí o hablá..." style="flex:1;border-radius:20px;padding:.5rem .8rem;font-size:.82rem" onkeydown="if(event.key==='Enter')ia_enviar()">
      <button onclick="ia_enviar()" style="width:40px;height:40px;border-radius:50%;background:var(--accent);border:none;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#000">➤</button>
    </div>`;
  document.body.appendChild(chat);
}

function ia_toggleChat() {
  const chat = document.getElementById('ia-chat');
  if (!chat) return;
  const visible = chat.style.display === 'flex';
  chat.style.display = visible ? 'none' : 'flex';
}

function ia_addMsg(text, isUser) {
  const msgs = document.getElementById('ia-msgs');
  if (!msgs) return;
  const div = document.createElement('div');
  div.style.cssText = `background:${isUser ? 'var(--surface2)' : 'rgba(0,229,255,.08)'};border-radius:${isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px'};padding:.6rem .8rem;font-size:.82rem;color:var(--text);max-width:85%;white-space:pre-wrap;${isUser ? 'align-self:flex-end' : ''}`;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function ia_addLoading() {
  const msgs = document.getElementById('ia-msgs');
  if (!msgs) return;
  const div = document.createElement('div');
  div.id = 'ia-loading';
  div.style.cssText = 'background:rgba(0,229,255,.08);border-radius:12px 12px 12px 4px;padding:.6rem .8rem;font-size:.82rem;color:var(--text2);max-width:85%';
  div.textContent = 'Pensando...';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function ia_removeLoading() {
  const el = document.getElementById('ia-loading');
  if (el) el.remove();
}

function ia_toggleVoz() {
  if (_iaListening) { ia_stopVoz(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Tu navegador no soporta reconocimiento de voz','error'); return; }
  const rec = new SR();
  rec.lang = 'es-PY';
  rec.continuous = false;
  rec.interimResults = false;
  window._iaRec = rec;
  const btn = document.getElementById('ia-mic-btn');
  btn.style.background = 'rgba(255,68,68,.3)';
  btn.style.borderColor = 'var(--danger)';
  btn.textContent = '⏹';
  _iaListening = true;
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    document.getElementById('ia-input').value = text;
    ia_stopVoz();
    ia_enviar();
  };
  rec.onerror = (e) => { if (e.error !== 'aborted') toast('Error de voz: ' + e.error, 'error'); ia_stopVoz(); };
  rec.onend = () => ia_stopVoz();
  rec.start();
}

function ia_stopVoz() {
  _iaListening = false;
  if (window._iaRec) { try { window._iaRec.stop(); } catch(e) {} }
  const btn = document.getElementById('ia-mic-btn');
  if (btn) { btn.style.background = 'var(--surface2)'; btn.style.borderColor = 'var(--border)'; btn.textContent = '🎙️'; }
}

let _iaContextCache = null;
let _iaContextTime = 0;

async function ia_getContexto() {
  const now = Date.now();
  if (_iaContextCache && (now - _iaContextTime) < 60000) return _iaContextCache;

  const hoy = new Date().toISOString().split('T')[0];
  const [clientes, vehiculos, repsPend, repsHoy, invBajo, totalCli, totalVeh] = await Promise.all([
    sb.from('clientes').select('id,nombre,telefono').eq('taller_id', tid()).order('created_at',{ascending:false}).limit(30).then(r=>r.data||[]),
    sb.from('vehiculos').select('id,patente,marca,modelo').eq('taller_id', tid()).order('created_at',{ascending:false}).limit(30).then(r=>r.data||[]),
    sb.from('reparaciones').select('id,descripcion,estado,vehiculos(patente),clientes(nombre)').eq('taller_id', tid()).in('estado',['pendiente','en_progreso','esperando_repuestos']).limit(20).then(r=>r.data||[]),
    sb.from('reparaciones').select('costo').eq('taller_id', tid()).eq('estado','finalizado').eq('fecha', hoy).then(r=>r.data||[]),
    sb.from('inventario').select('nombre,cantidad,stock_minimo').eq('taller_id', tid()).limit(200).then(r=>(r.data||[]).filter(i=>parseFloat(i.cantidad)<=parseFloat(i.stock_minimo))),
    sb.from('clientes').select('*',{count:'exact',head:true}).eq('taller_id', tid()).then(r=>r.count||0),
    sb.from('vehiculos').select('*',{count:'exact',head:true}).eq('taller_id', tid()).then(r=>r.count||0)
  ]);
  const ingresosHoy = repsHoy.reduce((s,r) => s + parseFloat(r.costo||0), 0);
  _iaContextCache = { clientes, vehiculos, repsPend, ingresosHoy, invBajo, hoy, totalCli, totalVeh };
  _iaContextTime = now;
  return _iaContextCache;
}

async function ia_enviar() {
  const input = document.getElementById('ia-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  ia_addMsg(text, true);
  ia_addLoading();

  await safeCall(async () => {
    const ctx = await ia_getContexto();

    const sysPrompt = `Sos la secretaria IA de un taller mecánico en Paraguay. Tu nombre es TallerIA.

PERSONALIDAD:
- Hablás como paraguayo/a. Usás vos, tuteo, modismos locales.
- Entendés español, guaraní y jopara perfectamente.
- Si te hablan en jopara respondé en jopara. Si en español, en español.
- Sos eficiente, breve y práctica. No explicás de más.
- Si algo no queda claro, preguntás antes de hacer.

CONTEXTO ACTUAL DEL TALLER "${currentPerfil?.talleres?.nombre || 'Taller'}":
- Empleado/Admin actual: ${currentPerfil?.nombre || 'desconocido'} (${currentPerfil?.rol || 'desconocido'})
- Clientes (${ctx.totalCli} total, mostrando últimos 30): ${JSON.stringify(ctx.clientes.slice(0,30).map(c=>({id:c.id,n:c.nombre,t:c.telefono})))}
- Vehículos (${ctx.totalVeh} total, mostrando últimos 30): ${JSON.stringify(ctx.vehiculos.slice(0,30).map(v=>({id:v.id,p:v.patente,m:v.marca+' '+(v.modelo||'')})))}
- Si el cliente/vehículo que mencionan no está en esta lista, preguntá el nombre exacto para buscarlo
- Trabajos activos (${ctx.repsPend.length}): ${JSON.stringify(ctx.repsPend.slice(0,15).map(r=>({desc:r.descripcion,est:r.estado,auto:r.vehiculos?.patente,cli:r.clientes?.nombre})))}
- Ingresos hoy: ₲${ctx.ingresosHoy.toLocaleString()}
- Stock bajo: ${ctx.invBajo.length > 0 ? ctx.invBajo.map(i=>i.nombre+' ('+i.cantidad+')').join(', ') : 'todo OK'}
- Fecha/hora: ${ctx.hoy} ${new Date().toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'})}

INSTRUCCIONES CRÍTICAS:
1. RESPONDÉ SOLO JSON. Sin backticks, sin markdown, sin texto antes ni después. SOLO el JSON puro.
2. Si el usuario dice algo ambiguo o incompleto, preguntá con {"accion":"mensaje","texto":"..."}.
3. Si el usuario saluda o hace conversación casual, respondé amablemente con {"accion":"mensaje","texto":"..."}.
4. Entendé variaciones del habla paraguaya:
   - "registrame" / "anotame" / "cargame" = crear
   - "fijate" / "buscame" / "checkeame" = buscar
   - "cuánto hicimos" / "cómo estamos" = consultar_ingresos
   - "qué hay pendiente" / "qué falta" = consultar_pendientes
   - "se fue" / "ya retiró" / "listo" = cambiar estado a finalizado
   - "200 luca" / "200 mil" = 200000, "1 palo" / "un palo" = 1000000, "medio palo" = 500000
   - "fierro" / "auto" / "coche" / "máquina" = vehículo
   - "la chapa" / "la patente" / "la placa" = patente
5. Asociá inteligentemente: si dicen "el Toyota de Juan", buscá un cliente llamado Juan y un vehículo Toyota en el contexto.
6. Si mencionan un nombre parcial ("Juan"), buscá coincidencias en los clientes existentes. Si hay más de uno, preguntá cuál.
7. Para vehículos, matcheá por patente O por marca+cliente.
8. Si te dan info incompleta, creá con lo que tenés y avisá qué falta.
9. Si te preguntan algo técnico sobre mecánica automotriz, respondé como un mecánico experto con 20 años de experiencia:
   - Diagnóstico de fallas: ruidos, vibraciones, humo, pérdidas de líquido
   - Especificaciones: litros de aceite, tipo de aceite recomendado, presión de neumáticos, intervalos de cambio
   - Procedimientos: cómo cambiar pastillas, cómo purgar frenos, etc.
   - Siempre respondé con datos específicos cuando los sepas (ej: "Toyota Hilux 2.8D lleva 6.2L de aceite 5W-30")
   - Si no estás seguro de un dato exacto, decilo: "No tengo el dato exacto, verificá en el manual"
   - Usá {"accion":"mensaje","texto":"..."} para responder
10. Podés combinar acciones + consejos: "Creé la reparación de frenos. Tip: revisá también los discos, si tienen menos de 2mm de labio no hace falta cambiarlos."

ACCIONES DISPONIBLES:
{"accion":"crear_cliente","nombre":"...","telefono":"..."}
{"accion":"crear_vehiculo","patente":"...","marca":"...","modelo":"...","anio":"...","cliente_id":"uuid o null"}
{"accion":"crear_reparacion","tipo_trabajo":"Mecánica general|Cambio de aceite / Service|Frenos|Suspensión / Tren delantero|Electricidad|Chapa y pintura|Aire acondicionado|Diagnóstico|Otro","descripcion":"...","vehiculo_id":"uuid o null","cliente_id":"uuid o null","costo":0,"costo_repuestos":0}
{"accion":"crear_item_inventario","nombre":"...","cantidad":0,"precio_unitario":0}
{"accion":"descontar_stock","nombre":"...","cantidad":1}
{"accion":"agendar_cita","cliente_id":"uuid o null","vehiculo_id":"uuid o null","fecha":"YYYY-MM-DD","hora":"HH:MM","descripcion":"..."}
{"accion":"registrar_vale","empleado_nombre":"...","monto":0,"concepto":"..."}
{"accion":"buscar_cliente","nombre":"..."}
{"accion":"buscar_vehiculo","patente":"..."}
{"accion":"consultar_pendientes"}
{"accion":"consultar_ingresos"}
{"accion":"consultar_stock_bajo"}
{"accion":"consultar_deudores"}
{"accion":"crear_presupuesto","descripcion":"...","vehiculo_id":"uuid o null","cliente_id":"uuid o null","items":[{"tipo":"servicio|producto|adicional","descripcion":"...","precio":0,"cantidad":1}],"observaciones":"..."}
{"accion":"crear_quickservice","descripcion":"...","vehiculo_id":"uuid o null","cliente_id":"uuid o null","items":[{"tipo":"servicio","descripcion":"...","precio":0,"cantidad":1}]}
{"accion":"registrar_gasto","descripcion":"...","monto":0,"categoria":"Alquiler|Servicios|Repuestos|Sueldos|Impuestos|Herramientas|Otros","proveedor":"..."}
{"accion":"mensaje","texto":"..."} — respuestas conversacionales, preguntas, confirmaciones
{"accion":"multiple","acciones":[...]} — ejecutar varias acciones juntas

EJEMPLOS DE INTERPRETACIÓN:
- "entró el auto de Ramírez para frenos" → buscar cliente Ramírez, buscar su vehículo, crear reparación de frenos
- "anotame a Pedro García 0981222333" → crear_cliente
- "cuánto hicimo hoy" → consultar_ingresos
- "faltó aceite" → consultar_stock_bajo o descontar_stock según contexto
- "dale un vale de 50 mil a Carlos" → registrar_vale
- "quién me debe plata" / "deudores" → consultar_deudores
- "cambio de aceite 200 luca, repuestos 80 mil" → crear_reparacion con costo y costo_repuestos
- "haceme un presupuesto para frenos" → crear_presupuesto
- "servicio rápido, cambio de aceite 200 luca" → crear_quickservice
- "pagamos 500 mil de luz" / "gasto de alquiler 2 palos" → registrar_gasto
- "mba'éichapa" → {"accion":"mensaje","texto":"Mba'éichapa! Mba'épa reikotevẽ?"}
- "che amigo trajo su Hilux" → preguntar nombre, patente, qué servicio necesita`;

    _iaMessages.push({ role: 'user', content: text });

    const apiKey = await ia_loadKey();
    if (!apiKey) { ia_removeLoading(); ia_addMsg('El asistente IA no está configurado. El admin debe agregar la API key.', false); return; }
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: sysPrompt }, ..._iaMessages.slice(-14)],
        max_tokens: 800,
        temperature: 0.2
      })
    });
    const data = await res.json();
    const respText = data.choices?.[0]?.message?.content || '';
    _iaMessages.push({ role: 'assistant', content: respText });
    ia_removeLoading();

    let action;
    try {
      action = JSON.parse(respText.replace(/```json|```/g, '').trim());
    } catch(e) {
      ia_addMsg(respText || 'No entendí, intentá de nuevo.', false);
      return;
    }

    if (action.accion === 'multiple' && Array.isArray(action.acciones)) {
      for (const a of action.acciones) await ia_ejecutar(a);
    } else {
      await ia_ejecutar(action);
    }
  }, null, 'Error de conexión con la IA');
}

async function ia_ejecutar(a) {
  await safeCall(async () => {
    const clean = (v) => (v === null || v === undefined || v === 'null' || v === 'undefined' || v === '' || v === 'none') ? null : v;
    const cleanUUID = (v) => { const s = clean(v); return (s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) ? s : null; };
    const cleanNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

    switch(a.accion) {
      case 'crear_cliente': {
        const { data: nuevo, error } = await sb.from('clientes').insert({ nombre: a.nombre||'Sin nombre', telefono: clean(a.telefono), taller_id: tid() }).select().single();
        if (error) { ia_addMsg('Error: '+error.message, false); return; }
        ia_addMsg(`✓ Cliente "${a.nombre}" creado${a.telefono ? ' ('+a.telefono+')' : ''}`, false);
        invalidateComponentCache();
        break;
      }
      case 'crear_vehiculo': {
        const { data: nuevo, error } = await sb.from('vehiculos').insert({ patente:(a.patente||'').toUpperCase(), marca:a.marca||'', modelo:a.modelo||'', anio:parseInt(a.anio)||null, cliente_id:cleanUUID(a.cliente_id), taller_id:tid() }).select().single();
        if (error) { ia_addMsg('Error: '+error.message, false); return; }
        ia_addMsg(`✓ Vehículo ${(a.patente||'').toUpperCase()} ${a.marca||''} ${a.modelo||''} registrado\n¿Querés crear una reparación para este vehículo?`, false);
        invalidateComponentCache();
        break;
      }
      case 'crear_reparacion': {
        const tipoT = TIPOS_TRABAJO.includes(a.tipo_trabajo) ? a.tipo_trabajo : 'Mecánica general';
        const { data: newRep, error } = await sb.from('reparaciones').insert({ descripcion:a.descripcion||'Trabajo', tipo_trabajo:tipoT, vehiculo_id:cleanUUID(a.vehiculo_id), cliente_id:cleanUUID(a.cliente_id), costo:cleanNum(a.costo), costo_repuestos:cleanNum(a.costo_repuestos), estado:'pendiente', fecha:new Date().toISOString().split('T')[0], taller_id:tid() }).select('id').single();
        if (error) { ia_addMsg('Error: '+error.message, false); return; }
        if (newRep?.id && currentPerfil?.rol === 'empleado') {
          await sb.from('reparacion_mecanicos').insert({ reparacion_id: newRep.id, mecanico_id: currentUser.id, nombre_mecanico: currentPerfil.nombre, horas: 0, pago: 0 });
        }
        const ganancia = a.costo_repuestos ? ` (ganancia: ₲${gs(cleanNum(a.costo)-cleanNum(a.costo_repuestos))})` : '';
        ia_addMsg(`✓ ${tipoT}: "${a.descripcion}" creado${a.costo ? ' — ₲'+gs(a.costo) : ''}${ganancia}${currentPerfil?.rol==='empleado'?' (asignado a vos)':''}`, false);
        clearCache('reparaciones');
        break;
      }
      case 'crear_item_inventario': {
        const { error } = await sb.from('inventario').insert({ nombre:a.nombre||'Producto', cantidad:cleanNum(a.cantidad), precio_unitario:cleanNum(a.precio_unitario), stock_minimo:5, unidad:'unidad', taller_id:tid() });
        if (error) { ia_addMsg('Error: '+error.message, false); return; }
        ia_addMsg(`✓ "${a.nombre}" agregado al inventario (${a.cantidad||0} unidades)`, false);
        clearCache('inventario');
        break;
      }
      case 'descontar_stock': {
        const { data: item } = await sb.from('inventario').select('id,nombre,cantidad').eq('taller_id', tid()).ilike('nombre', '%'+(a.nombre||'')+'%').maybeSingle();
        if (!item) { ia_addMsg(`No encontré "${a.nombre}" en el inventario.`, false); return; }
        const nuevaCant = Math.max(0, parseFloat(item.cantidad) - cleanNum(a.cantidad||1));
        await sb.from('inventario').update({ cantidad: nuevaCant }).eq('id', item.id);
        ia_addMsg(`✓ Descontado ${a.cantidad||1}x ${item.nombre}. Stock actual: ${nuevaCant}`, false);
        clearCache('inventario');
        break;
      }
      case 'agendar_cita': {
        const { error } = await sb.from('citas').insert({
          cliente_id:cleanUUID(a.cliente_id), vehiculo_id:cleanUUID(a.vehiculo_id),
          fecha:a.fecha||new Date().toISOString().split('T')[0], hora:a.hora||'09:00', descripcion:a.descripcion||'Cita',
          estado:'confirmada', taller_id:tid()
        });
        if (error) { ia_addMsg('Error: '+error.message, false); return; }
        ia_addMsg(`✓ Cita agendada para ${formatFecha(a.fecha)} a las ${a.hora||'09:00'}`, false);
        clearCache('citas');
        break;
      }
      case 'buscar_cliente': {
        const { data } = await sb.from('clientes').select('nombre,telefono').eq('taller_id',tid()).ilike('nombre','%'+a.nombre+'%').limit(5);
        ia_addMsg(!data?.length ? `No encontré "${a.nombre}"` : `Encontré ${data.length} cliente(s):\n${data.map(c=>'• '+c.nombre+(c.telefono?' ('+c.telefono+')':'')).join('\n')}`, false);
        break;
      }
      case 'buscar_vehiculo': {
        const { data } = await sb.from('vehiculos').select('patente,marca,modelo').eq('taller_id',tid()).ilike('patente','%'+a.patente+'%').limit(5);
        ia_addMsg(!data?.length ? `No encontré patente "${a.patente}"` : `Encontré:\n${data.map(v=>'• '+v.patente+' — '+v.marca+' '+(v.modelo||'')).join('\n')}`, false);
        break;
      }
      case 'consultar_pendientes': {
        const { data } = await sb.from('reparaciones').select('descripcion,estado,vehiculos(patente),clientes(nombre)').eq('taller_id',tid()).in('estado',['pendiente','en_progreso']).limit(15);
        if (!data?.length) { ia_addMsg('No hay reparaciones pendientes. ¡Todo al día! 🎉', false); return; }
        ia_addMsg(`${data.length} reparación(es) activa(s):\n${data.map(r=>'• '+r.descripcion+' ['+r.estado+']'+(r.vehiculos?' — '+r.vehiculos.patente:'')+(r.clientes?' ('+r.clientes.nombre+')':'')).join('\n')}`, false);
        break;
      }
      case 'consultar_ingresos': {
        const hoy = new Date().toISOString().split('T')[0];
        const primerMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const [{ data: dHoy }, { data: dMes }] = await Promise.all([
          sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').eq('fecha',hoy),
          sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').gte('fecha',primerMes)
        ]);
        const totHoy = (dHoy||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
        const totMes = (dMes||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
        ia_addMsg(`📊 Ingresos:\n• Hoy: ₲${gs(totHoy)} (${(dHoy||[]).length} reparaciones)\n• Este mes: ₲${gs(totMes)} (${(dMes||[]).length} reparaciones)`, false);
        break;
      }
      case 'consultar_stock_bajo': {
        const { data } = await sb.from('inventario').select('nombre,cantidad,stock_minimo').eq('taller_id',tid());
        const bajo = (data||[]).filter(i => parseFloat(i.cantidad) <= parseFloat(i.stock_minimo));
        if (!bajo.length) { ia_addMsg('Todo el inventario está en buen nivel de stock. 👍', false); return; }
        ia_addMsg(`⚠ ${bajo.length} producto(s) con stock bajo:\n${bajo.map(i=>'• '+i.nombre+': '+i.cantidad+' (mín: '+i.stock_minimo+')').join('\n')}`, false);
        break;
      }
      case 'registrar_vale': {
        const { data: emps } = await sb.from('empleados').select('id,nombre').eq('taller_id',tid()).ilike('nombre','%'+(a.empleado_nombre||'')+'%').limit(1);
        if (!emps?.length) { ia_addMsg(`No encontré al empleado "${a.empleado_nombre}".`, false); return; }
        const emp = emps[0];
        const { error } = await sb.from('vales_empleado').insert({ empleado_id:emp.id, monto:cleanNum(a.monto), concepto:a.concepto||'Vale', fecha:new Date().toISOString().split('T')[0], taller_id:tid() });
        if (error) { ia_addMsg('Error: '+error.message, false); return; }
        ia_addMsg(`✓ Vale de ₲${gs(cleanNum(a.monto))} registrado para ${emp.nombre}${a.concepto?' ('+a.concepto+')':''}`, false);
        clearCache('empleados');
        break;
      }
      case 'consultar_deudores': {
        const { data: reps } = await sb.from('reparaciones').select('id,descripcion,costo,clientes(nombre)').eq('taller_id',tid()).eq('estado','finalizado').gt('costo',0).limit(50);
        const { data: pagos } = await sb.from('pagos_reparacion').select('reparacion_id,monto').eq('taller_id',tid()).limit(500);
        const pagosPorRep = {};
        (pagos||[]).forEach(p => { if(!pagosPorRep[p.reparacion_id]) pagosPorRep[p.reparacion_id]=0; pagosPorRep[p.reparacion_id]+=parseFloat(p.monto||0); });
        const deudores = (reps||[]).filter(r => { const pagado = pagosPorRep[r.id]||0; return pagado > 0 && pagado < parseFloat(r.costo); }).map(r => ({...r, saldo:parseFloat(r.costo)-(pagosPorRep[r.id]||0)}));
        const { data: fiados } = await sb.from('fiados').select('monto,clientes(nombre)').eq('taller_id',tid()).eq('pagado',false);
        const totalFiados = (fiados||[]).reduce((s,f)=>s+parseFloat(f.monto||0),0);
        if (!deudores.length && !totalFiados) { ia_addMsg('No hay deudores. Nadie te debe plata. 🎉', false); return; }
        let msg = '';
        if (deudores.length) { msg += `💸 Pagos parciales pendientes:\n${deudores.map(d=>'• '+(d.clientes?.nombre||'Sin cliente')+' — debe ₲'+gs(d.saldo)).join('\n')}\n`; }
        if (totalFiados) { msg += `\n📋 Fiados sin pagar: ₲${gs(totalFiados)} (${(fiados||[]).length} créditos)`; }
        ia_addMsg(msg, false);
        break;
      }
      case 'crear_presupuesto': {
        if(currentPerfil?.rol!=='admin'){ia_addMsg('Solo el admin puede crear presupuestos. Pedile al admin.',false);break;}
        const items = a.items || [];
        const total = items.reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);
        const { error } = await sb.from('presupuestos_v2').insert({
          descripcion:a.descripcion||'Presupuesto',vehiculo_id:cleanUUID(a.vehiculo_id),cliente_id:cleanUUID(a.cliente_id),
          items,total,estado:'generado',observaciones:a.observaciones||'',taller_id:tid()
        });
        if(error){ia_addMsg('Error: '+error.message,false);return;}
        ia_addMsg(`✓ Presupuesto "${a.descripcion}" creado por ₲${gs(total)}. Estado: GENERADO. Podés aprobarlo desde el módulo de Presupuestos.`,false);
        clearCache('presupuestos');
        break;
      }
      case 'crear_quickservice': {
        const items = a.items || [];
        const total = items.reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);
        const { error } = await sb.from('ventas').insert({
          tipo: 'mixto', es_servicio_rapido: true,
          descripcion:a.descripcion||'Servicio rápido',vehiculo_id:cleanUUID(a.vehiculo_id),cliente_id:cleanUUID(a.cliente_id),
          items,total,estado:'completado',taller_id:tid()
        });
        if(error){ia_addMsg('Error: '+error.message,false);return;}
        ia_addMsg(`✓ Servicio rápido "${a.descripcion}" creado por ₲${gs(total)}. Listo para facturar.`,false);
        clearCache('ventas');
        break;
      }
      case 'registrar_gasto': {
        if(currentPerfil?.rol!=='admin'){ia_addMsg('Solo el admin puede registrar gastos.',false);break;}
        const { error } = await sb.from('gastos_taller').insert({
          descripcion:a.descripcion||'Gasto',monto:cleanNum(a.monto),categoria:a.categoria||'Otros',
          proveedor:a.proveedor||'',fecha:new Date().toISOString().split('T')[0],taller_id:tid()
        });
        if(error){ia_addMsg('Error: '+error.message,false);return;}
        ia_addMsg(`✓ Gasto "${a.descripcion}" registrado por ₲${gs(cleanNum(a.monto))}${a.categoria?' ('+a.categoria+')':''}`,false);
        clearCache('gastos');
        break;
      }
      case 'mensaje':
        ia_addMsg(a.texto || 'No entendí, intentá de nuevo.', false);
        break;
      default:
        ia_addMsg('No entendí esa acción. Probá decirlo de otra forma.', false);
    }
  }, null, 'Error ejecutando acción de IA');
}
