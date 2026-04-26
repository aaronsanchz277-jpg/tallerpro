// ════════════════════════════════════════════════════════════════
//  TALLERPRO — Gestión Inteligente de Talleres Mecánicos
//  Versión 2.1 | Supabase + Vanilla JS | Security Patch
// ════════════════════════════════════════════════════════════════

// ─── SEGURIDAD: Escape de HTML para prevenir XSS ─────────────────────────────
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  // Reemplazo manual de caracteres peligrosos (más rápido que crear un div)
  return s.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  }).replace(/[\"]/g, '&quot;')
    .replace(/[\']/g, '&#39;');
}
const h = escapeHtml;

// ─── SEGURIDAD: Escape combinado HTML-attr + JS-string ───────────────────────
// Para uso dentro de atributos delimitados por dobles comillas que interpolan
// strings de usuario como argumentos JS, p.ej.:
//   onclick="foo('${hjs(name)}')"
// Aplica DOS capas de escape (orden importa, porque el HTML-parser corre primero
// y luego el JS-parser):
//   1) JS-string escape — neutraliza el cierre del string ('), backslashes y
//      separadores de línea (incl. U+2028/U+2029, que son line terminators en JS).
//   2) HTML-attribute escape — neutraliza el cierre de atributo (") y todos los
//      metacaracteres HTML, evitando que un " en el dato cierre el atributo.
function escapeHtmlJs(str) {
  if (str === null || str === undefined) return '';
  const jsEscaped = String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return jsEscaped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
const hjs = escapeHtmlJs;

// ─── BÚSQUEDA: resaltado de coincidencias seguro contra XSS ──────────────────
// Devuelve HTML escapado donde los tokens del término aparecen envueltos en
// <mark class="hl">…</mark>. Hacemos el matching sobre el string original
// (case-insensitive) y luego escapamos cada segmento por separado, así nunca
// inyectamos HTML sin pasar por escapeHtml.
//
// Hace dos pasadas y une los rangos:
//   1) Match literal case-insensitive por token (regex).
//   2) Match "compacto" para tokens sin espacios/guiones: caminamos el texto
//      ignorando `-` y espacios en él, así "ab123" resalta "AB-123" en un
//      título tipo "AB-123 · TOYOTA" (mismo criterio que matchCompact en el
//      palette).
function highlightMatch(text, term) {
  if (text === null || text === undefined) return '';
  const s = String(text);
  const t = (term === null || term === undefined) ? '' : String(term).trim();
  if (!t) return escapeHtml(s);
  const tokens = t.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return escapeHtml(s);

  const ranges = []; // pares [start, end) sobre s

  // 1) Pasada literal con regex (case-insensitive).
  const escRe = tokens
    .map(tok => tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  try {
    const re = new RegExp(`(${escRe})`, 'gi');
    let m;
    while ((m = re.exec(s)) !== null) {
      if (m[0].length > 0) ranges.push([m.index, m.index + m[0].length]);
      if (m[0].length === 0) re.lastIndex++;
    }
  } catch (_) { /* token raro: seguimos sin match literal */ }

  // 2) Pasada compacta: tokens alfanuméricos (sin separadores) matchean
  //    ignorando `-` y espacios dentro del texto, pensado para patentes
  //    tipo "AB-123" cuando el usuario tipea "ab123". Limitamos a tokens
  //    de al menos 2 chars y sólo alfanuméricos para evitar marcar de más.
  const sL = s.toLowerCase();
  for (const tok of tokens) {
    if (tok.length < 2) continue;
    if (!/^[a-zA-Z0-9]+$/.test(tok)) continue;
    const tokC = tok.toLowerCase();
    let i = 0;
    while (i < sL.length) {
      // No arrancar el match en un separador, así no nos comemos espacios o
      // guiones al principio del rango resaltado.
      if (sL[i] === '-' || sL[i] === ' ') { i++; continue; }
      let j = i, k = 0;
      while (j < sL.length && k < tokC.length) {
        const c = sL[j];
        if (c === '-' || c === ' ') { j++; continue; }
        if (c !== tokC[k]) break;
        j++; k++;
      }
      if (k === tokC.length) {
        ranges.push([i, j]);
        i = j > i ? j : i + 1;
      } else {
        i++;
      }
    }
  }

  if (ranges.length === 0) return escapeHtml(s);

  // Mergeamos rangos solapados/adyacentes.
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const [a, b] of ranges) {
    const top = merged[merged.length - 1];
    if (top && a <= top[1]) top[1] = Math.max(top[1], b);
    else merged.push([a, b]);
  }

  let out = '';
  let last = 0;
  for (const [a, b] of merged) {
    if (a > last) out += escapeHtml(s.slice(last, a));
    out += '<mark class="hl">' + escapeHtml(s.slice(a, b)) + '</mark>';
    last = b;
  }
  if (last < s.length) out += escapeHtml(s.slice(last));
  return out;
}
const hh = highlightMatch;

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://uggqqmsmxvafeyyinuir.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QYoTP02Bh4tEhV_zkQkFVQ_rWXx0hBu';
const _sbRaw = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Interceptor global: detectar sesión expirada en cualquier query
const sb = new Proxy(_sbRaw, {
  get(target, prop) {
    const val = target[prop];
    if (prop === 'from') {
      return function(...args) {
        const chain = val.apply(target, args);
        return _wrapChain(chain);
      };
    }
    return val;
  }
});

function _wrapChain(chain) {
  return new Proxy(chain, {
    get(target, prop) {
      const val = target[prop];
      if (typeof val !== 'function') return val;
      return function(...args) {
        const result = val.apply(target, args);
        // Si devuelve una Promise (query final como .single(), .maybeSingle(), etc)
        if (result && typeof result.then === 'function' && !result.eq && !result.select) {
          return result.then(res => {
            if (res?.error && (res.error.code === 'PGRST301' || res.error.message?.includes('JWT expired') || res.error.message?.includes('Invalid Refresh Token'))) {
              console.warn('Session expired detected in query');
              toast('Tu sesión expiró. Volvé a iniciar sesión.','error');
              setTimeout(() => logout(), 500);
            }
            return res;
          });
        }
        // Si devuelve otro builder (encadenable), seguir wrapping
        if (result && typeof result === 'object' && (result.eq || result.select || result.order || result.limit || result.insert || result.update || result.delete || result.upsert)) {
          return _wrapChain(result);
        }
        return result;
      };
    }
  });
}

