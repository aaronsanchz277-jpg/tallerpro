# TallerPro

Static HTML/CSS/JS Progressive Web App for managing mechanic workshops ("Gestión Inteligente para Talleres"). Spanish-language UI.

## Stack
- Pure static frontend (HTML, CSS, vanilla JS) — no build step
- Supabase JS client loaded via CDN for backend data
- Service worker for offline support (`sw.js`)

## Project Layout
- `index.html` — main app shell (login, dashboard)
- `landing.html`, `privacidad.html`, `terminos.html` — marketing/legal pages
- `css/styles.css` — global styles
- `js/` — feature modules (authcore, dashboard, finances, hr, integrations, navigation, reports, sales, ux, workshop, configcrm, dev)
- `manifest.json`, `sw.js` — PWA assets
- `server.js` — minimal Node static file server used in development

## Replit Setup
- Workflow `Start application` runs `node server.js` on port `5000`, host `0.0.0.0` (no-cache headers for the iframe preview).
- Deployment configured as `static` with `publicDir: "."`.

## Publicar en GitHub Pages

La app es 100% estática y se puede servir directo desde el repo. Archivos clave:
- `.nojekyll` — desactiva Jekyll en GitHub Pages para que sirva todo tal cual.
- `404.html` — copia de `index.html`. GitHub Pages lo devuelve cuando una ruta no existe, así un refresh o link directo carga la app igual.

Pasos manuales (una sola vez):

1. **Subir los archivos al repo de GitHub.** Asegurate de que `.nojekyll`, `404.html`, `index.html`, `manifest.json`, `sw.js`, `css/`, `js/` y los `.html` legales estén en la rama `main`. Repetí este paso cada vez que cambies algo del código.
2. **Activar GitHub Pages.** En el repo: **Settings → Pages**. En *Source* elegí "Deploy from a branch", seleccioná `main` y carpeta `/ (root)`. Guardá. A los pocos minutos GitHub muestra la URL pública (ej: `https://<usuario>.github.io/<repo>/`).
3. **Configurar Supabase con la nueva URL.** Entrá al panel de Supabase → **Project Settings → Authentication → URL Configuration**:
   - **Site URL**: pegá la URL de GitHub Pages.
   - **Redirect URLs**: agregá la URL en sus dos variantes (con y sin barra final), por ejemplo `https://<usuario>.github.io/<repo>` y `https://<usuario>.github.io/<repo>/`. Si usás la app desde varios dominios (Replit + GitHub Pages), sumalos todos, una entrada por línea.
   Guardá. Esto hace que los links de mails (recuperación de contraseña, confirmación) apunten al dominio correcto.

`server.js` y `.replit` siguen funcionando para desarrollo local en Replit y se pueden quedar en el repo sin afectar a GitHub Pages (los ignora).

## Permisos del empleado y seguridad (RLS)

A partir de la Tarea #12, el sistema tiene dos capas de seguridad:

1. **Capa de UI (cliente)** — `js/core/permisos.js` agrega helpers globales
   `esAdmin()`, `esEmpleado()`, `puedeVer(clave)`, `puedoVerEmpleado(id)`,
   `requireAdmin()`, `requirePerm(clave)` y `tienePerm(clave)`. Los módulos de
   reparaciones, empleados, usuarios y sueldos los usan para esconder botones
   y bloquear acciones que no le tocan al empleado. El perfil del usuario
   carga el campo `permisos` (jsonb) y `empleado_id` desde `loadPerfil` con
   fallback defensivo si la migración SQL todavía no fue corrida.
2. **Capa de servidor (Postgres / RLS)** — el script
   `supabase/rls_policies.sql` agrega la columna `permisos` a `perfiles`,
   crea funciones helper `SECURITY DEFINER` (`taller_id_actual`, `es_admin`,
   etc.) y activa políticas en todas las tablas para que cada usuario solo
   pueda ver/escribir lo de su taller, y el empleado nunca acceda a
   movimientos financieros, sueldos o vales que no son suyos.

**Importante**: el script SQL hay que correrlo a mano una vez por taller en
**Supabase → SQL Editor**. Es idempotente (`DROP POLICY IF EXISTS`,
`CREATE OR REPLACE FUNCTION`, `IF NOT EXISTS`), así que se puede correr de
nuevo sin romper nada. La app sigue funcionando si todavía no fue corrido,
pero **no hay seguridad real** hasta que se aplique.

Claves del jsonb `permisos` (default todo en `false`):
`ver_costos`, `ver_ganancia`, `registrar_cobros`, `anular_ventas`,
`modificar_precios`. Se editan desde el modal
"Editar empleado" cuando el empleado tiene un usuario vinculado (vía
**Usuarios → Vincular**).

