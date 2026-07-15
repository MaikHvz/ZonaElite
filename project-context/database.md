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
| `src/lib/supabase/middleware.ts` | Refresh de sesión en middleware |
| `src/middleware.ts` | Middleware global (actualiza sesión en cada request) |

## Uso

```ts
// En Server Components / Route Handlers
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// En Client Components
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```

## Entidades (borrador - pendiente crear en Supabase)

- **users** → Usuarios/alumnos (manejado por Supabase Auth)
- **classes** → Clases disponibles
- **schedules** → Horarios de clases
- **memberships** → Planes de membresía
- **bookings** → Reservas de clases
- **instructors** → Instructores
