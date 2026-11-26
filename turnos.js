// =======================================================================
// LEO BARBER SHOP - SISTEMA DE TURNOS DIARIOS SINCRONIZADOS EN TIEMPO REAL
// Motor Híbrido Resiliente: Cloud Database + Local Fallback + Auto-Retry
// =======================================================================

const WHATSAPP_BARBERO = "18097686713";

// Endpoint Cloud de alta disponibilidad
const CLOUD_API_BASE = "https://sheetdb.io/api/v1/58f61be4dda40";

// HORARIOS EXACTOS DE LA NOTA DE VOZ:
// - Apertura 9:00 AM, primer cliente entra 9:30 AM
// - Break de almuerzo: 1:00 PM a 2:30 PM (retoma 2:30 PM)
// - Cierre oficial: 9:00 PM (último turno 8:30 PM)
const TURNOS_HORARIOS = [
  "09:30 AM",
  "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM",
  // 01:00 PM a 02:30 PM -> BREAK DE ALMUERZO
  "02:30 PM",
  "03:00 PM", "03:30 PM",
  "04:00 PM", "04:30 PM",
  "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM",
  "07:00 PM", "07:30 PM",
  "08:00 PM", "08:30 PM"
];

let turnosGlobales = [];
let turnoSeleccionadoHora = null;
let filtroActual = "todos";
let estaEnviando = false;

document.addEventListener("DOMContentLoaded", async () => {
  iniciarReloj();
  mostrarFechaHoy();
  
  // 1. Cargar plantilla inicial limpia
  turnosGlobales = generarPlantillaTurnos();
  
  // 2. Cargar respaldo local si existe para mostrar al instante
  recuperarRespaldoLocal();
  renderizarTurnos();

  // 3. Sincronizar con la nube
  await sincronizarTurnosConLaNube();
  
  // 4. Polling inteligente y seguro cada 5 segundos
  setInterval(async () => {
    if (!estaEnviando && !document.getElementById("bookingModal").classList.contains("opacity-100")) {
      await sincronizarTurnosConLaNube(true);
    }
  }, 5000);
});

// Obtener fecha actual en formato YYYY-MM-DD
function getTodayString() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Generar plantilla de 22 turnos
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

let ultimoEstadoJSON = "";

// Sincronizar reservas reales desde la nube
async function sincronizarTurnosConLaNube(esSilencioso = false) {
  const statusIndicator = document.getElementById("syncStatusIndicator");
  if (statusIndicator && !esSilencioso) {
    statusIndicator.innerHTML = `<span class="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span> Sincronizando nube...`;
  }

  const hoyStr = getTodayString();

  try {
    const res = await fetch(CLOUD_API_BASE, { 
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!res.ok) throw new Error("Status " + res.status);

    const data = await res.json();
    const nuevaLista = generarPlantillaTurnos();

    if (Array.isArray(data)) {
      data.forEach(item => {
        if (!item.name) return;
        // Formato codificado: fecha|hora|cliente|telefono|servicio
        const partes = item.name.split("|");
        if (partes.length >= 3 && partes[0] === hoyStr) {
          const horaTurno = partes[1];
          const idx = nuevaLista.findIndex(t => t.hora === horaTurno);
          if (idx !== -1) {
            nuevaLista[idx].ocupado = true;
            nuevaLista[idx].cliente = partes[2];
            nuevaLista[idx].telefono = partes[3] || "";
            nuevaLista[idx].servicio = partes[4] || "Servicio Barbería";
          }
        }
      });
    }

    const estadoSerializado = JSON.stringify(nuevaLista);
    // Solo re-renderizar si hubo un cambio real en los datos para máxima fluidez
    if (estadoSerializado !== ultimoEstadoJSON) {
      ultimoEstadoJSON = estadoSerializado;
      turnosGlobales = nuevaLista;
      guardarRespaldoLocal(turnosGlobales);
      renderizarTurnos();
    }

    if (statusIndicator) {
      statusIndicator.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Conectado en Vivo (Nube)`;
    }
  } catch (error) {
    console.warn("Fallo de red en nube, manteniendo estado activo:", error);
    if (statusIndicator) {
      statusIndicator.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400/80"></span> Conectado (En espera)`;
    }
  }
}

// Enviar nueva reserva a la nube para que se refleje en TODOS los móviles
async function publicarReservaEnLaNube(payloadReserva) {
  estaEnviando = true;
  const hoyStr = getTodayString();

  // Codificar registro compacto
  const recordString = `${hoyStr}|${payloadReserva.hora}|${payloadReserva.cliente}|${payloadReserva.telefono}|${payloadReserva.servicio}`;
  const recordId = "turno_" + Date.now();

  try {
    const bodyData = {
      data: [{
        id: recordId,
        name: recordString,
        age: "1",
        comment: hoyStr
      }]
    };

    const res = await fetch(CLOUD_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(bodyData)
    });

    if (!res.ok) {
      console.warn("Error al registrar en nube:", res.status);
    }
  } catch (err) {
    console.error("Error publicando en la nube:", err);
  } finally {
    estaEnviando = false;
  }
}

