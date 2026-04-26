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

-- INSERT del propio perfil tras signup. Restringido a campos seguros: el
-- usuario nuevo SOLO puede insertarse como rol='cliente' sin taller, sin
-- vínculos y sin permisos. La elevación a admin/empleado pasa siempre por
-- las RPCs SECURITY DEFINER (`crear_taller_y_admin`, `aplicar_codigo`),
-- que corren con rol owner y no son afectadas por esta policy.
DROP POLICY IF EXISTS "perfiles_insert_propio" ON perfiles;
CREATE POLICY "perfiles_insert_propio" ON perfiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND COALESCE(rol, 'cliente') = 'cliente'
    AND taller_id IS NULL
    AND empleado_id IS NULL
    AND cliente_id IS NULL
    AND (permisos IS NULL OR permisos = '{}'::jsonb)
  );

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
-- La policy permite la operación pero el trigger de abajo restringe que el
-- único campo modificable sea `aprobacion_cliente`.
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

-- Trigger: el cliente solo puede modificar la columna `aprobacion_cliente`.
-- Si intenta cambiar cualquier otro campo (costo, estado, descripcion,
-- repuestos, etc.) abortamos la operación.
CREATE OR REPLACE FUNCTION public.reparaciones_proteger_cliente_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  o jsonb := to_jsonb(OLD);
  n jsonb := to_jsonb(NEW);
  k text;
BEGIN
  -- Las RPC SECURITY DEFINER y el staff pasan sin chequeo.
  IF current_user IS DISTINCT FROM 'authenticated' THEN RETURN NEW; END IF;
  IF public.rol_actual() IN ('admin','empleado') THEN RETURN NEW; END IF;

  -- Cliente: comparar fila vieja vs nueva, solo `aprobacion_cliente` puede
  -- haber cambiado.
  FOR k IN SELECT jsonb_object_keys(n) LOOP
    IF k <> 'aprobacion_cliente' AND (o->k) IS DISTINCT FROM (n->k) THEN
      RAISE EXCEPTION 'El cliente solo puede actualizar el campo aprobacion_cliente, intentó cambiar: %', k;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reparaciones_proteger_cliente_update_trg ON reparaciones;
CREATE TRIGGER reparaciones_proteger_cliente_update_trg
  BEFORE UPDATE ON reparaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.reparaciones_proteger_cliente_update();


-- ---- INVENTARIO / AGENDA / MANTENIMIENTOS / PRESUPUESTOS / VENTAS ----
-- Solo aplica el patrón genérico (filter por `taller_id`) a las tablas que
-- realmente tengan esa columna. Las tablas hijas que heredan tenancy de su
-- padre (p.ej. `reparacion_mecanicos` vía `reparacion_id`) tienen policies
-- dedicadas más abajo.
DO $$
DECLARE
  t text;
  staff_tables text[] := ARRAY[
    'inventario','movimientos_inventario','historial_precios','ubicaciones',
    'agenda','citas','feriados','google_calendar_tokens',
    'mantenimientos','presupuestos',
    -- 'presupuestos_v2' tiene policies dedicadas más abajo (lectura cliente).
    'reparacion_items',
    'checklist_recepcion','checklist_plantillas',
    'trabajos_empleado'
  ];
BEGIN
  FOREACH t IN ARRAY staff_tables LOOP
    -- saltar si la tabla no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema='public' AND table_name=t) THEN
      CONTINUE;
    END IF;
    -- saltar si la tabla no tiene columna taller_id (se protege vía padre)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=t AND column_name='taller_id') THEN
      RAISE NOTICE 'Tabla % no tiene taller_id; saltando patrón genérico (debe protegerse vía padre).', t;
      CONTINUE;
    END IF;
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
  END LOOP;
END $$;


