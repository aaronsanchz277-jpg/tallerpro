// ════════════════════════════════════════════════════════════════
//  TALLERPRO — Gestión Inteligente de Talleres Mecánicos
//  Versión 2.1 | Supabase + Vanilla JS | Security Patch
// ════════════════════════════════════════════════════════════════

// ─── SEGURIDAD: Escape de HTML para prevenir XSS ─────────────────────────────
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
// Alias corto para usar en templates
const h = escapeHtml;

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

