-- ============================================================================
-- TallerPro · Seguridad a nivel de servidor (Row Level Security)
-- ----------------------------------------------------------------------------
-- Este script es para correrlo en el SQL editor de Supabase (Project → SQL).
-- Hace dos cosas:
--   1) Agrega la columna `permisos` (jsonb) en la tabla `perfiles`.
--   2) Activa RLS en todas las tablas con datos del taller y crea las
--      políticas necesarias para que cada usuario solo vea lo que le toca.
--
-- Es seguro correrlo varias veces: usa IF NOT EXISTS / DROP POLICY IF EXISTS.
-- Recomendado: ejecutar en orden, validando que la app sigue funcionando
-- después de cada bloque (tablas críticas primero).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0) Migración: columna `permisos` en perfiles
-- ---------------------------------------------------------------------------
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS permisos jsonb DEFAULT '{}'::jsonb;

-- Default razonable: todo en NO. El admin habilita lo que confía.
UPDATE perfiles SET permisos = '{}'::jsonb WHERE permisos IS NULL;


-- ---------------------------------------------------------------------------
-- 1) Helpers (funciones SECURITY DEFINER) para evitar recursión en RLS
-- ---------------------------------------------------------------------------
-- Devuelve el taller_id del usuario actual (basado en su perfil).
CREATE OR REPLACE FUNCTION public.taller_id_actual()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT taller_id FROM perfiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Devuelve el rol del usuario actual.
CREATE OR REPLACE FUNCTION public.rol_actual()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM perfiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ¿Es admin?
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT rol = 'admin' FROM perfiles WHERE id = auth.uid()), false);
$$;

-- empleado_id del usuario actual (puede ser NULL si no está vinculado)
CREATE OR REPLACE FUNCTION public.empleado_id_actual()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empleado_id FROM perfiles WHERE id = auth.uid() LIMIT 1;
$$;

-- cliente_id del usuario actual (puede ser NULL si no está vinculado)
CREATE OR REPLACE FUNCTION public.cliente_id_actual()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cliente_id FROM perfiles WHERE id = auth.uid() LIMIT 1;
$$;


-- ---------------------------------------------------------------------------
-- 1.b) Trigger anti-escalada en perfiles
-- ---------------------------------------------------------------------------
-- El cliente JS tiene que poder editar su perfil (cambiar su nombre, etc.),
-- pero NO puede tocar campos sensibles: rol, taller_id, permisos,
-- empleado_id, cliente_id. Si lo hace, lo revertimos silenciosamente.
--
-- Las RPCs SECURITY DEFINER (`crear_taller_y_admin`, `aplicar_codigo`, etc.)
-- corren con el rol del owner (postgres / supabase_admin), no con
-- `authenticated`. Por eso este trigger las deja pasar: el chequeo
-- `current_user = 'authenticated'` solo se cumple cuando el cliente JS
-- escribe directo a la tabla.
CREATE OR REPLACE FUNCTION public.perfiles_proteger_campos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si la operación NO viene del rol authenticated (p.ej. una RPC SECURITY
  -- DEFINER, un trigger del sistema, o un superuser), dejar pasar.
  IF current_user IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- Admin del mismo taller: puede modificar todo (incluido rol/permisos
  -- de otros usuarios del taller).
  IF public.es_admin()
     AND COALESCE(NEW.taller_id, OLD.taller_id) = public.taller_id_actual() THEN
    RETURN NEW;
  END IF;

  -- Cualquier otro caso (usuario no-admin editando su propio perfil):
  -- forzamos que los campos sensibles NO cambien.
  IF TG_OP = 'UPDATE' THEN
    NEW.rol         := OLD.rol;
    NEW.taller_id   := OLD.taller_id;
    NEW.empleado_id := OLD.empleado_id;
    NEW.cliente_id  := OLD.cliente_id;
    NEW.permisos    := OLD.permisos;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS perfiles_proteger_campos_trg ON perfiles;
CREATE TRIGGER perfiles_proteger_campos_trg
  BEFORE UPDATE ON perfiles
  FOR EACH ROW
  EXECUTE FUNCTION public.perfiles_proteger_campos();


-- ---------------------------------------------------------------------------
-- 2) PERFILES y TALLERES (siempre RLS, lectura por taller)
-- ---------------------------------------------------------------------------
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfiles_select_mismo_taller" ON perfiles;
CREATE POLICY "perfiles_select_mismo_taller" ON perfiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR taller_id = public.taller_id_actual()
  );