-- ---- REPARACION_MECANICOS (sin taller_id; herencia vía reparacion_id) ----
-- Cada fila pertenece a una reparación; el chequeo se hace contra el
-- taller_id de la reparación padre. Solo staff (admin/empleado) lee y escribe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='reparacion_mecanicos') THEN

    EXECUTE 'ALTER TABLE reparacion_mecanicos ENABLE ROW LEVEL SECURITY';

    -- Tarea #17: separar las policies para que el empleado solo vea SUS
    -- propias asignaciones (vital porque acá se guardan los pagos /
    -- comisiones de cada uno). El admin sigue viendo y editando todo.
    EXECUTE 'DROP POLICY IF EXISTS "reparacion_mecanicos_staff_all" ON reparacion_mecanicos';
    EXECUTE 'DROP POLICY IF EXISTS "reparacion_mecanicos_admin_all" ON reparacion_mecanicos';
    EXECUTE 'DROP POLICY IF EXISTS "reparacion_mecanicos_empleado_select_own" ON reparacion_mecanicos';

    -- Admin: full access en su taller.
    EXECUTE $f$
      CREATE POLICY "reparacion_mecanicos_admin_all" ON reparacion_mecanicos
        FOR ALL TO authenticated
        USING (
          public.es_admin()
          AND EXISTS (
            SELECT 1 FROM reparaciones r
              WHERE r.id = reparacion_mecanicos.reparacion_id
                AND r.taller_id = public.taller_id_actual()
          )
        )
        WITH CHECK (
          public.es_admin()
          AND EXISTS (
            SELECT 1 FROM reparaciones r
              WHERE r.id = reparacion_mecanicos.reparacion_id
                AND r.taller_id = public.taller_id_actual()
          )
        )
    $f$;

    -- Empleado: SELECT solo de filas que le corresponden a él.
    -- Acepta tanto el FK moderno `empleado_id` como el legado
    -- `mecanico_id = auth.uid()` para no romper datos antiguos.
    EXECUTE $f$
      CREATE POLICY "reparacion_mecanicos_empleado_select_own" ON reparacion_mecanicos
        FOR SELECT TO authenticated
        USING (
          public.rol_actual() = 'empleado'
          AND EXISTS (
            SELECT 1 FROM reparaciones r
              WHERE r.id = reparacion_mecanicos.reparacion_id
                AND r.taller_id = public.taller_id_actual()
          )
          AND (
            (empleado_id IS NOT NULL AND empleado_id = public.empleado_id_actual())
            OR mecanico_id = auth.uid()
          )
        )
    $f$;
  END IF;
END $$;


-- ---- PRESUPUESTOS_V2 (cliente VE los suyos; staff escribe) ----
-- Tarea #13: portal del cliente muestra sus presupuestos en "Mis presupuestos".
-- Pattern idéntico al de `reparaciones`: cliente solo ve filas con su cliente_id.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='presupuestos_v2') THEN
    EXECUTE 'ALTER TABLE presupuestos_v2 ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "presupuestos_v2_select" ON presupuestos_v2';
    EXECUTE $p$
      CREATE POLICY "presupuestos_v2_select" ON presupuestos_v2
        FOR SELECT TO authenticated
        USING (
          taller_id = public.taller_id_actual()
          AND (
            public.rol_actual() IN ('admin','empleado')
            OR (public.rol_actual() = 'cliente' AND cliente_id = public.cliente_id_actual())
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "presupuestos_v2_modify_staff" ON presupuestos_v2';
    EXECUTE $p$
      CREATE POLICY "presupuestos_v2_modify_staff" ON presupuestos_v2
        FOR ALL TO authenticated
        USING (taller_id = public.taller_id_actual()
               AND public.rol_actual() IN ('admin','empleado'))
        WITH CHECK (taller_id = public.taller_id_actual()
                    AND public.rol_actual() IN ('admin','empleado'))
    $p$;

    -- Cliente puede aprobar / rechazar SUS presupuestos formales.
    -- La policy permite UPDATE pero el trigger más abajo restringe los campos
    -- modificables a `estado` y (si existe) `aprobado_por_cliente_at`, y limita
    -- las transiciones de estado a generado→aprobado/rechazado.
    EXECUTE 'DROP POLICY IF EXISTS "presupuestos_v2_update_cliente" ON presupuestos_v2';
    EXECUTE $p$
      CREATE POLICY "presupuestos_v2_update_cliente" ON presupuestos_v2
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
          AND estado IN ('aprobado','rechazado')
        )
    $p$;
  END IF;
END $$;

-- Trigger: cuando un cliente actualiza presupuestos_v2 directamente, solo
-- puede cambiar `estado` (y opcionalmente `aprobado_por_cliente_at` si la
-- columna existe). Cualquier cambio a `total`, `descripcion`, items, etc.
-- aborta la operación. Misma lógica que el trigger de `reparaciones`.
CREATE OR REPLACE FUNCTION public.presupuestos_v2_proteger_cliente_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  o jsonb := to_jsonb(OLD);
  n jsonb := to_jsonb(NEW);
  k text;
  campos_permitidos text[] := ARRAY['estado','aprobado_por_cliente_at','updated_at'];
BEGIN
  -- RPCs SECURITY DEFINER y staff pasan sin chequeo.
  IF current_user IS DISTINCT FROM 'authenticated' THEN RETURN NEW; END IF;
  IF public.rol_actual() IN ('admin','empleado') THEN RETURN NEW; END IF;

  -- Cliente: comparar fila vieja vs nueva, solo los campos permitidos pueden cambiar.
  FOR k IN SELECT jsonb_object_keys(n) LOOP
    IF NOT (k = ANY(campos_permitidos)) AND (o->k) IS DISTINCT FROM (n->k) THEN
      RAISE EXCEPTION 'El cliente solo puede actualizar el estado del presupuesto, intentó cambiar: %', k;
    END IF;
  END LOOP;

  -- Solo permitir transición desde estado actual generado/pendiente.
  IF (o->>'estado') NOT IN ('generado','pendiente') THEN
    RAISE EXCEPTION 'No se puede cambiar el estado del presupuesto desde %', (o->>'estado');
  END IF;

  -- Estado destino solo aprobado / rechazado.
  IF (n->>'estado') NOT IN ('aprobado','rechazado') THEN
    RAISE EXCEPTION 'El cliente solo puede aprobar o rechazar el presupuesto';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='presupuestos_v2') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS presupuestos_v2_proteger_cliente_update_trg ON presupuestos_v2';
    EXECUTE 'CREATE TRIGGER presupuestos_v2_proteger_cliente_update_trg
             BEFORE UPDATE ON presupuestos_v2
             FOR EACH ROW
             EXECUTE FUNCTION public.presupuestos_v2_proteger_cliente_update()';
  END IF;
