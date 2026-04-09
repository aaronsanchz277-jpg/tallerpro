// ─── MI PERFIL (Empleado + Cliente) ─────────────────────────────────────────
async function miPerfil() {
  const { data: perfil } = await sb.from('perfiles')
    .select('id, nombre, rol, taller_id, talleres(nombre)')
    .eq('id', currentUser.id).single();
  if (!perfil) return;

  const email = currentUser.email;
  const rol = perfil.rol;
  const tallerNombre = perfil.talleres?.nombre || '';

  document.getElementById('main-content').innerHTML = `
    <div style="padding:.25rem 0">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--surface);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-head);font-size:1.8rem;color:var(--accent);font-weight:700">${h(perfil.nombre).charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-family:var(--font-head);font-size:1.3rem;color:var(--text)">${h(perfil.nombre)}</div>
          <div style="font-size:.8rem;color:var(--text2)">${h(email)}</div>
          <div style="font-size:.75rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px;margin-top:.2rem">${rol.toUpperCase()} · ${h(tallerNombre)}</div>
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.25rem;margin-bottom:1rem">
        <div style="font-family:var(--font-head);font-size:.85rem;color:var(--text2);letter-spacing:1px;margin-bottom:1rem">DATOS PERSONALES</div>
        <div class="form-group"><label class="form-label">Nombre</label><input class="form-input" id="f-perfil-nombre" value="${h(perfil.nombre)}"></div>
        <button class="btn-primary" onclick="guardarPerfil()">GUARDAR CAMBIOS</button>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.25rem;margin-bottom:1rem">
        <div style="font-family:var(--font-head);font-size:.85rem;color:var(--text2);letter-spacing:1px;margin-bottom:1rem">SEGURIDAD</div>
        <div class="form-group"><label class="form-label">Nueva contraseña</label><input class="form-input" id="f-perfil-pass" type="password" placeholder="Dejar vacío para no cambiar"></div>
        <div class="form-group"><label class="form-label">Confirmar contraseña</label><input class="form-input" id="f-perfil-pass2" type="password" placeholder="Repetir contraseña"></div>
        <button class="btn-secondary" onclick="cambiarPassPerfil()">CAMBIAR CONTRASEÑA</button>
      </div>

      <button onclick="logout()" style="width:100%;background:rgba(255,68,68,.1);color:var(--danger);border:1px solid rgba(255,68,68,.3);border-radius:10px;padding:.7rem;font-family:var(--font-head);font-size:.9rem;cursor:pointer;letter-spacing:1px">CERRAR SESIÓN</button>
    </div>`;
}

async function guardarPerfil() {
  const nombre = document.getElementById('f-perfil-nombre').value.trim();
  if (!nombre) { toast('El nombre es obligatorio','error'); return; }
  const { error } = await sb.from('perfiles').update({ nombre }).eq('id', currentUser.id);
  if (error) { toast('Error: '+error.message,'error'); return; }
  currentPerfil.nombre = nombre;
  toast('Perfil actualizado','success');
}

async function cambiarPassPerfil() {
  const pass = document.getElementById('f-perfil-pass').value;
  const pass2 = document.getElementById('f-perfil-pass2').value;
  if (!pass) { toast('Ingresá la nueva contraseña','error'); return; }
  if (pass.length < 6) { toast('Mínimo 6 caracteres','error'); return; }
  if (pass !== pass2) { toast('Las contraseñas no coinciden','error'); return; }
  const { error } = await sb.auth.updateUser({ password: pass });
  if (error) { toast('Error: '+error.message,'error'); return; }
  document.getElementById('f-perfil-pass').value = '';
  document.getElementById('f-perfil-pass2').value = '';
  toast('Contraseña actualizada','success');
}

