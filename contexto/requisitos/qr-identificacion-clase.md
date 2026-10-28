# Requisito: identificación de la clase en el QR de asistencia

## Explicación del requisito
Cuando el profesor activa el QR de asistencia de una sesión, la pantalla solo muestra el código y la URL. Si el profesor olvida **finalizar la asistencia** y empieza otra clase, los alumnos de la clase nueva escanean el QR de la anterior y quedan marcados (e inscritos, con token o deuda) en la sesión equivocada sin que nadie lo note.

Se agrega feedback visible de **qué clase** recibe el check-in:

- **Admin / profesor (`/admin/asistencia`)**: sobre el QR, una cabecera grande con la disciplina, el horario, el profesor y la(s) categoría(s) de la clase (Niños, Juveniles, Adultos o varias). Si la hora de término ya pasó (o la sesión es de un día anterior), un aviso de que el QR sigue activo para una clase terminada y que debe finalizarse antes de abrir la siguiente.
- **Alumno (`/checkin/[sessionId]`)**: antes de confirmar, una tarjeta con la clase (disciplina, fecha, horario, categorías). Si la clase ya terminó, un aviso para que confirme con el profesor antes de marcar. Si la categoría del alumno (según su fecha de nacimiento) no está entre las de la clase, un aviso no bloqueante. El resultado del check-in repite el nombre de la clase.

Roles: Admin/Instructor (pantalla QR) y Alumno (check-in).

## Flujo de implementación
1. `src/lib/category.ts`: `SCHEDULE_CATEGORIES` (orden ninos → juveniles → adultos), `scheduleCategoryLabel()` y `sortScheduleCategories()`.
2. `src/lib/dates.ts`: `getChileNowTime()` → `"HH:MM"` en `America/Santiago`, y `isSessionOver(date, endTime)`.
3. `src/lib/supabase/dashboard.ts`: `getUpcomingSessions` / `getPastSessions` también traen `schedules.category`; `ClassSessionData.schedule.category?: string[]`.
4. `/admin/asistencia`: cabecera de la clase sobre el QR + aviso de clase terminada (reloj que se refresca cada minuto).
5. `/checkin/[sessionId]`: la consulta de la sesión trae `session_date` y `schedules(start_time, end_time, category, disciplines(name))`; tarjeta de la clase, avisos y nombre en el resultado.

## Análisis de impacto
- **Checkout / Flow**: no se toca.
- **Zona horaria**: la comparación de "clase terminada" usa `getChileToday()` y la hora de Chile (`getChileNowTime()`), nunca la hora local del navegador ni UTC.
- **Base de datos**: sin cambios de esquema, RPC ni policies. `schedules` y `disciplines` ya son de lectura pública (`schedules_select_all`, `disciplines_select_all`); `class_sessions` ya se leía desde `/checkin`.
- **`/api/checkin`**: sin cambios; los avisos de categoría y de clase terminada son solo informativos (no bloquean), igual que hoy.
- **Consultas del dashboard**: solo se agrega una columna al `select`; las vistas que usan `ClassSessionData` siguen funcionando (campo opcional).