END $$;


-- ---- RPC: vincular cuentas sin taller (admin only) ─────────────────────────
-- Tarea #13: el cliente puede crear cuenta SIN código (queda con taller_id=NULL).
-- Esta RPC permite al admin buscarla por email exacto y vincularla a su taller.
-- SECURITY DEFINER porque las RLS no permiten al admin ver perfiles de otros
-- talleres. La RPC valida que el solicitante sea admin de algún taller y que el
-- perfil destino esté huérfano (taller_id IS NULL, rol='cliente').
CREATE OR REPLACE FUNCTION public.admin_vincular_cuenta_huerfana(
  p_email text,
  p_cliente_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_taller uuid;
  v_user_id uuid;
  v_perfil_actual record;
BEGIN
  -- Solo admin con taller asignado.
  SELECT taller_id INTO v_admin_taller
    FROM perfiles
    WHERE id = auth.uid() AND rol = 'admin'
    LIMIT 1;
  IF v_admin_taller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo el admin del taller puede vincular cuentas');
  END IF;

  -- Si se pasa cliente_id, validar que pertenezca al taller del admin
  -- (evita cross-taller referential inconsistencies).
  IF p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM clientes
        WHERE id = p_cliente_id AND taller_id = v_admin_taller
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Ese cliente no pertenece a tu taller');
    END IF;
  END IF;

  -- Buscar el user_id por email exacto (case-insensitive).
  SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(trim(p_email))
    LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No encontramos ninguna cuenta con ese email');
  END IF;

  -- El perfil debe estar huérfano (sin taller, rol cliente).
  SELECT * INTO v_perfil_actual FROM perfiles WHERE id = v_user_id LIMIT 1;
  IF v_perfil_actual IS NULL THEN
    -- Crear perfil cliente vinculado.
    INSERT INTO perfiles (id, rol, taller_id, cliente_id)
      VALUES (v_user_id, 'cliente', v_admin_taller, p_cliente_id);
    RETURN jsonb_build_object('ok', true, 'created', true);
  END IF;

  IF v_perfil_actual.taller_id IS NOT NULL AND v_perfil_actual.taller_id <> v_admin_taller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esa cuenta ya está vinculada a otro taller');
  END IF;

  IF v_perfil_actual.rol <> 'cliente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esa cuenta no es de cliente');
  END IF;

  UPDATE perfiles
    SET taller_id = v_admin_taller,
        cliente_id = COALESCE(p_cliente_id, cliente_id)
    WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'created', false);
