#!/usr/bin/env node
/**
 * TallerPro — Chequeo de salud del frontend.
 *
 * Corré `node scripts/check.js` antes de publicar para detectar problemas
 * silenciosos típicos de un proyecto vanilla JS sin bundler:
 *
 *   ERROR (rompe el build, exit 1):
 *     - Funciones globales (window.X o function X top-level) definidas en
 *       2+ archivos: el segundo pisa al primero sin error y vuelven los
 *       bugs "antes funcionaba".
 *     - Items del sidebar que apuntan a páginas que no están en el mapa
 *       de navigate(): el botón existe pero no hace nada al clickearlo.
 *
 *   AVISO (no rompe, sólo alerta):
 *     - Archivos JS de más de 40 KB: candidatos a partir.
 *     - Comentarios sospechosos: `// 👈`, `// FIXME`, `// XXX`, `// HACK`.
 *
 * Diseñado para ser cero-dependencias: usa solo Node nativo, ningún
 * `npm install` requerido. No modifica archivos.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');
const NAV_FILE = path.join(JS_DIR, 'navigation', 'navigation.js');

// ─── Helpers ───────────────────────────────────────────────────────────────

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && full.endsWith('.js')) yield full;
  }
}

function rel(p) { return path.relative(ROOT, p); }

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m',
  cyan: '\x1b[36m', gray: '\x1b[90m',
};
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (col, s) => useColor ? `${C[col]}${s}${C.reset}` : s;

// ─── Recolección ───────────────────────────────────────────────────────────

const files = [...walk(JS_DIR)].sort();
const filesData = files.map(p => {
  const content = fs.readFileSync(p, 'utf8');
  return {
    path: p,
    rel: rel(p),
    content,
    lines: content.split('\n'),
    bytes: Buffer.byteLength(content, 'utf8'),
  };
});

const totalLines = filesData.reduce((s, f) => s + f.lines.length, 0);
const totalBytes = filesData.reduce((s, f) => s + f.bytes, 0);

// ─── Check 1: funciones globales duplicadas ────────────────────────────────
// Detectamos:
//   function X(...)              al inicio de línea (top-level declaration)
//   window.X = function          asignación explícita global
//   window.X = async function    idem async
//
// Ignoramos definiciones dentro de funciones / objetos / clases (ese matching
// con regex es heurístico — buscamos solo top-level por estética del código).

const fnDefs = new Map(); // name -> [{file, line}]

const RE_FN_DECL  = /^function\s+([A-Za-z_$][\w$]*)\s*\(/;
const RE_WINDOW   = /^window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function/;
const RE_VAR_FN   = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function/;

for (const f of filesData) {
  for (let i = 0; i < f.lines.length; i++) {
    const line = f.lines[i];
    let m;
    if ((m = RE_FN_DECL.exec(line))) addFn(m[1], f.rel, i + 1);
    else if ((m = RE_WINDOW.exec(line))) addFn(m[1], f.rel, i + 1);
    else if ((m = RE_VAR_FN.exec(line))) addFn(m[1], f.rel, i + 1);
  }
}
function addFn(name, file, line) {
  if (!fnDefs.has(name)) fnDefs.set(name, []);
  fnDefs.get(name).push({ file, line });
}

const collisions = [];
for (const [name, defs] of fnDefs) {
  // Una colisión real implica archivos distintos (no múltiples sobrecargas
  // dentro de un mismo archivo, que son patrones legítimos de feature flag).
  const distinctFiles = new Set(defs.map(d => d.file));
  if (distinctFiles.size > 1) collisions.push({ name, defs });
}

// ─── Check 2: items del sidebar apuntan a páginas válidas ──────────────────

let sidebarErrors = [];
try {
  const navContent = fs.readFileSync(NAV_FILE, 'utf8');
  // Extraer todos los `id:'algo'` dentro del bloque buildNav (hasta navigate).
  const buildNavMatch = navContent.match(/function buildNav\([\s\S]*?(?=async function navigate)/);
  const buildNavCode = buildNavMatch ? buildNavMatch[0] : '';
  // Solo nos interesan ítems cuyo click llama navigate(id). Si el ítem
  // declara `onclick:` propio (ej. modales), su `id` es solo el sufijo del
  // HTML id="side-..." y no necesita estar en el mapa de páginas.
  const sidebarIds = new Set();
  const RE_ITEM = /\{\s*id\s*:\s*'([^']+)'[^}]*\}/g;
  let m;
  while ((m = RE_ITEM.exec(buildNavCode)) !== null) {
    const block = m[0];
    if (/\bonclick\s*:/.test(block)) continue; // tiene handler propio
    if (m[1] === 'null') continue;
    sidebarIds.add(m[1]);
  }

  // Extraer las claves del objeto `pages = { ... }` dentro de navigate()
  const pagesMatch = navContent.match(/const pages\s*=\s*\{([\s\S]*?)\n\s*\};/);
  const pagesBlock = pagesMatch ? pagesMatch[1] : '';
  const pageKeys = new Set();
  // shorthand: `dashboard,` o `presupuestos,`
  for (const m2 of pagesBlock.matchAll(/\b([A-Za-z_$][\w$]*)\s*,/g)) pageKeys.add(m2[1]);
  // explicit:  `'algo': fn`
  for (const m2 of pagesBlock.matchAll(/'([^']+)'\s*:/g)) pageKeys.add(m2[1]);
  // último ítem sin coma final
  for (const m2 of pagesBlock.matchAll(/\b([A-Za-z_$][\w$]*)\s*$/gm)) pageKeys.add(m2[1]);

  for (const id of sidebarIds) {
    if (!pageKeys.has(id)) sidebarErrors.push(id);
  }
} catch (e) {
  sidebarErrors = null; // no pudimos verificar
}

// ─── Check 3: archivos grandes ──────────────────────────────────────────────

const BIG_KB = 40;
const bigFiles = filesData
  .filter(f => f.bytes > BIG_KB * 1024)
  .sort((a, b) => b.bytes - a.bytes);

// ─── Check 4: comentarios sospechosos ──────────────────────────────────────

const suspicious = [];
const RE_SUS = /\/\/.*?(👈|FIXME|XXX|HACK)\b/i;
for (const f of filesData) {
  for (let i = 0; i < f.lines.length; i++) {
    const line = f.lines[i];
    if (RE_SUS.test(line)) {
      suspicious.push({ file: f.rel, line: i + 1, text: line.trim().slice(0, 100) });
    }
  }
}

// ─── Reporte ────────────────────────────────────────────────────────────────

console.log();
console.log(c('bold', c('cyan', 'TallerPro — Chequeo de salud del frontend')));
console.log(c('gray', '─'.repeat(56)));
console.log(`Archivos JS: ${c('bold', files.length)}  ·  Líneas: ${c('bold', totalLines.toLocaleString())}  ·  Tamaño: ${c('bold', (totalBytes / 1024).toFixed(0) + ' KB')}`);
console.log();

let errors = 0;
let warnings = 0;

// 1. colisiones
if (collisions.length === 0) {
  console.log(c('green', '✓ Funciones globales: sin colisiones'));
} else {
  console.log(c('red', `✗ ${collisions.length} función(es) global(es) definida(s) en 2+ archivos:`));
  for (const { name, defs } of collisions.slice(0, 20)) {
    console.log(`  ${c('bold', name)}()`);
    for (const d of defs) console.log(c('gray', `    └─ ${d.file}:${d.line}`));
  }
  if (collisions.length > 20) console.log(c('gray', `  ... y ${collisions.length - 20} más`));
  errors += collisions.length;
}
console.log();

// 2. sidebar
if (sidebarErrors === null) {
  console.log(c('yellow', '? Sidebar: no se pudo verificar (estructura inesperada en navigation.js)'));
  warnings++;
} else if (sidebarErrors.length === 0) {
  console.log(c('green', '✓ Sidebar: todos los ítems apuntan a páginas válidas'));
} else {
  console.log(c('red', `✗ Sidebar: ${sidebarErrors.length} ítem(s) sin página correspondiente:`));
  for (const id of sidebarErrors) console.log(c('gray', `    └─ id: '${id}'`));
  errors += sidebarErrors.length;
}
console.log();

// 3. tamaño
if (bigFiles.length === 0) {
  console.log(c('green', `✓ Tamaño de archivos: ninguno supera ${BIG_KB} KB`));
} else {
  console.log(c('yellow', `! ${bigFiles.length} archivo(s) >${BIG_KB} KB (candidatos a dividir):`));
  for (const f of bigFiles) {
    const kb = (f.bytes / 1024).toFixed(1);
    console.log(c('gray', `    └─ ${f.rel}  (${kb} KB · ${f.lines.length} líneas)`));
  }
  warnings += bigFiles.length;
}
console.log();

// 4. comentarios
if (suspicious.length === 0) {
  console.log(c('green', '✓ Comentarios: sin marcadores sospechosos (👈 / FIXME / XXX / HACK)'));
} else {
  console.log(c('yellow', `! ${suspicious.length} comentario(s) sospechoso(s):`));
  for (const s of suspicious.slice(0, 15)) {
    console.log(c('gray', `    └─ ${s.file}:${s.line}  ${s.text}`));
  }
  if (suspicious.length > 15) console.log(c('gray', `    ... y ${suspicious.length - 15} más`));
  warnings += suspicious.length;
}
console.log();

// ─── Resumen ───────────────────────────────────────────────────────────────

console.log(c('gray', '─'.repeat(56)));
const summary = `Resultado: ${errors} error(es), ${warnings} aviso(s)`;
if (errors > 0) {
  console.log(c('red', c('bold', '✗ ' + summary)));
  process.exit(1);
} else if (warnings > 0) {
  console.log(c('yellow', c('bold', '! ' + summary)));
  process.exit(0);
} else {
  console.log(c('green', c('bold', '✓ ' + summary)));
  process.exit(0);
}
