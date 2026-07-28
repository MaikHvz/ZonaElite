# Requisito: Creación de Usuarios por Admin con Contraseña Auto-Generada

## 1. Explicación Profunda del Requisito
El administrador necesita poder crear nuevos usuarios directamente desde el panel admin (`/admin/usuarios`), sin depender del flujo de registro público. Al crear el usuario:

- Se genera una contraseña aleatoria segura
- El admin puede ver la contraseña **una sola vez** para enviársela al usuario
- Se envía un correo de bienvenida al usuario con sus credenciales (email + contraseña)
- El usuario puede iniciar sesión inmediatamente (sin necesidad de confirmar email)

**Roles que interactúan:** Administrador (crea), Alumno/Instructor/Recepción (el nuevo usuario creado)

## 2. Flujo de Implementación Propuesto

1. **Botón "Crear Usuario"** en la cabecera de `/admin/usuarios` (junto al botón Excel)
2. **Modal con formulario**: Email, Nombre Completo, Rol (selector con defaults)
3. **API Route `POST /api/admin/create-user`**:
   a. Verificar sesión + role_id=1 (admin)
   b. Generar contraseña aleatoria segura (12 chars, crypto.randomBytes)
   c. `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`
   d. El trigger `handle_new_user()` crea `profiles` con role_id=4 automáticamente
   e. Si el admin eligió otro rol, actualizar `profiles.role_id`
   f. Crear `beneficiaries` (profile_id=user.id, dependent_id=NULL)
   g. Enviar email de bienvenida vía Resend con credenciales
   h. Log en `audit_logs`
   i. Retornar `{ user: { id, email, full_name }, tempPassword }`
4. **Modal de resultado**: Muestra la contraseña generada con botón "Copiar", advertencia de que solo se ve una vez, y botón "Cerrar" que refresca la tabla

## 3. Análisis de Impacto

- **Trigger `handle_new_user()`**: Se dispara automáticamente al crear el Auth user. Crea `profiles` con `role_id=4`. No interfiere porque actualizamos el rol después si es necesario.
- **Beneficiarios**: El trigger SQL actual solo crea `profiles`, no `beneficiaries`. Se crea manualmente en la API.
- **RLS**: La API usa `getAdminClient()` con service_role, bypass completo de RLS. La verificación de admin es manual (server client + profiles lookup).
- **Fechas**: No hay manipulación de fechas en este feature.
- **Flow / Checkout**: Sin impacto — no altera ningún flujo existente.

## 4. Archivos a Modificar/Crear

| Archivo | Acción |
|---------|--------|
| `contexto/requisitos/admin-create-user.md` | Crear (este documento) |
| `src/app/api/admin/create-user/route.ts` | Crear — API route |
| `src/lib/email.ts` | Crear — utilidad de email con Resend |
| `src/app/admin/usuarios/page.tsx` | Modificar — agregar UI |
| `.env.local` | Agregar `RESEND_API_KEY` |

## 5. Estado de Implementación
En progreso.
