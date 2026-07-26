# Requisitos — Check-in de Asistencia vía QR

## 1. Objetivo

Permitir que un alumno (o su tutor, en el caso de cargas/hijos) se marque **presente** en una clase presencial escaneando un código QR mostrado en una tablet/pantalla de la sala, sin depender de que un miembro del staff pase lista manualmente.

## 2. Actores

| Actor | Rol |
|---|---|
| **Staff (admin/instructor/recepción)** | Muestra el QR de la clase en curso desde una pantalla/tablet |
| **Usuario autenticado** | Escanea el QR con su celular para marcarse presente a sí mismo y/o a sus cargas |
| **Beneficiario** | La persona que efectivamente asiste (el usuario mismo o una carga/hijo) |

## 3. Qué SÍ hace

1. **Muestra un QR por clase (sesión) del día**, generado a partir de la sesión (`class_sessions`) correspondiente al horario (`schedules`) que el staff seleccione en pantalla.
2. **El usuario que escanea, si no ha iniciado sesión, debe autenticarse** antes de poder registrar su asistencia (y vuelve automáticamente al check-in tras loguearse).
3. **El usuario ve una lista de todos sus beneficiarios** (él mismo + sus cargas/hijos) y puede marcar presente a **uno, varios o todos** en un mismo escaneo — no está limitado a una sola persona.
4. **Un beneficiario puede marcarse presente aunque no se haya inscrito previamente a esa clase** (`class_enrollments`). Es decir, "olvidé inscribirme" **no bloquea** el check-in: el sistema lo agrega a la lista de esa sesión en el momento (ver detalle en sección 8).
5. **Un beneficiario puede marcarse presente aunque la clase ya no tenga cupos disponibles.** El límite de capacidad (`schedules.capacity`) **no aplica** a este flujo — el check-in por QR siempre se permite, independiente de cuántos cupos queden.
6. **Muestra el estado de "al día" o "atrasado"** de cada beneficiario en el **celular del usuario que escaneó** (no en la tablet), apenas confirma el check-in — esto es solo informativo y no bloquea ni condiciona el registro de asistencia. El aviso en la tablet (sección 7) es un canal aparte y solo se activa para los casos "atrasado".
7. **Confirma en el celular, por cada beneficiario seleccionado, si efectivamente quedó marcado presente o no.** Después de enviar el check-in, el usuario debe ver una lista con el resultado de cada uno (ej. "Juan — Presente ✓", "Sofía — Presente ✓"), para que sepa con certeza que el escaneo funcionó y no le queden dudas de si registró correctamente a cada persona. Si alguno falló por algún motivo, debe indicarse cuál y por qué, en vez de mostrar un mensaje genérico de éxito para todo el grupo.
8. **Registra la asistencia** (tabla `attendance`, `status = 'presente'`) apenas el usuario confirma en su celular.
9. **Evita duplicados**: si el mismo beneficiario ya fue marcado presente en esa sesión (por QR o manualmente por el staff), un segundo escaneo no crea un registro repetido — simplemente confirma que ya está presente.
10. **El staff sigue pudiendo corregir todo desde el panel admin** (marcar presente/ausente/justificado manualmente), tal como ya funciona hoy — el check-in por QR es un canal adicional, no reemplaza al admin.
11. **El QR de cada clase solo acepta check-ins mientras esa sesión esté "activa"** (el staff la activa presionando "Abrir sesión de asistencia QR" desde `/admin/asistencia`, ver sección 10, y la cierra con "Finalizar asistencia" al terminar). Si alguien escanea un QR de una sesión cerrada o aún no activada, el check-in se rechaza con un mensaje claro.

## 4. Qué NO hace (fuera de alcance)

