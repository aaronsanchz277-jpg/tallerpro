 // ─── TEMA CLARO/OSCURO ──────────────────────────────────────────────────────
let _temaActual = localStorage.getItem('tallerpro_theme') || 'dark';

function aplicarTema() {
  // Buscar o crear el elemento <style> para las variables del tema
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
    // Tema oscuro (valores por defecto definidos en :root del CSS principal, los dejamos vacíos para que hereden)
    themeStyles.textContent = `
      :root {
        /* Se heredan los valores por defecto del CSS original */
      }
    `;
  }
}

function toggleTema() {
  _temaActual = _temaActual === 'dark' ? 'light' : 'dark';
  localStorage.setItem('tallerpro_theme', _temaActual);
  aplicarTema();
  toast(_temaActual === 'light' ? '☀️ Modo claro' : '🌙 Modo oscuro', 'success');
}

function getTemaToggle() {
  return `
    <button onclick="toggleTema()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:.4rem .6rem;cursor:pointer;font-size:.75rem">
      ${_temaActual === 'dark' ? '☀️' : '🌙'}
    </button>
  `;
}

// Aplicar el tema guardado al iniciar la app
aplicarTema();
