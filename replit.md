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