1. **No valida ni exige matrícula o membresía vigente** para permitir el check-in — solo lo informa. No es un "control de acceso", es un registro de asistencia.
2. **No respeta ni hace cumplir el límite de cupos (`capacity`)** — un walk-in siempre puede marcarse presente aunque la clase figure "llena" para quienes se inscriben con anticipación desde `/horarios`.
3. **No reemplaza el flujo de inscripción anticipada** (`/horarios` + `EnrollModal`) — sigue existiendo tal como está, con sus propias reglas de cupo y elegibilidad. El QR es solo para el día de la clase.
4. **No impide que alguien marque presente a un beneficiario que no le pertenece** más allá de la regla de propiedad ya existente (`owns_beneficiary`) — es decir, un usuario solo puede marcarse a sí mismo o a sus propias cargas, nunca a beneficiarios de otra familia.
5. **No permite marcar `ausente` o `justificado`** desde el check-in — esos estados siguen siendo exclusivos del panel admin. El check-in solo puede generar `presente`.
6. **No incluye medidas anti-fraude avanzadas** como rotación del QR o geolocalización — se prioriza simplicidad. La única protección incluida es que **el QR solo funciona mientras la sesión está "activa"** (ver sección 9); una vez cerrada la asistencia, escanear una foto vieja del QR no sirve de nada.
7. **No envía notificaciones fuera de la pantalla del QR** (ej. no manda push, email o WhatsApp al staff) — el feedback en tiempo real descrito en la sección 7 ocurre únicamente en la tablet/pantalla que muestra el QR de esa clase.
8. **No genera ni modifica cobros o pagos** — si un beneficiario está "atrasado" en su membresía, el check-in lo deja asistir y solo lo señala; cualquier gestión de cobro queda para el staff, fuera de este flujo.

## 5. Reglas de negocio clave

| Situación | Comportamiento |
|---|---|
| Beneficiario sin inscripción previa a esa clase | Se agrega igual a la lista de esa sesión y queda `presente` |
| Clase llena (cupos = 0 o negativos) | El check-in se permite de todas formas |
| Beneficiario sin membresía o matrícula vigente | Se marca `presente` igual, mostrando aviso "Atrasado" |
| Beneficiario ya marcado presente (por QR o admin) | Un nuevo escaneo no duplica el registro |
| Usuario marca a una carga que no es suya | Bloqueado (regla de propiedad ya existente en el sistema) |
| Staff necesita corregir asistencia | Se sigue haciendo desde `/admin/asistencia`, sin cambios |

## 6. Efecto secundario a tener en cuenta

Como un walk-in por QR puede agregar a alguien a una clase llena o sin inscripción previa, el conteo de "cupos disponibles" que ven otros usuarios al inscribirse con anticipación desde `/horarios` puede quedar en 0 o negativo después de una clase con varios walk-ins. Esto es esperado y aceptado: no se restringe el check-in por eso, y a futuros usuarios que intenten inscribirse con anticipación simplemente les seguirá apareciendo "Llena".

## 7. Feedback en tiempo real en la pantalla del QR

Además del check-in en sí, la pantalla/tablet donde se muestra el QR debe reaccionar **en el momento**, pero **solo cuando corresponde llamar la atención** — es decir, únicamente cuando el beneficiario que se marca presente tiene la **membresía vencida**:

- 🔴 Rojo: "Nombre del beneficiario — Membresía vencida"

**Si el beneficiario está al día, no se muestra ningún aviso.** Esto es intencional: la mayoría de los check-ins son de alumnos al día, y mostrarlos todos generaría una cola constante de avisos sin aportar información útil al staff. Solo interrumpe la pantalla cuando hay algo que requiere su atención.

El nombre mostrado es siempre el del **beneficiario específico** que se marcó presente (el usuario mismo o la carga/hijo correspondiente), no el nombre de la cuenta que escaneó.

**Cómo funciona:** la tablet mantiene una suscripción en tiempo real (Supabase Realtime) a los nuevos registros de `attendance` de esa sesión específica. Apenas se inserta un check-in, la tablet consulta el estado de membresía/matrícula del beneficiario y **solo si está vencida** muestra el aviso.

**Duración del aviso:** 4 segundos por defecto, pero debe ser un valor **configurable** desde `/admin/configuracion` (junto con el resto de la configuración general de la academia), no un número fijo en el código.

**Manejo de check-ins simultáneos (cola):** como ahora solo entran a la cola los casos de membresía vencida (una minoría), es muy poco probable que se acumulen varios al mismo tiempo — pero si ocurre, se muestran **uno tras otro en cola** (cada uno completa sus 4 segundos — o los que se configuren — antes de pasar al siguiente), nunca se pisan ni se pierden entre sí.

