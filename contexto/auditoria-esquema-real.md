# Auditoría: esquema real de Supabase vs. espejo SQL

**Fecha:** 2026-10-16 · **Proyecto:** `sfkkfcticgqdqvzthimz` ("Web principal zona elite", Postgres 17) · **Método:** consultas de solo lectura a `pg_catalog` / `information_schema` / `pg_policies` vía Supabase Management API. No se modificó nada.

**Conclusión:** las **tablas y columnas coinciden** con `documentacion/squema-sql-actualizado.sql` (41 tablas, ninguna columna faltante), pero **las policies RLS, los triggers, varios CHECK y varias funciones son distintos** a lo documentado. El espejo describe un RLS "endurecido" que **no está aplicado** en producción. Para RLS, triggers y valores permitidos, la fuente de verdad es la base real (esta auditoría), no el espejo.

---

> **Estado de corrección:** S-1…S-6, F-1 y F-2 corregidos en `contexto/migrations/035_security_hardening.sql` + cambios de código (v1.10.1, requisito `contexto/requisitos/hardening-seguridad-bd.md`). **Aplicada en producción el 2026-10-16** (SQL Editor) y verificada: trigger `trg_profiles_protect_privileged` activo, las 12 policies eliminadas ya no existen, storage con `public_bucket_admin_*`, `roles` con RLS, CHECK ampliados, `idx_payments_flow_token` creado y changelog v1.10.1 cargado. Las secciones 1–4 describen el estado **previo** a la corrección. S-7 y el bucket privado de vouchers quedan como decisión de negocio.
>
> **Contexto de pagos:** hay dos canales (transferencia validada por el admin y Flow). Hoy los tres productos están en `manual`, así que S-2 no permite obtener beneficios vía Flow mientras siga así (`create-order` responde 400), pero sí permitía crear filas `pagado` falsas que inflan los ingresos del dashboard. Vuelve a ser crítico al reactivar Flow.

## 1. Hallazgos de seguridad (ordenados por severidad)

### S-1 🔴 CRÍTICO — Cualquier usuario registrado puede hacerse administrador

- Policy `profiles_update_own_or_admin` (UPDATE): `USING ((id = auth.uid()) OR is_admin())`, **sin `WITH CHECK`**.
- El rol `authenticated` tiene privilegio UPDATE sobre **todas** las columnas de `profiles`, incluida `role_id`.
- No hay trigger que impida cambiar `role_id` (solo `trg_profiles_updated_at` y `trg_profiles_create_beneficiary`).
- **Escenario:** un alumno, desde la consola del navegador en el sitio: `supabase.from("profiles").update({ role_id: 1 }).eq("id", <su id>)` → `is_admin()` pasa a ser true → acceso total a `/admin`, a todos los datos personales, fichas médicas, pagos, y a las APIs admin (que validan `role_id = 1`).
- **Fix sugerido:** revocar UPDATE de `role_id`/`active`/`email` a `authenticated` (`REVOKE UPDATE (role_id, active, email) ON public.profiles FROM authenticated, anon;`) o un trigger `BEFORE UPDATE` que rechace cambios de `role_id`/`active` si `NOT is_admin()`. Agregar `WITH CHECK` a la policy.

### S-2 🔴 ALTO — Manipulación del pago: pagar un plan barato y recibir uno caro

- Policies en `payments`: `payments_owner_update_flow` (dueño puede UPDATE sus pagos `method='flow'`), `payments_flow_update` (UPDATE de cualquier pago flow, acotado en la práctica por la policy SELECT) y `payments_user_insert_own` (INSERT de pagos flow propios). Sin restricción de columnas.
- `/api/flow/confirmation` y `/api/flow/verify` **no comparan `verification.amount` con el monto/plan esperado**, y el plan se deduce del texto de `payments.concept`.
- **Escenario:** el usuario crea una orden de un plan barato → antes de pagar edita su fila de `payments` (`concept = 'Membresía <plan caro>'`, o cambia `beneficiary_id`/`include_enrollment`/`enrollment_plan_id`) → paga el monto barato en Flow → el callback asigna el plan caro.
- También puede marcar sus pagos como `pagado` (ensucia métricas de ingresos).
- **Fix sugerido:** quitar las policies INSERT/UPDATE de `payments` para usuarios y mover las escrituras de `/api/flow/create-order` (hoy usa el server client con RLS) al admin client; además validar en confirmation/verify que `verification.amount` = `payments.amount` y que el monto coincide con el precio del plan.

### S-3 🟠 MEDIO — Asistir a clases sin membresía/matrícula y recuperar tokens

