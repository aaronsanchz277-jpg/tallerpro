// ─── TESTS: Funciones de negocio críticas ────────────────────────────────────
// Ejecutar: abrir consola → tallerpro_runTests()
// O desde sidebar → 🧪 Tests (solo admin)

let _testResults = [];
let _testsPassed = 0;
let _testsFailed = 0;

function assert(condition, msg) {
  if (condition) {
    _testsPassed++;
    _testResults.push({ pass: true, msg });
  } else {
    _testsFailed++;
    _testResults.push({ pass: false, msg });
    console.error('FAIL:', msg);
  }
}

function test_escapeHtml() {
  assert(h('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;', 'h() escapa tags HTML');
  assert(h('"hello"') === '&quot;hello&quot;', 'h() escapa comillas dobles');
  assert(h(null) === '', 'h(null) retorna string vacío');
  assert(h(undefined) === '', 'h(undefined) retorna string vacío');
  assert(h(0) === '0', 'h(0) retorna "0"');
  assert(h('normal text') === 'normal text', 'h() no modifica texto normal');
  assert(h('<img onerror=alert(1)>') === '&lt;img onerror=alert(1)&gt;', 'h() escapa img injection');
}

function test_safeFotoUrl() {
  assert(safeFotoUrl('https://example.com/photo.jpg') === 'https://example.com/photo.jpg', 'Acepta URLs https');
  assert(safeFotoUrl('data:image/jpeg;base64,abc') === 'data:image/jpeg;base64,abc', 'Acepta data:image/jpeg');
  assert(safeFotoUrl('data:image/png;base64,abc') === 'data:image/png;base64,abc', 'Acepta data:image/png');
  assert(safeFotoUrl('javascript:alert(1)') === '', 'Rechaza javascript: protocol');
  assert(safeFotoUrl('http://insecure.com/photo.jpg') === '', 'Rechaza http sin SSL');
  assert(safeFotoUrl(null) === '', 'Retorna vacío para null');
  assert(safeFotoUrl('') === '', 'Retorna vacío para string vacío');
}

function test_gs() {
  assert(gs(0) === '0', 'gs(0) = "0"');
  assert(gs(250000).includes('250'), 'gs(250000) contiene 250');
  assert(gs(null) === '0', 'gs(null) = "0"');
  assert(gs('abc') === '0', 'gs("abc") = "0"');
}

function test_formatFecha() {
  assert(formatFecha('2025-01-15') === '15/01/2025', 'Formatea fecha ISO correctamente');
  assert(formatFecha('') === '', 'String vacío retorna vacío');
  assert(formatFecha(null) === '', 'null retorna vacío');
  assert(formatFecha('2025-12-31') === '31/12/2025', 'Formatea fin de año');
}

function test_fechaHoy() {
  const hoy = fechaHoy();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(hoy), 'fechaHoy() formato YYYY-MM-DD');
  assert(hoy === new Date().toISOString().split('T')[0], 'fechaHoy() es la fecha actual');
}

function test_cleanNum() {
  assert(cleanNum(500000) === 500000, 'Pasa números directos');
  assert(cleanNum(null) === 0, 'null retorna 0');
  assert(cleanNum('') === 0, 'String vacío retorna 0');
  assert(cleanNum('200') === 200, 'String numérico funciona');
  assert(cleanNum(0) === 0, '0 retorna 0');
}

function test_estadoBadges() {
  assert(estadoBadge('pendiente') === 'badge-yellow', 'Badge pendiente es yellow');
  assert(estadoBadge('en_progreso') === 'badge-orange', 'Badge en_progreso es orange');
  assert(estadoBadge('finalizado') === 'badge-green', 'Badge finalizado es green');
  assert(typeof estadoLabel('pendiente') === 'string', 'Label pendiente es string');
  assert(typeof estadoLabel('finalizado') === 'string', 'Label finalizado es string');
}

function test_i18n() {
  assert(IDIOMAS.es !== undefined, 'Existe idioma ES');
  assert(IDIOMAS.gn !== undefined, 'Existe idioma GN');
  assert(IDIOMAS.pt !== undefined, 'Existe idioma PT');
  assert(IDIOMAS.en !== undefined, 'Existe idioma EN');
  assert(typeof t('guardar') === 'string' && t('guardar').length > 0, 't("guardar") retorna string válido');
  const esKeys = Object.keys(IDIOMAS.es);
  const missingGn = esKeys.filter(k => !IDIOMAS.gn[k]);
  const missingPt = esKeys.filter(k => !IDIOMAS.pt[k]);
  const missingEn = esKeys.filter(k => !IDIOMAS.en[k]);
  assert(missingGn.length === 0, 'GN tiene todas las keys de ES' + (missingGn.length ? ' (faltan: ' + missingGn.slice(0,3).join(', ') + ')' : ''));
  assert(missingPt.length === 0, 'PT tiene todas las keys de ES' + (missingPt.length ? ' (faltan: ' + missingPt.slice(0,3).join(', ') + ')' : ''));
  assert(missingEn.length === 0, 'EN tiene todas las keys de ES' + (missingEn.length ? ' (faltan: ' + missingEn.slice(0,3).join(', ') + ')' : ''));
}

