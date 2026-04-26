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
