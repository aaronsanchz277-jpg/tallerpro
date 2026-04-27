// ─── HELPERS DE INTERNACIONALIZACIÓN ─────────────────────────────────────────
// Los diccionarios viven en `window.IDIOMAS` y se cargan en archivos separados
// (i18n-es.js, i18n-gn.js, i18n-pt.js, i18n-en.js) ANTES que este. Acá sólo
// quedan los helpers `t()`, `tp()`, `cambiarIdioma()`, etc., que dependen del
// objeto ya armado.
const IDIOMAS = window.IDIOMAS || {};

let idiomaActual = localStorage.getItem('tallerpro_lang') || 'es';

/**
 * Traduce una clave de idioma. Soporta interpolación de variables.
 * @param {string} key - Clave del diccionario
 * @param {object} params - Objeto con variables a reemplazar (ej: {nombre: 'Juan'})
 * @returns {string} Texto traducido
 */
const t = (key, params = {}) => {
  // Defensivo: si por alguna razón el idioma activo o español no se cargó,
  // devolvemos la clave tal cual en vez de tirar TypeError.
  let text = IDIOMAS[idiomaActual]?.[key] ?? IDIOMAS['es']?.[key] ?? key;
  if (params && typeof params === 'object') {
    Object.keys(params).forEach(param => {
      text = text.replace(new RegExp(`{${param}}`, 'g'), params[param]);
    });
  }
  return text;
};

/**
 * Traducción con pluralización simple (español).
 * @param {string} keyBase - Clave base (ej: 'dias')
 * @param {number} count - Cantidad
 * @returns {string}
 */
const tp = (keyBase, count) => {
  const suffix = count === 1 ? '' : '_plural';
  return t(keyBase + suffix, { count });
};

function cambiarIdioma(lang) {
  idiomaActual = lang;
  localStorage.setItem('tallerpro_lang', lang);

  // Actualizar atributo lang del HTML
  document.documentElement.lang = lang;

  // Actualizar elementos globales inmediatamente
  const btnSalir = document.getElementById('btn-salir');
  if (btnSalir) btnSalir.textContent = t('salirBtn');

  const langSelector = document.getElementById('lang-selector');
  if (langSelector) langSelector.value = lang;

  // Forzar recarga completa de la interfaz
  if (currentPage) {
    setTimeout(() => navigate(currentPage), 50);
  } else {
    window.location.reload();
  }
}

function aplicarIdioma() {
  const sel = document.getElementById('lang-selector');
  if (sel) sel.value = idiomaActual;

  const btnSalir = document.getElementById('btn-salir');
  if (btnSalir) btnSalir.textContent = t('salirBtn');

  document.documentElement.lang = idiomaActual;
}

function cambiarIdiomaLogin(lang) {
  idiomaActual = lang;
  localStorage.setItem('tallerpro_lang', lang);
  document.documentElement.lang = lang;
  translateLoginScreen();
}

function translateLoginScreen() {
  const setT = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = t(key); };
  setT('lt-ingresar', 'loginIngresar');
  setT('tab-nuevo-taller', 'loginNuevoTaller');
  setT('lt-registro-msg', 'loginRegistroMsg');
}
