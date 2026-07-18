# ZONAELITE — Contexto Completo del Proyecto

> **Archivo único de contexto para IA.** Contiene toda la información necesaria para entender el proyecto sin leer archivos individuales.

---

## 1. Visión General

**ZONAELITE** es una academia de artes marciales (Kenpo, Kickboxing, MMA) en La Serena, Chile. La aplicación web incluye:

- **Landing page** pública con información de la academia
- **Catálogos públicos**: productos, eventos, blog, horarios
- **Panel de administración** completo con CRUD de todas las entidades
- **Sistema de autenticación** con roles (admin, instructor, recepción, alumno)
- **Asignación manual de membresías** para pagos por transferencia/efectivo
- **Dashboard de métricas** con gráficos de ingresos, alumnos, membresías
- **Base de datos** en Supabase (PostgreSQL) con 22+ tablas y RLS

---

## 2. Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 16.2.10 | Framework (App Router, `src/app/`) |
| React | 19.2.4 | UI |
| TypeScript | ^5 | Tipado |
| Tailwind CSS | v4 | Estilos (config via `@theme inline` en `globals.css`, NO existe `tailwind.config.js`) |
| Supabase | latest | BD, Auth, Storage |
| Recharts | latest | Gráficos del dashboard admin |
| @react-pdf/renderer | latest | Generación de PDF (recibos de membresía) |

### Convenciones
- Componentes en `src/components/` (landing) y `src/components/admin/` (admin)
- Librerías en `src/lib/supabase/`
- Providers en `src/providers/`
- Fonts: Anton (headlines), Hanken Grotesk (body), JetBrains Mono (labels) via `next/font/google`
- Iconos: Material Symbols Outlined (CDN en layout.tsx)
- Navbar + FadeUpObserver + ContactModal son globales en root layout
- Todo el contenido visible en español
- Build exitoso: 35 rutas, 0 errores TypeScript

---

## 3. Paleta de Colores (Material Design 3)

| Token | Hex | Uso |
|---|---|---|
| `--color-primary` | `#ffb4ac` | Acentos, links, bordes activos |
| `--color-primary-container` | `#ff544c` | Botones CTA, badges (rojo intenso) |
| `--color-background` | `#131313` | Fondo general (casi negro) |
| `--color-surface-container` | `#201f1f` | Cards, paneles |
| `--color-on-surface` | `#e5e2e1` | Texto principal (blanco roto) |
| `--color-on-surface-variant` | `#e4beb9` | Texto secundario (beige) |

### Clases CSS Custom
- `.btn-primary-gradient` → `linear-gradient(135deg, #ff544c, #d32f2f, #b71c1c)`
- `.glass-panel` → `backdrop-filter: blur(12px)` + fondo semi-transparente
- `.fade-up` → Animación de entrada (opacity + translateY)

---

## 4. Autenticación y Roles

### Roles (tabla `roles`)
| ID | Nombre | Permisos |
|---|---|---|
| 1 | administrador | Acceso total a `/admin/*` |
| 2 | instructor | Staff (acceso parcial) |
| 3 | recepcion | Staff (acceso parcial) |
| 4 | alumno | Solo usuario regular |

### Funciones SQL de autorización
- `is_admin()` → Verifica role_id = 1
- `is_staff()` → Verifica role IN ('administrador', 'instructor', 'recepcion')
- `owns_beneficiary(b_id)` → Verifica si el usuario es dueño del beneficiary

### SessionProvider (global)
Provee: `user`, `profile` (UserProfile), `isAdmin` (role_id===1), `isStaff` (role_id 1-3), `refreshProfile()`

