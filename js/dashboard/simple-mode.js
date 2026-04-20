// ─── MODO SIMPLE (Interfaz simplificada para agilizar tareas comunes) ────────
let _modoSimple = localStorage.getItem('tallerpro_modo_simple') === 'true';

function toggleModoSimple() {
  _modoSimple = !_modoSimple;
  localStorage.setItem('tallerpro_modo_simple', _modoSimple);
  toast(_modoSimple ? 'Modo simple activado' : 'Modo avanzado activado', 'success');
  navigate(currentPage);
}

function esModoSimple() {
  return _modoSimple;
}

function getModoSimpleToggle() {
  const iconoSVG = _modoSimple
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg>`;
    
  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:.5rem">
      <button onclick="toggleModoSimple()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:20px;padding:.3rem .8rem;font-size:.7rem;cursor:pointer;display:flex;align-items:center;gap:.3rem">
        ${iconoSVG} ${_modoSimple ? 'Modo avanzado' : 'Modo simple'}
      </button>
    </div>
  `;
}
