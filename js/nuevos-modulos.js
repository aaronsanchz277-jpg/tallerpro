/**
 * ============================================================================
 * NUEVOS MÓDULOS TALLERPRO - Integración de funcionalidades adicionales
 * ============================================================================
 * 
 * Este archivo contiene las funciones desarrolladas después de la versión base
 * del sistema. Se integra con las funciones existentes (clientes, vehículos,
 * reparaciones, etc.) y añade nuevos módulos.
 * 
 * DEPENDENCIAS GLOBALES (deben existir en el sistema base):
 *   - window.sb                : Cliente de Supabase
 *   - window.currentUser       : Usuario autenticado
 *   - window.currentPerfil     : Perfil del usuario (con taller_id, rol, etc.)
 *   - window.tid()             : Retorna el taller_id actual
 *   - window.toast(msg, type)  : Muestra notificaciones
 *   - window.gs(num)           : Formatea números como moneda (ej: "1.500.000")
 *   - window.formatFecha(f)    : Convierte YYYY-MM-DD a DD/MM/YYYY
 *   - window.fechaHoy()        : Retorna YYYY-MM-DD actual
 *   - window.navigate(pagina)  : Cambia de vista en la SPA
 *   - window.openModal(html)   : Abre un modal
 *   - window.closeModal()      : Cierra el modal actual
 *   - window.confirmar(msg, fn): Muestra confirmación y ejecuta callback
 *   - window.offlineInsert/Update/Delete (opcional, para modo offline)
 *   - window.cachedQuery (opcional, para caché)
 *   - window.guardando()       : Control de doble clic (opcional)
 * 
 * Si alguna de estas no existe, se definen versiones básicas o se asume que
 * están disponibles en el ámbito global.
 * 
 * ============================================================================
 */

