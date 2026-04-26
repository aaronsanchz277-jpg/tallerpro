// ─── ASISTENTE IA v3 (Voz, enlaces, TTS, tolerancia a fallos) ───────────────
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
let _iaMessages = [];
let _iaListening = false;
let _groqKey = null;
let _iaVoiceEnabled = localStorage.getItem('tallerpro_ia_voice') === 'true';

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
  chat.style.cssText = 'display:none;position:fixed;bottom:135px;right:16px;width:340px;max-height:500px;background:var(--surface);border:1px solid var(--border);border-radius:16px;z-index:99;box-shadow:0 8px 40px rgba(0,0,0,.4);flex-direction:column;overflow:hidden';
  chat.innerHTML = `
    <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:.5rem">
        <span style="font-family:var(--font-head);color:var(--accent);font-size:.95rem">Asistente IA</span>
        <button onclick="ia_toggleVoice()" id="ia-voice-toggle" style="background:none;border:none;color:${_iaVoiceEnabled ? 'var(--success)' : 'var(--text2)'};cursor:pointer;font-size:.9rem;padding:2px 4px" title="Activar/desactivar voz">${_iaVoiceEnabled ? '🔊' : '🔇'}</button>
      </div>
      <button onclick="ia_toggleChat()" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:1rem">✕</button>
    </div>
    <div id="ia-msgs" style="flex:1;overflow-y:auto;padding:.75rem;display:flex;flex-direction:column;gap:.5rem;min-height:200px;max-height:350px">
      <div style="background:rgba(0,229,255,.08);border-radius:12px 12px 12px 4px;padding:.6rem .8rem;font-size:.82rem;color:var(--text);max-width:85%">
        Mba'éichapa! Soy tu asistente.<br><br>
        <span style="color:var(--text2)">Decime algo como:<br>
        • "Entró una Toyota Hilux ABC 123 para cambio de aceite"<br>
        • "¿Cuánto hicimos hoy?"<br>
        • "Anotame a Pedro Gómez 0981123456"<br>
        • "Resumen del día"</span>
      </div>
    </div>
    <div style="padding:.5rem;border-top:1px solid var(--border);display:flex;gap:.4rem">
      <button id="ia-mic-btn" onclick="ia_toggleVoz()" style="width:40px;height:40px;border-radius:50%;background:var(--surface2);border:1px solid var(--border);cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0">🎙️</button>
      <input id="ia-input" class="form-input" placeholder="Escribí o hablá..." style="flex:1;border-radius:20px;padding:.5rem .8rem;font-size:.82rem" onkeydown="if(event.key==='Enter')ia_enviar()">
      <button onclick="ia_enviar()" style="width:40px;height:40px;border-radius:50%;background:var(--accent);border:none;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#000">➤</button>
    </div>
    <div style="padding:.3rem;text-align:center;font-size:.6rem;color:var(--text2);border-top:1px solid var(--border)">
      <span onclick="ia_quickCommand('resumen')" style="cursor:pointer;margin:0 4px">📊 Resumen</span>
      <span onclick="ia_quickCommand('pendientes')" style="cursor:pointer;margin:0 4px">⏳ Pendientes</span>
      <span onclick="ia_quickCommand('deudores')" style="cursor:pointer;margin:0 4px">💰 Deudores</span>
    </div>`;
  document.body.appendChild(chat);
}

function ia_toggleChat() {
  const chat = document.getElementById('ia-chat');
  if (!chat) return;
  const visible = chat.style.display === 'flex';
  chat.style.display = visible ? 'none' : 'flex';
}

function ia_toggleVoice() {
  _iaVoiceEnabled = !_iaVoiceEnabled;
  localStorage.setItem('tallerpro_ia_voice', _iaVoiceEnabled);
  const btn = document.getElementById('ia-voice-toggle');
  if (btn) btn.innerHTML = _iaVoiceEnabled ? '🔊' : '🔇';
  toast(_iaVoiceEnabled ? 'Voz activada' : 'Voz desactivada', 'info');
}

function ia_speak(text) {
  if (!_iaVoiceEnabled) return;
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-PY';
  utterance.rate = 1.0;
  utterance.pitch = 1.1;
  const voices = window.speechSynthesis.getVoices();
  const spanishVoice = voices.find(v => v.lang.includes('es'));
  if (spanishVoice) utterance.voice = spanishVoice;
  window.speechSynthesis.speak(utterance);
}

