// ─── BUSCADOR DE PATENTE EN EL DASHBOARD ────────────────────────────────────
// El input del dashboard llama a `buscarPatente(this.value)` con un debounce
// de 500ms. Devuelve hasta 3 vehículos con su historial reciente y badge de
// garantía vigente cuando aplica.
let patenteBusquedaTimer = null;
async function buscarPatente(valor) {
  const resultsEl = document.getElementById('patente-results');
  if (!resultsEl) return;
  const patente = valor.trim().toUpperCase();
  if (!patente) { resultsEl.innerHTML = ''; return; }
  clearTimeout(patenteBusquedaTimer);
  patenteBusquedaTimer = setTimeout(async () => {
    await safeCall(async () => {
      const { data: vehs, fromCache } = await cachedQuery(`buscar_patente_${patente}`, () =>
        sb.from('vehiculos').select('*, clientes(nombre,telefono), reparaciones(id,descripcion,estado,costo,fecha,meses_garantia)').eq('taller_id', tid()).ilike('patente', `%${escapeLikePattern(patente)}%`).limit(3)
      );
      if (!vehs || vehs.length === 0) {
        resultsEl.innerHTML = `<div style="background:var(--surface2);border-radius:10px;padding:.75rem;margin-bottom:1rem;font-size:.85rem;color:var(--text2)">${t('dashPatenteNoEncontrada')}</div>`;
        return;
      }
      let html = fromCache ? `<div style="font-size:.6rem;color:var(--warning);margin-bottom:.3rem;display:flex;align-items:center;gap:4px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        ${t('dashResultadosCache')}
      </div>` : '';
      html += vehs.map(v => {
        const reps = (v.reparaciones || []).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 5);

        let garantiaHTML = '';
        const ahora = new Date();
        const reparacionEnGarantia = reps.find(r => {
          if (r.estado !== 'finalizado') return false;
          const mesesGarantia = r.meses_garantia || 3;
          const fechaRep = new Date(r.fecha);
          const fechaVencimiento = new Date(fechaRep);
          fechaVencimiento.setMonth(fechaVencimiento.getMonth() + mesesGarantia);
          return fechaVencimiento > ahora;
        });
        if (reparacionEnGarantia) {
          const mesesGarantia = reparacionEnGarantia.meses_garantia || 3;
          garantiaHTML = `<div style="background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.3);border-radius:6px;padding:.25rem .5rem;margin-top:.3rem;font-size:.7rem;color:var(--accent);display:inline-block">⚠️ ${t('enGarantia')} (${mesesGarantia} ${t('meses')})</div>`;
        }

        return `
          <div style="background:var(--surface);border:1px solid var(--accent);border-radius:12px;padding:1rem;margin-bottom:1rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
              <div>
                <div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);letter-spacing:2px">${h(v.patente)}</div>
                <div style="font-size:.82rem;color:var(--text2)">${h(v.marca || '')} ${h(v.modelo || '')} ${v.anio ? '· ' + v.anio : ''}</div>
                ${v.clientes ? `<div style="font-size:.8rem;color:var(--text2);display:flex;align-items:center;gap:4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  ${h(v.clientes.nombre)}
                </div>` : ''}
                ${garantiaHTML}
              </div>
              <button onclick="detalleVehiculo('${v.id}')" style="font-size:.72rem;background:none;border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:3px 8px;cursor:pointer">${t('dashVer')}</button>
            </div>
            <div style="font-size:.72rem;color:var(--text2);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.4rem">${t('dashHistorial')} (${reps.length})</div>
            ${reps.length === 0 ? `<div style="font-size:.8rem;color:var(--text2)">${t("vehSinReps")}</div>` :
              reps.map(r => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.82rem">
                <span>${h(r.descripcion)}</span>
                <span class="card-badge ${estadoBadge(r.estado)}" style="font-size:.65rem">${estadoLabel(r.estado)}</span>
              </div>`).join('')}
          </div>`;
      }).join('');
      resultsEl.innerHTML = html;
    }, null, 'Error al buscar patente');
  }, 500);
}
