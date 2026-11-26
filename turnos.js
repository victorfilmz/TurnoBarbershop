// ==========================================
// VIP BARBER CLUB - SISTEMA DE TURNOS DIARIOS
// ==========================================

const WHATSAPP_BARBERO = "18293407096";

// Horario: 9:00 AM a 8:00 PM cada 30 minutos (22 turnos por día)
const TURNOS_HORARIOS = [
  "09:00 AM", "09:30 AM",
  "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM",
  "01:00 PM", "01:30 PM",
  "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM",
  "04:00 PM", "04:30 PM",
  "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM",
  "07:00 PM", "07:30 PM"
];

let turnoSeleccionadoHora = null;
let filtroActual = "todos";

document.addEventListener("DOMContentLoaded", () => {
  iniciarReloj();
  mostrarFechaHoy();
  verificarReinicioDiario();
  renderizarTurnos();
});

// Obtener clave del día (ej: "turnos_2026-11-26")
function getTodayKey() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `barbershop_turnos_${yyyy}-${mm}-${dd}`;
}

// Cargar o inicializar turnos de hoy
function obtenerTurnosHoy() {
  const key = getTodayKey();
  const guardados = localStorage.getItem(key);

  if (guardados) {
    try {
      return JSON.parse(guardados);
    } catch(e) {}
  }

  // Generar lista limpia para el día
  const turnosIniciales = TURNOS_HORARIOS.map((hora, index) => ({
    id: index + 1,
    hora: hora,
    ocupado: false,
    cliente: null,
    telefono: null,
    servicio: null,
    horaReserva: null
  }));

  localStorage.setItem(key, JSON.stringify(turnosIniciales));
  return turnosIniciales;
}

function guardarTurnosHoy(turnos) {
  const key = getTodayKey();
  localStorage.setItem(key, JSON.stringify(turnos));
}

// Limpiar días anteriores para no llenar almacenamiento
function verificarReinicioDiario() {
  const keyHoy = getTodayKey();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("barbershop_turnos_") && k !== keyHoy) {
      localStorage.removeItem(k);
    }
  }
}

// Mostrar fecha en español en cabecera
function mostrarFechaHoy() {
  const hoy = new Date();
  const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const str = hoy.toLocaleDateString('es-ES', opciones);
  document.getElementById("currentDateStr").textContent = "Turnos para hoy: " + str.charAt(0).toUpperCase() + str.slice(1);
}

// Reloj en tiempo real
function iniciarReloj() {
  const clockEl = document.getElementById("liveClock");
  const tick = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('es-ES', { hour12: true });
  };
  tick();
  setInterval(tick, 1000);
}

