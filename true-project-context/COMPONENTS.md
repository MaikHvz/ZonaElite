# Componentes y Rutas Detallados

> **Archivo**: `true-project-context/COMPONENTS.md`

## Componentes por Categoría

### Landing (`src/components/`)

| Archivo | Tipo | Props | Descripción |
|---|---|---|---|
| `Navbar.tsx` | Client | — | Global, auth-aware, links, search, notification bell |
| `Hero.tsx` | Server | — | Imagen fondo, CTAs, título animado |
| `IntroSection.tsx` | Server | — | 2 columnas: Estilo de Vida + Seguridad |
| `Disciplines.tsx` | Server | — | Bento grid 4 cards |
| `Memberships.tsx` | Client | — | Planes desde Supabase + botón Comprar → CheckoutModal |
| `CTA.tsx` | Server | — | "¿Estás listo para comenzar?" |
| `Footer.tsx` | Client | — | Links sociales, copyright |
| `ContactModal.tsx` | Client | — | Global, formulario WhatsApp |
| `FadeUpObserver.tsx` | Client | — | IntersectionObserver para fade-in |
| `EventCard.tsx` | Server | `{ event: Event }` | Reutilizable para eventos |
| `PageCTA.tsx` | Client | — | CTA reutilizable (usado en /nosotros, /horarios) |
| `CheckoutModal.tsx` | Client | — | Modal selección beneficiario + pago Webpay Flow |
| `PurchaseSuccessBanner.tsx` | Client | — | Banners de éxito/error post-pago |
| `MedicalInfoCard.tsx` | Client | — | Ficha médica: enfermedades, lesiones, medicamentos, alergias (edit inline) |
| `EmergencyContactCard.tsx` | Client | — | Contacto de emergencia: nombre y teléfono (edit inline) |

### Admin (`src/components/admin/`)

| Archivo | Tipo | Props | Descripción |
|---|---|---|---|
| `AdminGuard.tsx` | Client | `{ children }` | Auth guard (role_id === 1) |
| `AdminSidebar.tsx` | Client | — | 10 links de navegación admin (incluye Asistencia) |
| `DataTable.tsx` | Client | `{ data, columns, searchKey, renderRow }` | Genérica + paginación |
| `FormModal.tsx` | Client | `{ open, onClose, title, children }` | Modal (escape + overlay click) |
| `DeleteConfirm.tsx` | Client | `{ open, onClose, onConfirm, item }` | Confirmación de borrado |
| `StatsCard.tsx` | Client | `{ title, value, change, icon }` | Tarjeta de estadística |
| `StatusBadge.tsx` | Server | `{ status }` | Badge colorido por estado |
| `AssignMembershipModal.tsx` | Client | `{ open, onClose }` | Asignación manual de membresías |
| `MembershipReceipt.tsx` | Client | `{ membership, plan, user }` | Generador PDF con @react-pdf/renderer |
| `RevenueChart.tsx` | Client | `{ data }` | Gráfico barras ingresos 6 meses |
| `NewStudentsChart.tsx` | Client | `{ data }` | Gráfico área nuevos alumnos 12 meses |
| `MembershipBreakdown.tsx` | Client | `{ data }` | Donut membresías por plan |
| `MonthlyComparison.tsx` | Client | `{ data }` | Mes actual vs anterior |
| `PaymentOverview.tsx` | Client | `{ data }` | Estado de pagos |

### Dashboard (`src/components/dashboard/`)

| Archivo | Tipo | Descripción |
|---|---|---|
| `DashboardNav.tsx` | Client | Navegación horizontal por 6 tabs (incluye Asistencia) |
| `MembershipCard.tsx` | Client | Card con barra de progreso, estado, beneficios |
| `QuickStats.tsx` | Server | 3 stat cards: membresías activas, pagos del mes, cargas |
| `AlertBanner.tsx` | Server | Alertas de membresía por vencer/vencida/sin membresía |
| `DashboardSkeleton.tsx` | Server | Loading states para cada sección |
| `NotificationItem.tsx` | Server | Fila de notificación con icono por tipo |
| `PaymentRow.tsx` | Server | Fila de pago con método, monto, estado |
| `DependentCard.tsx` | Server | Card de dependiente con edad, membresía y link a ficha médica |
| `AddDependentModal.tsx` | Client | Formulario para agregar nueva carga |

