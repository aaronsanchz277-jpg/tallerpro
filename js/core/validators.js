// ─── VALIDADORES UNIFICADOS ──────────────────────────────────────────────────
function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && !value.trim())) {
    toast(`El campo "${fieldName}" es obligatorio`, 'error');
    return false;
  }
  return true;
}

function validatePositiveNumber(value, fieldName) {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) {
    toast(`El campo "${fieldName}" debe ser un número mayor a 0`, 'error');
    return false;
  }
  return true;
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) {
    toast('Ingresá un email válido', 'error');
    return false;
  }
  return true;
}

function validatePhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 6) {
    toast('El teléfono debe tener al menos 6 dígitos', 'error');
    return false;
  }
  return true;
}

function validatePatente(patente) {
  if (!patente || patente.length < 3) {
    toast('La patente debe tener al menos 3 caracteres', 'error');
    return false;
  }
  return true;
}