function ia_addMsg(html, isUser) {
  const msgs = document.getElementById('ia-msgs');
  if (!msgs) return;
  const div = document.createElement('div');
  div.style.cssText = `background:${isUser ? 'var(--surface2)' : 'rgba(0,229,255,.08)'};border-radius:${isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px'};padding:.6rem .8rem;font-size:.82rem;color:var(--text);max-width:85%;white-space:pre-wrap;${isUser ? 'align-self:flex-end' : ''}`;
  div.innerHTML = html;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  if (!isUser) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    ia_speak(plainText);
  }
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

function ia_quickCommand(cmd) {
  const input = document.getElementById('ia-input');
  if (!input) return;
  const commands = {
    resumen: '¿Cuánto hicimos hoy?',
    pendientes: '¿Qué trabajos están pendientes?',
    deudores: '¿Quién me debe plata?'
  };
  input.value = commands[cmd] || '';
  ia_enviar();
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
  if (btn) {
    btn.style.background = 'rgba(255,68,68,.3)';
    btn.style.borderColor = 'var(--danger)';
    btn.textContent = '⏹';
  }
  _iaListening = true;
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const input = document.getElementById('ia-input');
    if (input) input.value = text;
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
  const [clientes, vehiculos, repsPend, repsHoy, invBajo, totalCli, totalVeh, deudores] = await Promise.all([
    sb.from('clientes').select('id,nombre,telefono').eq('taller_id', tid()).order('created_at',{ascending:false}).limit(30).then(r=>r.data||[]),
    sb.from('vehiculos').select('id,patente,marca,modelo').eq('taller_id', tid()).order('created_at',{ascending:false}).limit(30).then(r=>r.data||[]),
    sb.from('reparaciones').select('id,descripcion,estado,vehiculos(patente),clientes(nombre)').eq('taller_id', tid()).in('estado',['pendiente','en_progreso','esperando_repuestos']).limit(20).then(r=>r.data||[]),
    sb.from('reparaciones').select('costo').eq('taller_id', tid()).eq('estado','finalizado').eq('fecha', hoy).then(r=>r.data||[]),
    sb.from('inventario').select('nombre,cantidad,stock_minimo').eq('taller_id', tid()).limit(200).then(r=>(r.data||[]).filter(i=>parseFloat(i.cantidad)<=parseFloat(i.stock_minimo))),
    sb.from('clientes').select('*',{count:'exact',head:true}).eq('taller_id', tid()).then(r=>r.count||0),
    sb.from('vehiculos').select('*',{count:'exact',head:true}).eq('taller_id', tid()).then(r=>r.count||0),
    sb.from('fiados').select('monto,clientes(nombre)').eq('taller_id',tid()).eq('pagado',false).then(r=>r.data||[])
  ]);
  const ingresosHoy = repsHoy.reduce((s,r) => s + parseFloat(r.costo||0), 0);
  _iaContextCache = { clientes, vehiculos, repsPend, ingresosHoy, invBajo, hoy, totalCli, totalVeh, deudores };
  _iaContextTime = now;
  return _iaContextCache;
}

