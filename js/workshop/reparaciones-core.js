// ─── CORE DE REPARACIONES (constantes y helpers) ─────────────────────────────
export const TIPOS_TRABAJO = [
  'Mecánica general', 'Cambio de aceite / Service', 'Frenos',
  'Suspensión / Tren delantero', 'Electricidad', 'Chapa y pintura',
  'Aire acondicionado', 'Diagnóstico', 'Otro'
];

export const TIPO_ICONS = {
  'Mecánica general':'🔧',
  'Cambio de aceite / Service':'🛢️',
  'Frenos':'🛑',
  'Suspensión / Tren delantero':'🔩',
  'Electricidad':'⚡',
  'Chapa y pintura':'🎨',
  'Aire acondicionado':'❄️',
  'Diagnóstico':'🔍',
  'Otro':'📋'
};

export function inicioSemana() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}
