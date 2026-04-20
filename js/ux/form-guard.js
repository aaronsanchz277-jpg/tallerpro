// ─── PROTECCIÓN DE FORMULARIOS CONTRA SALIDA ACCIDENTAL ──────────────────────
let _formularioModificado = false;
let _formularioModalAbierto = false;

function formGuard_marcarModificado() {
  _formularioModificado = true;
}

function formGuard_reset() {
  _formularioModificado = false;
  _formularioModalAbierto = false;
}

function formGuard_iniciarProteccion() {
  _formularioModalAbierto = true;
  _formularioModificado = false;
}

// Interceptar cierre de modal
const originalCloseModal = closeModal;
closeModal = function() {
  if (_formularioModalAbierto && _formularioModificado) {
    confirmar('Tenés cambios sin guardar. ¿Salir igual?', () => {
      formGuard_reset();
      originalCloseModal();
    });
  } else {
    formGuard_reset();
    originalCloseModal();
  }
};

// Interceptar navegación cuando hay modal abierto con cambios
const originalNavigate = navigate;
navigate = function(page, params) {
  if (_formularioModalAbierto && _formularioModificado) {
    confirmar('Tenés cambios sin guardar. ¿Salir de la página igual?', () => {
      formGuard_reset();
      originalNavigate(page, params);
    });
  } else {
    formGuard_reset();
    originalNavigate(page, params);
  }
};

// Helper para agregar listeners de cambio a inputs de formularios modales
function formGuard_vigilarFormulario(prefix = 'f-') {
  formGuard_iniciarProteccion();
  setTimeout(() => {
    const modal = document.getElementById('modal-overlay');
    if (!modal) return;
    const inputs = modal.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('input', formGuard_marcarModificado);
      input.addEventListener('change', formGuard_marcarModificado);
    });
  }, 100);
}
