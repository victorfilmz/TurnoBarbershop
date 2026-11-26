# 💈 VIP Barber Club - Sistema de Turnos en Vivo por Disponibilidad

Sistema web inteligente y en tiempo real para barberías modernas. Permite a los clientes tomar turnos disponibles cada 30 minutos, ver quién tomó cada turno y recibir confirmación inmediata por WhatsApp con reglas estrictas de puntualidad.

Repositorio Oficial: [https://github.com/victorfilmz/TurnoBarbershop](https://github.com/victorfilmz/TurnoBarbershop)  
WhatsApp Oficial: [1-829-340-7096](https://wa.me/18293407096)

---

## ⚡ Reglas del Sistema

1. **Horario Diario de 9:00 AM a 8:00 PM:**
   - 22 turnos disponibles cada día con intervalos exactos de 30 minutos (9:00 AM, 9:30 AM, 10:00 AM ... hasta 7:30 PM).
2. **Visibilidad Pública y Transparente:**
   - Cada turno ocupado muestra el nombre del cliente y el servicio elegido. Todos los clientes pueden ver la agenda del día.
3. **Bloqueo Diario Estricto:**
   - Una vez tomado el turno, queda bloqueado para todo el día y no se puede modificar hasta la medianoche (reinicio automático diario).
4. **Regla de 10 Minutos:**
   - Todo cliente debe estar en el local con al menos **10 minutos de anticipación** a la hora indicada o su turno queda automáticamente liberado para otro cliente en espera.
5. **Confirmación Inmediata a WhatsApp:**
   - Notificación estructurada directo al barbero y al cliente al número **18293407096**.

---

## 🚀 Despliegue en GitHub Pages

1. **Vincular y subir a GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Sistema de turnos en vivo para barberia"
   git branch -M main
   git remote add origin https://github.com/victorfilmz/TurnoBarbershop.git
   git push -u origin main
   ```

2. **Habilitar GitHub Pages:**
   - Ve a **Settings** > **Pages** en tu repositorio.
   - En **Build and deployment > Source**, selecciona `GitHub Actions` o `Deploy from a branch (main / root)`.
   - En 1 minuto estará en vivo en: `https://victorfilmz.github.io/TurnoBarbershop/`
