# Componentes

## Componentes de Landing (`src/components/`)

| Componente | Client | Archivo | Estado |
|---|---|---|---|
| Navbar | Sí | `Navbar.tsx` | Activo — global en root layout, auth-aware, notification bell |
| Hero | No | `Hero.tsx` | Activo |
| IntroSection | No | `IntroSection.tsx` | Activo |
| Disciplines | No | `Disciplines.tsx` | Activo |
| Memberships | Sí | `Memberships.tsx` | Activo — carga planes desde Supabase |
| CTA | No | `CTA.tsx` | Activo |
| Footer | Sí | `Footer.tsx` | Activo |
| ContactModal | Sí | `ContactModal.tsx` | Activo — global en root layout |
| ContactModalContext | Sí | `ContactModalContext.tsx` | Activo |
| ContactLink | Sí | `ContactLink.tsx` | Activo |
| PageCTA | Sí | `PageCTA.tsx` | Activo (usado en /nosotros y /horarios) |
| FadeUpObserver | Sí | `FadeUpObserver.tsx` | Activo — global en root layout |
| EventCard | No | `EventCard.tsx` | Activo — usado en /eventos |

## Componentes Admin (`src/components/admin/`)

| Componente | Client | Archivo | Estado |
|---|---|---|---|
| AdminGuard | Sí | `AdminGuard.tsx` | Activo — verifica role_id === 1 |
| AdminSidebar | Sí | `AdminSidebar.tsx` | Activo — 9 links de navegación |
| DataTable | Sí | `DataTable.tsx` | Activo — tabla genérica con búsqueda + paginación |
| FormModal | Sí | `FormModal.tsx` | Activo — modal de formulario genérico |
| DeleteConfirm | Sí | `DeleteConfirm.tsx` | Activo — diálogo de confirmación de eliminación |
| StatsCard | Sí | `StatsCard.tsx` | Activo — tarjeta de estadística del dashboard |
| StatusBadge | No | `StatusBadge.tsx` | Activo — badge de estado (activo/vencida/borrador/etc.) |
| AssignMembershipModal | Sí | `AssignMembershipModal.tsx` | Activo — modal de asignación manual de membresías |
| MembershipReceipt | Sí | `MembershipReceipt.tsx` | Activo — generador de PDF recibo con @react-pdf/renderer |
| RevenueChart | Sí | `RevenueChart.tsx` | Activo — gráfico de barras de ingresos mensuales (recharts) |
| NewStudentsChart | Sí | `NewStudentsChart.tsx` | Activo — gráfico de área de nuevos alumnos por mes |
| MembershipBreakdown | Sí | `MembershipBreakdown.tsx` | Activo — donut de membresías activas por plan |
| MonthlyComparison | Sí | `MonthlyComparison.tsx` | Activo — comparación mes actual vs anterior |
| PaymentOverview | Sí | `PaymentOverview.tsx` | Activo — estado de pagos con barra de proporción |

## Componentes deshabilitados (no en uso activo)

| Componente | Archivo | Nota |
|---|---|---|
| Philosophy | `Philosophy.tsx` | Eliminado de landing, contenido en /nosotros |
| Lifestyle | `Lifestyle.tsx` | Eliminado de landing, contenido en IntroSection |
| Security | `Security.tsx` | Eliminado de landing, contenido en IntroSection |

## Providers

| Provider | Client | Archivo | Estado |
|---|---|---|---|
| SessionProvider | Sí | `src/providers/SessionProvider.tsx` | Activo — provee user, profile, isAdmin, isStaff, refreshProfile |

## Dependencias de componentes

```
layout.tsx (root)
├── SessionProvider
│   └── ContactModalProvider
│       ├── Navbar (auth-aware, notification bell)
│       ├── FadeUpObserver
│       ├── {children} (pages)
│       └── ContactModal

admin/layout.tsx
├── AdminGuard (verifica role_id === 1)
│   ├── AdminSidebar (9 links)
│   └── {children} (admin pages)
```

## Librerías (`src/lib/supabase/`)

| Archivo | Uso |
|---|---|
| `client.ts` | Cliente browser (createBrowserClient) |
| `server.ts` | Cliente server (createServerClient + cookies) |
| `auth.ts` | Operaciones de auth (login, register, logout, reset, etc.) |
| `profile.ts` | Consulta y actualización de perfiles |
| `middleware.ts` | Refresh de sesión + proteccion de rutas |
