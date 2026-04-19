// ─── ASISTENTE DE INTEGRACIONES (UX Mejorada) ──────────────────────────────
let _currentIntegrations = {};

async function modalCentroIntegraciones() {
  // Cargar estado actual de las claves
  const { data: keys } = await sb.from('config_keys').select('clave').eq('taller_id', tid());
  const activeKeys = new Set((keys || []).map(k => k.clave));
  
  _currentIntegrations = {
    ocr: activeKeys.has('ocr_api_key'),
    groq: activeKeys.has('groq_api_key'),
    google: activeKeys.has('google_client_id')
  };

  const integrations = [
    {
      id: 'ocr',
      name: 'Escáner de Facturas',
      icon: '📄',
      desc: 'Escanea facturas de proveedores y crea gastos automáticamente.',
      active: _currentIntegrations.ocr,
      color: 'var(--accent)'
    },
    {
      id: 'groq',
      name: 'Asistente IA con Voz',
      icon: '🤖',
      desc: 'Hablá con tu taller. Creá trabajos, clientes y consultá ingresos.',
      active: _currentIntegrations.groq,
      color: 'var(--accent)'
    },
    {
      id: 'google',
      name: 'Google Calendar',
      icon: '📅',
      desc: 'Sincronizá tus citas automáticamente con Google Calendar.',
      active: _currentIntegrations.google,
      color: 'var(--accent2)'
    }
  ];

  openModal(`
    <div class="modal-title">🔌 Centro de Integraciones</div>
    <p style="font-size:.8rem;color:var(--text2);margin-bottom:1.5rem">
      Activá servicios externos para potenciar tu taller. Cada servicio es gratuito e independiente.
    </p>
    <div style="display:flex;flex-direction:column;gap:.75rem">
      ${integrations.map(int => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:16px;padding:1rem">
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem">
            <span style="font-size:1.8rem">${int.icon}</span>
            <div style="flex:1">
              <div style="font-family:var(--font-head);font-size:1rem;color:${int.color}">${int.name}</div>
              <div style="font-size:.7rem;color:var(--text2)">${int.desc}</div>
            </div>
            <div>
              ${int.active ? 
                `<span style="background:rgba(0,255,136,.15);color:var(--success);padding:.25rem .6rem;border-radius:20px;font-size:.7rem;font-weight:600">✓ ACTIVO</span>` :
                `<button onclick="modalActivarIntegracion('${int.id}')" style="background:var(--surface);border:1px solid ${int.color};color:${int.color};padding:.4rem .8rem;border-radius:20px;font-size:.75rem;cursor:pointer;font-weight:600">Activar</button>`
              }
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <button class="btn-secondary" onclick="closeModal()" style="margin-top:1rem">Cerrar</button>
  `);
}

