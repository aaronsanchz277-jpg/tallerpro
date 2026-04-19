// ─── TEMAS DE COLOR ──────────────────────────────────────────────────────────
let _temaActual = localStorage.getItem('tallerpro_theme') || 'dark';

function aplicarTema() {
  const themeStyles = document.getElementById('theme-styles');
  if (!themeStyles) {
    const style = document.createElement('style');
    style.id = 'theme-styles';
    document.head.appendChild(style);
  }
  
  if (_temaActual === 'light') {
    document.getElementById('theme-styles').textContent = `
      :root {
        --bg: #f5f5f7;
        --surface: #ffffff;
        --surface2: #f0f0f3;
        --border: #dddde3;
        --text: #1a1a2e;
        --text2: #666680;
      }
    `;
  } else {
    document.getElementById('theme-styles').textContent = '';
  }
}

function toggleTema() {
  _temaActual = _temaActual === 'dark' ? 'light' : 'dark';
  localStorage.setItem('tallerpro_theme', _temaActual);
  aplicarTema();
  toast(_temaActual === 'light' ? '☀️ Modo claro' : '🌙 Modo oscuro', 'success');
}

// Botón en sidebar
function getTemaToggle() {
  return `
    <button onclick="toggleTema()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .6rem;cursor:pointer;font-size:.75rem">
      ${_temaActual === 'dark' ? '☀️' : '🌙'}
    </button>
  `;
}

aplicarTema();