END $$;

REVOKE ALL ON FUNCTION public.admin_vincular_cuenta_huerfana(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_vincular_cuenta_huerfana(text, uuid) TO authenticated;


-- ---- RPC: rechazar (desvincular) perfil pendiente ──────────────────────────
-- Tarea #13: el admin necesita rechazar perfiles vinculados a su taller pero
-- sin cliente_id. La operación natural es setear taller_id=NULL en perfiles,
-- pero la policy `perfiles_update_propio_o_admin` exige que el admin solo
-- modifique filas que sigan apuntando a su taller (WITH CHECK), por lo que
-- el admin no puede null-ear el campo desde el cliente. Se hace por RPC
-- SECURITY DEFINER con validaciones explícitas.
CREATE OR REPLACE FUNCTION public.admin_rechazar_perfil_pendiente(
  p_perfil_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_taller uuid;
  v_perfil record;
BEGIN
  -- Solo admin con taller asignado.
  SELECT taller_id INTO v_admin_taller
    FROM perfiles
    WHERE id = auth.uid() AND rol = 'admin'
    LIMIT 1;
  IF v_admin_taller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo el admin del taller puede rechazar cuentas');
  END IF;

  -- El perfil debe existir, ser cliente y pertenecer al taller del admin.
  SELECT * INTO v_perfil FROM perfiles WHERE id = p_perfil_id LIMIT 1;
  IF v_perfil IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No encontramos esa cuenta');
  END IF;
  IF v_perfil.taller_id IS DISTINCT FROM v_admin_taller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esa cuenta no pertenece a tu taller');
  END IF;
  IF v_perfil.rol <> 'cliente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo se pueden rechazar cuentas de cliente');
  END IF;

  -- Desvincular del taller. No borramos al usuario; solo le quitamos el acceso.
  UPDATE perfiles
    SET taller_id = NULL,
        cliente_id = NULL
    WHERE id = p_perfil_id;

  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.admin_rechazar_perfil_pendiente(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_rechazar_perfil_pendiente(uuid) TO authenticated;


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
-- Admin o empleado con permiso explícito `anular_ventas`.
CREATE POLICY "ventas_delete_admin" ON ventas
  FOR DELETE TO authenticated
  USING (
    taller_id = public.taller_id_actual()
    AND (
      public.es_admin()
      OR (
        public.rol_actual() = 'empleado'
        AND COALESCE(
          (SELECT (permisos->>'anular_ventas')::boolean
             FROM perfiles WHERE id = auth.uid()),
          false
        ) = true
      )
    )
  );


-- ---- CODIGOS DE EMPLEADO (admin-only) ----
-- Códigos de invitación para vincular usuarios. Solo admin del taller los
-- crea, lista, marca como usados o elimina. Empleados/clientes no deben
-- siquiera leerlos (pueden filtrar info de quién está siendo invitado).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='codigos_empleado') THEN
    -- Tarea #17: el admin puede asociar el código a un empleado existente
    -- para que, al aplicarlo, el perfil quede AUTO-VINCULADO con esa ficha
    -- de empleado (perfiles.empleado_id). Si no hay empleado preasociado,
    -- el código sigue funcionando como antes (vinculación manual posterior).
    EXECUTE 'ALTER TABLE codigos_empleado ADD COLUMN IF NOT EXISTS empleado_id uuid';
    -- FK opcional a empleados (si la tabla existe). ON DELETE SET NULL para
    -- no romper códigos cuando se borra al empleado.
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='empleados')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE table_schema='public'
                         AND table_name='codigos_empleado'
                         AND constraint_name='codigos_empleado_empleado_id_fkey') THEN
      EXECUTE 'ALTER TABLE codigos_empleado
                 ADD CONSTRAINT codigos_empleado_empleado_id_fkey
                 FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE SET NULL';
    END IF;

    EXECUTE 'ALTER TABLE codigos_empleado ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "codigos_empleado_admin_all" ON codigos_empleado';
    EXECUTE $f$
      CREATE POLICY "codigos_empleado_admin_all" ON codigos_empleado
        FOR ALL TO authenticated
        USING (taller_id = public.taller_id_actual() AND public.es_admin())
        WITH CHECK (taller_id = public.taller_id_actual() AND public.es_admin())
    $f$;
  END IF;
