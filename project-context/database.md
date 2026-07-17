# Schema de Base de Datos

## Conexión

- **Proveedor**: Supabase
- **URL**: `https://sfkkfcticgqdqvzthimz.supabase.co`
- **Key**: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (en `.env.local`)
- **Librería**: `@supabase/supabase-js` + `@supabase/ssr`

## Archivos de conexión

| Archivo | Uso |
|---|---|
| `src/lib/supabase/client.ts` | Cliente browser (createBrowserClient) |
| `src/lib/supabase/server.ts` | Cliente server (createServerClient + cookies) |
| `src/lib/supabase/auth.ts` | Operaciones de auth (login, register, logout, etc.) |
| `src/lib/supabase/profile.ts` | Consulta/actualización de profiles |
| `src/lib/supabase/middleware.ts` | Refresh sesión + proteccion de rutas |
| `src/middleware.ts` | Middleware global (updateSession en cada request) |

## Uso

```ts
// En Server Components / Route Handlers
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// En Client Components
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```

## Entidades principales (22+ tablas desplegadas)

| Tabla | Descripción |
|---|---|
| `roles` | Roles del sistema (administrador=1, instructor=2, recepcion=3, alumno=4) |
| `profiles` | Perfiles de usuario (extends auth.users) |
| `dependents` | Dependientes/alumnos menores (tutor_id → profiles) |
| `beneficiaries` | Tabla puente: usuario O carga, nunca ambos (profile_id OR dependent_id) |
| `membership_plans` | Planes de membresía (nombre, precio, duración, categoría, beneficios) |
| `memberships` | Membresías activas (beneficiary_id, plan_id, start/end_date, status) |
| `payments` | Pagos registrados (user_id, membership_id, amount, method, status, receipt_url) |
| `products` | Productos de la tienda |
| `product_images` | Imágenes de productos |
| `events` | Eventos (torneo, graduacion, seminario, clase_especial) |
| `schedules` | Horarios de clases |
| `disciplines` | Disciplinas (Kenpo, Kickboxing, MMA, Funcional) |
| `blog_posts` | Publicaciones del blog |
| `notifications` | Notificaciones (aviso, recordatorio, comunicado, correo_masivo) |
| `audit_logs` | Logs de auditoría |
| `academy_settings` | Configuración de la academia (nombre, dirección, WhatsApp, redes) |

## Funciones SQL

| Función | Uso |
|---|---|
| `is_admin(user_id)` | Verifica si un usuario tiene role_id = 1 |
| `is_staff()` | Verifica si es administrador, instructor o recepción |
| `owns_beneficiary(b_id)` | Verifica si el usuario es dueño del beneficiary (él o su carga) |
| `handle_new_user()` | Crea profile + beneficiary automáticamente al registrarse |
| `set_updated_at()` | Trigger para updated_at automático |

## Almacenamiento (Supabase Storage)

- Bucket `public` — usado para comprobantes de pago
- Ruta: `receipts/{membership_id}.{ext}`

## RLS (Row Level Security)

- Habilitado en todas las tablas
- Políticas para lectura pública (productos, events, blog_posts, schedules, etc.)
- Políticas para admin (solo role_id = 1 puede escribir)
- Políticas para usuario (solo puede ver/modificar su propio perfil)

## Seed Data

- `roles`: 4 roles predefinidos
- `disciplines`: Kenpo, Kickboxing, MMA, Funcional Trainer
- `academy_settings`: Datos base de la academia
