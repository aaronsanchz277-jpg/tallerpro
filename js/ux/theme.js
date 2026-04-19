// ─── TEMA CLARO/OSCURO ──────────────────────────────────────────────────────
let _temaActual = localStorage.getItem('tallerpro_theme') || 'dark';

function aplicarTema() {
  let themeStyles = document.getElementById('theme-styles');
  if (!themeStyles) {
    themeStyles = document.createElement('style');
    themeStyles.id = 'theme-styles';
    document.head.appendChild(themeStyles);
  }
  
  if (_temaActual === 'light') {
    themeStyles.textContent = `
      :root {
        --bg: #f5f5f7;
        --surface: #ffffff;
        --surface2: #f0f0f3;
        --border: #d1d1d6;
        --accent: #0077cc;
        --accent2: #ff6b35;
        --success: #00aa55;
        --warning: #ffaa00;
        --danger: #cc3333;
        --text: #1c1c1e;
        --text2: #6c6c70;
      }
    `;
  } else {
    themeStyles.textContent = '';
  }
}

function toggleTema() {
  _temaActual = _temaActual === 'dark' ? 'light' : 'dark';
  localStorage.setItem('tallerpro_theme', _temaActual);
  aplicarTema();
  toast(_temaActual === 'light' ? '☀️ Modo claro' : '🌙 Modo oscuro', 'success');
}

function getTemaToggle() {
  // SVG simple para sol/luna sin emojis
  const sunIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const moonIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  
  return `
    <button onclick="toggleTema()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .6rem;cursor:pointer;font-size:.75rem;display:flex;align-items:center;gap:.3rem">
      ${_temaActual === 'dark' ? sunIcon : moonIcon}
      <span>${_temaActual === 'dark' ? 'Claro' : 'Oscuro'}</span>
    </button>
  `;
}

// Aplicar el tema guardado al iniciar la app
aplicarTema();
