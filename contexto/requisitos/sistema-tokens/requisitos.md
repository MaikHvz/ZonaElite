# Requisitos — Sistema de Tokens por Membresía

## 1. Objetivo

Implementar un sistema de **tokens** (clases incluidas) dentro de cada membresía. Cada plan define cuántos tokens otorga por periodo de vigencia. Cada inscripción a una clase consume 1 token. Si el beneficiario es marcado como "justificado", se le devuelve el token. Cuando se agotan los tokens, se bloquea la inscripción a nuevas clases.

## 2. Actores

| Actor | Rol |
|---|---|
| **Usuario autenticado** | Se inscribe a clases desde `/horarios`. Ve sus tokens restantes en el dashboard. |
| **Beneficiario** | La persona que asiste a clases (el usuario o sus cargas/hijos). |
| **Staff (admin/instructor/recepción)** | Asigna membresías, ve tokens de beneficiarios, gestiona asistencia. |
| **Sistema** | Valida tokens antes de inscribir, bloquea si están agotados. |

## 3. Qué SÍ hace

1. **Cada plan de membresía puede tener un número de tokens** (campo `tokens` en `membership_plans`). Si `tokens = NULL`, el plan es ilimitado (sin restricción de clases).
2. **Cada inscripción a una sesión consume 1 token**, sin importar si el beneficiario asiste o no. La inscripción es la "reserva" del cupo.
3. **Si el beneficiario es marcado como "justificado"**, se le devuelve 1 token (la falta justificada no consume clase).
4. **Presente y ausente consumen token** (ya inscrito = token comprometido).
5. **Cuando los tokens se agotan (restantes = 0), se bloquea la inscripción** desde cualquier canal (EnrollModal, QR check-in, admin).
6. **Los tokens son visibles** tanto en el dashboard del usuario como en el panel del admin/profesor.
7. **Solo puede haber 1 membresía activa por beneficiario**. Si se compra o asigna una nueva, se desactiva la anterior con confirmación.
8. **Los tokens se calculan por periodo de vigencia** de la membresía (start_date → end_date), no por mes calendario.
9. **El admin puede ver tokens restantes** de cada beneficiario al momento de gestionar asistencia.

## 4. Qué NO hace (fuera de alcance)

1. **No permite acumular tokens** entre meses o periodos. Cada membresía tiene su propio conteo.
2. **No permite comprar tokens adicionales** fuera de una nueva membresía.
3. **No envía notificaciones** cuando los tokens se agotan (solo se muestra un mensaje en la UI).
4. **No modifica el flujo de pagos** — los tokens son un atributo del plan, no un producto separado.
5. **No afecta la lógica de cupos** (`schedules.capacity`) — los tokens son independientes del capacidad de la sala.
6. **No reemplaza el sistema de inscripción a la academia** (`academy_enrollments`) — ese sigue vigente como requisito previo.

## 5. Reglas de negocio clave

| Situación | Comportamiento |
|---|---|
| Plan con `tokens = NULL` | Ilimitado. Sin validación de tokens. |
| Plan con `tokens = 12` | Máximo 12 inscripciones en el periodo de la membresía. |
| Inscripción a sesión | Consume 1 token (presente o ausente). |
| Marca "justificado" | Devuelve 1 token. Se recalculará al guardar. |
| Tokens restantes = 0 | Bloqueo de inscripción. Mensaje: "Sin tokens disponibles". |
| 1 beneficiario con 2 membresías activas | No permitido. La nueva sobrescribe la anterior. |
| Beneficiario con membresía vencida | Sin tokens. No puede inscribirse. |
| Admin inscribe beneficiario | Misma validación. Admin ve tokens restantes. |
| QR check-in walk-in | Misma validación. Si no tiene tokens, se rechaza la inscripción. |
| Membresía asignada a mitad de periodo | Tokens completos del plan para ese periodo (no prorrateo). |

## 6. Fórmula de cálculo

```
tokens_restantes = plan.tokens - (inscripciones_en_periodo - justificaciones_en_periodo)
```

Donde:
- `plan.tokens` = cantidad de tokens del plan (NULL = ilimitado)
- `inscripciones_en_periodo` = count de `class_enrollments` del beneficiario donde la sesión cae entre `membership.start_date` y `membership.end_date`
- `justificaciones_en_periodo` = count de `attendance` con status `justificado` del beneficiario en sesiones dentro del periodo

## 7. Experiencia de usuario

### 7.1 Dashboard del beneficiario
- Badge junto a la membresía activa: "Tokens: 8/12 restantes"
- Barra de progreso visual (verde >50%, amarillo 25-50%, rojo <25%)
- Si es ilimitado: "Clases ilimitadas"

### 7.2 Inscripción desde /horarios
- En el EnrollModal, junto a cada beneficiario: "Tokens: 5 restantes"
- Si tokens = 0: beneficiario marcado como no elegible con razón "Sin tokens disponibles"
- Botón de inscribir deshabilitado

### 7.3 QR Check-in
- Si el beneficiario no tiene tokens: se rechaza la inscripción walk-in
- Mensaje: "Sin tokens disponibles para este beneficiario"
- Si tiene tokens: se inscribe normalmente (consumo automático)

### 7.4 Panel Admin (asistencia)
- En la lista de beneficiarios de cada sesión: badge con tokens restantes
- Al inscribir desde admin: misma validación
- Al marcar "justificado": el token se devuelve

### 7.5 Asignar membresía (admin)
- Si el beneficiario ya tiene membresía activa: modal de confirmación "Ya tiene [Plan X — vence DD/MM]. ¿Desea sobrescribirlo?"
- Al confirmar: desactivar membresía anterior, crear nueva

## 8. Requisitos no funcionales

1. **Rendimiento**: El cálculo de tokens restantes no debe generar consultas lentas. Usar índices en `class_enrollments(beneficiary_id)` y `attendance(beneficiary_id, status)`.
2. **Atomicidad**: Las operaciones de consumo/devolución de tokens deben ser atómicas para evitar race conditions (dos inscripciones simultáneas no deben pasar ambas si solo queda 1 token).
3. **Compatibilidad**: Los planes existentes sin `tokens` (NULL) deben seguir funcionando sin cambios. Ilimitado por defecto.
4. **Auditoría**: Los tokens se calculan desde datos existentes (inscripciones + asistencia), no se almacenan como contador separado. Esto garantiza consistencia.
