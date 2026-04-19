// ─── TUTORIAL INTERACTIVO PARA MODO SIMPLE ─────────────────────────────────
let _tutorialStep = 0;
const _tutorialSteps = [
  { selector: '#main-content [onclick*="modalNuevaReparacionSimple"]', text: 'Acá registrás un vehículo nuevo que entra al taller. Solo 3 pasos.', position: 'bottom' },
  { selector: '#main-content [onclick*="ventas"]', text: 'Acá cobrás rápido productos o servicios sin crear una orden de trabajo.', position: 'bottom' },
  { selector: '#main-content [onclick*="agenda"]', text: 'Acá ves los turnos del día.', position: 'bottom' },
  { selector: '#main-content [onclick*="modalCierreCaja"]', text: 'Acá hacés el cierre de caja al final del día.', position: 'bottom' },
  { selector: '.bottom-nav [onclick*="dashboard"]', text: 'Este es tu panel principal. Siempre podés volver acá.', position: 'top' }
];

function iniciarTutorial() {
  if (!esModoSimple || !esModoSimple()) {
    toast('El tutorial solo está disponible en Modo Simple', 'info');
    return;
  }
  
  const tutorialVisto = localStorage.getItem('tallerpro_tutorial_visto');
  if (tutorialVisto && !confirm('¿Querés ver el tutorial de nuevo?')) return;
  
  _tutorialStep = 0;
  mostrarTutorialStep();
}

function mostrarTutorialStep() {
  // Limpiar overlay anterior
  document.getElementById('tutorial-overlay')?.remove();
  
  if (_tutorialStep >= _tutorialSteps.length) {
    localStorage.setItem('tallerpro_tutorial_visto', 'true');
    toast('🎉 ¡Tutorial completado!', 'success');
    return;
  }
  
  const step = _tutorialSteps[_tutorialStep];
  const element = document.querySelector(step.selector);
  
  if (!element) {
    _tutorialStep++;
    mostrarTutorialStep();
    return;
  }
  
  const rect = element.getBoundingClientRect();
  
  const overlay = document.createElement('div');
  overlay.id = 'tutorial-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:999;';
  
  const highlight = document.createElement('div');
  highlight.style.cssText = `position:absolute;top:${rect.top - 5}px;left:${rect.left - 5}px;width:${rect.width + 10}px;height:${rect.height + 10}px;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.7);border:3px solid var(--accent);pointer-events:none`;
  overlay.appendChild(highlight);
  
  const tooltip = document.createElement('div');
  tooltip.style.cssText = `position:absolute;${step.position === 'bottom' ? `top:${rect.bottom + 15}px` : `bottom:${window.innerHeight - rect.top + 15}px`};left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--accent);border-radius:12px;padding:1rem;max-width:280px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.5);z-index:1000`;
  tooltip.innerHTML = `
    <div style="font-size:1rem;color:var(--text);margin-bottom:.5rem">${step.text}</div>
    <div style="display:flex;gap:.5rem;justify-content:center">
      <button onclick="tutorialSkip()" style="background:none;border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:.3rem .8rem;font-size:.75rem;cursor:pointer">Saltar</button>
      <button onclick="tutorialNext()" style="background:var(--accent);color:#000;border:none;border-radius:6px;padding:.3rem 1.2rem;font-size:.75rem;font-weight:600;cursor:pointer">${_tutorialStep === _tutorialSteps.length - 1 ? 'Finalizar' : 'Siguiente →'}</button>
    </div>
    <div style="margin-top:.5rem;font-size:.65rem;color:var(--text2)">${_tutorialStep + 1}/${_tutorialSteps.length}</div>
  `;
  overlay.appendChild(tooltip);
  
  document.body.appendChild(overlay);
}

function tutorialNext() {
  _tutorialStep++;
  mostrarTutorialStep();
}

function tutorialSkip() {
  document.getElementById('tutorial-overlay')?.remove();
  localStorage.setItem('tallerpro_tutorial_visto', 'true');
}

// Mostrar tutorial automáticamente la primera vez en modo simple
function checkTutorialAuto() {
  const tutorialVisto = localStorage.getItem('tallerpro_tutorial_visto');
  if (!tutorialVisto && esModoSimple && esModoSimple() && currentPage === 'dashboard') {
    setTimeout(iniciarTutorial, 1000);
  }
}