## Login y portal real del cliente (Tarea #13)

A partir de la Tarea #13, el cliente tiene su propia cuenta en TallerPro:

1. **Registro libre con código opcional** — pestaña "Soy cliente" en el
   login (`index.html` + `js/auth/auth.js`). El cliente crea su cuenta
   con nombre + email + contraseña; el **código de invitación es
   opcional**.
   - **Con código** → la RPC `aplicar_codigo` asigna `taller_id` y
     opcionalmente `cliente_id` en el momento.
   - **Sin código** → la cuenta queda en estado *limbo*
     (`rol=cliente`, `taller_id=NULL`, `cliente_id=NULL`). Al loguear,
     `loadPerfil()` detecta el `taller_id` nulo y dispara
     `showCodigoPrompt()` automáticamente para que el cliente "reclame"
     su código del taller. Este es el flujo *claim code post-signup*
     y permite que el cliente arme la cuenta antes de tener el código.

2. **Bandeja "Solicitudes de cliente"** — `js/hr/solicitudes-cliente.js`,
   ruta `solicitudes`, sidebar admin → CLIENTES. Lista perfiles con
   `rol=cliente`, `taller_id = mi taller` y `cliente_id IS NULL`
   (cuentas creadas con código pero todavía sin un cliente del CRM
   asociado), más los turnos en estado `pendiente`. El admin los
   vincula a un cliente existente o crea uno nuevo.

3. **"Mis presupuestos"** — `misPresupuestos()` en
   `js/crm/cliente-view.js`, sidebar cliente. Muestra dos secciones:
   - **Reparaciones pendientes de aprobación** (presupuesto cargado
     directo en la OT): aprueba o rechaza vía
     `aprobarPresupuestoCliente`.
   - **Presupuestos formales (`presupuestos_v2`)**: si están en estado
     `generado` aparecen los botones APROBAR / RECHAZAR / Pedir
     aclaración (`aprobarPresupV2`, `rechazarPresupV2`,
     `aclararPresupV2`). El update de estado lo permite la policy
     `presupuestos_v2_update_cliente`. "Pedir aclaración" abre
     WhatsApp con el taller sin cambiar el estado.

4. **Comprobante PDF del cliente** — botón "Descargar comprobante PDF"
   en `misReparaciones` para reparaciones finalizadas. Reusa
   `generarCartaConformidad` (jsPDF cargado on-demand desde CDN).

5. **Notificaciones del cliente** — tres checks en
   `js/integrations/push.js` corren en el ciclo cada 15 min:
   - `pushCheckMisReps`: cambios de estado en reparaciones y nuevos
     presupuestos pendientes de aprobar (sobre `reparaciones`).
   - `pushCheckMisCitas`: turnos que pasan de `pendiente` a
     `confirmada` o `cancelada/rechazada`.
   - `pushCheckMisPresupuestos`: nuevos presupuestos formales
     (`presupuestos_v2`) en estado `generado` para mí.
   Tracking en `localStorage` (snapshot id→estado) para evitar spam.

6. **Vincular cuentas sin código** — botón "Buscar y vincular por
   email" en la bandeja admin. Como las RLS no dejan ver perfiles de
   otros talleres, usa la RPC SECURITY DEFINER
   `admin_vincular_cuenta_huerfana(p_email, p_cliente_id)` (en
   `supabase/rls_policies.sql`). El admin pega el email del cliente
   y opcionalmente lo asocia a un cliente del CRM en la misma acción.

**RLS aplicada en Tarea #13**: `supabase/rls_policies.sql` ya incluye
las policies dedicadas `presupuestos_v2_select` (cliente ve solo filas
con su `cliente_id`) y `presupuestos_v2_modify_staff` (admin/empleado
escriben en su taller). El usuario tiene que correr el script en el
SQL Editor de Supabase una sola vez para que la pantalla "Mis
presupuestos" devuelva datos. Sin ejecutar el script la query devuelve
[] sin romper la UI — el cliente igual ve sus reparaciones pendientes.

## Empleado completo: vinculación y "Mi cobro" (Tarea #17)

A partir de la Tarea #17, el flujo del rol **empleado** quedó cerrado:

1. **Vinculación automática del perfil al empleado**. La tabla
   `codigos_empleado` ahora tiene la columna opcional `empleado_id`
   (FK a `empleados`). Cuando el admin genera un código desde la lista
   de empleados (botón **📨 Invitar** por fila) o desde Configuración
   → Usuarios eligiendo un empleado existente, el código queda
   "preasociado". Al aplicarlo, la nueva RPC `aplicar_codigo` setea en
   un solo paso `perfiles.rol`, `perfiles.taller_id` y
   `perfiles.empleado_id`. La RPC es `SECURITY DEFINER` para sortear el
   trigger que protege esos campos en la tabla `perfiles`.