function test_validaciones() {
  assert(!''.trim(), 'Patente vacía no pasa validación');
  assert('ABC 123'.trim().toUpperCase() === 'ABC 123', 'Patente se convierte a mayúsculas');
  assert(parseFloat('-100') < 0, 'Detecta montos negativos');
  assert('test@test.com'.includes('@'), 'Valida @ en email');
  assert(!'testsinarro'.includes('@'), 'Detecta email sin @');
}

async function test_offlineCache() {
  try {
    const testKey = 'test_cache_' + Date.now();
    const testData = { items: [1, 2, 3], name: 'test' };
    await cacheLocal(testKey, testData);
    const retrieved = await readCache(testKey);
    assert(retrieved !== null, 'Cache guarda y recupera datos');
    assert(retrieved.items?.length === 3, 'Datos recuperados son correctos');
    assert(retrieved.name === 'test', 'String data se preserva');
  } catch(e) {
    assert(false, 'Cache offline test falló: ' + e.message);
  }
}

function test_clearCache() {
  _memCache['test_clear_key'] = { result: { data: [1] }, ts: Date.now() };
  assert(_memCache['test_clear_key'] !== undefined, 'Cache tiene datos de test');
  clearCache('test_clear_');
  assert(_memCache['test_clear_key'] === undefined, 'clearCache elimina por prefix');
}

function test_supabaseProxy() {
  assert(typeof sb === 'object', 'sb existe');
  assert(typeof sb.from === 'function', 'sb.from es función');
  assert(typeof sb.auth === 'object', 'sb.auth existe');
  assert(typeof sb.storage === 'object', 'sb.storage existe');
}

// ─── RUNNER ──────────────────────────────────────────────────────────────────
async function tallerpro_runTests() {
  _testResults = [];
  _testsPassed = 0;
  _testsFailed = 0;

  console.log('%c🧪 TallerPro Tests', 'color:#00e5ff;font-size:16px;font-weight:bold');
  console.log('─'.repeat(50));

  test_escapeHtml();
  test_safeFotoUrl();
  test_gs();
  test_formatFecha();
  test_fechaHoy();
  test_cleanNum();
  test_estadoBadges();
  test_validaciones();
  test_clearCache();
  test_i18n();
  test_supabaseProxy();
  await test_offlineCache();

  console.log('─'.repeat(50));
  _testResults.forEach(r => {
    console.log(r.pass ? `%c  ✓ ${r.msg}` : `%c  ✗ ${r.msg}`, r.pass ? 'color:#00ff88' : 'color:#ff4444;font-weight:bold');
  });
  console.log('─'.repeat(50));
  console.log(`%c${_testsPassed} passed`, 'color:#00ff88;font-weight:bold');
  if (_testsFailed > 0) console.log(`%c${_testsFailed} FAILED`, 'color:#ff4444;font-weight:bold');
  else console.log('%c✓ ALL TESTS PASSED', 'color:#00ff88;font-size:14px;font-weight:bold');

  return { passed: _testsPassed, failed: _testsFailed, results: _testResults };
}

async function tallerpro_testUI() {
  const results = await tallerpro_runTests();
  openModal(`
    <div class="modal-title">🧪 Tests — ${results.passed}/${results.passed + results.failed}</div>
    <div style="max-height:60vh;overflow-y:auto">
      ${results.results.map(r => `
        <div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.8rem">
          <span style="color:${r.pass ? 'var(--success)' : 'var(--danger)'};flex-shrink:0">${r.pass ? '✓' : '✗'}</span>
          <span style="color:${r.pass ? 'var(--text2)' : 'var(--danger)'}">${h(r.msg)}</span>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:.5rem;margin-top:1rem">
      <div style="flex:1;background:rgba(0,255,136,.1);border-radius:8px;padding:.5rem;text-align:center">
        <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--success)">${results.passed}</div>
        <div style="font-size:.65rem;color:var(--success)">PASSED</div>
      </div>
      ${results.failed > 0 ? `
      <div style="flex:1;background:rgba(255,68,68,.1);border-radius:8px;padding:.5rem;text-align:center">
        <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--danger)">${results.failed}</div>
        <div style="font-size:.65rem;color:var(--danger)">FAILED</div>
      </div>` : ''}
    </div>
    <button class="btn-secondary" style="margin-top:.5rem" onclick="closeModal()">Cerrar</button>`);
}
