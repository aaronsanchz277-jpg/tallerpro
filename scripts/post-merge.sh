#!/bin/bash
# Post-merge hook for TallerPro.
#
# TallerPro es vanilla JS + Node estático (sin npm install, sin migraciones
# automáticas — los cambios SQL se aplican manualmente en Supabase). Por eso
# este script es intencionalmente un no-op: solo existe para que el sistema
# no avise "HOOK_NOT_FOUND" en cada merge. La reconciliación de workflows
# (reiniciar "Start application" si está corriendo) la hace el sistema
# automáticamente después de este script.
#
# Si en el futuro suma un package.json o pasa a usar migraciones automáticas,
# acá va `npm ci --silent` o `node scripts/aplicar-migraciones.js`, etc.
set -e
echo "[post-merge] TallerPro: nada que instalar ni migrar (vanilla JS + Node estático). OK."