2. **Bandeja de pendientes**. En Configuración → Usuarios aparece un
   recuadro "⚠️ Empleados pendientes de vincular" con cualquier perfil
   de rol `empleado` que todavía no tenga `empleado_id`, con botón
   directo a **🔗 Vincular**. Cada card de empleado muestra además a
   qué ficha está vinculado (o "Sin vincular").

3. **Pantalla "Mi cobro"** (`miCobro` en `js/auth/admin-v2.js`,
   ruta `mi-cobro`). El empleado ve su sueldo base, comisiones del
   período activo (suma de `pago` de `reparacion_mecanicos` cuyas
   reparaciones tienen `fecha` dentro del rango), total de horas
   trabajadas, vales tomados y total a cobrar. Cada comisión muestra
   patente, fecha y horas. El período se resuelve buscando el
   `periodos_sueldo` con `estado='abierto'` (mismo modelo que usa el
   admin en Sueldos); si no hay ninguno abierto, cae al mes corriente
   como fallback y se indica con un badge. Si el perfil aún no está
   vinculado, muestra un mensaje pidiendo al admin que lo vincule en
   lugar de fallar.

4. **RLS de `reparacion_mecanicos` ajustada** para que el empleado
   solo lea SUS propias filas (privacidad: ahí están las comisiones).
   Se reemplazó la antigua `reparacion_mecanicos_staff_all` por dos
   policies: `reparacion_mecanicos_admin_all` (admin sin restricción
   en su taller) y `reparacion_mecanicos_empleado_select_own`
   (empleado SELECT donde `empleado_id = empleado_id_actual()` o, por
   compatibilidad con datos viejos, `mecanico_id = auth.uid()`).

**SQL a correr**: el usuario tiene que volver a ejecutar
`supabase/rls_policies.sql` en el SQL Editor de Supabase (es
idempotente). Ese script agrega la columna `codigos_empleado.empleado_id`,
su FK a `empleados`, la RPC `aplicar_codigo` y la nueva separación de
policies en `reparacion_mecanicos`. Sin correrlo el botón "📨 Invitar"
sigue funcionando pero el código no queda preasociado (degradación
elegante: muestra un toast amarillo y se inserta sin la columna), y
la pantalla "Mi cobro" igual carga porque la policy vieja también
permite lectura al empleado.

## Caja del día y FAB de acciones rápidas (Tarea #18)

A partir de la Tarea #18, **Finanzas** abre por defecto la pantalla
**"Caja del día"** (`cajaDelDia` en `js/finances/caja.js`, ruta
`finanzas`). El menú lateral expone dos entradas: **💵 Caja del día**
(la pantalla nueva) y **Movimientos** (`finanzas-movimientos` → la
vista anterior `finanzas`).

1. **Pantalla "Caja del día"**. Muestra los KPIs del día (ingresos,
   egresos, saldo) y un detalle por origen: cobros de reparación,
   ventas/servicios, fiados cobrados, gastos y movimientos manuales.
   Lista cobros por método (efectivo, transferencia, tarjeta, crédito)
   y el efectivo en caja (cobros en efectivo − gastos del día). Abajo
   se muestra un **timeline cronológico unificado** con todos los
   movimientos del día y un badge de origen
   (COBRO / VENTA / SERVICIO / FIADO / GASTO / MANUAL); cada item lleva
   al detalle correspondiente. Hay un selector de fecha para revisar
   días anteriores.

2. **Botón "Cerrar caja"** siempre visible en la cabecera. Al cerrar
   se persiste el estado en `localStorage`
   (`tp_cierre_caja_<taller_id>_<fecha>`) con `ingresos`, `egresos`,
   `saldo`, `cerrado_por` y `cerrado_at`. No se crea ninguna tabla
   nueva (la `cierres_caja` que figuraba en `rls_policies.sql` nunca
   se materializó). Si el día está cerrado se muestra un banner con
   botón "Reabrir". El modal viejo `modalCierreCaja` se mantiene por
   compatibilidad con el dashboard y el tutorial, y ahora incluye un
   botón "Ir a Caja del día".

3. **FAB global "+"** (`js/core/fab.js`). Botón flotante fijo abajo a
   la derecha, visible en toda la app excepto el login y el rol
   `cliente`. Abre una hoja con accesos directos según el rol:
   - **Admin**: cobrar reparación, nueva venta, servicio rápido,
     nuevo gasto, ingreso/egreso manual y cobrar fiado.
   - **Empleado con `registrar_cobros`**: cobrar reparación y
     nueva venta.
   Cada acción reutiliza los modales existentes (`modalNuevaVenta`,
   `modalNuevoServicioRapido`, `modalNuevoGasto`, `finanzas_modalNuevo`,
   `modalPagosReparacion`, `navigate('creditos')`). "Cobrar reparación"
   abre primero un buscador propio (`fab_cobrarReparacion`) que lista
   reparaciones con saldo pendiente del taller y filtra por patente,
   cliente o descripción antes de abrir `modalPagosReparacion`. La
   visibilidad del FAB se actualiza automáticamente desde
   `navigate(...)` (llama a `fab_actualizarVisibilidad`).