**Requisitos técnicos para esto:**
- Habilitar Realtime sobre la tabla `attendance` en Supabase (Database → Replication) — es una activación de configuración, no de código.
- La política de lectura (`SELECT`) de `attendance` se mantiene tal como está (`owns_beneficiary` o `is_admin()`) — **no requiere cambios**, porque la tablet **siempre se opera con una cuenta de administrador**.
- El tiempo de exhibición del aviso se guarda en `academy_settings` (tabla singleton de configuración ya existente) como un nuevo campo, editable desde el panel admin.
- No genera fricción ni demora perceptible para el usuario que escanea: su flujo de check-in en el celular no depende de que la tablet procese el aviso.

## 8. Check-in sin inscripción previa (walk-in)

Cuando un beneficiario se marca presente sin tener una fila previa en `class_enrollments` para esa sesión, el sistema debe:

1. **Crear la fila en `class_enrollments`** (agregarlo formalmente a la lista de esa clase), sin importar si ya no quedan cupos.
2. **Además, registrar la asistencia** en `attendance` con `status = 'presente'`.

## 9. Finalizar asistencia (resumen de la clase)

Cada sesión de clase (`class_sessions`) tiene un **estado de asistencia**: **activa** (acepta check-ins por QR) o **cerrada** (no acepta más). El staff controla ese estado desde la misma pantalla del QR.

**Flujo:**
1. El staff **activa la sesión** al empezar la clase (recién ahí el QR queda funcional — ver regla de seguridad más abajo).
2. Durante la clase, los alumnos escanean y quedan `presente` normalmente.
3. Al terminar, el profesor presiona **"Finalizar asistencia"**.
4. Se muestra un **modal de confirmación** (ej. "¿Finalizar el registro de asistencia de esta clase? No se podrán recibir más check-ins por QR para esta sesión.").
5. Al confirmar, la sesión pasa a **cerrada**, y se muestra un **resumen** — como una **nueva pestaña/vista** en la misma pantalla — con la lista de nombres de todos los beneficiarios que quedaron `presente` **por QR** en esa sesión. Esta vista se queda ahí hasta que el staff decida avanzar (por ejemplo, elegir la siguiente clase); no desaparece sola.
6. **Solo se listan los que llegaron por QR.** Los alumnos que olvidaron escanear y el profesor marca presente manualmente después de la clase (desde `/admin/asistencia`, como ya existe hoy) **no aparecen en este resumen** — ese es un proceso aparte, posterior, para completar la asistencia real de la clase.
7. **La sesión se puede reabrir** si se cerró sin querer (ej. el staff le dio "Finalizar" por error). Al reabrir, vuelve a aceptar check-ins por QR normalmente.

**Regla de seguridad clave — por qué importa el estado activa/cerrada:**
El QR de una clase es siempre el mismo enlace mientras la clase existe (`/checkin/<session_id>`), así que alguien podría sacarle una foto durante la clase y tratar de escanearlo después, desde su casa, para "hacer trampa" y aparecer presente sin haber asistido. Por eso, **el check-in solo se acepta mientras la sesión está en estado "activa"**: si alguien escanea el QR estando la sesión cerrada (porque el profesor ya finalizó la asistencia, o porque el staff aún no la ha activado), el sistema debe rechazar el check-in y mostrarle un mensaje claro (ej. "Esta clase ya no está recibiendo asistencia").

## 10. Punto de entrada (dónde se activa el QR)

El QR no vive en una pantalla nueva independiente — se activa **desde la vista de asistencia que ya existe** (`/admin/asistencia`):

1. El staff entra a `/admin/asistencia` y **abre la clase correspondiente** (la sesión del día que va a dictar), tal como ya lo hace hoy para pasar lista manualmente.
2. Dentro de esa clase, aparece un botón **"Abrir sesión de asistencia QR"**.
3. Al presionarlo, se **activa la sesión** (queda en estado "activa", según la sección 9) y se **muestra el QR** en pantalla para que los alumnos escaneen.
4. Desde ahí mismo, el staff ve las llegadas en tiempo real (los avisos rojos de vencidos) y, al terminar, presiona "Finalizar asistencia" (sección 9) para cerrar la sesión y ver el resumen.

Es decir: **activar la sesión y mostrar el QR ocurren juntos**, con ese único botón — no son dos pasos separados.


