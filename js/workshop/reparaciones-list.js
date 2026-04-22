// En reparaciones-list.js
async function reparaciones({ filtro='todos', search='', offset=0, tipo='', mecanico='' }={}) {
  const cacheKey = `reparaciones_${filtro}_${search}_${offset}_${tipo}_${mecanico}`;
  const { data, count } = await cachedQuery(cacheKey, async () => {
    let q = sb.from('reparaciones')
      .select('*, vehiculos(patente,marca), clientes(nombre)', {count:'exact'})
      .eq('taller_id', tid())
      .order('created_at', {ascending: false});

    // 🔍 Filtro por mecánico
    if (mecanico) {
      const { data: asignaciones } = await sb.from('reparacion_mecanicos')
        .select('reparacion_id')
        .or(`mecanico_id.eq.${mecanico},empleado_id.eq.${mecanico}`);
      const repIds = (asignaciones || []).map(a => a.reparacion_id);
      if (repIds.length) q = q.in('id', repIds);
      else q = q.in('id', ['00000000-0000-0000-0000-000000000000']); // fuerza vacío
    }

    if (filtro === 'hoy') q = q.eq('fecha', new Date().toISOString().split('T')[0]);
    else if (filtro === 'semana') q = q.gte('fecha', inicioSemana());
    else if (filtro === 'mes') q = q.gte('fecha', primerDiaMes());
    else if (filtro !== 'todos') q = q.eq('estado', filtro);
    if (tipo) q = q.eq('tipo_trabajo', tipo);
    if (search) q = q.ilike('descripcion', `%${search}%`);
    return q.range(offset, offset + PAGE_SIZE - 1);
  });

  // Resto del renderizado igual...
  document.getElementById('main-content').innerHTML = `...`;
}