### Providers (`src/providers/`)

| Archivo | Tipo | Descripción |
|---|---|---|
| `SessionProvider.tsx` | Client | user, profile, isAdmin, isStaff, refreshProfile |

### Librerías (`src/lib/supabase/`)

| Archivo | Descripción |
|---|---|
| `client.ts` | Cliente browser (createBrowserClient) |
| `server.ts` | Cliente server (createServerClient + cookies) |
| `auth.ts` | Operaciones de autenticación |
| `profile.ts` | Consulta/actualización de profiles |
| `dashboard.ts` | Queries del dashboard: membresías, pagos, dependientes, notificaciones, ficha médica, asistencia |
| `middleware.ts` | Refresh sesión + protección de rutas |

### Flow (`src/lib/`)

| Archivo | Descripción |
|---|---|
| `flow.ts` | Utilidades Flow.cl: signFlowParams (HMAC-SHA256), createFlowOrder, verifyFlowPayment |

---

## Rutas por Categoría

### Públicas

| Ruta | Archivo | Componente | Datos |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Landing | membership_plans (Supabase) |
| `/horarios` | `src/app/horarios/page.tsx` | Page | Estáticos |
| `/nosotros` | `src/app/nosotros/page.tsx` | Page | Estáticos + LocalBusiness Schema |
| `/productos` | `src/app/productos/page.tsx` | Page | products (Supabase) |
| `/eventos` | `src/app/eventos/page.tsx` | Page | events (Supabase) |
| `/blog` | `src/app/blog/page.tsx` | Page | blog_posts (Supabase) |
| `/blog/[slug]` | `src/app/blog/[slug]/page.tsx` | Page | blog_post por slug (dynamic) |

### Auth

| Ruta | Archivo | Descripción |
|---|---|---|
| `/auth` | `src/app/auth/page.tsx` | Login / Registro (tabs) |
| `/auth/confirm` | `src/app/auth/confirm/page.tsx` | Confirmación email |
| `/auth/update-password` | `src/app/auth/update-password/page.tsx` | Reset contraseña |

### Protegidas (requieren sesión)

| Ruta | Archivo | Descripción |
|---|---|---|
| `/dashboard` | `src/app/dashboard/page.tsx` | Panel usuario |
| `/dashboard/membresias` | `src/app/dashboard/membresias/page.tsx` | Membresías con filtros |
| `/dashboard/pagos` | `src/app/dashboard/pagos/page.tsx` | Historial de pagos paginado |
| `/dashboard/cargas` | `src/app/dashboard/cargas/page.tsx` | Lista de dependientes |
| `/dashboard/cargas/[id]/medico` | `src/app/dashboard/cargas/[id]/medico/page.tsx` | Ficha médica del dependiente |
| `/dashboard/notificaciones` | `src/app/dashboard/notificaciones/page.tsx` | Historial de notificaciones |
| `/dashboard/asistencia` | `src/app/dashboard/asistencia/page.tsx` | Historial de asistencia del usuario |
| `/perfil` | `src/app/perfil/page.tsx` | Perfil |

### Admin (requieren role_id = 1)

| Ruta | Archivo | Descripción |
|---|---|---|
| `/admin` | `src/app/admin/page.tsx` | Dashboard + Stats + 5 gráficos |
| `/admin/usuarios` | `src/app/admin/usuarios/page.tsx` | Usuarios + cargas agrupadas |
| `/admin/membresias` | `src/app/admin/membresias/page.tsx` | CRUD planes + asignar + PDF |
| `/admin/asistencia` | `src/app/admin/asistencia/page.tsx` | Marcar asistencia por sesión de clase |
| `/admin/productos` | `src/app/admin/productos/page.tsx` | CRUD productos |
| `/admin/eventos` | `src/app/admin/eventos/page.tsx` | CRUD eventos |
| `/admin/horarios` | `src/app/admin/horarios/page.tsx` | CRUD horarios |
| `/admin/blog` | `src/app/admin/blog/page.tsx` | CRUD blog |
| `/admin/notificaciones` | `src/app/admin/notificaciones/page.tsx` | CRUD notificaciones |
| `/admin/configuracion` | `src/app/admin/configuracion/page.tsx` | Config academia |