END $$;


-- ---- RPC: aplicar_codigo (vinculación post-signup) ─────────────────────────
-- Se ejecuta desde el cliente cuando un usuario recién registrado introduce
-- el código de invitación que le pasó el admin. Vincula el perfil del usuario
-- al taller correspondiente y setea su rol (cliente o empleado).
--
-- Tarea #17: si el código tiene `empleado_id` (preasociado por el admin),
-- también se setea `perfiles.empleado_id` en el mismo paso. Esto evita el
-- "doble paso" de invitar primero y vincular después manualmente.
--
-- SECURITY DEFINER: el cliente JS no puede tocar perfiles.rol/taller_id/
-- empleado_id (lo bloquea el trigger `perfiles_proteger_campos`), pero esta
-- RPC corre como owner y por eso puede.
CREATE OR REPLACE FUNCTION public.aplicar_codigo(
  p_codigo text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo record;
  v_existe boolean;
BEGIN
  -- Validación básica.
  IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Código vacío');
  END IF;
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario inválido');
  END IF;

  -- Buscar el código sin usar.
  SELECT id, taller_id, tipo, empleado_id
    INTO v_codigo
    FROM codigos_empleado
    WHERE upper(codigo) = upper(trim(p_codigo))
      AND COALESCE(usado, false) = false
    LIMIT 1;

  IF v_codigo.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Código inválido o ya utilizado');
  END IF;

  IF v_codigo.tipo NOT IN ('empleado','cliente') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tipo de código no soportado');
  END IF;

  -- Marcar el código como usado primero (single-use).
  UPDATE codigos_empleado SET usado = true WHERE id = v_codigo.id;

  -- Crear o actualizar el perfil con los datos del código.
  SELECT EXISTS (SELECT 1 FROM perfiles WHERE id = p_user_id) INTO v_existe;

  IF v_existe THEN
    UPDATE perfiles
       SET rol         = v_codigo.tipo,
           taller_id   = v_codigo.taller_id,
           empleado_id = CASE
                          WHEN v_codigo.tipo = 'empleado' AND v_codigo.empleado_id IS NOT NULL
                          THEN v_codigo.empleado_id
                          ELSE empleado_id
                        END
     WHERE id = p_user_id;
  ELSE
    INSERT INTO perfiles (id, rol, taller_id, empleado_id)
      VALUES (
        p_user_id,
        v_codigo.tipo,
        v_codigo.taller_id,
        CASE WHEN v_codigo.tipo = 'empleado' THEN v_codigo.empleado_id ELSE NULL END
      );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'rol', v_codigo.tipo,
    'taller_id', v_codigo.taller_id,
    'empleado_id', CASE WHEN v_codigo.tipo = 'empleado' THEN v_codigo.empleado_id ELSE NULL END
  );
END $$;