### Protección de rutas
- `src/middleware.ts` → Actualiza sesión en cada request
- `src/lib/supabase/middleware.ts` → Protege /dashboard, /perfil, /admin
- `src/components/admin/AdminGuard.tsx` → Solo role_id = 1 accede a /admin/*

---

## 5. Rutas del Proyecto

### Públicas
| Ruta | Archivo | Descripción |
|---|---|---|
| `/` | `src/app/page.tsx` | Landing: Hero → IntroSection → Disciplines → Memberships (desde BD) → CTA → Footer |
| `/horarios` | `src/app/horarios/page.tsx` | Calendario semanal Lun-Dom |
| `/nosotros` | `src/app/nosotros/page.tsx` | Filosofía, disciplinas, FAQ, Schema LocalBusiness |
| `/productos` | `src/app/productos/page.tsx` | Catálogo con filtros por categoría |
| `/eventos` | `src/app/eventos/page.tsx` | Torneos + ceremonias unificados con pestañas |
| `/blog` | `src/app/blog/page.tsx` | Feed estilo redes sociales (sin likes/comentarios) |
| `/blog/[slug]` | `src/app/blog/[slug]/page.tsx` | Publicación individual (dynamic) |

### Auth
| Ruta | Archivo | Descripción |
|---|---|---|
| `/auth` | `src/app/auth/page.tsx` | Login / Registro (tabs) |
| `/auth/confirm` | `src/app/auth/confirm/page.tsx` | Confirmación de email |
| `/auth/update-password` | `src/app/auth/update-password/page.tsx` | Reset de contraseña |

### Protegidas (requieren sesión)
| Ruta | Archivo | Descripción |
|---|---|---|
| `/dashboard` | `src/app/dashboard/page.tsx` | Dashboard: resumen membresías, pagos, alertas, accesos rápidos |
| `/dashboard/membresias` | `src/app/dashboard/membresias/page.tsx` | Membresías con filtros |
| `/dashboard/pagos` | `src/app/dashboard/pagos/page.tsx` | Historial de pagos paginado |
| `/dashboard/cargas` | `src/app/dashboard/cargas/page.tsx` | Lista de dependientes |
| `/dashboard/notificaciones` | `src/app/dashboard/notificaciones/page.tsx` | Historial de notificaciones |
| `/dashboard/asistencia` | `src/app/dashboard/asistencia/page.tsx` | Historial de asistencia del usuario |
| `/perfil` | `src/app/perfil/page.tsx` | Perfil editable + cambio contraseña |

### Admin (requieren role_id = 1)
| Ruta | Archivo | Descripción |
|---|---|---|
| `/admin` | `src/app/admin/page.tsx` | Dashboard con métricas: RevenueChart, NewStudentsChart, MembershipBreakdown, MonthlyComparison, PaymentOverview, StatsCards |
| `/admin/usuarios` | `src/app/admin/usuarios/page.tsx` | Usuarios + cargas agrupadas bajo tutor |
| `/admin/membresias` | `src/app/admin/membresias/page.tsx` | CRUD planes + asignación manual + editar/cancelar membresías + PDF recibo |
| `/admin/asistencia` | `src/app/admin/asistencia/page.tsx` | Marcar asistencia por sesión de clase |
| `/admin/productos` | `src/app/admin/productos/page.tsx` | CRUD productos (inputMode="numeric") |
| `/admin/eventos` | `src/app/admin/eventos/page.tsx` | CRUD eventos (torneo/graduacion/seminario/clase_especial) |
| `/admin/horarios` | `src/app/admin/horarios/page.tsx` | CRUD horarios con selects disciplina/profesor |
| `/admin/blog` | `src/app/admin/blog/page.tsx` | CRUD blog (borrador/programado/publicado) |
| `/admin/notificaciones` | `src/app/admin/notificaciones/page.tsx` | CRUD notificaciones (aviso/recordatorio/comunicado/correo_masivo) |
| `/admin/configuracion` | `src/app/admin/configuracion/page.tsx` | Editar settings de la academia |

### Redirects
- `/torneos` → `/eventos`
- `/ceremonias` → `/eventos`

---

## 6. Componentes Principales

### Landing (`src/components/`)
| Componente | Tipo | Descripción |
|---|---|---|
| Navbar | Client | Global, auth-aware, notification bell con badge |
| Hero | Server | Imagen de fondo, CTAs |
| IntroSection | Server | 2 columnas: Estilo de Vida + Seguridad |
| Disciplines | Server | Bento grid 4 cards |
| Memberships | Client | Carga planes desde Supabase `membership_plans` + botón Comprar → CheckoutModal |
| CTA | Server | "¿Estás listo para comenzar?" |
| Footer | Client | Links |
| ContactModal | Client | Global, modal de contacto |
| FadeUpObserver | Client | Global, IntersectionObserver |
| EventCard | Server | Reutilizable para torneos/ceremonias |
| PageCTA | Client | CTA reutilizable (usado en /nosotros, /horarios) |
| CheckoutModal | Client | Modal selección beneficiario + pago Webpay Flow |
| PurchaseSuccessBanner | Client | Banners de éxito/error post-pago |
| MedicalInfoCard | Client | Ficha médica: enfermedades, lesiones, medicamentos, alergias (edit inline) |
| EmergencyContactCard | Client | Contacto de emergencia: nombre y teléfono (edit inline) |

### Admin (`src/components/admin/`)
| Componente | Tipo | Descripción |
|---|---|---|
| AdminGuard | Client | Auth guard role_id === 1 |
| AdminSidebar | Client | 10 links de navegación (incluye Asistencia) |
| DataTable | Client | Genérica con búsqueda + paginación |
| FormModal | Client | Modal de formulario (escape + onMouseDown overlay) |
| DeleteConfirm | Client | Confirmación de eliminación |
| StatsCard | Client | Tarjeta de estadística |
| StatusBadge | Server | Badge de estado (activo/vencida/borrador/etc.) |
| AssignMembershipModal | Client | Asignación manual: buscar usuario →选 beneficiario/carga → plan → fechas → pago |
| MembershipReceipt | Client | PDF con @react-pdf/renderer (recibo descargable) |
| RevenueChart | Client | Gráfico barras ingresos 6 meses (recharts) |
| NewStudentsChart | Client | Gráfico área nuevos alumnos 12 meses |
| MembershipBreakdown | Client | Donut membresías por plan |
| MonthlyComparison | Client | Mes actual vs anterior (ingresos, usuarios, membresías, asignaciones) |
| PaymentOverview | Client | Estado de pagos con barra de proporción |

### Dashboard Usuario (`src/components/dashboard/`)
| Componente | Tipo | Descripción |
|---|---|---|
| DashboardNav | Client | Navegación horizontal por 6 tabs (incluye Asistencia) |
| MembershipCard | Client | Card con barra de progreso, estado, beneficios |
| QuickStats | Server | 3 stat cards: membresías activas, pagos del mes, cargas |
| AlertBanner | Server | Alertas de membresía por vencer/vencida/sin membresía |
| DashboardSkeleton | Server | Loading states para cada sección |
| NotificationItem | Server | Fila de notificación con icono por tipo |
| PaymentRow | Server | Fila de pago con método, monto, estado, comprobante |
| DependentCard | Server | Card de dependiente con edad, membresía y link a ficha médica |
| AddDependentModal | Client | Formulario para agregar nueva carga |

---

## 7. Base de Datos (Supabase)

**URL**: `https://sfkkfcticgqdqvzthimz.supabase.co`

### Esquema de Tablas

```
auth.users (Supabase Auth)
    │
    ▼
profiles ──────────────────► dependents (tutor_id → profiles)
    │                              │
    ▼                              ▼
beneficiaries ◄────────────────────┘
    │
    ├──► memberships ──► membership_plans
    ├──► medical_records
    ├──► consent_forms
    ├──► body_metrics
    └──► attendance ──► class_sessions ──► schedules ──► disciplines
                                                    └──► profiles (professor_id)

payments ──► profiles (user_id)
        └──► memberships (membership_id, nullable)

products ──► product_images
product_orders ──► order_items ──► products

blog_posts ──► profiles (author_id)
events (autónoma)
notifications ──► profiles (sent_by)
audit_logs ──► profiles (user_id)
academy_settings (autónoma, 1 row)
```

### Tablas Principales

| Tabla | Columnas Clave | Descripción |
|---|---|---|
| `roles` | id (serial), name | 4 roles: administrador, instructor, recepcion, alumno |
| `profiles` | id (uuid, FK auth.users), role_id, full_name, email, phone, active | Perfiles de usuario |
| `dependents` | id, tutor_id (FK profiles), full_name, birth_date, category (nino/adulto) | Cargas/hijos |
| `beneficiaries` | id, profile_id (nullable, unique), dependent_id (nullable, unique) | Tabla puente: usuario O carga |
| `membership_plans` | id, name, price, duration_days, category, benefits (jsonb), active | Planes de membresía |
| `memberships` | id, beneficiary_id, plan_id, purchased_by, start_date, end_date, status | Membresías activas |
| `payments` | id, user_id, membership_id (nullable), order_id (nullable), amount, method, status, receipt_url | Pagos registrados |
| `products` | id, name, category, price, stock, active | Tienda |
| `events` | id, type (torneo/graduacion/seminario/clase_especial), title, event_date, extra (jsonb) | Eventos |
| `blog_posts` | id, title, slug, content, cover_image, author_id, status | Blog |
| `schedules` | id, discipline_id, professor_id, day_of_week, start_time, end_time, capacity | Horarios |
| `notifications` | id, type, subject, content, target, sent_by | Notificaciones |
| `academy_settings` | name, logo_url, address, whatsapp, social_links, integrations | Config (1 row) |

### Triggers Importantes
- `trg_on_auth_user_created` → Crea profile automáticamente al registrarse
- `trg_profiles_create_beneficiary` → Crea beneficiary automáticamente al crear profile
- `trg_dependents_create_beneficiary` → Crea beneficiary automáticamente al crear dependent

### RLS (Row Level Security)
- Todas las tablas tienen RLS habilitado
- Admin: acceso total a todas las tablas
- Staff: acceso a payments, class_sessions, attendance
- Usuarios: solo ven/editan su propio perfil y beneficiarios
- Públicos: membership_plans, products, events, schedules, disciplines (lectura)
- `payments_user_insert_own`: usuarios solo insertan pagos propios (solo method=flow)
- `payments_flow_update`: Flow callback puede actualizar pagos (update por token)

### Storage
- Bucket `public` para comprobantes de pago
- Ruta: `receipts/{membership_id}.{ext}`

---

## 8. Funcionalidades Implementadas

### Módulo 0 — Base de Datos ✅
- SQL completo ejecutado (22+ tablas, RLS, triggers, seed data)
- Roles, disciplines, academy_settings predefinidos

### Módulo 1 — Páginas Públicas ✅
- Landing con planes desde Supabase
- Horarios, Nosotros, Productos, Eventos, Blog
- SEO: metadata, OpenGraph, Schema LocalBusiness, FAQ Schema

### Módulo 2 — Panel Admin ✅
- CRUD completo: Productos, Eventos, Horarios, Usuarios, Membresías, Blog, Notificaciones, Configuración
- Dashboard con 5 gráficos (recharts) + stats + accesos rápidos
- Asignación manual de membresías con búsqueda agrupada
- Edición/cancelación de membresías existentes
- PDF de recibo descargable

### Auth ✅
- Login, registro, forgot password, email confirmation, reset
- SessionProvider con profile, isAdmin, isStaff

### Blog ✅
- Feed estilo social (sin likes/comentarios)
- Post individual por slug

### Usuarios ✅
- Cargas agrupadas bajo tutor en tabla
- Búsqueda agrupada en modal de asignación

---

## 9. Pendiente

### Módulo 3 — Pasarela de Pagos (Flow) ✅ (código listo, pendiente sandbox)
- Integración con Flow.cl (Webpay)
- `src/lib/flow.ts` — utilidades de firma y API
- `/api/flow/create-order` — crea orden de pago (previene duplicados)
- `/api/flow/confirmation` — callback de Flow, activa membresía (fallback por commerceOrder)
- `/api/flow/verify` — verificación client-side del pago al retornar de Flow
- `CheckoutModal.tsx` — selección de beneficiario + pago
- `Memberships.tsx` — botón Comprar → modal
- RLS: `payments_user_insert_own` (solo flow), `payments_flow_update` (callback)
- Pendiente: credenciales de sandbox + testing

### Módulo 4 — Asistencia y Ficha Médica ✅
- **Ficha Médica**: `/dashboard/cargas/[id]/medico` — ver/editar info médica por dependiente
- **Asistencia Admin**: `/admin/asistencia` — marcar asistencia por sesión de clase
- **Historial Asistencia**: `/dashboard/asistencia` — usuario ve su historial
- Components: MedicalInfoCard, EmergencyContactCard
- Queries: getMedicalRecord, upsertMedicalRecord, getUpcomingSessions, getAttendanceForSession, markAttendance, getUserAttendance
- AdminSidebar actualizado con link de Asistencia

### Galería
- Grid de fotos/videos, categorías, lightbox

### SEO
- `sitemap.xml`, `robots.txt`
- Open Graph dinámico para blog (ShareCard)
- JSON-LD en todas las páginas

### Otros
- Google Analytics / Tag Manager
- PWA
- Internacionalización (i18n)

---

## 10. Archivos del Código Fuente

### Layouts
- `src/app/layout.tsx` → Root: fonts, metadata, Navbar, FadeUpObserver, ContactModal, SessionProvider
- `src/app/admin/layout.tsx` → AdminGuard + AdminSidebar (10 links)

### Librerías
#### Supabase (`src/lib/supabase/`)
| Archivo | Uso |
|---|---|
| `client.ts` | Cliente browser (createBrowserClient) |
| `server.ts` | Cliente server (createServerClient + cookies) |
| `auth.ts` | Operaciones de auth |
| `profile.ts` | Consulta/actualización de profiles |
| `dashboard.ts` | Queries del dashboard: membresías, pagos, dependientes, notificaciones, ficha médica, asistencia |
| `middleware.ts` | Refresh sesión + protección de rutas |

#### Flow (`src/lib/`)
| Archivo | Uso |
|---|---|
| `flow.ts` | Utilidades Flow.cl: signFlowParams (HMAC-SHA256), createFlowOrder, verifyFlowPayment |

### Providers
- `src/providers/SessionProvider.tsx` → user, profile, isAdmin, isStaff, refreshProfile

### Middleware
- `src/middleware.ts` → updateSession en cada request (excepto assets estáticos)

---

## 11. Notas de Implementación

### React 19 + Inputs numéricos
- Usar `inputMode="numeric"` en vez de `type="number"` (bug de React 19 controlled inputs)
- Parsear valor con `Number(e.target.value.replace(/[^0-9]/g, ""))`

### FadeUpObserver
- Los componentes async-loaded (Memberships, EventCard, etc.) NO deben tener clase `fade-up` porque el observer solo corre una vez al mount

### FormModal
- Overlay: `onMouseDown` (no onClick) para evitar cierre accidental
- Escape handler con `useCallback` para evitar re-registros

### Búsqueda Agrupada
- En AssignMembershipModal y /admin/usuarios: cargas aparecen bajo su tutor
- Buscar profiles → fetch dependents por tutor_id → mostrar agrupados
- En DataTable de membresías: "Nombre — Carga de tutor" para dependientes