### Redirects

| Ruta Origen | Ruta Destino |
|---|---|
| `/torneos` | `/eventos` |
| `/ceremonias` | `/eventos` |

### API Routes

| Ruta | Método | Archivo | Descripción |
|---|---|---|---|
| `/api/flow/create-order` | POST | `src/app/api/flow/create-order/route.ts` | Crea orden de pago Flow (previene duplicados) |
| `/api/flow/confirmation` | POST | `src/app/api/flow/confirmation/route.ts` | Callback Flow: verifica pago, crea membresía |
| `/api/flow/verify` | GET | `src/app/api/flow/verify/route.ts` | Verificación client-side del pago |

---

## Layouts

### Root Layout (`src/app/layout.tsx`)
- Fuentes: Anton (headlines), Hanken Grotesk (body), JetBrains Mono (labels)
- Metadata: title, description, icons, manifest
- Globales: Navbar, FadeUpObserver, ContactModal
- Providers: SessionProvider (global)
- Schema: Organization JSON-LD

### Admin Layout (`src/app/admin/layout.tsx`)
- Auth guard: AdminGuard
- Sidebar: AdminSidebar (10 links)

---

## Hooks Personalizados

| Hook | Archivo | Descripción |
|---|---|---|
| `useSession` | `src/providers/SessionProvider.tsx` | user, profile, isAdmin, isStaff, refreshProfile |

---

## Tipos TypeScript

### Profile (UserProfile)
```typescript
interface UserProfile {
  id: string;
  role_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  birth_date: string | null;
  photo_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  roles?: { name: string } | null;
}
```

### Event
```typescript
interface Event {
  id: string;
  type: 'torneo' | 'graduacion' | 'seminario' | 'clase_especial';
  title: string;
  description: string | null;
  image: string | null;
  location_name: string | null;
  event_date: string;
  extra: {
    horario?: string;
    recomendaciones?: string[];
    cinturones_convocados?: string[];
  };
}
```

### Membership
```typescript
interface Membership {
  id: string;
  beneficiary_id: string;
  plan_id: string;
  purchased_by: string;
  start_date: string;
  end_date: string;
  status: 'activa' | 'vencida' | 'cancelada';
  created_at: string;
  plan?: MembershipPlan;
  beneficiary?: Beneficiary;
  purchaser?: UserProfile;
}
```

### MembershipPlan
```typescript
interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  category: 'adulto' | 'nino';
  benefits: string[];
  active: boolean;
}
```

### Beneficiary
```typescript
interface Beneficiary {
  id: string;
  profile_id: string | null;
  dependent_id: string | null;
  profile?: UserProfile;
  dependent?: Dependent;
}
```

### Dependent
```typescript
interface Dependent {
  id: string;
  tutor_id: string;
  full_name: string;
  rut: string | null;
  birth_date: string;
  category: 'nino' | 'adulto';
  tutor?: UserProfile;
}
```

### Payment
```typescript
interface Payment {
  id: string;
  user_id: string;
  membership_id: string | null;
  order_id: string | null;
  concept: string;
  amount: number;
  method: 'efectivo' | 'transferencia' | 'flow' | 'otro';
  status: 'pendiente' | 'pagado' | 'rechazado' | 'expirado';
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
  user?: UserProfile;
}
```

---

## Paleta de Colores

### Tokens CSS
```css
--color-primary: #ffb4ac;
--color-primary-container: #ff544c;
--color-background: #131313;
--color-surface-container: #201f1f;
--color-on-surface: #e5e2e1;
--color-on-surface-variant: #e4beb9;
```

### Clases Custom
- `.btn-primary-gradient` → `linear-gradient(135deg, #ff544c, #d32f2f, #b71c1c)`
- `.glass-panel` → `backdrop-filter: blur(12px)` + fondo semi-transparente
- `.fade-up` → Animación entrada (opacity + translateY)

---

## Dependencias

```json
{
  "next": "^16.2.10",
  "react": "^19.2.4",
  "react-dom": "^19.2.4",
  "@supabase/supabase-js": "^2.49.1",
  "@supabase/ssr": "^0.5.2",
  "recharts": "^2.15.0",
  "@react-pdf/renderer": "^4.3.0"
}
```