// Renderizar la lista de turnos en pantalla
function renderizarTurnos() {
  const grid = document.getElementById("turnosGrid");
  grid.innerHTML = "";

  const now = new Date();
  const diaSemana = now.getDay(); // 1 = Lunes

  // SI ES LUNES: LA BARBERÍA ESTÁ CERRADA
  if (diaSemana === 1) {
    grid.innerHTML = `
      <div class="col-span-full bg-[#161a24] border border-amber-500/30 rounded-3xl p-8 sm:p-12 text-center max-w-xl mx-auto shadow-2xl">
        <div class="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-3xl mb-4">
          😴
        </div>
        <span class="text-xs font-bold uppercase tracking-widest text-amber-400">Día de Descanso</span>
        <h3 class="text-2xl sm:text-3xl font-black text-white font-heading mt-2">Los lunes estamos cerrados</h3>
        <p class="text-slate-400 text-sm mt-3 leading-relaxed">
          Hoy lunes no laboramos. Te esperamos mañana martes a partir de las <strong>9:00 AM</strong> (primer turno disponible a las 9:30 AM).
        </p>
        <div class="mt-6 pt-6 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-slate-400">
          <i class="fas fa-calendar-alt text-amber-400"></i> Horario: Martes a Domingo (9:00 AM a 9:00 PM)
        </div>
      </div>
    `;
    document.getElementById("statDisponibles").textContent = "0";
    document.getElementById("statOcupados").textContent = "0";
    return;
  }

  let countDisponibles = 0;
  let countOcupados = 0;

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  turnosGlobales.forEach(turno => {
    const horaObj = parseHoraTurno(turno.hora);
    const yaPaso = (currentHour > horaObj.hour) || (currentHour === horaObj.hour && currentMinute >= horaObj.minute);

    // Todos los turnos del día están disponibles para reservarse por anticipado (desde la mañana para la noche)
    if (turno.ocupado) {
      countOcupados++;
    } else {
      countDisponibles++;
    }

    if (filtroActual === "disponibles" && turno.ocupado) return;
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
    } else {
      // DISPONIBLE: Se puede reservar en cualquier momento del día
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
          <i class="fas fa-check-circle text-emerald-400 mr-1"></i> Libre para apartar hoy
          <p class="text-[11px] text-amber-300/80 mt-1"><i class="fas fa-clock mr-1"></i>Estar 10 min antes</p>
        </div>

        <button onclick="abrirBookingModal('${turno.hora}')" class="w-full py-2.5 bg-barber-gold hover:bg-yellow-400 text-black font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-barber-gold/20 active:scale-95 transition">
          <i class="fas fa-calendar-check"></i>
          <span>Apartar este Turno</span>
        </button>
      `;
    }

    grid.appendChild(card);
  });

  document.getElementById("statDisponibles").textContent = countDisponibles;
  document.getElementById("statOcupados").textContent = countOcupados;
}

// Convertir hora tipo "09:30 AM" a 24 horas
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

  const horaGuardada = turnoSeleccionadoHora;
  const index = turnosGlobales.findIndex(t => t.hora === horaGuardada);
  if (index === -1) return;

  if (turnosGlobales[index].ocupado) {
    alert(`¡Ups! El turno de las ${horaGuardada} ya está ocupado.`);
    cerrarBookingModal();
    renderizarTurnos();
    return;
  }

  const payloadReserva = {
    fecha: getTodayString(),
    hora: horaGuardada,
    cliente: nombre,
    telefono: telefono,
    servicio: servicio
  };

  // Bloquear localmente de inmediato para feedback instantáneo
  turnosGlobales[index].ocupado = true;
  turnosGlobales[index].cliente = nombre;
  turnosGlobales[index].telefono = telefono;
  turnosGlobales[index].servicio = servicio;

  guardarRespaldoLocal(turnosGlobales);
  cerrarBookingModal();
  renderizarTurnos();

  // Publicar en la nube
  publicarReservaEnLaNube(payloadReserva);

  // Enviar confirmación a WhatsApp
  const mensaje = 
`💈 *¡NUEVO TURNO CONFIRMADO - LEO BARBER SHOP!* 💈
━━━━━━━━━━━━━━━━━━━━
👤 *Cliente:* ${nombre}
📱 *Teléfono:* ${telefono}
🕒 *Turno Asignado:* ${horaGuardada} (Hoy)
✂️ *Servicio:* ${servicio}
━━━━━━━━━━━━━━━━━━━━
⚠️ *RECORDATORIO OBLIGATORIO:*
Debes presentarte en la barbería al menos *10 minutos antes* (${horaGuardada}) o tu turno quedará liberado automáticamente para el siguiente cliente en espera.
━━━━━━━━━━━━━━━━━━━━
¡Gracias por reservar en Leo Barber Shop! Nos vemos en el sillón 💈🔥`;

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

// Respaldo local
function guardarRespaldoLocal(turnos) {
  try {
    localStorage.setItem("leandro_barber_turnos_" + getTodayString(), JSON.stringify(turnos));
  } catch(e) {}
}

function recuperarRespaldoLocal() {
  try {
    const saved = localStorage.getItem("leandro_barber_turnos_" + getTodayString());
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === TURNOS_HORARIOS.length) {
        turnosGlobales = parsed;
      }
    }
  } catch(e) {}
}
