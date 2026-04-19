// ─── INTEGRACIÓN GOOGLE CALENDAR ────────────────────────────────────────────
const GOOGLE_CLIENT_ID = 'TU_CLIENT_ID.apps.googleusercontent.com'; // Obtener de Google Cloud Console
const GOOGLE_API_KEY = 'TU_API_KEY';

let _googleTokenClient = null;

async function googleCalendar_init() {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'TU_CLIENT_ID...') {
    console.warn('Google Calendar no configurado');
    return;
  }
  
  await new Promise((resolve) => {
    if (window.google) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = resolve;
    document.head.appendChild(script);
  });
  
  _googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    callback: async (response) => {
      if (response.error) return;
      await sb.from('google_calendar_tokens').upsert({
        taller_id: tid(),
        access_token: response.access_token,
        expiry_date: Date.now() + (response.expires_in * 1000),
        sync_enabled: true
      });
      toast('✓ Conectado a Google Calendar', 'success');
      googleCalendar_syncCitas();
    },
  });
}

async function googleCalendar_autorizar() {
  if (!_googleTokenClient) await googleCalendar_init();
  _googleTokenClient.requestAccessToken();
}

async function googleCalendar_syncCitas() {
  const { data: tokens } = await sb.from('google_calendar_tokens').select('*').eq('taller_id', tid()).maybeSingle();
  if (!tokens?.sync_enabled) return;
  
  const { data: citas } = await sb.from('citas').select('*, clientes(nombre), vehiculos(patente)')
    .eq('taller_id', tid()).in('estado', ['confirmada', 'pendiente']).gte('fecha', fechaHoy());
  
  for (const cita of citas) {
    const evento = {
      summary: `${cita.descripcion} - ${cita.clientes?.nombre || ''}`,
      description: `Vehículo: ${cita.vehiculos?.patente || 'N/A'}\nNotas: ${cita.notas || ''}`,
      start: { dateTime: `${cita.fecha}T${cita.hora || '09:00'}:00-04:00`, timeZone: 'America/Asuncion' },
      end: { dateTime: `${cita.fecha}T${sumarMinutos(cita.hora || '09:00', cita.duracion || 60)}:00-04:00`, timeZone: 'America/Asuncion' }
    };
    
    await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(evento)
    });
  }
  
  toast('Citas sincronizadas con Google Calendar', 'success');
}

function sumarMinutos(hora, minutos) {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function modalConfigurarGoogleCalendar() {
  openModal(`
    <div class="modal-title">📅 Google Calendar</div>
    <p style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">Sincronizá tus citas automáticamente con Google Calendar.</p>
    <button class="btn-primary" onclick="googleCalendar_autorizar()">Conectar cuenta de Google</button>
    <button class="btn-secondary" onclick="closeModal()">Cerrar</button>
  `);
}