No requiere correr SQL nuevo. La pantalla respeta RLS porque consulta
las tablas existentes (`pagos_reparacion`, `ventas`, `gastos_taller`,
`movimientos_financieros`, `fiados`) con el `taller_id` del usuario
actual.

## Anti-duplicados clientes y vehículos (Tarea #19)

A partir de la Tarea #19, antes de crear un cliente o un vehículo, la
app chequea si ya existe uno equivalente en el mismo taller y, si lo
hay, ofrece reusarlo en lugar de crear un duplicado.

1. **Helpers compartidos** (`js/core/components.js`):
   - `normalizarTelefono(t)` — solo dígitos.
   - `normalizarPatente(p)` — uppercase y sin espacios.
   - `buscarClienteExistente(tallerId, {telefono, ruc}, excludeId?)`
     — match exacto por teléfono normalizado o por RUC/CI no vacío,
     filtrado por `taller_id`.
   - `buscarVehiculoExistente(tallerId, patente, excludeId?)` — match
     exacto por patente normalizada, filtrado por `taller_id`.
   - `confirmarDuplicado({titulo, mensajeHtml, ...})` — modal de
     confirmación apilable (z-index 300) que NO cierra el modal de
     fondo. Devuelve `'usar' | 'crear' | 'cancelar'`.

2. **Cobertura completa**:
   - **Cliente**: alta normal en CRM (`guardarCliente`), wizard de
     reparación paso 1 (`wizardNextStep`), asistente IA
     (`crear_cliente`).
   - **Vehículo**: alta normal en CRM (`guardarVehiculo`, reemplaza
     el bloqueo duro previo por la confirmación), wizard de reparación
     paso 2, modal "nuevo trabajo" cuando crea vehículo en el momento
     (`guardarReparacion`), asistente IA (`crear_vehiculo`).

3. **Comportamiento de la IA**: como el flujo es no interactivo, si
   detecta un duplicado simplemente **reutiliza el existente** y lo
   informa por el chat + `console.log`. No crea duplicados ni pregunta.

4. **Sin cambios en la base**: validación 100% en capa de app, sin
   constraints UNIQUE adicionales, para permitir override consciente
   del admin (ej. dos personas distintas con el mismo número, o dos
   vehículos compartiendo patente vieja). No requiere correr SQL.

## Buscador global y atajos de navegación (Tarea #25)

Para que el equipo del taller llegue a cualquier ficha en pocos toques
sin tener que recorrer pantallas:

1. **Command palette / buscador global** (`js/core/palette.js`).
   Modal único que busca clientes, vehículos, trabajos e inventario en
   vivo. Se abre con la tecla `/` desde cualquier vista (ignora cuando
   el foco está en un input/textarea) y desde el botón "Buscar" del
   bottom-nav. Si el campo está vacío muestra "Recientes" (clientes y
   trabajos abiertos previamente). Solo lo ven `admin` y `empleado`.

2. **Recientes** (`recordReciente` / `getRecientes` en
   `js/core/components.js`). Cada vez que se abre la ficha de un
   cliente (`detalleCliente`) o de un trabajo (`detalleReparacion`) se
   guarda en `localStorage` (`tp_recientes_clientes_<tallerId>` y
   `tp_recientes_reparaciones_<tallerId>`, máx. 10). El dashboard y el
   palette muestran las 4–5 últimas como chips clicables.

3. **Combobox autocompletar reusable** (`renderComboboxAuto` en
   `js/core/components.js`). Input visible + lista filtrada en vivo +
   `<input type="hidden">` con el id elegido. Reemplaza al `<select>`
   nativo en el wizard de "nueva reparación" (paso 1: cliente, paso 2:
   vehículo) para escribir y filtrar en lugar de scrollear.

4. **Atajos en la ficha del cliente** (`js/crm/clientes.js`). Tres
   botones nuevos: "🔧 Nuevo trabajo" (abre el wizard saltando el paso 1
   con el cliente preseleccionado), "📅 Agendar turno"
   (`quickAgendarCita` → `modalNuevaCita` con cliente preseteado) y
   "💰 Cobrar fiado" (visible solo si tiene saldo pendiente).

