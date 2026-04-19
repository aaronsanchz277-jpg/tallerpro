// ─── TEMA CLARO/OSCURO ──────────────────────────────────────────────────────
let _temaClaro = localStorage.getItem('tallerpro_tema') === 'claro';

function aplicarTema() {
  const root = document.documentElement;
  if (_temaClaro) {
    root.style.setProperty('--bg', '#f5f5f7');
    root.style.setProperty('--surface', '#ffffff');
    root.style.setProperty('--surface2', '#f0f0f3');
    root.style.setProperty('--border', '#d1d1d6');
    root.style.setProperty('--text', '#1c1c1e');
    root.style.setProperty('--text2', '#6c6c70');
    root.style.setProperty('--accent', '#0077cc');
  } else {
    root.style.setProperty('--bg', '#0a0a0f');
    root.style.setProperty('--surface', '#12121a');
    root.style.setProperty('--surface2', '#1a1a26');
    root.style.setProperty('--border', '#2a2a3a');
    root.style.setProperty('--text', '#e8e8f0');
    root.style.setProperty('--text2', '#8888aa');
    root.style.setProperty('--accent', '#00e5ff');
  }
}

function toggleTema() {
  _temaClaro = !_temaClaro;
  localStorage.setItem('tallerpro_tema', _temaClaro ? 'claro' : 'oscuro');
  aplicarTema();
  toast(_temaClaro ? '☀️ Modo claro' : '🌙 Modo oscuro', 'success');
}

function getTemaToggle() {
  return `<button onclick="toggleTema()" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:1rem;padding:4px">${_temaClaro ? '🌙' : '☀️'}</button>`;
}

// Aplicar tema al iniciar
aplicarTema();
