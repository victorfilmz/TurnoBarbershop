// ==============================================================
// VIP BARBER CLUB - SISTEMA DE TURNOS DIARIOS SINCRONIZADOS
// Base de datos en la NUBE (Sincronización en vivo entre teléfonos)
// ==============================================================

const WHATSAPP_BARBERO = "18293407096";

// Objeto de almacenamiento en la nube global compartido por todos los celulares
const CLOUD_OBJECT_ID = "ff808181a09d98f701a219a8abc959ac";
const CLOUD_API_URL = `https://api.restful-api.dev/objects/${CLOUD_OBJECT_ID}`;

// 22 turnos de 9:00 AM a 8:00 PM (cada 30 min)
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

let turnosGlobales = [];
let turnoSeleccionadoHora = null;
let filtroActual = "todos";
let estaGuardando = false;

document.addEventListener("DOMContentLoaded", async () => {
  iniciarReloj();
  mostrarFechaHoy();
  
  // Cargar estado inicial desde la nube
  await sincronizarTurnosConLaNube();
  
  // Polling automático cada 4 segundos para actualizar si alguien reserva en otro móvil
  setInterval(async () => {
    if (!estaGuardando && !document.getElementById("bookingModal").classList.contains("opacity-100")) {
      await sincronizarTurnosConLaNube(true);
    }
  }, 4000);
});

// Obtener fecha actual en formato YYYY-MM-DD
function getTodayString() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Generar plantilla limpia de turnos
function generarPlantillaTurnos() {
  return TURNOS_HORARIOS.map((hora, idx) => ({
    id: idx + 1,
    hora: hora,
    ocupado: false,
    cliente: null,
    telefono: null,
    servicio: null,
    horaReserva: null
  }));
}

// Sincronizar lectura con la nube
async function sincronizarTurnosConLaNube(esSilencioso = false) {
  const statusIndicator = document.getElementById("syncStatusIndicator");
  if (statusIndicator && !esSilencioso) {
    statusIndicator.innerHTML = `<span class="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span> Sincronizando...`;
  }

  const hoyStr = getTodayString();

  try {
    const res = await fetch(CLOUD_API_URL);
    if (!res.ok) throw new Error("Error en red nube");
    const json = await res.json();

    // Si los turnos guardados en la nube son de hoy, usarlos; si son de ayer, reiniciar automáticamente
    if (json.data && json.data.fecha === hoyStr && Array.isArray(json.data.turnos)) {
      turnosGlobales = json.data.turnos;
    } else {
      // Es un nuevo día: reiniciar todos los turnos
      turnosGlobales = generarPlantillaTurnos();
      await enviarTurnosALaNube(turnosGlobales, hoyStr);
    }

    if (statusIndicator) {
      statusIndicator.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Conectado en Vivo (Nube)`;
    }
    renderizarTurnos();
  } catch (error) {
    console.warn("Fallo temporal sincronizando con la nube, usando respaldo local:", error);
    // Respaldo localStorage si no hay internet
    if (turnosGlobales.length === 0) {
      const backup = localStorage.getItem("backup_turnos_" + hoyStr);
      turnosGlobales = backup ? JSON.parse(backup) : generarPlantillaTurnos();
      renderizarTurnos();
    }
    if (statusIndicator) {
      statusIndicator.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span> Modo sin conexión`;
    }
  }
}

// Enviar actualización a la nube (para que todos los móviles lo vean)
async function enviarTurnosALaNube(turnos, fecha) {
  estaGuardando = true;
  const hoyStr = fecha || getTodayString();

  try {
    const payload = {
      name: "barbershop_turnos_" + hoyStr,
      data: {
        fecha: hoyStr,
        turnos: turnos,
        ultimaActualizacion: new Date().toISOString()
      }
    };

    const res = await fetch(CLOUD_API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      localStorage.setItem("backup_turnos_" + hoyStr, JSON.stringify(turnos));
    }
  } catch (err) {
    console.error("Error guardando en la nube:", err);
  } finally {
    estaGuardando = false;
  }
}

