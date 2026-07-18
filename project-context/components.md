# Componentes

## Componentes de Landing (`src/components/`)

| Componente | Client | Archivo | Estado |
|---|---|---|---|
| Navbar | Sí | `Navbar.tsx` | Activo — global en root layout, auth-aware, notification bell |
| Hero | No | `Hero.tsx` | Activo |
| IntroSection | No | `IntroSection.tsx` | Activo |
| Disciplines | No | `Disciplines.tsx` | Activo |
| Memberships | Sí | `Memberships.tsx` | Activo — carga planes desde Supabase + botón Comprar → CheckoutModal |
| CTA | No | `CTA.tsx` | Activo |
| Footer | Sí | `Footer.tsx` | Activo |
| ContactModal | Sí | `ContactModal.tsx` | Activo — global en root layout |
| ContactModalContext | Sí | `ContactModalContext.tsx` | Activo |
| ContactLink | Sí | `ContactLink.tsx` | Activo |
| PageCTA | Sí | `PageCTA.tsx` | Activo (usado en /nosotros y /horarios) |
| FadeUpObserver | Sí | `FadeUpObserver.tsx` | Activo — global en root layout |
| EventCard | No | `EventCard.tsx` | Activo — usado en /eventos |
| CheckoutModal | Sí | `CheckoutModal.tsx` | Activo — modal selección beneficiario + pago Webpay Flow |
| PurchaseSuccessBanner | Sí | `PurchaseSuccessBanner.tsx` | Activo — banners éxito/error post-pago |
| MedicalInfoCard | Sí | `MedicalInfoCard.tsx` | Activo — ficha médica: enfermedades, lesiones, medicamentos, alergias |
| EmergencyContactCard | Sí | `EmergencyContactCard.tsx` | Activo — contacto de emergencia: nombre y teléfono |

## Componentes Admin (`src/components/admin/`)

| Componente | Client | Archivo | Estado |
|---|---|---|---|
| AdminGuard | Sí | `AdminGuard.tsx` | Activo — verifica role_id === 1 |
| AdminSidebar | Sí | `AdminSidebar.tsx` | Activo — 10 links de navegación (incluye Asistencia) |
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

## Componentes Dashboard (`src/components/dashboard/`)

| Componente | Client | Archivo | Estado |
|---|---|---|---|
| DashboardNav | Sí | `DashboardNav.tsx` | Activo — navegación horizontal por 6 tabs (incluye Asistencia) |
| MembershipCard | Sí | `MembershipCard.tsx` | Activo — card con barra de progreso, estado, beneficios |
| QuickStats | No | `QuickStats.tsx` | Activo — 3 cards: membresías, pagos del mes, cargas |
| AlertBanner | No | `AlertBanner.tsx` | Activo — alertas de vencimiento/sin membresía |
| DashboardSkeleton | No | `DashboardSkeleton.tsx` | Activo — loading states para cada sección |
| NotificationItem | No | `NotificationItem.tsx` | Activo — fila de notificación con icono por tipo |
| PaymentRow | No | `PaymentRow.tsx` | Activo — fila de pago con método, monto, estado |
| DependentCard | No | `DependentCard.tsx` | Activo — card de dependiente con edad, membresía y link a ficha médica |
| AddDependentModal | Sí | `AddDependentModal.tsx` | Activo — formulario para agregar nueva carga |

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
│       ├── Navbar (auth-aware, notification bell → /dashboard/notificaciones)
│       ├── FadeUpObserver
│       ├── {children} (pages)
│       └── ContactModal

admin/layout.tsx
├── AdminGuard (verifica role_id === 1)
│   ├── AdminSidebar (10 links)
│   └── {children} (admin pages)

dashboard/layout.tsx
├── DashboardNav (6 tabs: Resumen, Membresías, Pagos, Cargas, Notificaciones, Asistencia)
│   └── {children} (dashboard pages)
```

## Librerías

### Supabase (`src/lib/supabase/`)

| Archivo | Uso |
|---|---|
| `client.ts` | Cliente browser (createBrowserClient) |
| `server.ts` | Cliente server (createServerClient + cookies) |
| `auth.ts` | Operaciones de auth (login, register, logout, reset, etc.) |
| `profile.ts` | Consulta y actualización de perfiles |
| `dashboard.ts` | Queries del dashboard usuario: safeQuery wrapper, membresías, pagos, dependientes, notificaciones, resumen, perfil, ficha médica, asistencia |
| `middleware.ts` | Refresh de sesión + proteccion de rutas |

### Flow (`src/lib/`)

| Archivo | Uso |
|---|---|
| `flow.ts` | Utilidades Flow.cl: signFlowParams (HMAC-SHA256), createFlowOrder, verifyFlowPayment |