DROP POLICY IF EXISTS "perfiles_update_propio_o_admin" ON perfiles;
CREATE POLICY "perfiles_update_propio_o_admin" ON perfiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (public.es_admin() AND taller_id = public.taller_id_actual())
  )
  WITH CHECK (
    id = auth.uid()
    OR (public.es_admin() AND taller_id = public.taller_id_actual())
  );

DROP POLICY IF EXISTS "perfiles_insert_propio" ON perfiles;
CREATE POLICY "perfiles_insert_propio" ON perfiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "perfiles_delete_admin" ON perfiles;
CREATE POLICY "perfiles_delete_admin" ON perfiles
  FOR DELETE TO authenticated
  USING (public.es_admin() AND taller_id = public.taller_id_actual());


ALTER TABLE talleres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "talleres_select_propio" ON talleres;
CREATE POLICY "talleres_select_propio" ON talleres
  FOR SELECT TO authenticated
  USING (id = public.taller_id_actual());

DROP POLICY IF EXISTS "talleres_update_admin" ON talleres;
CREATE POLICY "talleres_update_admin" ON talleres
  FOR UPDATE TO authenticated
  USING (public.es_admin() AND id = public.taller_id_actual())
  WITH CHECK (public.es_admin() AND id = public.taller_id_actual());

DROP POLICY IF EXISTS "talleres_insert_authenticated" ON talleres;
CREATE POLICY "talleres_insert_authenticated" ON talleres
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- al crear taller nuevo aún no hay perfil


-- ---------------------------------------------------------------------------
-- 3) MACRO DE POLÍTICAS POR TABLA
-- ---------------------------------------------------------------------------
-- Patrón "staff" (admin + empleado) leen y escriben todo del propio taller:
--   reparaciones, vehiculos, clientes, inventario, presupuestos, agenda,
--   mantenimientos, reparacion_mecanicos, items_reparacion, fotos, etc.
--
-- Patrón "admin-only escritura, staff lectura":
--   movimientos_financieros, sueldos, vales_empleado, gastos, balances,
--   periodos_sueldo, categorias_financieras, cuentas_pagar, creditos
--
-- Patrón "cliente": el rol cliente solo ve filas asociadas a su cliente_id.
-- ---------------------------------------------------------------------------


-- =====================================================================
-- 3.A · Tablas de operación cotidiana (staff = admin + empleado)
-- =====================================================================

-- ---- CLIENTES ----
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_select" ON clientes;
CREATE POLICY "clientes_select" ON clientes
  FOR SELECT TO authenticated
  USING (
    taller_id = public.taller_id_actual()
    AND (
      public.rol_actual() IN ('admin','empleado')
      OR (public.rol_actual() = 'cliente' AND id = public.cliente_id_actual())
    )
  );

DROP POLICY IF EXISTS "clientes_modify_staff" ON clientes;
CREATE POLICY "clientes_modify_staff" ON clientes
  FOR ALL TO authenticated
  USING (taller_id = public.taller_id_actual() AND public.rol_actual() IN ('admin','empleado'))
  WITH CHECK (taller_id = public.taller_id_actual() AND public.rol_actual() IN ('admin','empleado'));


-- ---- VEHICULOS ----
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehiculos_select" ON vehiculos;
CREATE POLICY "vehiculos_select" ON vehiculos
  FOR SELECT TO authenticated
  USING (
    taller_id = public.taller_id_actual()
    AND (
      public.rol_actual() IN ('admin','empleado')
      OR (public.rol_actual() = 'cliente' AND cliente_id = public.cliente_id_actual())
    )
  );

DROP POLICY IF EXISTS "vehiculos_modify_staff" ON vehiculos;
CREATE POLICY "vehiculos_modify_staff" ON vehiculos
  FOR ALL TO authenticated
  USING (taller_id = public.taller_id_actual() AND public.rol_actual() IN ('admin','empleado'))
  WITH CHECK (taller_id = public.taller_id_actual() AND public.rol_actual() IN ('admin','empleado'));


-- ---- REPARACIONES ----
ALTER TABLE reparaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reparaciones_select" ON reparaciones;
CREATE POLICY "reparaciones_select" ON reparaciones
  FOR SELECT TO authenticated
  USING (
    taller_id = public.taller_id_actual()
    AND (
      public.rol_actual() IN ('admin','empleado')
      OR (public.rol_actual() = 'cliente' AND cliente_id = public.cliente_id_actual())
    )
  );

DROP POLICY IF EXISTS "reparaciones_modify_staff" ON reparaciones;
CREATE POLICY "reparaciones_modify_staff" ON reparaciones
  FOR ALL TO authenticated
  USING (taller_id = public.taller_id_actual() AND public.rol_actual() IN ('admin','empleado'))
  WITH CHECK (taller_id = public.taller_id_actual() AND public.rol_actual() IN ('admin','empleado'));