// Renderizar la lista de turnos en pantalla
function renderizarTurnos() {
  const grid = document.getElementById("turnosGrid");
  grid.innerHTML = "";

  let countDisponibles = 0;
  let countOcupados = 0;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  turnosGlobales.forEach(turno => {
    const horaObj = parseHoraTurno(turno.hora);
    const yaPaso = (currentHour > horaObj.hour) || (currentHour === horaObj.hour && currentMinute >= horaObj.minute);

    if (turno.ocupado) {
      countOcupados++;
    } else if (!yaPaso) {
      countDisponibles++;
    }

    if (filtroActual === "disponibles" && (turno.ocupado || yaPaso)) return;
    if (filtroActual === "ocupados" && !turno.ocupado) return;

    const card = document.createElement("div");
    card.className = "bg-[#131722] border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden";

    if (turno.ocupado) {
      card.classList.add("border-rose-500/40", "bg-rose-950/20");
      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="text-[11px] uppercase tracking-wider text-rose-400 font-extrabold block flex items-center gap-1">
              <i class="fas fa-lock"></i> Ocupado (Bloqueado)
            </span>
            <h3 class="text-xl font-black text-white font-heading mt-0.5">${turno.hora}</h3>
          </div>
          <span class="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-bold border border-rose-500/30">
            🔴
          </span>
        </div>

        <div class="my-3 py-2.5 px-3 bg-black/50 rounded-xl border border-white/5">
          <p class="text-[10px] uppercase font-bold text-slate-400">Turno tomado por:</p>
          <p class="text-sm font-black text-white truncate flex items-center gap-1.5 mt-0.5">
            <i class="fas fa-user-check text-rose-400"></i> ${turno.cliente}
          </p>
          <p class="text-[11px] text-barber-gold font-medium mt-1 truncate">
            ${turno.servicio || 'Corte de Barbería'}
          </p>
        </div>

        <div class="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
          <span>No disponible</span>
          <span class="text-rose-400 font-bold">Llegar 10 min antes</span>
        </div>
      `;
    } else if (yaPaso) {
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
      card.classList.add("border-emerald-500/30", "hover:border-barber-gold", "hover:shadow-xl", "hover:shadow-barber-gold/5", "group");
      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="text-xs uppercase tracking-wider text-emerald-400 font-bold block flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Disponible
            </span>
            <h3 class="text-xl font-black text-white font-heading mt-0.5 group-hover:text-barber-gold transition">${turno.hora}</h3>
          </div>
          <span class="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold border border-emerald-500/30">
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
  modal.classList.add("opacity-100");
}

function cerrarBookingModal() {
  const modal = document.getElementById("bookingModal");
  modal.classList.add("opacity-0", "pointer-events-none");
  modal.classList.remove("opacity-100");
  document.getElementById("bookingForm").reset();
  turnoSeleccionadoHora = null;
}

// Confirmar reserva en la nube y enviar a WhatsApp
async function confirmarReservaTurno(e) {
  e.preventDefault();

  const nombre = document.getElementById("clienteNombre").value.trim();
  const telefono = document.getElementById("clienteTelefono").value.trim();
  const servicio = document.getElementById("clienteServicio").value;

  if (!nombre || !telefono || !turnoSeleccionadoHora) {
    alert("Por favor completa los campos obligatorios.");
    return;
  }

  // Verificar en tiempo real con la nube si no lo tomó otra persona en el último segundo
  await sincronizarTurnosConLaNube(true);

  const index = turnosGlobales.findIndex(t => t.hora === turnoSeleccionadoHora);
  if (index === -1) return;

  if (turnosGlobales[index].ocupado) {
    alert(`¡Ups! El turno de las ${turnoSeleccionadoHora} acaba de ser reservado por otro cliente (${turnosGlobales[index].cliente}). Por favor elige otro horario disponible.`);
    cerrarBookingModal();
    renderizarTurnos();
    return;
  }

  // Bloquear turno en la lista global
  turnosGlobales[index].ocupado = true;
  turnosGlobales[index].cliente = nombre;
  turnosGlobales[index].telefono = telefono;
  turnosGlobales[index].servicio = servicio;
  turnosGlobales[index].horaReserva = new Date().toISOString();

  // Guardar en la NUBE para todos los teléfonos
  await enviarTurnosALaNube(turnosGlobales);

  cerrarBookingModal();
  renderizarTurnos();

  // Enviar confirmación a WhatsApp
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

// Mostrar fecha en español en cabecera
function mostrarFechaHoy() {
  const hoy = new Date();
  const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const str = hoy.toLocaleDateString('es-ES', opciones);
  document.getElementById("currentDateStr").textContent = "Turnos para hoy: " + str.charAt(0).toUpperCase() + str.slice(1);
}