async function modalActivarIntegracion(type) {
  const configs = {
    ocr: {
      title: 'Activar Escáner de Facturas',
      description: 'Necesitamos una llave gratuita de OCR.space. Son 500 escaneos al mes sin costo.',
      helpLink: 'https://ocr.space/OCRAPI',
      keyPrefix: 'K',
      claveDB: 'ocr_api_key',
      example: 'K86742158888957',
      helpSteps: [
        '1. Hacé clic en "Obtener llave gratuita".',
        '2. Registrate con tu email (es gratis).',
        '3. Copiá la llave que empieza con "K".',
        '4. Pegala abajo y guardá.'
      ]
    },
    groq: {
      title: 'Activar Asistente IA',
      description: 'Obtené una API Key gratuita de Groq. Tiene límites generosos para uso normal.',
      helpLink: 'https://console.groq.com/keys',
      keyPrefix: 'gsk_',
      claveDB: 'groq_api_key',
      example: 'gsk_...',
      helpSteps: [
        '1. Hacé clic en "Obtener llave gratuita".',
        '2. Iniciá sesión con Google o GitHub.',
        '3. Creá una nueva API Key.',
        '4. Copiala y pegala abajo.'
      ]
    },
    google: {
      title: 'Conectar Google Calendar',
      description: 'Configurá un proyecto en Google Cloud (gratis) para sincronizar turnos.',
      helpLink: 'https://console.cloud.google.com/',
      keyPrefix: '',
      claveDB: 'google_client_id',
      example: '...apps.googleusercontent.com',
      helpSteps: [
        '1. Hacé clic en "Configurar Google".',
        '2. Creá un proyecto y habilitá Calendar API.',
        '3. Creá credenciales OAuth 2.0.',
        '4. Copiá el "Client ID" y pegalo abajo.'
      ]
    }
  };

  const cfg = configs[type];
  
  openModal(`
    <div class="modal-title">${cfg.title}</div>
    <div style="background:rgba(0,229,255,.05);border-radius:12px;padding:1rem;margin-bottom:1.5rem">
      <p style="font-size:.85rem;color:var(--text);margin-bottom:.5rem">${cfg.description}</p>
      <ol style="font-size:.75rem;color:var(--text2);margin-left:1rem">
        ${cfg.helpSteps.map(step => `<li style="margin-bottom:.2rem">${step}</li>`).join('')}
      </ol>
    </div>
    
    <div style="margin-bottom:1.5rem">
      <button onclick="window.open('${cfg.helpLink}', '_blank')" style="width:100%;background:var(--accent);color:#000;border:none;border-radius:12px;padding:.8rem;font-family:var(--font-head);font-size:1rem;font-weight:700;cursor:pointer">
        🔑 OBTENER MI LLAVE GRATUITA
      </button>
    </div>

    <div class="form-group">
      <label class="form-label">Pegá tu llave aquí</label>
      <div style="display:flex;gap:.4rem;align-items:center">
        <input class="form-input" id="integration-key" placeholder="${cfg.example}" style="flex:1;font-family:monospace" autocomplete="off">
        <span id="key-valid-icon" style="font-size:1.2rem">⚪</span>
      </div>
      <div id="key-hint" style="font-size:.7rem;color:var(--text2);margin-top:.3rem">${cfg.keyPrefix ? 'Debe empezar con "' + cfg.keyPrefix + '"' : ''}</div>
    </div>

    <button class="btn-primary" onclick="guardarIntegracion('${type}', '${cfg.claveDB}', '${cfg.keyPrefix}')" id="btn-save-integration" disabled>Guardar y Activar</button>
    ${_currentIntegrations[type] ? `<button class="btn-danger" onclick="desactivarIntegracion('${type}', '${cfg.claveDB}')" style="margin-top:.5rem">Desactivar integración</button>` : ''}
    <button class="btn-secondary" onclick="modalCentroIntegraciones()" style="margin-top:.5rem">← Volver</button>
  `);

  const keyInput = document.getElementById('integration-key');
  if (keyInput) {
    keyInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const isValid = !cfg.keyPrefix || val.startsWith(cfg.keyPrefix);
      const icon = document.getElementById('key-valid-icon');
      const btn = document.getElementById('btn-save-integration');
      if (icon) icon.textContent = isValid ? '✅' : '❌';
      if (btn) btn.disabled = !isValid || val.length < 5;
    });
  }
}

async function guardarIntegracion(type, claveDB, keyPrefix) {
  const keyInput = document.getElementById('integration-key');
  const apiKey = keyInput.value.trim();
  
  if (!apiKey) {
    toast('Pegá la llave primero', 'error');
    return;
  }
  if (keyPrefix && !apiKey.startsWith(keyPrefix)) {
    toast(`La llave debe empezar con "${keyPrefix}"`, 'error');
    return;
  }

  const { error } = await sb.from('config_keys').upsert({
    taller_id: tid(),
    clave: claveDB,
    valor: apiKey
  }, { onConflict: 'taller_id, clave' });

  if (error) {
    toast('Error al guardar: ' + error.message, 'error');
    return;
  }

  // Limpiar cachés de las claves
  if (type === 'ocr') _ocrApiKey = null;
  if (type === 'groq') _groqKey = null;

  toast('¡Integración activada correctamente!', 'success');
  modalCentroIntegraciones();
}

async function desactivarIntegracion(type, claveDB) {
  confirmar('¿Desactivar esta integración? Podrás volver a activarla después.', async () => {
    await sb.from('config_keys').delete().eq('taller_id', tid()).eq('clave', claveDB);
    if (type === 'ocr') _ocrApiKey = null;
    if (type === 'groq') _groqKey = null;
    toast('Integración desactivada', 'success');
    modalCentroIntegraciones();
  });
}
