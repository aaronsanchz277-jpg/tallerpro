// ─── CATEGORÍAS FINANCIERAS CENTRALIZADAS ─────────────────────────────────────
let _categoriasCache = null;
let _cacheTimestampCat = 0;  // renombrado también

async function obtenerCategoriaFinanciera(nombre, tipo = 'egreso') {
  if (!tid()) return null;

  const now = Date.now();
  if (_categoriasCache && (now - _cacheTimestampCat) < 60000) {
    const encontrada = _categoriasCache.find(c => c.nombre === nombre);
    if (encontrada) return encontrada.id;
  }

  const { data: existente } = await sb
    .from('categorias_financieras')
    .select('id')
    .eq('taller_id', tid())
    .eq('nombre', nombre)
    .maybeSingle();

  if (existente) return existente.id;

  const { data: nueva, error } = await sb
    .from('categorias_financieras')
    .insert({ taller_id: tid(), nombre, tipo, es_fija: false })
    .select('id')
    .single();

  if (error) {
    console.error('Error creando categoría financiera:', error);
    return null;
  }

  _categoriasCache = null;
  return nueva.id;
}

// (resto del archivo igual, sin CACHE_TTL ni inicializarCategoriasFijas si no se usa)