- `class_enrollments.enrollments_own_insert` permite al dueño insertar inscripciones **sin** validar membresía, matrícula ni aforo. Es permisiva y se suma (OR) a la policy correcta `class_enrollments_insert_admin_or_self`, anulándola. También salta el RPC `enroll_class`.
- `/api/checkin` **omite** los chequeos de membresía/matrícula/tokens si el beneficiario ya estaba inscrito → con una inscripción insertada a mano, el QR marca `presente` sin membresía y sin deuda.
- `enrollments_own_delete` permite al dueño borrar sus inscripciones (incluso de clases ya asistidas) → `get_remaining_tokens` le devuelve el token.
- **Fix sugerido:** eliminar `enrollments_own_insert` y `enrollments_own_delete` (la UI usa el RPC `enroll_class` y la desinscripción el RPC admin); que `/api/checkin` valide membresía/matrícula también cuando ya existe la inscripción.

### S-4 🟠 MEDIO — Storage: cualquier usuario logueado puede borrar o reemplazar cualquier archivo

- `storage.objects`: policies `Authenticated users can delete/update/upload` con solo `bucket_id = 'public'` → un alumno puede borrar imágenes de productos, galería, eventos o vouchers de otros.
- Los vouchers de transferencia (datos bancarios/personales) quedan en el bucket **público** (mitigado porque la ruta es un UUID).
- **Fix sugerido:** restringir DELETE/UPDATE a `is_admin()` y mover `vouchers/` a un bucket privado con URLs firmadas.

### S-5 🟡 BAJO-MEDIO — Notificaciones falsas a cualquier usuario

- `user_notifications."Service role inserts notifications"` (INSERT) tiene `WITH CHECK (true)` para el rol `public` → cualquier cliente puede crear notificaciones in-app a nombre del sistema para cualquier `user_id` (phishing interno). El service role no necesita policy (salta RLS).
- **Fix:** eliminar esa policy.

### S-6 🟡 BAJO — Tabla `roles` sin RLS y con permisos completos para `anon`

- `roles` tiene RLS deshabilitado y `anon`/`authenticated` con INSERT/UPDATE/DELETE/TRUNCATE. El CHECK de nombres + UNIQUE + FKs limitan el daño (no hay escalada porque `is_admin()` usa `role_id`), pero es trivial de cerrar: `ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;` + policy SELECT pública.

### S-7 🟡 Decisión de negocio — Staff (instructor/recepción) con escritura amplia

- `payments_staff_write` (ALL), `payments_staff_update`, `attendance_staff_write` (ALL), `class_sessions_staff_write` (ALL), `medical_records_owner_or_staff` (ALL), `body_metrics`/`consent_forms` (ALL), `product_orders_owner`/`order_items_owner` (ALL para staff). Un instructor puede, por ejemplo, marcar pagos como pagados. Confirmar si es intencional.

---

## 2. Bugs funcionales causados por diferencias de esquema

| # | Qué pasa | Causa en la BD real |
|---|----------|---------------------|
| F-1 | Las alertas al staff "Pago pagado sin membresía" (`notifyPaymentWithoutMembership`, B-008) y el aviso de nueva solicitud de transferencia **nunca se guardan** (la tabla `notifications` tiene 0 filas) | El código inserta `type='sistema'`, `target='staff'`, pero los CHECK reales solo permiten `type ∈ {correo_masivo, aviso, recordatorio, comunicado}` y `target ∈ {todos, segmento}`. El error se loguea y se ignora |
| F-2 | Asignar matrícula con método **"Cortesía"** en `/admin/inscripciones` falla al crear el pago | `payments_method_check` solo permite `efectivo, transferencia, flow, otro` |
| F-3 | Si algún flujo usa `memberships.status='suspendida'` o `payments.status='fallido'/'reembolsado'`, fallará | CHECK real: memberships `activa, vencida, cancelada`; payments `pendiente, pagado, rechazado, expirado, cancelado` |
| F-4 | `notifications_user_read_todos` solo deja leer `target='todos'`: un comunicado con `target='segmento'` no lo ve nadie salvo el admin | Policy real |

---

## 3. Diferencias del espejo (para sincronizarlo)