// Renderizar la lista de turnos en pantalla
function renderizarTurnos() {
  const turnos = obtenerTurnosHoy();
  const grid = document.getElementById("turnosGrid");
  grid.innerHTML = "";

  let countDisponibles = 0;
  let countOcupados = 0;

  // Evaluar estado según la hora actual
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  turnos.forEach(turno => {
    // Calcular si la hora ya pasó
    const horaObj = parseHoraTurno(turno.hora);
    const yaPaso = (currentHour > horaObj.hour) || (currentHour === horaObj.hour && currentMinute >= horaObj.minute);

    if (turno.ocupado) {
      countOcupados++;
    } else if (!yaPaso) {
      countDisponibles++;
    }

    // Aplicar filtros
    if (filtroActual === "disponibles" && (turno.ocupado || yaPaso)) return;
    if (filtroActual === "ocupados" && !turno.ocupado) return;

    // Crear Card de Turno
    const card = document.createElement("div");
    card.className = "bg-[#131722] border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden";

    if (turno.ocupado) {
      // ESTADO: OCUPADO
      card.classList.add("border-rose-500/30", "bg-rose-950/10");
      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="text-xs uppercase tracking-wider text-rose-400 font-bold block">
              <i class="fas fa-lock"></i> Ocupado (Bloqueado)
            </span>
            <h3 class="text-xl font-black text-white font-heading mt-0.5">${turno.hora}</h3>
          </div>
          <span class="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-bold">
            🔴
          </span>
        </div>

        <div class="my-3 py-2.5 px-3 bg-black/40 rounded-xl border border-white/5">
          <p class="text-xs text-slate-400">Tomado por:</p>
          <p class="text-sm font-extrabold text-white truncate"><i class="fas fa-user-check text-rose-400 mr-1.5"></i>${turno.cliente}</p>
          <p class="text-[11px] text-barber-gold font-medium mt-1 truncate">${turno.servicio || 'Servicio Barbería'}</p>
        </div>

        <div class="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
          <span>No disponible</span>
          <span class="text-rose-400 font-bold">Llegar 10 min antes</span>
        </div>
      `;
    } else if (yaPaso) {
      // ESTADO: HORA PASADA
      card.classList.add("border-white/5", "opacity-50", "bg-black/20");
      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="text-xs uppercase tracking-wider text-slate-500 font-bold block">Turno Vencido</span>
            <h3 class="text-xl font-black text-slate-400 font-heading mt-0.5">${turno.hora}</h3>
          </div>
          <span class="text-xs text-slate-500 font-bold">⏳</span>
        </div>
        <p class="text-xs text-slate-500 my-4">Este horario ya transcurrió el día de hoy.</p>
        <button disabled class="w-full py-2 bg-white/5 text-slate-600 rounded-xl text-xs font-bold cursor-not-allowed">
          Hora Pasada
        </button>
      `;
    } else {
      // ESTADO: DISPONIBLE
      card.classList.add("border-emerald-500/30", "hover:border-barber-gold", "hover:shadow-xl", "hover:shadow-barber-gold/5", "group");
      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="text-xs uppercase tracking-wider text-emerald-400 font-bold block flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Disponible
            </span>
            <h3 class="text-xl font-black text-white font-heading mt-0.5 group-hover:text-barber-gold transition">${turno.hora}</h3>
          </div>
          <span class="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
            🟢
          </span>
        </div>

        <div class="my-3 py-2 px-3 bg-white/5 rounded-xl text-xs text-slate-300">
          <i class="fas fa-check-circle text-emerald-400 mr-1"></i> Libre para reservar ahora
          <p class="text-[11px] text-amber-300/80 mt-1"><i class="fas fa-clock mr-1"></i>Estar 10 min antes</p>
        </div>

        <button onclick="abrirBookingModal('${turno.hora}')" class="w-full py-2.5 bg-barber-gold hover:bg-yellow-400 text-black font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-barber-gold/20 active:scale-95 transition">
          <i class="fas fa-calendar-check"></i>
          <span>Tomar este Turno</span>
        </button>
      `;
    }

    grid.appendChild(card);
  });

  // Actualizar métricas
  document.getElementById("statDisponibles").textContent = countDisponibles;
  document.getElementById("statOcupados").textContent = countOcupados;
}

// Convertir hora tipo "09:30 AM" a horas y minutos 24h
function parseHoraTurno(horaStr) {
  const partes = horaStr.split(" ");
  const tiempo = partes[0].split(":");
  let hour = parseInt(tiempo[0], 10);
  const minute = parseInt(tiempo[1], 10);
  const ampm = partes[1];

  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  return { hour, minute };
}

// Modal de reserva
function abrirBookingModal(hora) {
  turnoSeleccionadoHora = hora;
  document.getElementById("modalTurnoHora").textContent = `Horario seleccionado: ${hora}`;
  const modal = document.getElementById("bookingModal");
  modal.classList.remove("opacity-0", "pointer-events-none");
}

function cerrarBookingModal() {
  const modal = document.getElementById("bookingModal");
  modal.classList.add("opacity-0", "pointer-events-none");
  document.getElementById("bookingForm").reset();
  turnoSeleccionadoHora = null;
}

// Confirmación de reserva
function confirmarReservaTurno(e) {
  e.preventDefault();

  const nombre = document.getElementById("clienteNombre").value.trim();
  const telefono = document.getElementById("clienteTelefono").value.trim();
  const servicio = document.getElementById("clienteServicio").value;

  if (!nombre || !telefono || !turnoSeleccionadoHora) {
    alert("Por favor completa los campos obligatorios.");
    return;
  }

  const turnos = obtenerTurnosHoy();
  const index = turnos.findIndex(t => t.hora === turnoSeleccionadoHora);

  if (index === -1) return;

  if (turnos[index].ocupado) {
    alert("Lo sentimos, este turno acaba de ser tomado por otra persona.");
    cerrarBookingModal();
    renderizarTurnos();
    return;
  }

  // Registrar reserva y bloquear turno por todo el día
  turnos[index].ocupado = true;
  turnos[index].cliente = nombre;
  turnos[index].telefono = telefono;
  turnos[index].servicio = servicio;
  turnos[index].horaReserva = new Date().toISOString();

  guardarTurnosHoy(turnos);
  cerrarBookingModal();
  renderizarTurnos();

  // Enviar mensaje formateado a WhatsApp
  const mensaje = 
`💈 *¡NUEVO TURNO CONFIRMADO - VIP BARBER CLUB!* 💈
━━━━━━━━━━━━━━━━━━━━
👤 *Cliente:* ${nombre}
📱 *Teléfono:* ${telefono}
🕒 *Turno Asignado:* ${turnoSeleccionadoHora} (Hoy)
✂️ *Servicio:* ${servicio}
━━━━━━━━━━━━━━━━━━━━
⚠️ *RECORDATORIO OBLIGATORIO:*
Debes presentarte en la barbería al menos *10 minutos antes* (${turnoSeleccionadoHora}) o tu turno quedará liberado automáticamente para el siguiente cliente en espera.
━━━━━━━━━━━━━━━━━━━━
¡Gracias por reservar con nosotros! Nos vemos en el sillón 💈🔥`;

  const url = `https://wa.me/${WHATSAPP_BARBERO}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
}

// Filtros
function filtrarTurnos(tipo) {
  filtroActual = tipo;

  const btnTodos = document.getElementById("btnFilterTodos");
  const btnDisp = document.getElementById("btnFilterDisponibles");
  const btnOcup = document.getElementById("btnFilterOcupados");

  [btnTodos, btnDisp, btnOcup].forEach(btn => {
    btn.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#141822] text-slate-300 hover:text-white border border-white/5";
  });

  if (tipo === "todos") {
    btnTodos.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-barber-gold text-black shadow-md";
  } else if (tipo === "disponibles") {
    btnDisp.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-barber-gold text-black shadow-md";
  } else if (tipo === "ocupados") {
    btnOcup.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-barber-gold text-black shadow-md";
  }

  renderizarTurnos();
}