// -------------------- VERIFICACIÓN Y DEFINICIÓN DE UTILIDADES BÁSICAS --------------------
// Estas funciones se definen solo si no existen en el sistema base.
(function() {
    if (typeof window.escapeHtml === 'undefined') {
        window.escapeHtml = function(str) {
            if (!str) return '';
            return String(str).replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
                return c;
            });
        };
    }
    if (typeof window.gs === 'undefined') {
        window.gs = function(n) { return parseFloat(n||0).toLocaleString('es-PY'); };
    }
    if (typeof window.formatFecha === 'undefined') {
        window.formatFecha = function(f) { if (!f) return ''; const [y,m,d] = f.split('-'); return `${d}/${m}/${y}`; };
    }
    if (typeof window.fechaHoy === 'undefined') {
        window.fechaHoy = function() { return new Date().toISOString().split('T')[0]; };
    }
    if (typeof window.primerDiaMes === 'undefined') {
        window.primerDiaMes = function() { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-01`; };
    }
    if (typeof window.tid === 'undefined') {
        window.tid = function() { return window.currentPerfil?.taller_id; };
    }
    if (typeof window.toast === 'undefined') {
        window.toast = function(msg, type='info') {
            const t = document.getElementById('toast');
            if (!t) { alert(msg); return; }
            t.textContent = msg;
            t.style.borderColor = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--accent)';
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 2500);
        };
    }
})();

// ============================================================================
// 1. MÓDULO DE ASISTENTE IA (Groq + reconocimiento de voz)
//    Relación: Se integra con el sistema para crear/consultar entidades
//    (clientes, vehículos, reparaciones, inventario, citas, vales, etc.)
//    usando lenguaje natural. Depende de una API key de Groq almacenada en
//    la tabla `config_keys`.
// ============================================================================
let _iaMessages = [];
let _iaListening = false;
let _groqKey = null;
let _iaContextCache = null;
let _iaContextTime = 0;

async function ia_loadKey() {
    if (_groqKey) return _groqKey;
    const { data } = await window.sb.from('config_keys').select('valor').eq('taller_id', window.tid()).eq('clave', 'groq_api_key').maybeSingle();
    _groqKey = data?.valor || null;
    return _groqKey;
}

function ia_init() {
    const rol = window.currentPerfil?.rol;
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
    if (!SR) { window.toast('Tu navegador no soporta reconocimiento de voz','error'); return; }
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
    rec.onerror = (e) => { if (e.error !== 'aborted') window.toast('Error de voz: ' + e.error, 'error'); ia_stopVoz(); };
    rec.onend = () => ia_stopVoz();
    rec.start();
}

function ia_stopVoz() {
    _iaListening = false;
    if (window._iaRec) { try { window._iaRec.stop(); } catch(e) {} }
    const btn = document.getElementById('ia-mic-btn');
    if (btn) { btn.style.background = 'var(--surface2)'; btn.style.borderColor = 'var(--border)'; btn.textContent = '🎙️'; }
}

async function ia_getContexto() {
    const now = Date.now();
    if (_iaContextCache && (now - _iaContextTime) < 60000) return _iaContextCache;

    const hoy = window.fechaHoy();
    const [clientes, vehiculos, repsPend, repsHoy, invBajo, totalCli, totalVeh] = await Promise.all([
        window.sb.from('clientes').select('id,nombre,telefono').eq('taller_id', window.tid()).order('created_at',{ascending:false}).limit(30).then(r=>r.data||[]),
        window.sb.from('vehiculos').select('id,patente,marca,modelo').eq('taller_id', window.tid()).order('created_at',{ascending:false}).limit(30).then(r=>r.data||[]),
        window.sb.from('reparaciones').select('id,descripcion,estado,vehiculos(patente),clientes(nombre)').eq('taller_id', window.tid()).in('estado',['pendiente','en_progreso','esperando_repuestos']).limit(20).then(r=>r.data||[]),
        window.sb.from('reparaciones').select('costo').eq('taller_id', window.tid()).eq('estado','finalizado').eq('fecha', hoy).then(r=>r.data||[]),
        window.sb.from('inventario').select('nombre,cantidad,stock_minimo').eq('taller_id', window.tid()).limit(200).then(r=>(r.data||[]).filter(i=>parseFloat(i.cantidad)<=parseFloat(i.stock_minimo))),
        window.sb.from('clientes').select('*',{count:'exact',head:true}).eq('taller_id', window.tid()).then(r=>r.count||0),
        window.sb.from('vehiculos').select('*',{count:'exact',head:true}).eq('taller_id', window.tid()).then(r=>r.count||0)
    ]);
    const ingresosHoy = repsHoy.reduce((s,r) => s + parseFloat(r.costo||0), 0);
    _iaContextCache = { clientes, vehiculos, repsPend, ingresosHoy, invBajo, hoy, totalCli, totalVeh };
    _iaContextTime = Date.now();
    return _iaContextCache;
}

async function ia_enviar() {
    const input = document.getElementById('ia-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    ia_addMsg(text, true);
    ia_addLoading();

    const ctx = await ia_getContexto();

    const sysPrompt = `Sos la secretaria IA de un taller mecánico en Paraguay. Tu nombre es TallerIA.
PERSONALIDAD:
- Hablás como paraguayo/a. Usás vos, tuteo, modismos locales.
- Entendés español, guaraní y jopara perfectamente.
- Si te hablan en jopara respondé en jopara. Si en español, en español.
- Sos eficiente, breve y práctica. No explicás de más.
- Si algo no queda claro, preguntás antes de hacer.

CONTEXTO ACTUAL DEL TALLER "${window.currentPerfil?.talleres?.nombre || 'Taller'}":
- Empleado/Admin actual: ${window.currentPerfil?.nombre || 'desconocido'} (${window.currentPerfil?.rol || 'desconocido'})
- Clientes (${ctx.totalCli} total, mostrando últimos 30): ${JSON.stringify(ctx.clientes.slice(0,30).map(c=>({id:c.id,n:c.nombre,t:c.telefono})))}
- Vehículos (${ctx.totalVeh} total, mostrando últimos 30): ${JSON.stringify(ctx.vehiculos.slice(0,30).map(v=>({id:v.id,p:v.patente,m:v.marca+' '+(v.modelo||'')})))}
- Si el cliente/vehículo que mencionan no está en esta lista, preguntá el nombre exacto para buscarlo
- Trabajos activos (${ctx.repsPend.length}): ${JSON.stringify(ctx.repsPend.slice(0,15).map(r=>({desc:r.descripcion,est:r.estado,auto:r.vehiculos?.patente,cli:r.clientes?.nombre})))}
- Ingresos hoy: ₲${window.gs(ctx.ingresosHoy)}
- Stock bajo: ${ctx.invBajo.length > 0 ? ctx.invBajo.map(i=>i.nombre+' ('+i.cantidad+')').join(', ') : 'todo OK'}
- Fecha/hora: ${ctx.hoy} ${new Date().toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'})}

INSTRUCCIONES CRÍTICAS:
1. RESPONDÉ SOLO JSON. Sin backticks, sin markdown, sin texto antes ni después. SOLO el JSON puro.
2. Si el usuario dice algo ambiguo o incompleto, preguntá con {"accion":"mensaje","texto":"..."}.
3. Si el usuario saluda o hace conversación casual, respondé amablemente con {"accion":"mensaje","texto":"..."}.
4. Entendé variaciones del habla paraguaya.
5. Asociá inteligentemente: si dicen "el Toyota de Juan", buscá un cliente llamado Juan y un vehículo Toyota en el contexto.
6. Si mencionan un nombre parcial ("Juan"), buscá coincidencias en los clientes existentes. Si hay más de uno, preguntá cuál.
7. Para vehículos, matcheá por patente O por marca+cliente.
8. Si te dan info incompleta, creá con lo que tenés y avisá qué falta.
9. Si te preguntan algo técnico sobre mecánica automotriz, respondé como un mecánico experto.
10. Podés combinar acciones + consejos.

ACCIONES DISPONIBLES:
{"accion":"crear_cliente","nombre":"...","telefono":"..."}
{"accion":"crear_vehiculo","patente":"...","marca":"...","modelo":"...","anio":"...","cliente_id":"uuid o null"}
{"accion":"crear_reparacion","tipo_trabajo":"...","descripcion":"...","vehiculo_id":"uuid o null","cliente_id":"uuid o null","costo":0,"costo_repuestos":0}
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
{"accion":"mensaje","texto":"..."}
{"accion":"multiple","acciones":[...]}`;

    _iaMessages.push({ role: 'user', content: text });
    try {
        const apiKey = await ia_loadKey();
        if (!apiKey) { ia_removeLoading(); ia_addMsg('El asistente IA no está configurado. El admin debe agregar la API key.', false); return; }
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    } catch(err) {
        ia_removeLoading();
        ia_addMsg('Error de conexión. Intentá de nuevo.', false);
        console.error('IA error:', err);
    }
}

async function ia_ejecutar(a) {
    const clean = (v) => (v === null || v === undefined || v === 'null' || v === 'undefined' || v === '' || v === 'none') ? null : v;
    const cleanUUID = (v) => { const s = clean(v); return (s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) ? s : null; };
    const cleanNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

    switch(a.accion) {
        case 'crear_cliente':
            const { data: nuevoCliente, error: errCliente } = await window.sb.from('clientes').insert({ nombre: a.nombre||'Sin nombre', telefono: clean(a.telefono), taller_id: window.tid() }).select().single();
            if (errCliente) { ia_addMsg('Error: '+errCliente.message, false); return; }
            ia_addMsg(`✓ Cliente "${a.nombre}" creado${a.telefono ? ' ('+a.telefono+')' : ''}`, false);
            break;
        case 'crear_vehiculo':
            const { data: nuevoVehiculo, error: errVehiculo } = await window.sb.from('vehiculos').insert({ patente:(a.patente||'').toUpperCase(), marca:a.marca||'', modelo:a.modelo||'', anio:parseInt(a.anio)||null, cliente_id:cleanUUID(a.cliente_id), taller_id:window.tid() }).select().single();
            if (errVehiculo) { ia_addMsg('Error: '+errVehiculo.message, false); return; }
            ia_addMsg(`✓ Vehículo ${(a.patente||'').toUpperCase()} ${a.marca||''} ${a.modelo||''} registrado`, false);
            break;
        case 'crear_reparacion':
            const tipoT = ['Mecánica general','Cambio de aceite / Service','Frenos','Suspensión','Electricidad','Chapa y pintura','Aire acondicionado','Diagnóstico','Otro'].includes(a.tipo_trabajo) ? a.tipo_trabajo : 'Mecánica general';
            const { data: newRep, error: errRep } = await window.sb.from('reparaciones').insert({ descripcion:a.descripcion||'Trabajo', tipo_trabajo:tipoT, vehiculo_id:cleanUUID(a.vehiculo_id), cliente_id:cleanUUID(a.cliente_id), costo:cleanNum(a.costo), costo_repuestos:cleanNum(a.costo_repuestos), estado:'pendiente', fecha:window.fechaHoy(), taller_id:window.tid() }).select('id').single();
            if (errRep) { ia_addMsg('Error: '+errRep.message, false); return; }
            if (newRep?.id && window.currentPerfil?.rol === 'empleado') {
                await window.sb.from('reparacion_mecanicos').insert({ reparacion_id: newRep.id, mecanico_id: window.currentUser.id, nombre_mecanico: window.currentPerfil.nombre, horas: 0, pago: 0 });
            }
            ia_addMsg(`✓ ${tipoT}: "${a.descripcion}" creado`, false);
            break;
        case 'crear_item_inventario':
            const { error: errInv } = await window.sb.from('inventario').insert({ nombre:a.nombre||'Producto', cantidad:cleanNum(a.cantidad), precio_unitario:cleanNum(a.precio_unitario), stock_minimo:5, unidad:'unidad', taller_id:window.tid() });
            if (errInv) { ia_addMsg('Error: '+errInv.message, false); return; }
            ia_addMsg(`✓ "${a.nombre}" agregado al inventario`, false);
            break;
        case 'descontar_stock':
            const { data: item } = await window.sb.from('inventario').select('id,nombre,cantidad').eq('taller_id', window.tid()).ilike('nombre', '%'+(a.nombre||'')+'%').maybeSingle();
            if (!item) { ia_addMsg(`No encontré "${a.nombre}" en el inventario.`, false); return; }
            const nuevaCant = Math.max(0, parseFloat(item.cantidad) - cleanNum(a.cantidad||1));
            await window.sb.from('inventario').update({ cantidad: nuevaCant }).eq('id', item.id);
            ia_addMsg(`✓ Descontado ${a.cantidad||1}x ${item.nombre}. Stock actual: ${nuevaCant}`, false);
            break;
        case 'agendar_cita':
            const { error: errCita } = await window.sb.from('citas').insert({ cliente_id:cleanUUID(a.cliente_id), vehiculo_id:cleanUUID(a.vehiculo_id), fecha:a.fecha||window.fechaHoy(), hora:a.hora||'09:00', descripcion:a.descripcion||'Cita', estado:'confirmada', taller_id:window.tid() });
            if (errCita) { ia_addMsg('Error: '+errCita.message, false); return; }
            ia_addMsg(`✓ Cita agendada para ${window.formatFecha(a.fecha)} a las ${a.hora||'09:00'}`, false);
            break;
        case 'buscar_cliente':
            const { data: clientesEncontrados } = await window.sb.from('clientes').select('nombre,telefono').eq('taller_id', window.tid()).ilike('nombre','%'+a.nombre+'%').limit(5);
            ia_addMsg(!clientesEncontrados?.length ? `No encontré "${a.nombre}"` : `Encontré ${clientesEncontrados.length} cliente(s):\n${clientesEncontrados.map(c=>'• '+c.nombre+(c.telefono?' ('+c.telefono+')':'')).join('\n')}`, false);
            break;
        case 'buscar_vehiculo':
            const { data: vehiculosEncontrados } = await window.sb.from('vehiculos').select('patente,marca,modelo').eq('taller_id', window.tid()).ilike('patente','%'+a.patente+'%').limit(5);
            ia_addMsg(!vehiculosEncontrados?.length ? `No encontré patente "${a.patente}"` : `Encontré:\n${vehiculosEncontrados.map(v=>'• '+v.patente+' — '+v.marca+' '+(v.modelo||'')).join('\n')}`, false);
            break;
        case 'consultar_pendientes':
            const { data: pendientes } = await window.sb.from('reparaciones').select('descripcion,estado,vehiculos(patente),clientes(nombre)').eq('taller_id', window.tid()).in('estado',['pendiente','en_progreso']).limit(15);
            if (!pendientes?.length) { ia_addMsg('No hay reparaciones pendientes. ¡Todo al día! 🎉', false); return; }
            ia_addMsg(`${pendientes.length} reparación(es) activa(s):\n${pendientes.map(r=>'• '+r.descripcion+' ['+r.estado+']'+(r.vehiculos?' — '+r.vehiculos.patente:'')+(r.clientes?' ('+r.clientes.nombre+')':'')).join('\n')}`, false);
            break;
        case 'consultar_ingresos':
            const hoy = window.fechaHoy();
            const primerMes = window.primerDiaMes();
            const [{ data: dHoy }, { data: dMes }] = await Promise.all([
                window.sb.from('reparaciones').select('costo').eq('taller_id', window.tid()).eq('estado','finalizado').eq('fecha', hoy),
                window.sb.from('reparaciones').select('costo').eq('taller_id', window.tid()).eq('estado','finalizado').gte('fecha', primerMes)
            ]);
            const totHoy = (dHoy||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
            const totMes = (dMes||[]).reduce((s,r)=>s+parseFloat(r.costo||0),0);
            ia_addMsg(`📊 Ingresos:\n• Hoy: ₲${window.gs(totHoy)} (${(dHoy||[]).length} reparaciones)\n• Este mes: ₲${window.gs(totMes)} (${(dMes||[]).length} reparaciones)`, false);
            break;
        case 'consultar_stock_bajo':
            const { data: itemsBajo } = await window.sb.from('inventario').select('nombre,cantidad,stock_minimo').eq('taller_id', window.tid());
            const bajo = (itemsBajo||[]).filter(i => parseFloat(i.cantidad) <= parseFloat(i.stock_minimo));
            if (!bajo.length) { ia_addMsg('Todo el inventario está en buen nivel de stock. 👍', false); return; }
            ia_addMsg(`⚠ ${bajo.length} producto(s) con stock bajo:\n${bajo.map(i=>'• '+i.nombre+': '+i.cantidad+' (mín: '+i.stock_minimo+')').join('\n')}`, false);
            break;
        case 'registrar_vale':
            const { data: emps } = await window.sb.from('empleados').select('id,nombre').eq('taller_id', window.tid()).ilike('nombre','%'+(a.empleado_nombre||'')+'%').limit(1);
            if (!emps?.length) { ia_addMsg(`No encontré al empleado "${a.empleado_nombre}".`, false); return; }
            const emp = emps[0];
            const { error: errVale } = await window.sb.from('vales_empleado').insert({ empleado_id:emp.id, monto:cleanNum(a.monto), concepto:a.concepto||'Vale', fecha:window.fechaHoy(), taller_id:window.tid() });
            if (errVale) { ia_addMsg('Error: '+errVale.message, false); return; }
            ia_addMsg(`✓ Vale de ₲${window.gs(cleanNum(a.monto))} registrado para ${emp.nombre}${a.concepto?' ('+a.concepto+')':''}`, false);
            break;
        case 'consultar_deudores':
            const { data: reps } = await window.sb.from('reparaciones').select('id,descripcion,costo,clientes(nombre)').eq('taller_id', window.tid()).eq('estado','finalizado').gt('costo',0).limit(50);
            const { data: pagos } = await window.sb.from('pagos_reparacion').select('reparacion_id,monto').eq('taller_id', window.tid()).limit(500);
            const pagosPorRep = {};
            (pagos||[]).forEach(p => { if(!pagosPorRep[p.reparacion_id]) pagosPorRep[p.reparacion_id]=0; pagosPorRep[p.reparacion_id]+=parseFloat(p.monto||0); });
            const deudores = (reps||[]).filter(r => { const pagado = pagosPorRep[r.id]||0; return pagado > 0 && pagado < parseFloat(r.costo); }).map(r => ({...r, saldo:parseFloat(r.costo)-(pagosPorRep[r.id]||0)}));
            const { data: fiados } = await window.sb.from('fiados').select('monto,clientes(nombre)').eq('taller_id', window.tid()).eq('pagado',false);
            const totalFiados = (fiados||[]).reduce((s,f)=>s+parseFloat(f.monto||0),0);
            if (!deudores.length && !totalFiados) { ia_addMsg('No hay deudores. Nadie te debe plata. 🎉', false); return; }
            let msg = '';
            if (deudores.length) { msg += `💸 Pagos parciales pendientes:\n${deudores.map(d=>'• '+(d.clientes?.nombre||'Sin cliente')+' — debe ₲'+window.gs(d.saldo)).join('\n')}\n`; }
            if (totalFiados) { msg += `\n📋 Fiados sin pagar: ₲${window.gs(totalFiados)} (${(fiados||[]).length} créditos)`; }
            ia_addMsg(msg, false);
            break;
        case 'crear_presupuesto':
            if(window.currentPerfil?.rol!=='admin'){ia_addMsg('Solo el admin puede crear presupuestos.',false);break;}
            const items = a.items || [];
            const total = items.reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);
            const { error: errPpto } = await window.sb.from('presupuestos_v2').insert({ descripcion:a.descripcion||'Presupuesto', vehiculo_id:cleanUUID(a.vehiculo_id), cliente_id:cleanUUID(a.cliente_id), items, total, estado:'generado', observaciones:a.observaciones||'', taller_id:window.tid() });
            if(errPpto){ia_addMsg('Error: '+errPpto.message,false);return;}
            ia_addMsg(`✓ Presupuesto "${a.descripcion}" creado por ₲${window.gs(total)}.`,false);
            break;
        case 'crear_quickservice':
            const itemsQS = a.items || [];
            const totalQS = itemsQS.reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);
            const { error: errQS } = await window.sb.from('quickservices').insert({ descripcion:a.descripcion||'Servicio rápido', vehiculo_id:cleanUUID(a.vehiculo_id), cliente_id:cleanUUID(a.cliente_id), items:itemsQS, total:totalQS, estado:'completado', taller_id:window.tid() });
            if(errQS){ia_addMsg('Error: '+errQS.message,false);return;}
            ia_addMsg(`✓ Servicio rápido "${a.descripcion}" creado por ₲${window.gs(totalQS)}.`,false);
            break;
        case 'registrar_gasto':
            if(window.currentPerfil?.rol!=='admin'){ia_addMsg('Solo el admin puede registrar gastos.',false);break;}
            const { error: errGasto } = await window.sb.from('gastos_taller').insert({ descripcion:a.descripcion||'Gasto', monto:cleanNum(a.monto), categoria:a.categoria||'Otros', proveedor:a.proveedor||'', fecha:window.fechaHoy(), taller_id:window.tid() });
            if(errGasto){ia_addMsg('Error: '+errGasto.message,false);return;}
            ia_addMsg(`✓ Gasto "${a.descripcion}" registrado por ₲${window.gs(cleanNum(a.monto))}`,false);
            break;
        case 'mensaje':
            ia_addMsg(a.texto || 'No entendí, intentá de nuevo.', false);
            break;
        default:
            ia_addMsg('No entendí esa acción. Probá decirlo de otra forma.', false);
    }
}

// Exponer funciones de IA globalmente
window.ia_init = ia_init;
window.ia_toggleChat = ia_toggleChat;
window.ia_enviar = ia_enviar;
window.ia_toggleVoz = ia_toggleVoz;
window.ia_stopVoz = ia_stopVoz;

// ============================================================================
// 2. MÓDULO DE ESCÁNER DE CÓDIGO DE BARRAS
//    Relación: Permite escanear códigos de barras de productos para
//    buscar en el inventario, descontar stock o editar productos.
//    Depende de la librería Quagga (cargada dinámicamente).
// ============================================================================
let _barcodeScanner = null;

async function barcode_loadLib() {
    if (window.Quagga) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.4/dist/quagga.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('No se pudo cargar el escáner'));
        document.head.appendChild(script);
    });
}

async function barcode_scan(targetInputId) {
    try {
        await barcode_loadLib();
    } catch(e) {
        window.toast('Error cargando escáner. Verificá tu conexión.', 'error');
        return;
    }

    window.openModal(`
        <div class="modal-title">📷 Escanear producto</div>
        <div id="barcode-viewport" style="width:100%;height:250px;background:#000;border-radius:10px;overflow:hidden;position:relative"></div>
        <p style="font-size:.75rem;color:var(--text2);text-align:center;margin-top:.5rem">Apuntá la cámara al código de barras del repuesto</p>
        <button class="btn-secondary" onclick="barcode_stop();window.closeModal()">Cancelar</button>`);

    setTimeout(() => {
        Quagga.init({
            inputStream: {
                name: 'Live',
                type: 'LiveStream',
                target: document.getElementById('barcode-viewport'),
                constraints: { facingMode: 'environment', width: 640, height: 480 }
            },
            decoder: {
                readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader', 'upc_reader', 'upc_e_reader']
            },
            locate: true
        }, (err) => {
            if (err) { window.toast('No se pudo acceder a la cámara', 'error'); window.closeModal(); return; }
            Quagga.start();
        });

        Quagga.onDetected((result) => {
            const code = result.codeResult.code;
            if (code) {
                barcode_stop();
                window.closeModal();
                if (targetInputId) {
                    const input = document.getElementById(targetInputId);
                    if (input) { input.value = code; input.focus(); }
                }
                barcode_accionProducto(code);
            }
        });
    }, 300);
}

function barcode_stop() {
    try { if (window.Quagga) Quagga.stop(); } catch(e) {}
}

async function barcode_accionProducto(code) {
    const { data } = await window.sb.from('inventario').select('*').eq('taller_id', window.tid()).eq('codigo_barras', code).maybeSingle();
    if (data) {
        const bajo = parseFloat(data.cantidad) <= parseFloat(data.stock_minimo);
        window.openModal(`
            <div class="modal-title">📦 ${window.escapeHtml(data.nombre)}</div>
            <div class="info-grid" style="margin-bottom:1rem">
                <div class="info-item"><div class="label">Stock</div><div class="value" style="color:${bajo?'var(--danger)':'var(--success)'}">${data.cantidad} ${window.escapeHtml(data.unidad||'')}</div></div>
                <div class="info-item"><div class="label">Precio</div><div class="value">₲${window.gs(data.precio_unitario)}</div></div>
                ${data.zona?`<div class="info-item"><div class="label">Zona</div><div class="value">📍 ${window.escapeHtml(data.zona)}</div></div>`:''}
                ${data.categoria?`<div class="info-item"><div class="label">Categoría</div><div class="value">${window.escapeHtml(data.categoria)}</div></div>`:''}
            </div>
            ${bajo?'<div style="background:rgba(255,68,68,.1);border-radius:8px;padding:.5rem;margin-bottom:1rem;font-size:.8rem;color:var(--danger);text-align:center">⚠ Stock bajo — pedir más</div>':''}
            <div style="display:flex;gap:.5rem;margin-bottom:.5rem">
                <button onclick="window.closeModal();modalDescontarStock('${data.id}','${window.escapeHtml(data.nombre)}',${data.cantidad})" class="btn-primary" style="flex:1;margin:0">Descontar stock</button>
            </div>
            <div style="display:flex;gap:.5rem">
                <button onclick="window.closeModal();modalEditarItem('${data.id}')" class="btn-secondary" style="flex:1;margin:0">Editar producto</button>
                <button onclick="window.closeModal()" class="btn-secondary" style="margin:0">Cerrar</button>
            </div>`);
    } else {
        window.openModal(`
            <div class="modal-title">Código: ${window.escapeHtml(code)}</div>
            <div style="text-align:center;padding:1rem 0">
                <div style="font-size:2rem;margin-bottom:.5rem">❓</div>
                <div style="font-size:.85rem;color:var(--text2);margin-bottom:1rem">No hay ningún producto con este código de barras en tu inventario.</div>
            </div>
            <button onclick="window.closeModal();modalNuevoItem()" class="btn-primary">Crear producto con este código</button>
            <button onclick="window.closeModal()" class="btn-secondary">Cancelar</button>`);
        setTimeout(() => {
            const bc = document.getElementById('f-barcode');
            if (bc) bc.value = code;
        }, 200);
    }
}

window.barcode_scan = barcode_scan;
window.barcode_stop = barcode_stop;
window.barcode_accionProducto = barcode_accionProducto;

// ============================================================================
// 3. MÓDULO FINANZAS (ingresos, egresos, categorías)
//    Relación: Se integra con las tablas `movimientos_financieros` y
//    `categorias_financieras`. También se conecta con `reparaciones` y
//    `pagos_reparacion` para registrar automáticamente ingresos.
// ============================================================================
// (Ya definido arriba: finanzas, finanzas_modalNuevo, etc.)

// ============================================================================
// 4. MÓDULO PRESUPUESTOS (con flujo de aprobación y creación de OT)
//    Relación: Tabla `presupuestos_v2`. Al aprobar, crea automáticamente
//    una reparación (orden de trabajo) y la vincula.
// ============================================================================
// (Ya definido arriba: presupuestos, detallePresupuesto, aprobarPresupuesto, etc.)

// ============================================================================
// 5. MÓDULO SERVICIO RÁPIDO (QuickService)
//    Relación: Tabla `quickservices`. Servicios sin orden de trabajo,
//    facturación directa. Puede descontar stock.
// ============================================================================
// (Ya definido arriba: quickservice, modalNuevoQS, etc.)

// ============================================================================
// 6. MÓDULO VENTAS POS (Punto de venta)
//    Relación: Tabla `ventas_pos`. Venta de productos del inventario
//    sin necesidad de orden de trabajo. Descuenta stock automáticamente.
// ============================================================================
// (Ya definido arriba: ventasPOS, modalNuevaVentaPOS, etc.)

// ============================================================================
// 7. MÓDULO GASTOS DEL TALLER
//    Relación: Tabla `gastos_taller`. Registro de egresos (alquiler,
//    servicios, repuestos, etc.) y generación de movimientos financieros.
// ============================================================================
// (Ya definido arriba: gastos, modalNuevoGasto, etc.)

// ============================================================================
// 8. MÓDULO SUELDOS Y LIQUIDACIONES
//    Relación: Tablas `periodos_sueldo`, `liquidaciones`, `vales_empleado`,
//    `trabajos_empleado`. Calcula sueldos base, descuentos por vales,
//    bonos por trabajos extra y genera liquidaciones.
// ============================================================================
// (Ya definido arriba: sueldos, detallePeriodo, etc.)

// ============================================================================
// 9. MÓDULO CUENTAS A PAGAR (proveedores)
//    Relación: Tabla `cuentas_pagar`. Registra deudas con proveedores,
//    vencimientos y pagos. Al pagar, genera egreso en finanzas.
// ============================================================================
// (Ya definido arriba: cuentasPagar, detalleCuenta, etc.)

// ============================================================================
// 10. MÓDULO PANEL DE TRABAJO (Kanban)
//     Relación: Muestra las reparaciones agrupadas por estado
//     (pendiente, en progreso, esperando repuestos, finalizados recientes).
//     Depende de `reparaciones` y `reparacion_mecanicos`.
// ============================================================================
// (Ya definido arriba: panelTrabajo)

// ============================================================================
// 11. MÓDULO FICHA DE RECEPCIÓN
//     Relación: Guarda en el campo `ficha_recepcion` de la tabla
//     `reparaciones` datos como kilometraje, combustible, accesorios,
//     estado interior, daños, etc.
// ============================================================================
// (Ya definido arriba: modalFichaRecepcion, confirmarIngreso, verFichaRecepcion)

// ============================================================================
// 12. MÓDULO CARTA DE CONFORMIDAD
//     Relación: Genera un documento PDF imprimible para que el cliente
//     firme al retirar el vehículo. Actualiza el estado de la reparación
//     a 'finalizado' y registra fecha de entrega.
// ============================================================================
// (Ya definido arriba: generarCartaConformidad, marcarEntregado)

// ============================================================================
// 13. MÓDULO UBICACIONES JERÁRQUICAS
//     Relación: Tabla `ubicaciones`. Permite organizar el inventario
//     en ubicaciones físicas (estantes, depósitos, etc.) con estructura
//     padre-hijo.
// ============================================================================
// (Ya definido arriba: cargarUbicaciones, modalGestionarUbicaciones, etc.)

// ============================================================================
// 14. MÓDULO SUPER ADMIN
//     Relación: Tabla `super_admins`. Permite a usuarios con privilegios
//     especiales gestionar todos los talleres, sus suscripciones y planes.
// ============================================================================
// (Ya definido arriba: superAdminPanel, modalGestionarTaller, etc.)

// ============================================================================
// 15. MÓDULO MECÁNICOS POR REPARACIÓN (multi-asignación)
//     Relación: Tabla `reparacion_mecanicos`. Permite asignar varios
//     mecánicos a una misma reparación, con horas trabajadas y pago
//     individual. Valida límite de trabajos simultáneos por mecánico.
// ============================================================================
// (Ya definido arriba: repMecanicos_cargar, repMecanicos_modal, etc.)

// ============================================================================
// 16. MÓDULO CIERRE DE CAJA
//     Relación: Muestra resumen del día (ingresos, egresos, cobros por
//     método de pago, efectivo en caja) basado en `movimientos_financieros`
//     y `pagos_reparacion`.
// ============================================================================
// (Ya definido arriba: modalCierreCaja)

// ============================================================================
// FIN DEL ARCHIVO
// ============================================================================
