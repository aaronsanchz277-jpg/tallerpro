-- ═══════════════════════════════════════════════════════════
--  TALLERPRO — MIGRATIONS: MOD-1 Finanzas, MOD-2 Mecánicos, MOD-3 Barcode
--  EJECUTAR EN ORDEN: 1 → 2 → 3 → 4 → 5 → 6
-- ═══════════════════════════════════════════════════════════

-- ═══ MIGRATION 1: Categorías financieras ═══
CREATE TABLE IF NOT EXISTS categorias_financieras (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  taller_id uuid NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'ambos')),
  es_fija boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categorias_financieras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_fin_select" ON categorias_financieras FOR SELECT
  USING (taller_id IN (SELECT taller_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "cat_fin_insert" ON categorias_financieras FOR INSERT
  WITH CHECK (taller_id IN (SELECT taller_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "cat_fin_update" ON categorias_financieras FOR UPDATE
  USING (taller_id IN (SELECT taller_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "cat_fin_delete" ON categorias_financieras FOR DELETE
  USING (taller_id IN (SELECT taller_id FROM perfiles WHERE id = auth.uid()) AND es_fija = false);

CREATE INDEX idx_cat_fin_taller ON categorias_financieras(taller_id);


-- ═══ MIGRATION 2: Movimientos financieros (ingresos y egresos) ═══
CREATE TABLE IF NOT EXISTS movimientos_financieros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  taller_id uuid NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  monto numeric NOT NULL CHECK (monto > 0),
  concepto text NOT NULL,
  categoria_id uuid REFERENCES categorias_financieras(id) ON DELETE SET NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  notas text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE movimientos_financieros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mov_fin_select" ON movimientos_financieros FOR SELECT
  USING (taller_id IN (SELECT taller_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "mov_fin_insert" ON movimientos_financieros FOR INSERT
  WITH CHECK (taller_id IN (SELECT taller_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "mov_fin_update" ON movimientos_financieros FOR UPDATE
  USING (taller_id IN (SELECT taller_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "mov_fin_delete" ON movimientos_financieros FOR DELETE
  USING (taller_id IN (SELECT taller_id FROM perfiles WHERE id = auth.uid()));

CREATE INDEX idx_mov_fin_taller ON movimientos_financieros(taller_id);
CREATE INDEX idx_mov_fin_fecha ON movimientos_financieros(taller_id, fecha);
CREATE INDEX idx_mov_fin_tipo ON movimientos_financieros(taller_id, tipo);


-- ═══ MIGRATION 3: Función get_balance ═══
CREATE OR REPLACE FUNCTION get_balance(p_taller_id uuid, p_fecha_inicio date, p_fecha_fin date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ingresos numeric;
  v_egresos numeric;
BEGIN
  SELECT COALESCE(SUM(monto), 0) INTO v_ingresos
  FROM movimientos_financieros
  WHERE taller_id = p_taller_id AND tipo = 'ingreso'
    AND fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  SELECT COALESCE(SUM(monto), 0) INTO v_egresos
  FROM movimientos_financieros
  WHERE taller_id = p_taller_id AND tipo = 'egreso'
    AND fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  RETURN jsonb_build_object(
    'total_ingresos', v_ingresos,
    'total_egresos', v_egresos,
    'balance_neto', v_ingresos - v_egresos
  );
END;
$$;


-- ═══ MIGRATION 4: Tabla mecánicos por reparación (reemplaza asignado_a) ═══
CREATE TABLE IF NOT EXISTS reparacion_mecanicos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reparacion_id uuid NOT NULL REFERENCES reparaciones(id) ON DELETE CASCADE,
  mecanico_id uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  horas numeric DEFAULT 0,
  notas text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(reparacion_id, mecanico_id)
);

ALTER TABLE reparacion_mecanicos ENABLE ROW LEVEL SECURITY;

-- RLS via reparaciones.taller_id
CREATE POLICY "rep_mec_select" ON reparacion_mecanicos FOR SELECT
  USING (reparacion_id IN (
    SELECT id FROM reparaciones WHERE taller_id IN (
      SELECT taller_id FROM perfiles WHERE id = auth.uid()
    )
  ));
CREATE POLICY "rep_mec_insert" ON reparacion_mecanicos FOR INSERT
  WITH CHECK (reparacion_id IN (
    SELECT id FROM reparaciones WHERE taller_id IN (
      SELECT taller_id FROM perfiles WHERE id = auth.uid()
    )
  ));
CREATE POLICY "rep_mec_update" ON reparacion_mecanicos FOR UPDATE
  USING (reparacion_id IN (
    SELECT id FROM reparaciones WHERE taller_id IN (
      SELECT taller_id FROM perfiles WHERE id = auth.uid()
    )
  ));
CREATE POLICY "rep_mec_delete" ON reparacion_mecanicos FOR DELETE
  USING (reparacion_id IN (
    SELECT id FROM reparaciones WHERE taller_id IN (
      SELECT taller_id FROM perfiles WHERE id = auth.uid()
    )
  ));

CREATE INDEX idx_rep_mec_rep ON reparacion_mecanicos(reparacion_id);
CREATE INDEX idx_rep_mec_mec ON reparacion_mecanicos(mecanico_id);


-- ═══ MIGRATION 5: Campo codigo_barras en inventario ═══
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS codigo_barras text;
CREATE INDEX idx_inv_barcode ON inventario(codigo_barras) WHERE codigo_barras IS NOT NULL;


-- ═══ MIGRATION 6: Insertar categorías fijas por defecto ═══
-- (ejecutar después de que el taller ya exista — o ejecutar manualmente por taller)
-- Se insertan con un INSERT que NO falla si ya existen (ON CONFLICT DO NOTHING)
-- Nota: Esto se ejecutará desde JS al crear un taller nuevo
-- Las categorías fijas son:
--   Ingresos: Reparaciones, Servicios, Otros ingresos
--   Egresos: Repuestos, Sueldos, Alquiler, Servicios básicos, Otros egresos