### Existe en la BD real y NO en el espejo
- **Funciones:** `create_beneficiary_for_profile()`, `create_beneficiary_for_dependent()` (triggers SECDEF), `notify_token_return(uuid, text, date, text)`, `compute_category_from_birth(date)` (nino < 10, juvenil < 16, adulto), `set_updated_at()`.
- **Triggers:** `trg_on_auth_user_created` (auth.users → `handle_new_user`), `trg_profiles_create_beneficiary`, `trg_dependents_create_beneficiary`, `trg_*_updated_at` en academy_settings, blog_posts, dependents, medical_records, products, profiles (usan `set_updated_at`), `qr_session_lock_updated_at`, `set_sport_profiles_updated_at`, `set_sports_podiums_updated_at`.
- **`handle_new_user()` real** no fija `role_id` (usa el default 4) y solo inserta `profiles`; el beneficiario lo crea `trg_profiles_create_beneficiary`.
- **CHECK:** `beneficiaries.chk_beneficiary_exactly_one`, `class_enrollments.chk_enrollment_target` (session_id o schedule_id), `attendance_status_check`, `memberships_status_check`, `payments_method_check`, `payments_status_check`, `events_type_check` (`torneo, graduacion, seminario, clase_especial`), `notifications_type_check`, `notifications_target_check`, `blog_posts_status_check`, `debts_*`, `academy_enrollments_status_check`, `personalized_packs_status_check`, `roles_name_check`, `schedules_day_of_week_check`.
- **UNIQUE:** `attendance(session_id, beneficiary_id)`, `class_sessions(schedule_id, session_date)`, `class_enrollments(session_id, beneficiary_id)` (con otro nombre), `class_plans(schedule_id, plan_id)`, `beneficiaries(profile_id)`, `beneficiaries(dependent_id)`, `medical_records(beneficiary_id)`, `disciplines(name)`, `blog_posts(slug)`, `roles(name)`.
- **Índices:** `idx_class_plans_plan`, `idx_class_plans_schedule`, `idx_payments_commerce_order`, `idx_user_notifications_user_id`.
- **87 policies** con nombres distintos a los del espejo (ver sección 4).

### Está en el espejo y NO existe en la BD real
- 43 policies con nombres del espejo (`*_select_own_or_admin`, `*_insert_admin`, `class_enrollments_delete_admin`, `payments_insert_admin`, …).
- Constraint `schedules_category_check` (no hay CHECK sobre las categorías de horarios).
- ~30 índices `idx_*` simples (profiles, payments.flow_token, class_sessions, attendance, etc.). Notable: **no hay índice en `payments.flow_token`**, que se consulta en cada callback de Flow.
- Triggers `on_auth_user_created`, `set_*_updated_at` (existen con otros nombres).

---

## 4. RLS real por tabla (resumen)

Todas las policies tienen rol `public` (aplican a anon y authenticated; el filtro real es `auth.uid()`/helpers).

| Tabla | Lectura | Escritura |
|-------|---------|-----------|
| profiles | propio o admin | UPDATE propio **sin restricción de columnas (S-1)**; admin ALL |
| beneficiaries | dueño o admin | — (los crean triggers) |
| dependents | — | ALL tutor o admin |
| memberships | dueño, comprador o admin | admin ALL |
| academy_enrollments | dueño, staff, admin | INSERT admin/staff; admin ALL |
| class_enrollments | dueño o admin | INSERT dueño **sin validación (S-3)**, INSERT dueño validado, INSERT staff; DELETE dueño (S-3); admin ALL |
| class_sessions | público | staff ALL |
| attendance | dueño o staff | staff ALL |
| payments | dueño o staff | INSERT/UPDATE dueño flow (S-2); staff ALL |
| user_notifications | propio | INSERT cualquiera (S-5); UPDATE propio |
| notifications | `target='todos'` o admin | admin ALL |
| medical_records / body_metrics / consent_forms | dueño o staff | ALL dueño o staff |
| product_orders / order_items | dueño o staff | ALL dueño o staff |
| catálogos (disciplines, schedules, class_plans, membership_plans, products, product_images, events, gallery_images, personalized_plans, personalized_schedule_plans, reglamento_interno, academy_settings) | público | admin |
| enrollment_plans | autenticados (activos), staff, admin | admin |
| belt_grades, sport_profiles, sports_podiums | dueño/autenticado o admin | admin |
| debts | dueño, staff, admin | admin |
| personalized_packs / personalized_enrollments | dueño o admin | admin |
| event_attendees | dueño o staff | solo RPC |
| qr_session_lock, changelog, audit_logs | admin | admin / — |
| roles | **sin RLS (S-6)** | **sin RLS** |

**Storage:** bucket único `public` (público, 5 MB, solo jpeg/png/webp/gif a nivel bucket). Lectura pública; INSERT/UPDATE/DELETE para cualquier `authenticated` (S-4).

**Extensiones:** plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault. **Sin vistas.**

---

## 5. Cómo repetir esta auditoría

Con la variable de entorno de usuario `SUPABASE_ACCESS_TOKEN` (Personal Access Token), ejecutar `SELECT` de solo lectura contra `POST https://api.supabase.com/v1/projects/sfkkfcticgqdqvzthimz/database/query` con body `{"query": "..."}` (consultas sobre `pg_policies`, `pg_constraint`, `pg_trigger`, `pg_proc`, `information_schema.columns`). En una sesión nueva de Claude Code también está el servidor MCP `supabase-zonaelite` (`.mcp.json`, read-only).