REVOKE ALL ON FUNCTION public.aplicar_codigo(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.aplicar_codigo(text, uuid) TO authenticated;


-- ---- PAGOS DE REPARACION (sensible: gate por permiso `registrar_cobros`) ----
-- Cualquier staff lee (lo necesita la pantalla de detalle, caja y rentabilidad)
-- pero SOLO admin o empleado con permiso `registrar_cobros` inserta/modifica.
ALTER TABLE pagos_reparacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pagos_reparacion_select_staff" ON pagos_reparacion;
CREATE POLICY "pagos_reparacion_select_staff" ON pagos_reparacion
  FOR SELECT TO authenticated
  USING (
    taller_id = public.taller_id_actual()
    AND public.rol_actual() IN ('admin','empleado')
  );

DROP POLICY IF EXISTS "pagos_reparacion_insert_perm" ON pagos_reparacion;
CREATE POLICY "pagos_reparacion_insert_perm" ON pagos_reparacion
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

DROP POLICY IF EXISTS "pagos_reparacion_update_admin" ON pagos_reparacion;
CREATE POLICY "pagos_reparacion_update_admin" ON pagos_reparacion
  FOR UPDATE TO authenticated
  USING (taller_id = public.taller_id_actual() AND public.es_admin())
  WITH CHECK (taller_id = public.taller_id_actual() AND public.es_admin());

DROP POLICY IF EXISTS "pagos_reparacion_delete_admin" ON pagos_reparacion;
CREATE POLICY "pagos_reparacion_delete_admin" ON pagos_reparacion
  FOR DELETE TO authenticated
  USING (taller_id = public.taller_id_actual() AND public.es_admin());


-- ---- FIADOS (créditos de clientes, real nombre de la tabla) ----
-- Es información financiera sensible. Staff lee (para ver saldos en cliente,
-- caja, dashboard, reportes). INSERT por admin o empleado con
-- `registrar_cobros` (porque el flujo de pago parcial crea un fiado por el
-- resto). UPDATE/DELETE (cobrar/anular) solo admin.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='fiados') THEN

    EXECUTE 'ALTER TABLE fiados ENABLE ROW LEVEL SECURITY';

    -- Solo admin lee. La UI de créditos también está bloqueada a admin
    -- (`creditos()` requireAdmin), así que un empleado no debe poder leer
    -- saldos de fiado ni vía API directa.
    EXECUTE 'DROP POLICY IF EXISTS "fiados_select_staff" ON fiados';
    EXECUTE 'DROP POLICY IF EXISTS "fiados_select_admin" ON fiados';
    EXECUTE $f$
      CREATE POLICY "fiados_select_admin" ON fiados
        FOR SELECT TO authenticated
        USING (taller_id = public.taller_id_actual() AND public.es_admin())
    $f$;

    EXECUTE 'DROP POLICY IF EXISTS "fiados_insert_perm" ON fiados';
    EXECUTE $f$
      CREATE POLICY "fiados_insert_perm" ON fiados
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
        )
    $f$;

    EXECUTE 'DROP POLICY IF EXISTS "fiados_update_admin" ON fiados';
    EXECUTE $f$
      CREATE POLICY "fiados_update_admin" ON fiados
        FOR UPDATE TO authenticated
        USING (taller_id = public.taller_id_actual() AND public.es_admin())
        WITH CHECK (taller_id = public.taller_id_actual() AND public.es_admin())
    $f$;

    EXECUTE 'DROP POLICY IF EXISTS "fiados_delete_admin" ON fiados';
    EXECUTE $f$
      CREATE POLICY "fiados_delete_admin" ON fiados
        FOR DELETE TO authenticated
        USING (taller_id = public.taller_id_actual() AND public.es_admin())
    $f$;
  END IF;
END $$;


-- =====================================================================
-- 3.B · Tablas financieras y de RR.HH. (admin total; empleado solo lo suyo)
-- =====================================================================

-- ---- EMPLEADOS ----
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;

-- empleados.sueldo es información SENSIBLE. Por eso esta policy es estricta:
-- admin del taller, o el propio empleado mirándose a sí mismo. Ningún
-- empleado puede leer la fila de otro. Si mañana se quiere "ver historial
-- de otros mecánicos" se hará vía vista pública sin sueldo o vía la tabla
-- `trabajos_empleado` (que sí es staff).
DROP POLICY IF EXISTS "empleados_select" ON empleados;
CREATE POLICY "empleados_select" ON empleados
  FOR SELECT TO authenticated
  USING (
    taller_id = public.taller_id_actual()
    AND (
      public.es_admin()
      OR (public.rol_actual() = 'empleado' AND id = public.empleado_id_actual())
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
  -- Nombres reales de tablas usadas por el frontend (verificado con grep
  -- en js/finances/*.js, js/reports/*.js). NOTA: `gastos_taller` (no
  -- `gastos`), `fiados` está protegida arriba con políticas finas. Las
  -- tablas que no existan en el taller las salta `IF EXISTS`.
  admin_tables text[] := ARRAY[
    'gastos_taller','sueldos','liquidaciones','liquidaciones_sueldo',
    'cuentas_pagar','balances','movimiento_balance','cierres_caja',
    'categorias_financieras','conciliaciones','suscripciones',
    'config_taller','config_keys','dashboard_config','super_admins'
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