5. **Filtros en lista de trabajos** (`js/workshop/reparaciones-list.js`).
   - Selector de mecánico arriba de las pestañas (admin/empleado).
   - Pestaña rápida "⏱ +7d" → fuerza `estado=esperando_repuestos` con
     `updated_at < hoy-7d`.
   - Cada tarjeta `esperando_repuestos` muestra "⏱ X días esperando"
     en amarillo (≥7d) o rojo (≥14d), calculado desde `updated_at`.

6. **Cobrar reparación priorizado** (`fab_cobrarReparacion` en
   `js/core/fab.js`). Ahora ordena por fecha ascendente (deudas más
   antiguas primero) y muestra "⏱ Xd sin cobrar" en cada fila para que
   el cobrador identifique de un vistazo lo que más urge.

7. **Badges en sidebar** (`cargarBadgesNav` en
   `js/navigation/navigation.js`). Carga asíncrona de contadores:
   - **Admin** → "Solicitudes" muestra perfiles cliente sin vincular +
     turnos pendientes.
   - **Cliente** → "Mis presupuestos" suma presupuestos `generado` +
     reparaciones con `aprobacion_cliente=pendiente`; "Mis turnos"
     muestra citas confirmadas futuras.

No requiere correr SQL nuevo. Todas las consultas usan tablas
existentes y respetan RLS.

## Centro de cobros unificado (Tarea #34)

El taller real reportó que tenía "demasiados lugares para registrar pagos
y se le perdían". Ahora hay dos vistas únicas que centralizan todo:

1. **"💰 Por cobrar"** (`porCobrar` en `js/finances/por-cobrar.js`).
   Lista en una sola pantalla todo lo que le deben al taller:
   - **Reparaciones con saldo pendiente** (calculado en vivo desde
     `pagos_reparacion`), ordenadas por fecha ascendente y con badge
     "⏱ Xd" coloreado (gris <7d, amarillo ≥7d, rojo ≥30d).
   - **Fiados pendientes** de la tabla `fiados`.
   - Encabezado con dos cifras grandes: "TE DEBEN ₲X" y "HOY COBRASTE
     ₲Y" (suma de ingresos del día desde `movimientos_financieros`).
   - Cada fila tiene botón **"Cobrar"** que dispara el flujo existente
     (`modalPagosReparacion` para reparaciones, marcado directo para
     fiados) y refresca la lista en lugar de saltar al detalle, así el
     usuario va tachando pendientes sin perderse.
   - Visible para **admin** y para **empleados con permiso
     `registrar_cobros`**.

2. **"📤 Por pagar"** (`porPagar`). Vista análoga para egresos, solo
   admin. Lista cuentas a proveedores (`cuentas_pagar.pagada=false`) y
   liquidaciones de sueldo no pagadas (`liquidaciones.estado!='pagado'`),
   con botón "Pagar" en cada fila que reusa la lógica de
   `marcarCuentaPagada` y `registrarPagoSueldo` (los mismos triggers de
   Supabase insertan el egreso en `movimientos_financieros`).

3. **Cambio mínimo en `reparaciones-pagos.js`**. `modalPagosReparacion`
   acepta un 3er parámetro opcional `onSuccess(repId)`. Si se pasa, se
   llama después del cobro exitoso en lugar de navegar al detalle. Lo
   usa "Por cobrar" para refrescarse a sí misma. Si nadie lo pasa, el
   comportamiento es idéntico al anterior (navega al detalle).

4. **Badges en sidebar**. `cargarBadgesNav` carga en background el
   conteo de pendientes via `porCobrar_contar()` y `porPagar_contar()`
   y los pinta junto a los items "💰 Por cobrar" (rojo) y
   "📤 Por pagar" (amarillo).

5. **Permisos en `navigate()`**. `por-pagar` está en `adminOnly`.
   `por-cobrar` se valida explícitamente: admin O empleado con
   `tienePerm('registrar_cobros')`.

No requiere correr SQL nuevo. Reusa todas las tablas, triggers y
permisos existentes.

## Vista "Para hoy" personal (Tarea #29)

Para que el empleado/admin entre a la app y arranque sin tener que
cazar pestañas, hay una vista única que junta los tres pendientes más
frecuentes del día.

1. **Pantalla "Para hoy"** (`paraHoy` en `js/workshop/para-hoy.js`,
   ruta `para-hoy`). Accesible desde:
   - Sidebar → PRINCIPAL → "📋 Para hoy" (admin y empleado).
   - Tarjeta destacada arriba del dashboard staff con el mismo título.

