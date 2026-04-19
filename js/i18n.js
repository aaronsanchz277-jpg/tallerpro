// ─── IDIOMAS ──────────────────────────────────────────────────────────────────
const IDIOMAS = {
  es: {
    // ... (todo el contenido existente se mantiene igual, solo agrego las nuevas claves al final)
    // NUEVAS CLAVES PARA INTEGRACIONES, KPIS, ETC.
    integracionesTitulo: '🔌 Centro de Integraciones',
    integracionesDesc: 'Activá servicios externos para potenciar tu taller.',
    activo: 'ACTIVO',
    activar: 'Activar',
    desactivar: 'Desactivar',
    obtenerLlave: '🔑 OBTENER MI LLAVE GRATUITA',
    pegaTuLlave: 'Pegá tu llave aquí',
    guardarYActivar: 'Guardar y Activar',
    desactivarIntegracion: 'Desactivar integración',
    volverAlCentro: '← Volver al Centro',
    validandoLlave: 'Validando llave...',
    llaveInvalida: 'La llave no tiene el formato correcto',
    integracionActivada: '¡Integración activada correctamente!',
    integracionDesactivada: 'Integración desactivada',
    confirmarDesactivar: '¿Desactivar esta integración? Podrás volver a activarla después.',
    kpisTitulo: '📊 Configurar KPIs',
    kpisDesc: 'Seleccioná qué indicadores querés ver en la pantalla principal.',
    guardarConfig: 'Guardar configuración',
    configGuardada: 'Configuración guardada',
    kpiClientes: 'Total clientes',
    kpiVehiculos: 'Total vehículos',
    kpiEnProgreso: 'Trabajos en progreso',
    kpiHoy: 'Trabajos hoy',
    kpiCreditos: 'Créditos pendientes',
    kpiIngresosMes: 'Ingresos del mes',
    kpiGananciaNeta: 'Ganancia neta',
    kpiVehiculosHoy: 'Vehículos hoy',
    kpiStockBajo: 'Alertas stock bajo',
    modoTallerTitulo: '📺 Modo Taller',
    tutorialTitulo: '🎓 Tutorial',
    tutorialPaso1: 'Acá registrás un vehículo nuevo en 3 pasos fáciles',
    tutorialPaso2: 'Cobrá rápido productos o servicios',
    tutorialPaso3: 'Mirá los turnos de hoy',
    tutorialPaso4: 'Al final del día, cerrá la caja y sabé cuánto ganaste',
    tutorialFinal: '¡Listo! Ya sabés usar el taller',
    temaClaro: '☀️ Modo claro',
    temaOscuro: '🌙 Modo oscuro',
    exportarExcel: '📥 Exportar a Excel',
    exportando: 'Exportando...',
    exportado: 'Exportado correctamente',
    recordatoriosTitulo: '📨 Configurar mensajes',
    recordatoriosGuardado: 'Mensaje guardado',
    ocrTitulo: '📄 Escanear factura',
    ocrProcesando: 'Procesando imagen...',
    ocrExito: 'Factura analizada',
    ocrError: 'No se pudo leer la factura',
    googleCalendarTitulo: '📅 Google Calendar',
    googleConectar: 'Conectar cuenta de Google',
    googleConectado: '✓ Conectado a Google Calendar',
    googleSincronizado: 'Citas sincronizadas',
    realtimeConectado: 'Sincronización en tiempo real activada',
    realtimeDesconectado: 'Sincronización en tiempo real desactivada',
    tutorialIniciar: 'Iniciar tutorial',
    tutorialOmitir: 'Omitir',
    checklistPlantillas: '📋 Plantillas de inspección',
    nuevaPlantilla: 'Nueva plantilla',
    editarPlantilla: 'Editar plantilla',
    eliminarPlantilla: 'Eliminar plantilla',
    guardarPlantilla: 'Guardar plantilla',
    itemsPlantilla: 'Ítems de la plantilla',
    agregarItem: 'Agregar ítem',
  },
  gn: {
    // ... (todo el contenido existente se mantiene igual)
    // NUEVAS CLAVES EN GUARANÍ
    integracionesTitulo: '🔌 Mbojoajuha Guasu',
    integracionesDesc: 'Embojopy umi mba\'e okáigua nde tallerre.',
    activo: 'OIKÓVA',
    activar: 'Embojopy',
    desactivar: 'Emboyke',
    obtenerLlave: '🔑 EHUPYTY NE LLAVE REI',
    pegaTuLlave: 'Emoĩ nde llave ápe',
    guardarYActivar: 'Ñongatu ha Embojopy',
    desactivarIntegracion: 'Emboyke mbojoajuha',
    volverAlCentro: '← Jevy Mbojoajuhápe',
    validandoLlave: 'Ojehecháta llave...',
    llaveInvalida: 'Ndaha\'éi llave oĩva\'erãicha',
    integracionActivada: '¡Mbojoajuha oiko porã!',
    integracionDesactivada: 'Mbojoajuha ojejokóma',
    confirmarDesactivar: '¿Embogueje ko mbojoajuha? Ikatu embojopy jey upéi.',
    kpisTitulo: '📊 Embosako\'i KPI-kuéra',
    kpisDesc: 'Eiporavo mba\'e kuaapyrã rehechase pantalla principal-pe.',
    guardarConfig: 'Ñongatu ñembosako\'i',
    configGuardada: 'Ñembosako\'i oñeñongatu',
    kpiClientes: 'Mborokuái opavave',
    kpiVehiculos: 'Mbyyrã opavave',
    kpiEnProgreso: 'Mboguataha oikóva',
    kpiHoy: 'Mboguataha ko\'ãra',
    kpiCreditos: 'Moñe\'ẽ oñemanteve',
    kpiIngresosMes: 'Pytyvõ ko ara peve',
    kpiGananciaNeta: 'Ganancia neta',
    kpiVehiculosHoy: 'Mbyyrã ko\'ãra',
    kpiStockBajo: 'Mboguata michĩ',
    modoTallerTitulo: '📺 Tembiapo Taller',
    tutorialTitulo: '🎓 Moñe\'ẽrã',
    tutorialPaso1: 'Ápe remoingove mbyyrã pyahu mbohapy párte ndahasýivape',
    tutorialPaso2: 'Ehepyme pya\'e mba\'erepy térã mba\'apo',
    tutorialPaso3: 'Ema\'e umi mba\'erã ko\'arape',
    tutorialPaso4: 'Arahaku pahápe, emboty la caja ha eikuaa mboypa reganahague',
    tutorialFinal: '¡Iporãma! Eikuaáma mba\'éichapa eiporu va\'erã ne taller',
    temaClaro: '☀️ Tembiecharã hesakãva',
    temaOscuro: '🌙 Tembiecharã ypytũva',
    exportarExcel: '📥 Mbogue Excel-pe',
    exportando: 'Oñemondo...',
    exportado: 'Oñemondo porã',
    recordatoriosTitulo: '📨 Embosako\'i marandu',
    recordatoriosGuardado: 'Marandu oñeñongatu',
    ocrTitulo: '📄 Ehecha factura',
    ocrProcesando: 'Ojehecha ta\'anga...',
    ocrExito: 'Factura ojehechakuaa',
    ocrError: 'Ndaikatúi ojehecha factura',
    googleCalendarTitulo: '📅 Google Arapapaha',
    googleConectar: 'Embojoaju Google mba\'ete',
    googleConectado: '✓ Ojejoaju Google Arapapaháre',
    googleSincronizado: 'Umi cita oñemoĩ joa',
    realtimeConectado: 'Oikojoa ára añónte',
    realtimeDesconectado: 'Ojejoko ára añónte',
    tutorialIniciar: 'Emoñepyrũ moñe\'ẽrã',
    tutorialOmitir: 'Eheja rei',
    checklistPlantillas: '📋 Plantilla jehechajey rehegua',
    nuevaPlantilla: 'Plantilla pyahu',
    editarPlantilla: 'Embosako\'i plantilla',
    eliminarPlantilla: 'Embogue plantilla',
    guardarPlantilla: 'Ñongatu plantilla',
    itemsPlantilla: 'Plantilla mba\'e',
    agregarItem: 'Embojoapy mba\'e',
  },
  pt: {
    // ... (todo el contenido existente se mantiene igual)
    // NUEVAS CLAVES EN PORTUGUÉS
    integracionesTitulo: '🔌 Centro de Integrações',
    integracionesDesc: 'Ative serviços externos para potencializar sua oficina.',
    activo: 'ATIVO',
    activar: 'Ativar',
    desactivar: 'Desativar',
    obtenerLlave: '🔑 OBTER MINHA CHAVE GRATUITA',
    pegaTuLlave: 'Cole sua chave aqui',
    guardarYActivar: 'Salvar e Ativar',
    desactivarIntegracion: 'Desativar integração',
    volverAlCentro: '← Voltar ao Centro',
    validandoLlave: 'Validando chave...',
    llaveInvalida: 'A chave não tem o formato correto',
    integracionActivada: 'Integração ativada com sucesso!',
    integracionDesactivada: 'Integração desativada',
    confirmarDesactivar: 'Desativar esta integração? Você poderá ativá-la novamente depois.',
    kpisTitulo: '📊 Configurar KPIs',
    kpisDesc: 'Selecione quais indicadores deseja ver na tela principal.',
    guardarConfig: 'Salvar configuração',
    configGuardada: 'Configuração salva',
    kpiClientes: 'Total de clientes',
    kpiVehiculos: 'Total de veículos',
    kpiEnProgreso: 'Trabalhos em andamento',
    kpiHoy: 'Trabalhos hoje',
    kpiCreditos: 'Créditos pendentes',
    kpiIngresosMes: 'Receita do mês',
    kpiGananciaNeta: 'Lucro líquido',
    kpiVehiculosHoy: 'Veículos hoje',
    kpiStockBajo: 'Alertas de estoque baixo',
    modoTallerTitulo: '📺 Modo Oficina',
    tutorialTitulo: '🎓 Tutorial',
    tutorialPaso1: 'Aqui você registra um veículo novo em 3 passos fáceis',
    tutorialPaso2: 'Cobre rápido produtos ou serviços',
    tutorialPaso3: 'Veja os agendamentos de hoje',
    tutorialPaso4: 'No fim do dia, feche o caixa e saiba quanto ganhou',
    tutorialFinal: 'Pronto! Você já sabe usar a oficina',
    temaClaro: '☀️ Modo claro',
    temaOscuro: '🌙 Modo escuro',
    exportarExcel: '📥 Exportar para Excel',
    exportando: 'Exportando...',
    exportado: 'Exportado com sucesso',
    recordatoriosTitulo: '📨 Configurar mensagens',
    recordatoriosGuardado: 'Mensagem salva',
    ocrTitulo: '📄 Digitalizar fatura',
    ocrProcesando: 'Processando imagem...',
    ocrExito: 'Fatura analisada',
    ocrError: 'Não foi possível ler a fatura',
    googleCalendarTitulo: '📅 Google Calendar',
    googleConectar: 'Conectar conta do Google',
    googleConectado: '✓ Conectado ao Google Calendar',
    googleSincronizado: 'Compromissos sincronizados',
    realtimeConectado: 'Sincronização em tempo real ativada',
    realtimeDesconectado: 'Sincronização em tempo real desativada',
    tutorialIniciar: 'Iniciar tutorial',
    tutorialOmitir: 'Pular',
    checklistPlantillas: '📋 Modelos de inspeção',
    nuevaPlantilla: 'Novo modelo',
    editarPlantilla: 'Editar modelo',
    eliminarPlantilla: 'Excluir modelo',
    guardarPlantilla: 'Salvar modelo',
    itemsPlantilla: 'Itens do modelo',
    agregarItem: 'Adicionar item',
  },
  en: {
    // ... (todo el contenido existente se mantiene igual)
    // NUEVAS CLAVES EN INGLÉS
    integracionesTitulo: '🔌 Integration Hub',
    integracionesDesc: 'Activate external services to empower your workshop.',
    activo: 'ACTIVE',
    activar: 'Activate',
    desactivar: 'Deactivate',
    obtenerLlave: '🔑 GET FREE KEY',
    pegaTuLlave: 'Paste your key here',
    guardarYActivar: 'Save and Activate',
    desactivarIntegracion: 'Deactivate integration',
    volverAlCentro: '← Back to Hub',
    validandoLlave: 'Validating key...',
    llaveInvalida: 'Invalid key format',
    integracionActivada: 'Integration activated successfully!',
    integracionDesactivada: 'Integration deactivated',
    confirmarDesactivar: 'Deactivate this integration? You can reactivate it later.',
    kpisTitulo: '📊 Configure KPIs',
    kpisDesc: 'Select which indicators to display on the main screen.',
    guardarConfig: 'Save configuration',
    configGuardada: 'Configuration saved',
    kpiClientes: 'Total clients',
    kpiVehiculos: 'Total vehicles',
    kpiEnProgreso: 'Jobs in progress',
    kpiHoy: 'Jobs today',
    kpiCreditos: 'Pending credits',
    kpiIngresosMes: 'Monthly income',
    kpiGananciaNeta: 'Net profit',
    kpiVehiculosHoy: 'Vehicles today',
    kpiStockBajo: 'Low stock alerts',
    modoTallerTitulo: '📺 Workshop Mode',
    tutorialTitulo: '🎓 Tutorial',
    tutorialPaso1: 'Here you register a new vehicle in 3 easy steps',
    tutorialPaso2: 'Quickly charge for products or services',
    tutorialPaso3: 'Check today\'s appointments',
    tutorialPaso4: 'At the end of the day, close the cash register and see your earnings',
    tutorialFinal: 'Done! You now know how to use the workshop',
    temaClaro: '☀️ Light mode',
    temaOscuro: '🌙 Dark mode',
    exportarExcel: '📥 Export to Excel',
    exportando: 'Exporting...',
    exportado: 'Exported successfully',
    recordatoriosTitulo: '📨 Configure messages',
    recordatoriosGuardado: 'Message saved',
    ocrTitulo: '📄 Scan invoice',
    ocrProcesando: 'Processing image...',
    ocrExito: 'Invoice analyzed',
    ocrError: 'Could not read invoice',
    googleCalendarTitulo: '📅 Google Calendar',
    googleConectar: 'Connect Google account',
    googleConectado: '✓ Connected to Google Calendar',
    googleSincronizado: 'Appointments synchronized',
    realtimeConectado: 'Real-time sync enabled',
    realtimeDesconectado: 'Real-time sync disabled',
    tutorialIniciar: 'Start tutorial',
    tutorialOmitir: 'Skip',
    checklistPlantillas: '📋 Inspection templates',
    nuevaPlantilla: 'New template',
    editarPlantilla: 'Edit template',
    eliminarPlantilla: 'Delete template',
    guardarPlantilla: 'Save template',
    itemsPlantilla: 'Template items',
    agregarItem: 'Add item',
  }
};

let idiomaActual = localStorage.getItem('tallerpro_lang') || 'es';

/**
 * Traduce una clave de idioma. Soporta interpolación de variables.
 * @param {string} key - Clave del diccionario
 * @param {object} params - Objeto con variables a reemplazar (ej: {nombre: 'Juan'})
 * @returns {string} Texto traducido
 */
const t = (key, params = {}) => {
  let text = IDIOMAS[idiomaActual]?.[key] || IDIOMAS['es'][key] || key;
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
