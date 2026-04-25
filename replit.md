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
