// ─── CATEGORÍAS FINANCIERAS CENTRALIZADAS ─────────────────────────────────────
let _categoriasCache = null;
let _cacheTimestamp = 0;
const CACHE_TTL = 60000;

export async function obtenerCategoriaFinanciera(nombre, tipo = 'egreso') {
  if (!tid()) return null;

  const now = Date.now();
  if (_categoriasCache && (now - _cacheTimestamp) < CACHE_TTL) {
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

export async function inicializarCategoriasFijas() {
  const categorias = [
    { nombre: 'Reparaciones', tipo: 'ingreso', es_fija: true },
    { nombre: 'Servicios', tipo: 'ingreso', es_fija: true },
    { nombre: 'Otros ingresos', tipo: 'ingreso', es_fija: true },
    { nombre: 'Repuestos', tipo: 'egreso', es_fija: true },
    { nombre: 'Sueldos', tipo: 'egreso', es_fija: true },
    { nombre: 'Alquiler', tipo: 'egreso', es_fija: true },
    { nombre: 'Servicios básicos', tipo: 'egreso', es_fija: true },
    { nombre: 'Gastos personales', tipo: 'egreso', es_fija: true },
    { nombre: 'Vales/Adelantos', tipo: 'egreso', es_fija: true },
    { nombre: 'Otros egresos', tipo: 'egreso', es_fija: true }
  ];

  for (const cat of categorias) {
    const { data: existe } = await sb
      .from('categorias_financieras')
      .select('id')
      .eq('taller_id', tid())
      .eq('nombre', cat.nombre)
      .maybeSingle();
    if (!existe) {
      await sb.from('categorias_financieras').insert({ ...cat, taller_id: tid() });
    }
  }
  _categoriasCache = null;
}
