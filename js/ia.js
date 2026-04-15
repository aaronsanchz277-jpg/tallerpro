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
  if (!SR) { toast('Tu navegador no soporta reconocimiento de voz', 'error'); return; }
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
  if (window._iaRec) { try { window._iaRec.stop(); } catch (e) {} }
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
    sb.from('clientes').select('id,nombre,telefono').eq('taller_id', tid()).order('created_at', { ascending: false }).limit(30).then(r => r.data || []),
    sb.from('vehiculos').select('id,patente,marca,modelo').eq('taller_id', tid()).order('created_at', { ascending: false }).limit(30).then(r => r.data || []),
    sb.from('reparaciones').select('id,descripcion,estado,vehiculos(patente),clientes(nombre)').eq('taller_id', tid()).in('estado', ['pendiente', 'en_progreso', 'esperando_repuestos']).limit(20).then(r => r.data || []),
    sb.from('reparaciones').select('costo').eq('taller_id', tid()).eq('estado', 'finalizado').eq('fecha', hoy).then(r => r.data || []),
    sb.from('inventario').select('nombre,cantidad,stock_minimo').eq('taller_id', tid()).limit(200).then(r => (r.data || []).filter(i => parseFloat(i.cantidad) <= parseFloat(i.stock_minimo))),
    sb.from('clientes').select('*', { count: 'exact', head: true }).eq('taller_id', tid()).then(r => r.count || 0),
    sb.from('vehiculos').select('*', { count: 'exact', head: true }).eq('taller_id', tid()).then(r => r.count || 0)
  ]);
  const ingresosHoy = repsHoy.reduce((s, r) => s + parseFloat(r.costo || 0), 0);
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
    const sysPrompt = `Sos la secretaria IA de un taller mecánico en Paraguay... (prompt completo)`;
    _iaMessages.push({ role: 'user', content: text });
    const apiKey = await ia_loadKey();
    if (!apiKey) { ia_removeLoading(); ia_addMsg('El asistente IA no está configurado. El admin debe agregar la API key.', false); return; }
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: sysPrompt }, ..._iaMessages.slice(-14)], max_tokens: 800, temperature: 0.2 })
    });
    const data = await res.json();
    const respText = data.choices?.[0]?.message?.content || '';
    _iaMessages.push({ role: 'assistant', content: respText });
    ia_removeLoading();
    let action;
    try { action = JSON.parse(respText.replace(/```json|```/g, '').trim()); } catch (e) { ia_addMsg(respText || 'No entendí, intentá de nuevo.', false); return; }
    if (action.accion === 'multiple' && Array.isArray(action.acciones)) { for (const a of action.acciones) await ia_ejecutar(a); }
    else { await ia_ejecutar(action); }
  }, null, 'Error de conexión con la IA');
}

async function ia_ejecutar(a) {
  await safeCall(async () => {
    const clean = (v) => (v === null || v === undefined || v === 'null' || v === 'undefined' || v === '' || v === 'none') ? null : v;
    const cleanUUID = (v) => { const s = clean(v); return (s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) ? s : null; };
    const cleanNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    switch (a.accion) {
      case 'crear_cliente': {
        const { data: nuevo, error } = await sb.from('clientes').insert({ nombre: a.nombre || 'Sin nombre', telefono: clean(a.telefono), taller_id: tid() }).select().single();
        if (error) { ia_addMsg('Error: ' + error.message, false); return; }
        ia_addMsg(`✓ Cliente "${a.nombre}" creado${a.telefono ? ' (' + a.telefono + ')' : ''}`, false);
        invalidateComponentCache();
        break;
      }
      case 'crear_vehiculo': {
        const { data: nuevo, error } = await sb.from('vehiculos').insert({ patente: (a.patente || '').toUpperCase(), marca: a.marca || '', modelo: a.modelo || '', anio: parseInt(a.anio) || null, cliente_id: cleanUUID(a.cliente_id), taller_id: tid() }).select().single();
        if (error) { ia_addMsg('Error: ' + error.message, false); return; }
        ia_addMsg(`✓ Vehículo ${(a.patente || '').toUpperCase()} ${a.marca || ''} ${a.modelo || ''} registrado\n¿Querés crear una reparación para este vehículo?`, false);
        invalidateComponentCache();
        break;
      }
      case 'crear_reparacion': {
        const tipoT = TIPOS_TRABAJO.includes(a.tipo_trabajo) ? a.tipo_trabajo : 'Mecánica general';
        const { data: newRep, error } = await sb.from('reparaciones').insert({ descripcion: a.descripcion || 'Trabajo', tipo_trabajo: tipoT, vehiculo_id: cleanUUID(a.vehiculo_id), cliente_id: cleanUUID(a.cliente_id), costo: cleanNum(a.costo), costo_repuestos: cleanNum(a.costo_repuestos), estado: 'pendiente', fecha: new Date().toISOString().split('T')[0], taller_id: tid() }).select('id').single();
        if (error) { ia_addMsg('Error: ' + error.message, false); return; }
        if (newRep?.id && currentPerfil?.rol === 'empleado') { await sb.from('reparacion_mecanicos').insert({ reparacion_id: newRep.id, mecanico_id: currentUser.id, nombre_mecanico: currentPerfil.nombre, horas: 0, pago: 0 }); }
        const ganancia = a.costo_repuestos ? ` (ganancia: ₲${gs(cleanNum(a.costo) - cleanNum(a.costo_repuestos))})` : '';
        ia_addMsg(`✓ ${tipoT}: "${a.descripcion}" creado${a.costo ? ' — ₲' + gs(a.costo) : ''}${ganancia}${currentPerfil?.rol === 'empleado' ? ' (asignado a vos)' : ''}`, false);
        clearCache('reparaciones');
        break;
      }
      // ... (resto de casos sin cambios)
      case 'mensaje': ia_addMsg(a.texto || 'No entendí, intentá de nuevo.', false); break;
      default: ia_addMsg('No entendí esa acción. Probá decirlo de otra forma.', false);
    }
  }, null, 'Error ejecutando acción de IA');
} 