async function ia_enviar() {
  if (!requireOnline('usar el asistente IA')) return;
  const input = document.getElementById('ia-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  ia_addMsg(h(text), true);
  ia_addLoading();

  await safeCall(async () => {
    const ctx = await ia_getContexto();
    const deudoresInfo = ctx.deudores.length > 0 
      ? ctx.deudores.map(d => `${d.clientes?.nombre || 'Sin nombre'}: ₲${gs(d.monto)}`).join(', ')
      : 'No hay deudores';

    const sysPrompt = `Sos la secretaria IA de un taller mecánico en Paraguay. Tu nombre es TallerIA.

PERSONALIDAD:
- Hablás como paraguayo/a. Usás vos, tuteo, modismos locales.
- Entendés español, guaraní y jopara perfectamente.
- Si te hablan en jopara respondé en jopara. Si en español, en español.
- Sos eficiente, breve y práctica. No explicás de más.
- Si algo no queda claro, preguntás antes de hacer.

CONTEXTO ACTUAL DEL TALLER "${currentPerfil?.talleres?.nombre || 'Taller'}":
- Empleado actual: ${currentPerfil?.nombre || 'desconocido'} (${currentPerfil?.rol || 'desconocido'})
- Clientes (${ctx.totalCli} total): ${JSON.stringify(ctx.clientes.slice(0,10).map(c=>({id:c.id,n:c.nombre,t:c.telefono})))}
- Vehículos (${ctx.totalVeh} total): ${JSON.stringify(ctx.vehiculos.slice(0,10).map(v=>({id:v.id,p:v.patente,m:v.marca+' '+(v.modelo||'')})))}
- Trabajos activos (${ctx.repsPend.length}): ${JSON.stringify(ctx.repsPend.slice(0,10).map(r=>({id:r.id,desc:r.descripcion,est:r.estado,auto:r.vehiculos?.patente,cli:r.clientes?.nombre})))}
- Ingresos hoy: ₲${ctx.ingresosHoy.toLocaleString()}
- Stock bajo: ${ctx.invBajo.length > 0 ? ctx.invBajo.map(i=>i.nombre+' ('+i.cantidad+')').join(', ') : 'todo OK'}
- Deudores: ${deudoresInfo}
- Fecha: ${ctx.hoy}

INSTRUCCIONES CRÍTICAS:
1. Respondé con un objeto JSON válido. Podés usar backticks si querés, pero el contenido debe ser parseable.
2. Si el usuario dice algo ambiguo o incompleto, preguntá con {"accion":"mensaje","texto":"..."}.
3. Si te preguntan algo técnico de mecánica, respondé como experto con datos específicos cuando los sepas.
4. Podés combinar acciones + consejos: "Creé la reparación de frenos. Tip: revisá también los discos."

ACCIONES DISPONIBLES:
{"accion":"crear_cliente","nombre":"...","telefono":"..."}
{"accion":"crear_vehiculo","patente":"...","marca":"...","modelo":"...","anio":"...","cliente_id":"uuid"}
{"accion":"crear_reparacion","tipo_trabajo":"...","descripcion":"...","vehiculo_id":"uuid","cliente_id":"uuid","costo":0,"costo_repuestos":0}
{"accion":"agendar_cita","cliente_id":"uuid","vehiculo_id":"uuid","fecha":"YYYY-MM-DD","hora":"HH:MM","descripcion":"..."}
{"accion":"consultar_pendientes"}
{"accion":"consultar_ingresos"}
{"accion":"consultar_deudores"}
{"accion":"registrar_vale","empleado_nombre":"...","monto":0,"concepto":"..."}
{"accion":"mensaje","texto":"..."}
{"accion":"multiple","acciones":[...]}`;

    _iaMessages.push({ role: 'user', content: text });

    const apiKey = await ia_loadKey();
    if (!apiKey) { ia_removeLoading(); ia_addMsg('El asistente IA no está configurado. El admin debe agregar la API key en Configuración.', false); return; }
    
    let response;
    let retries = 2;
    while (retries >= 0) {
      try {
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
        response = await res.json();
        break;
      } catch(e) {
        retries--;
        if (retries < 0) throw e;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    const respText = response.choices?.[0]?.message?.content || '';
    _iaMessages.push({ role: 'assistant', content: respText });
    ia_removeLoading();

    let action;
    try {
      let cleanText = respText.trim();
      cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        action = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se encontró JSON');
      }
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
        invalidateComponentCache();
        ia_addMsg(`✓ Cliente "${a.nombre}" creado. <button onclick="closeModal();navigate('clientes');detalleCliente('${nuevo.id}')" style="margin-left:8px;background:var(--accent);color:#000;border:none;border-radius:12px;padding:2px 8px;font-size:.65rem;cursor:pointer;font-weight:600">Ver →</button>`, false);
        break;
      }
      case 'crear_vehiculo': {
        const { data: nuevo, error } = await sb.from('vehiculos').insert({ patente:(a.patente||'').toUpperCase(), marca:a.marca||'', modelo:a.modelo||'', anio:parseInt(a.anio)||null, cliente_id:cleanUUID(a.cliente_id), taller_id:tid() }).select().single();
        if (error) { ia_addMsg('Error: '+error.message, false); return; }
        invalidateComponentCache();
        ia_addMsg(`✓ Vehículo ${a.patente} registrado. <button onclick="closeModal();navigate('vehiculos');detalleVehiculo('${nuevo.id}')" style="margin-left:8px;background:var(--accent);color:#000;border:none;border-radius:12px;padding:2px 8px;font-size:.65rem;cursor:pointer;font-weight:600">Ver →</button>`, false);
        break;
      }
      case 'crear_reparacion': {
        const tipoT = TIPOS_TRABAJO.includes(a.tipo_trabajo) ? a.tipo_trabajo : 'Mecánica general';
        const { data: nuevo, error } = await sb.from('reparaciones').insert({ descripcion:a.descripcion||'Trabajo', tipo_trabajo:tipoT, vehiculo_id:cleanUUID(a.vehiculo_id), cliente_id:cleanUUID(a.cliente_id), costo:cleanNum(a.costo), costo_repuestos:cleanNum(a.costo_repuestos), estado:'pendiente', fecha:new Date().toISOString().split('T')[0], taller_id:tid() }).select('id').single();
        if (error) { ia_addMsg('Error: '+error.message, false); return; }
        if (currentPerfil?.rol === 'empleado') {
          await sb.from('reparacion_mecanicos').insert({ reparacion_id: nuevo.id, mecanico_id: currentUser.id, nombre_mecanico: currentPerfil.nombre, horas: 0, pago: 0 });
        }
        clearCache('reparaciones');
        ia_addMsg(`✓ Trabajo creado: "${a.descripcion}". <button onclick="closeModal();navigate('reparaciones');detalleReparacion('${nuevo.id}')" style="margin-left:8px;background:var(--accent);color:#000;border:none;border-radius:12px;padding:2px 8px;font-size:.65rem;cursor:pointer;font-weight:600">Ver →</button>`, false);
        break;
      }
      case 'agendar_cita': {
        const { error } = await sb.from('citas').insert({ cliente_id:cleanUUID(a.cliente_id), vehiculo_id:cleanUUID(a.vehiculo_id), fecha:a.fecha||new Date().toISOString().split('T')[0], hora:a.hora||'09:00', descripcion:a.descripcion||'Cita', estado:'confirmada', taller_id:tid() });
        if (error) { ia_addMsg('Error: '+error.message, false); return; }
        clearCache('citas');
        ia_addMsg(`✓ Cita agendada para ${formatFecha(a.fecha)} a las ${a.hora}.`, false);
        break;
      }
      case 'consultar_pendientes': {
        const { data } = await sb.from('reparaciones').select('descripcion,estado,vehiculos(patente),clientes(nombre)').eq('taller_id',tid()).in('estado',['pendiente','en_progreso']).limit(10);
        if (!data?.length) { ia_addMsg('No hay trabajos pendientes. ¡Todo al día! 🎉', false); return; }
        ia_addMsg(`Hay ${data.length} trabajos activos:\n${data.map(r=>'• '+r.descripcion+' ['+r.estado+']'+(r.vehiculos?' — '+r.vehiculos.patente:'')).join('\n')}`, false);
        break;
      }
      case 'consultar_ingresos': {
        const hoy = new Date().toISOString().split('T')[0];
        const { data } = await sb.from('reparaciones').select('costo').eq('taller_id',tid()).eq('estado','finalizado').eq('fecha',hoy);
        const total = (data||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
        ia_addMsg(`📊 Ingresos de hoy: ₲${gs(total)} (${data?.length||0} trabajos finalizados).`, false);
        break;
      }
      case 'consultar_deudores': {
        const { data } = await sb.from('fiados').select('monto,clientes(nombre)').eq('taller_id',tid()).eq('pagado',false);
        if (!data?.length) { ia_addMsg('No hay deudores. ¡Excelente! 🎉', false); return; }
        ia_addMsg(`Deudores:\n${data.map(d=>'• '+(d.clientes?.nombre||'Sin nombre')+': ₲'+gs(d.monto)).join('\n')}`, false);
        break;
      }
      case 'registrar_vale': {
        const { data: emps } = await sb.from('empleados').select('id,nombre').eq('taller_id',tid()).ilike('nombre','%'+escapeLikePattern(a.empleado_nombre||'')+'%').limit(1);
        if (!emps?.length) { ia_addMsg(`No encontré al empleado "${a.empleado_nombre}".`, false); return; }
        const emp = emps[0];
        const { error } = await sb.from('vales_empleado').insert({ empleado_id:emp.id, monto:cleanNum(a.monto), concepto:a.concepto||'Vale', fecha:new Date().toISOString().split('T')[0], taller_id:tid() });
        if (error) { ia_addMsg('Error: '+error.message, false); return; }
        clearCache('empleados');
        ia_addMsg(`✓ Vale de ₲${gs(cleanNum(a.monto))} registrado para ${emp.nombre}.`, false);
        break;
      }
      case 'mensaje':
        ia_addMsg(a.texto || 'No entendí, intentá de nuevo.', false);
        break;
      default:
        ia_addMsg('No entendí esa acción. Probá decirlo de otra forma.', false);
    }
  }, null, 'Error ejecutando acción');
}