-- Cliente puede actualizar solo su propia aprobación (campo aprobacion_cliente).
-- Lo dejamos abierto pero acotado a sus propias reparaciones.
DROP POLICY IF EXISTS "reparaciones_update_cliente" ON reparaciones;
CREATE POLICY "reparaciones_update_cliente" ON reparaciones
  FOR UPDATE TO authenticated
  USING (
    taller_id = public.taller_id_actual()
    AND public.rol_actual() = 'cliente'
    AND cliente_id = public.cliente_id_actual()
  )
  WITH CHECK (
    taller_id = public.taller_id_actual()
    AND public.rol_actual() = 'cliente'
    AND cliente_id = public.cliente_id_actual()
  );


-- ---- INVENTARIO / AGENDA / MANTENIMIENTOS / PRESUPUESTOS / VENTAS ----
DO $$
DECLARE
  t text;
  staff_tables text[] := ARRAY[
    'inventario','agenda','mantenimientos','presupuestos','presupuestos_v2',
    'reparacion_mecanicos','items_reparacion','pagos_reparacion',
    'fotos_reparacion','checklist_recepcion','trabajos_empleado',
    'codigos_empleado'
  ];
BEGIN
  FOREACH t IN ARRAY staff_tables LOOP
    -- saltar si la tabla no existe (algunos talleres no la usan todavía)
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "%I_staff_all" ON %I', t, t);
      EXECUTE format($f$
        CREATE POLICY "%I_staff_all" ON %I
          FOR ALL TO authenticated
          USING (taller_id = public.taller_id_actual()
                 AND public.rol_actual() IN ('admin','empleado'))
          WITH CHECK (taller_id = public.taller_id_actual()
                      AND public.rol_actual() IN ('admin','empleado'))
      $f$, t, t);
    END IF;
  END LOOP;
END $$;


-- ---- VENTAS (admin + empleado escriben; cliente no ve nada) ----
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ventas_select_staff" ON ventas;
CREATE POLICY "ventas_select_staff" ON ventas
  FOR SELECT TO authenticated
  USING (taller_id = public.taller_id_actual() AND public.rol_actual() IN ('admin','empleado'));

DROP POLICY IF EXISTS "ventas_insert_staff" ON ventas;
CREATE POLICY "ventas_insert_staff" ON ventas
  FOR INSERT TO authenticated
  WITH CHECK (taller_id = public.taller_id_actual() AND public.rol_actual() IN ('admin','empleado'));

DROP POLICY IF EXISTS "ventas_update_staff" ON ventas;
CREATE POLICY "ventas_update_staff" ON ventas
  FOR UPDATE TO authenticated
  USING (taller_id = public.taller_id_actual() AND public.rol_actual() IN ('admin','empleado'))
  WITH CHECK (taller_id = public.taller_id_actual() AND public.rol_actual() IN ('admin','empleado'));

DROP POLICY IF EXISTS "ventas_delete_admin" ON ventas;
CREATE POLICY "ventas_delete_admin" ON ventas
  FOR DELETE TO authenticated
  USING (public.es_admin() AND taller_id = public.taller_id_actual());


-- =====================================================================
-- 3.B · Tablas financieras y de RR.HH. (admin total; empleado solo lo suyo)
-- =====================================================================

-- ---- EMPLEADOS ----
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empleados_select" ON empleados;
CREATE POLICY "empleados_select" ON empleados
  FOR SELECT TO authenticated
  USING (
    taller_id = public.taller_id_actual()
    AND (
      public.es_admin()
      OR (public.rol_actual() = 'empleado' AND id = public.empleado_id_actual())
      OR (public.rol_actual() = 'empleado'
          AND COALESCE((SELECT permisos->>'ver_historial_otros' FROM perfiles WHERE id = auth.uid()), 'false') = 'true')
    )
  );

DROP POLICY IF EXISTS "empleados_modify_admin" ON empleados;
CREATE POLICY "empleados_modify_admin" ON empleados
  FOR ALL TO authenticated
  USING (public.es_admin() AND taller_id = public.taller_id_actual())
  WITH CHECK (public.es_admin() AND taller_id = public.taller_id_actual());


-- ---- VALES_EMPLEADO ----
ALTER TABLE vales_empleado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vales_select" ON vales_empleado;
CREATE POLICY "vales_select" ON vales_empleado
  FOR SELECT TO authenticated
  USING (
    taller_id = public.taller_id_actual()
    AND (
      public.es_admin()
      OR (public.rol_actual() = 'empleado' AND empleado_id = public.empleado_id_actual())
    )
  );

