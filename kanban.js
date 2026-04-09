// ─── PWA: Service Worker ─────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    console.log('SW registrado:', reg.scope);
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'SYNC_REQUESTED') processOfflineQueue();
    });
  }).catch(err => console.warn('SW falló:', err));
}

// ─── PWA: Instalar App ──────────────────────────────────────────────────────
let _installPrompt = null;
let _appInstalled = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone || window.matchMedia('(display-mode: fullscreen)').matches;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _installPrompt = e;
  const btn = document.getElementById('btn-install');
  if (btn) btn.style.display = 'inline-block';
});

window.addEventListener('appinstalled', () => {
  _appInstalled = true;
  _installPrompt = null;
  const btn = document.getElementById('btn-install');
  if (btn) btn.style.display = 'none';
  toast('✓ TallerPro instalada!', 'success');
});

async function installApp() {
  if (_installPrompt) {
    _installPrompt.prompt();
    const result = await _installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      _installPrompt = null;
      const btn = document.getElementById('btn-install');
      if (btn) btn.style.display = 'none';
    }
  }
}

// Detectar dispositivos
const _ua = navigator.userAgent || '';
const _isIOS = /iPad|iPhone|iPod/.test(_ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const _isAndroid = /Android/i.test(_ua);
const _isSamsung = /SamsungBrowser/i.test(_ua);
const _isFirefox = /Firefox/i.test(_ua) && !_ua.includes('Seamonkey');
const _isHuawei = /HuaweiBrowser|HUAWEI/i.test(_ua);
const _isInStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone || window.matchMedia('(display-mode: fullscreen)').matches;
const _iosBannerDismissed = localStorage.getItem('tallerpro_ios_dismiss');

function dismissIOSBanner() {
  localStorage.setItem('tallerpro_ios_dismiss', '1');
  const el = document.getElementById('ios-install-banner');
  if (el) el.remove();
}

function getInstallBanner() {
  if (_appInstalled || _isInStandalone) return '';
  
  // iOS: instrucciones de Safari
  if (_isIOS && !_iosBannerDismissed) {
    return `<div class="install-banner" id="ios-install-banner" style="position:relative">
      <div class="install-banner-icon">📲</div>
      <div class="install-banner-text">
        <div class="install-banner-title">Instalá TallerPro</div>
        <div class="install-banner-sub" style="line-height:1.5">
          1. Abrí en <strong style="color:var(--text)">Safari</strong><br>
          2. Tocá <strong style="color:var(--text)">Compartir</strong> ⬆️<br>
          3. Tocá <strong style="color:var(--text)">Agregar a inicio</strong>
        </div>
      </div>
      <button onclick="event.stopPropagation();dismissIOSBanner()" style="position:absolute;top:8px;right:8px;background:none;border:none;color:var(--text2);font-size:1.1rem;cursor:pointer;padding:4px">✕</button>
    </div>`;
  }
  
  // Android Chrome/Edge: botón directo
  if (_installPrompt) {
    return `<div class="install-banner" onclick="installApp()">
      <div class="install-banner-icon">📲</div>
      <div class="install-banner-text">
        <div class="install-banner-title">Instalá TallerPro</div>
        <div class="install-banner-sub">Acceso rápido desde tu pantalla de inicio</div>
      </div>
      <button class="install-banner-btn">INSTALAR</button>
    </div>`;
  }
  
  // Samsung Internet: instrucciones manuales
  if (_isSamsung && !_iosBannerDismissed) {
    return `<div class="install-banner" id="ios-install-banner" style="position:relative">
      <div class="install-banner-icon">📲</div>
      <div class="install-banner-text">
        <div class="install-banner-title">Instalá TallerPro</div>
        <div class="install-banner-sub" style="line-height:1.5">
          Tocá el menú <strong style="color:var(--text)">☰</strong> → <strong style="color:var(--text)">Agregar a pantalla de inicio</strong>
        </div>
      </div>
      <button onclick="event.stopPropagation();dismissIOSBanner()" style="position:absolute;top:8px;right:8px;background:none;border:none;color:var(--text2);font-size:1.1rem;cursor:pointer;padding:4px">✕</button>
    </div>`;
  }
  
  // Firefox Android / Huawei: instrucciones manuales
  if ((_isFirefox || _isHuawei) && _isAndroid && !_iosBannerDismissed) {
    return `<div class="install-banner" id="ios-install-banner" style="position:relative">
      <div class="install-banner-icon">📲</div>
      <div class="install-banner-text">
        <div class="install-banner-title">Instalá TallerPro</div>
        <div class="install-banner-sub" style="line-height:1.5">
          Tocá el menú <strong style="color:var(--text)">⋮</strong> → <strong style="color:var(--text)">Instalar</strong> o <strong style="color:var(--text)">Agregar a inicio</strong>
        </div>
      </div>
      <button onclick="event.stopPropagation();dismissIOSBanner()" style="position:absolute;top:8px;right:8px;background:none;border:none;color:var(--text2);font-size:1.1rem;cursor:pointer;padding:4px">✕</button>
    </div>`;
  }
  
  return '';
}