2. **Tres bloques en la misma pantalla**:
   - **Mis trabajos en curso**: reparaciones en estado `pendiente` o
     `en_progreso` asignadas al usuario via `reparacion_mecanicos`
     (match por `empleado_id = currentPerfil.empleado_id` o por
     `mecanico_id = auth.uid()`, mismo criterio que `misTrabajos` y
     `miCobro`). Cada card incluye el botón **✓ HECHO HOY** que pasa
     la reparación a `finalizado` con un toque (`paraHoy_marcarHecho`,
     usa `offlineUpdate` + `clearCache`). Para admin sin asignaciones
     propias, muestra todas las reparaciones activas del taller con
     un badge "overview taller".
   - **Mis turnos de hoy**: `citas` con `fecha = hoy` y
     `estado IN (pendiente, confirmada)` filtradas por
     `responsable_id = currentPerfil.empleado_id` (empleado) o
     mostradas todas con la etiqueta del responsable (admin). El
     selector de responsable se completa al crear la cita
     (`modalNuevaCita` en `js/workshop/agenda.js`), por defecto
     proponiendo al usuario actual si está vinculado a un empleado.
   - **Repuestos llegaron** + **Esperan repuestos**: las reparaciones
     en `esperando_repuestos` se parten en dos. Para detectar que un
     repuesto llegó, se cruzan los `reparacion_items` de cada
     reparación contra `movimientos_inventario` tipo='entrada' de los
     últimos 7 días, primero por `inventario_id` (agregado en el
     ítem cuando se elige del inventario) y, como fallback, por
     `descripcion` normalizada contra `inventario.nombre`. Las que
     tienen al menos una entrada matching aparecen arriba con el
     banner verde "📦 Llegó al stock: …, hace X días"; el resto va
     debajo en "Esperan repuestos" con el badge "X días esperando"
     (amarillo ≥7d, rojo ≥14d).

