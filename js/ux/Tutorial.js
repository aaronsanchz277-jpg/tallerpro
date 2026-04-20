   // ─── TUTORIAL INTERACTIVO (Primera vez en Modo Simple) ──────────────────────
let _tutorialVisto = localStorage.getItem('tallerpro_tutorial_visto');

function iniciarTutorial() {
  if (_tutorialVisto) return;
  if (typeof esModoSimple !== 'function' || !esModoSimple()) return;

  setTimeout(() => {
    const pasos = [
      { selector: '[onclick="modalNuevaReparacionSimple()"]', texto: 'Acá registrás un vehículo nuevo en 3 pasos fáciles' },
      { selector: '[onclick="navigate(\'ventas\')"]', fallback: '[onclick*="ventas"]', texto: 'Cobrá rápido productos o servicios' },
      { selector: '[onclick="navigate(\'agenda\')"]', fallback: '[onclick*="agenda"]', texto: 'Mirá los turnos de hoy' },
      { selector: '[onclick="modalCierreCaja()"]', texto: 'Al final del día, cerrá la caja y sabé cuánto ganaste' }
    ];

    let overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;';
    document.body.appendChild(overlay);

    let pasoActual = 0;

    function mostrarPaso() {
      const paso = pasos[pasoActual];
      let el = document.querySelector(paso.selector);
      if (!el && paso.fallback) el = document.querySelector(paso.fallback);

      if (!el) {
        console.warn(`Tutorial: elemento no encontrado paso ${pasoActual + 1}`);
        siguientePaso();
        return;
      }

      const rect = el.getBoundingClientRect();
      const tooltip = document.createElement('div');
      tooltip.style.cssText = `position:fixed;top:${rect.bottom + 10}px;left:${Math.max(10, rect.left)}px;background:var(--accent);color:#000;padding:1rem;border-radius:12px;max-width:250px;z-index:10000;font-weight:bold;box-shadow:0 4px 20px rgba(0,0,0,.5);`;
      tooltip.innerHTML = `
        ${paso.texto}
        <div style="margin-top:.5rem;display:flex;justify-content:space-between">
          <span style="opacity:.7">${pasoActual + 1}/${pasos.length}</span>
          <button id="tutorial-siguiente" style="background:#000;color:#fff;border:none;padding:.3rem .8rem;border-radius:20px;cursor:pointer">Siguiente →</button>
        </div>
      `;
      document.body.appendChild(tooltip);
      window._tutorialTooltip = tooltip;
      document.getElementById('tutorial-siguiente').addEventListener('click', siguientePaso);
    }

    window.siguientePaso = function() {
      if (window._tutorialTooltip) {
        window._tutorialTooltip.remove();
        window._tutorialTooltip = null;
      }
      pasoActual++;
      if (pasoActual < pasos.length) {
        mostrarPaso();
      } else {
        overlay.remove();
        localStorage.setItem('tallerpro_tutorial_visto', '1');
        toast('¡Listo! Ya sabés usar el taller', 'success');
      }
    };

    mostrarPaso();
  }, 800);
}   