DROP POLICY IF EXISTS "vales_modify_admin" ON vales_empleado;
CREATE POLICY "vales_modify_admin" ON vales_empleado
  FOR ALL TO authenticated
  USING (public.es_admin() AND taller_id = public.taller_id_actual())
  WITH CHECK (public.es_admin() AND taller_id = public.taller_id_actual());


-- ---- PERIODOS_SUELDO ----
ALTER TABLE periodos_sueldo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "periodos_select_staff" ON periodos_sueldo;
CREATE POLICY "periodos_select_staff" ON periodos_sueldo
  FOR SELECT TO authenticated
  USING (taller_id = public.taller_id_actual() AND public.rol_actual() IN ('admin','empleado'));

DROP POLICY IF EXISTS "periodos_modify_admin" ON periodos_sueldo;
CREATE POLICY "periodos_modify_admin" ON periodos_sueldo
  FOR ALL TO authenticated
  USING (public.es_admin() AND taller_id = public.taller_id_actual())
  WITH CHECK (public.es_admin() AND taller_id = public.taller_id_actual());


-- ---- MOVIMIENTOS_FINANCIEROS ----
ALTER TABLE movimientos_financieros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "movimientos_select_admin" ON movimientos_financieros;
CREATE POLICY "movimientos_select_admin" ON movimientos_financieros
  FOR SELECT TO authenticated
  USING (
    taller_id = public.taller_id_actual()
    AND public.es_admin()
  );

DROP POLICY IF EXISTS "movimientos_insert_staff" ON movimientos_financieros;
-- Solo admin, o empleado con permiso explícito `registrar_cobros`, puede
-- insertar movimientos financieros. Esto cubre el flujo de pagos del
-- cliente. Para flujos de venta/vale, el insert es disparado por el admin.
-- Aunque pueda insertar, el empleado NO puede leer ni modificar
-- movimientos (políticas separadas más abajo).
CREATE POLICY "movimientos_insert_staff" ON movimientos_financieros
  FOR INSERT TO authenticated
  WITH CHECK (
    taller_id = public.taller_id_actual()
    AND (
      public.es_admin()
      OR (
        public.rol_actual() = 'empleado'
        AND COALESCE(
          (SELECT (permisos->>'registrar_cobros')::boolean
             FROM perfiles WHERE id = auth.uid()),
          false
        ) = true
      )
    )
  );

DROP POLICY IF EXISTS "movimientos_update_admin" ON movimientos_financieros;
CREATE POLICY "movimientos_update_admin" ON movimientos_financieros
  FOR UPDATE TO authenticated
  USING (public.es_admin() AND taller_id = public.taller_id_actual())
  WITH CHECK (public.es_admin() AND taller_id = public.taller_id_actual());

DROP POLICY IF EXISTS "movimientos_delete_admin" ON movimientos_financieros;
CREATE POLICY "movimientos_delete_admin" ON movimientos_financieros
  FOR DELETE TO authenticated
  USING (public.es_admin() AND taller_id = public.taller_id_actual());


-- ---- Resto de tablas financieras: solo admin lee/escribe ----
DO $$
DECLARE
  t text;
  admin_tables text[] := ARRAY[
    'gastos','sueldos','liquidaciones','liquidaciones_sueldo','cuentas_pagar','creditos',
    'balances','movimiento_balance','cierres_caja','categorias_financieras',
    'conciliaciones','suscripciones'
  ];
BEGIN
  FOREACH t IN ARRAY admin_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "%I_admin_all" ON %I', t, t);
      EXECUTE format($f$
        CREATE POLICY "%I_admin_all" ON %I
          FOR ALL TO authenticated
          USING (taller_id = public.taller_id_actual() AND public.es_admin())
          WITH CHECK (taller_id = public.taller_id_actual() AND public.es_admin())
      $f$, t, t);
    END IF;
  END LOOP;
END $$;


-- =====================================================================
-- 4) Tabla `planes` (catálogo público)
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='planes') THEN
    EXECUTE 'ALTER TABLE planes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "planes_read_all" ON planes';
    EXECUTE 'CREATE POLICY "planes_read_all" ON planes FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;


-- ============================================================================
-- LISTO. Validación recomendada después de aplicar:
--   • Loguearte como ADMIN: tenés que ver todo (movimientos, sueldos, vales).
--   • Loguearte como EMPLEADO sin permisos: en consola probá:
--       sb.from('movimientos_financieros').select('*')   → debe devolver [].
--       sb.from('sueldos').select('*')                   → [].
--       sb.from('vales_empleado').select('*')            → solo los suyos.
--   • Loguearte como CLIENTE: solo ve sus propios vehículos y reparaciones.
-- ============================================================================