3. **Migración de schema** (`supabase/rls_policies.sql` sección 3.D):
   - `citas.responsable_id uuid` con FK a `empleados(id) ON DELETE
     SET NULL` y `índice (responsable_id, fecha)`.
   - `reparacion_items.inventario_id uuid` con FK a `inventario(id)
     ON DELETE SET NULL` e índice parcial.
   El JS hace fallback graceful si las columnas todavía no fueron
   migradas (los inserts reintentan sin el campo si Postgres rechaza
   por columna inexistente, las queries de turnos caen a "vista
   taller-wide" y se muestra un banner de aviso al admin).

Las consultas respetan RLS:
`reparacion_mecanicos_empleado_select_own`, `citas`, `reparaciones`,
`reparacion_items`, `movimientos_inventario`, `empleados`, `inventario`
filtran por `taller_id` (o por `reparacion_id` para
`reparacion_mecanicos`).

## Aviso "repuesto llegó" al cliente (Tarea #30)

Cierra el ciclo del badge "X días esperando" (#25) avisando al cliente
en cuanto el repuesto entra al stock.

1. **Detección automática post-entrada** (`js/workshop/repuesto-llego.js`,
   helper `repuestoLlego_chequear`). Cuando `guardarEntrada()` en
   `js/workshop/inventario.js` termina de registrar una compra a
   proveedor, llama al helper con el `inventario_id` y el nombre del
   producto. El helper:
   - Busca todas las reparaciones del taller en estado
     `esperando_repuestos`.
   - Cruza sus `reparacion_items` contra el id que acaba de entrar (o
     por nombre normalizado si el ítem no tiene `inventario_id`).
   - Marca las reparaciones cruzadas con
     `reparaciones.repuesto_disponible_at = now()` (sin pisar si ya
     estaba) y abre un modal con la lista de reparaciones afectadas y
     un botón "💬 Avisar al cliente" por cada una.

2. **Botón en la ficha de la reparación**
   (`js/workshop/reparaciones-detalle.js`):
   - Banner verde "📦 REPUESTO DISPONIBLE" cuando
     `repuesto_disponible_at` está seteado y la reparación todavía
     está en `esperando_repuestos`, con CTA "💬 Avisar".
   - Botón siempre visible "📦 Avisar al cliente que llegó el
     repuesto" cuando la reparación está en `esperando_repuestos` y
     el cliente tiene teléfono (permite mandar el aviso aunque el
     repuesto haya entrado antes de aplicar la migración o por una
     vía no automatizada).
   - Ambos disparan `repuestoLlego_enviarWhatsApp(repId)`, que arma
     un mensaje configurable con la plantilla `repuesto_listo` de
     `js/integrations/recordatorios.js` (variables `{cliente}`,
     `{vehiculo}`, `{descripcion}`, `{taller}`, `{link}`) y abre
     `wa.me/595…`. El `{link}` es un deep-link al portal del cliente
     (`<origin>/?rep=<id>`); si la plantilla configurada no lo incluye,
     se anexa al final del mensaje para garantizar que el WhatsApp
     siempre lleve el enlace de agendamiento.

3. **Indicador en listados**:
   - `js/workshop/reparaciones-list.js` muestra un sub-badge verde
     "📦 Repuesto disponible — avisar al cliente" en cada card en
     estado `esperando_repuestos` con `repuesto_disponible_at`.
   - `js/workshop/kanban.js` agrega la misma marca en la columna
     "ESPERANDO REPUESTOS" del panel de trabajo.

4. **Migración de schema** (`supabase/rls_policies.sql` sección 3.E):
   - `reparaciones.repuesto_disponible_at timestamptz` + índice
     parcial donde no es null.
   El JS hace fallback graceful si la columna no existe: el helper
   intenta el update y, si Postgres responde con error de columna
   inexistente, sigue funcionando (sin marca persistente, pero el
   modal de aviso y el botón manual siguen activos).

5. **Plantilla configurable**: `MENSAJES_PREDEFINIDOS.repuesto_listo`
   en `js/integrations/recordatorios.js`. Aparece como pestaña
   "Repuesto llegó" dentro de "📨 Configurar mensajes automáticos"
   y se puede personalizar (se persiste en `localStorage`).


## Reparar cuentas viejas pagadas sin egreso (Tarea #42)

Desde la **Tarea #35** existe un trigger en Supabase
(`trg_cuenta_pagar_egreso` en `rls_policies.sql` sección 3.F) que inserta
el egreso en `movimientos_financieros` en la misma transacción que el
`UPDATE cuentas_pagar.pagada=true`. Casos nuevos no pueden quedar
inconsistentes. Pero los pagos viejos hechos antes del fix podrían haber
quedado con `pagada=true` sin egreso si la app o la red se cortaba entre
los dos pasos. La Tarea #42 agrega una verificación de una sola vez (que
también puede correrse cuando se quiera) para detectarlos y compensarlos.

1. **Detector** (`cuentas_detectarPagadasSinEgreso` en
   `js/finances/cuentas.js`). Trae todas las `cuentas_pagar` con
   `pagada=true` del taller, busca en `movimientos_financieros` los que
   tengan `referencia_tabla='cuentas_pagar'` apuntando a esas cuentas
   (en bloques de 100 ids para no pasar el límite de `IN`), y devuelve
   la diferencia: cuentas pagadas que **no** tienen su egreso. El
   resultado viene ordenado de la más vieja a la más reciente.

2. **Reparador** (`cuentas_repararPagadasSinEgreso`). Para cada cuenta
   inserta un `movimientos_financieros` con `tipo='egreso'`, categoría
   "Repuestos" (autocreada vía `obtenerCategoriaFinanciera` si no
   existía), `monto` y `fecha = fecha_pago` original (o hoy si la
   cuenta no tenía `fecha_pago`), `referencia_id`/`referencia_tabla`
   apuntando a la cuenta. Antes de cada insert re-chequea que no exista
   ya, así dos pestañas haciendo "Reparar" en simultáneo no duplican
   egresos. Limpia los caches de `cuentas` y `finanzas` al terminar.

3. **Pantalla de revisión** (`cuentas_modalRevisarPagadasSinEgreso`).
   Modal admin-only con la lista (proveedor, fecha de pago, notas,
   monto), total a regularizar y botón **🔧 Reparar las N cuenta(s)**.
   Re-detecta al click para no apoyarse en datos viejos. Después
   refresca la lista y, si está abierta Finanzas, refresca también la
   pantalla principal.

4. **Aviso pasivo en Finanzas** (`finanzas_renderBannerCuentasViejas`
   en `js/finances/finanzas.js`). Cada vez que `finanzas_cargarDatos`
   pinta los movimientos, llama al detector en background. Si hay
   cuentas viejas sin egreso, muestra arriba de la lista un banner
   amarillo "⚠️ CAJA DESCUADRADA — N cuenta(s) pagada(s) sin egreso
   (₲X total)" con botón **Revisar**. Si no hay nada, el banner queda
   vacío y no aparece. Falla silenciosa: si la consulta tira error no
   rompe la pantalla.

5. **Botón directo**. Además del banner automático, la barra de
   acciones de Finanzas suma "🧾 Cuentas viejas" para abrir la
   pantalla de revisión cuando quiera el admin (útil después de
   importar datos o si recién cerró el banner).

Idempotencia total: si se corre dos veces seguidas, la segunda no
inserta nada (la verificación previa al insert lo evita). No requiere
correr SQL nuevo: usa el catálogo de categorías y la tabla
`movimientos_financieros` que ya existían.

## Triggers financieros automáticos en Supabase (Tarea #44)

La tabla `movimientos_financieros` es **de sólo lectura para el JS en el
caso normal**. La escriben 7 triggers en Postgres que se disparan
automáticamente cuando el JS escribe en la tabla de origen del evento.
Vivían en la base de producción desde hace tiempo pero no estaban
versionados; ahora `supabase/rls_policies.sql` (sección **3.F**) los
crea con `CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS`, así que
correrlo en una base que ya los tiene es seguro y en una base nueva los
crea desde cero.

| Tabla origen      | Evento  | Trigger                              | Movimiento que inserta                       |
|-------------------|---------|--------------------------------------|----------------------------------------------|
| `cuentas_pagar`   | UPDATE  | `trigger_cuenta_pagada`              | egreso "Repuestos" (paga proveedor)          |
| `liquidaciones`   | UPDATE  | `trigger_sueldo_pagado`              | egreso "Sueldos" (paga liquidación)          |
| `pagos_reparacion`| INSERT  | `trigger_pago_reparacion_movimiento` | ingreso "Reparaciones" (cobro de OT)         |
| `gastos_taller`   | INSERT  | `trigger_gasto_movimiento`           | egreso por `categoria` del gasto             |
| `ventas`          | INSERT  | `trigger_venta_movimiento`           | ingreso "Ventas" (cuando `estado=completado`)|
| `fiados`          | INSERT  | `trigger_credito_otorgado`           | ingreso "Créditos otorgados" (no afecta caja)|
| `fiados`          | UPDATE  | `trigger_pago_credito`               | ingreso "Cobro de créditos" (cuando se paga) |

Reglas de oro:

1. **El JS NUNCA debería hacer `insert` directo a `movimientos_financieros`**
   para reflejar uno de estos 7 eventos: el trigger ya lo hace y
   duplicarlo solo agrega trabajo (la unicidad evita el doble cobro,
   pero no el doble código). Lugares actuales con insert directo,
   auditados:

   | Archivo | Caso | Compite con trigger? |
   |---|---|---|
   | `js/finances/finanzas.js` | Modal "Nuevo movimiento" del admin | No, no tiene tabla origen. |
   | `js/hr/empleados.js` | Vale/adelanto al empleado | No, `vales_empleado` no tiene trigger. |
   | `js/finances/cuentas.js` | Reparador retroactivo de cuentas viejas (Tarea #42) | Sí superficialmente, pero está pensado para cubrir cuentas anteriores a que existiera el trigger. |
   | `js/finances/conciliador.js` | Reparador genérico de movimientos faltantes en un día | Sí superficialmente. Igual que arriba: protegido por la doble verificación previa al insert. |
   | `js/workshop/reparaciones-detalle.js` | Cobro completo al finalizar la OT | Sí: competiría con `trigger_pago_reparacion_movimiento` si el mismo flujo crea un `pagos_reparacion`. Hoy convive porque el insert directo usa `referencia_tabla='reparaciones'` y el trigger usa `'pagos_reparacion'`, así que el `ON CONFLICT` no matchea (oportunidad futura: simplificar). |
   | `js/workshop/inventario.js` | Egreso por compra al contado (sin pasar por `cuentas_pagar`) | No compite con triggers. **Bug abierto**: usa la columna `descripcion` en vez de `concepto` y el insert revienta en silencio. Cubierto por la Tarea #48. |

   Si tenés que sumar uno nuevo, primero preguntate si el evento ya
   tiene un trigger; si lo tiene, **no lo dupliques** — escribí en la
   tabla origen y dejá que el trigger se encargue.
2. **La columna correcta del concepto se llama `concepto`**, no
   `descripcion`. El bug típico es copiar un insert de otra tabla y
   dejar `descripcion`. Postgres tira error y el `try/catch` silencioso
   se lo come (caso real: tareas #43 y #48). Si tenés que agregar un
   insert manual, copiá el shape del modal de Finanzas, no de otro lado.
3. **Idempotencia** vía `ON CONFLICT (referencia_id, referencia_tabla)
   DO NOTHING`. Por eso la sección 3.F crea un `UNIQUE INDEX
   movimientos_financieros_referencia_unico` sobre esas dos columnas.
   Ese índice ya existe en producción (los triggers lo necesitan para
   funcionar) pero el SQL lo declara explícitamente para que un
   Supabase nuevo lo tenga.
4. **Categorías autocreadas**: cada trigger crea su categoría en
   `categorias_financieras` si no existe. No hace falta sembrar nada al
   crear un taller.
5. **Resta el trigger redundante de #35**: `trg_cuenta_pagar_egreso` y
   su función `cuenta_pagar_egreso` quedaron obsoletos porque
   `trigger_cuenta_pagada` ya cubría el caso. La sección 3.F los borra
   con `DROP TRIGGER IF EXISTS` y `DROP FUNCTION IF EXISTS` antes de
   crear el bloque nuevo, así una base que llegó a aplicar el SQL de #35
   queda limpia.
