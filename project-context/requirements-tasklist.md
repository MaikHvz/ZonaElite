# Requerimientos - Tasklist

## Módulos

### Módulo 0 — Base de Datos
- [x] SQL completo ejecutado en Supabase (22+ tablas)
- [x] RLS habilitado en todas las tablas
- [x] Roles: administrador(1), instructor(2), recepcion(3), alumno(4)
- [x] Tabla profiles vinculada a auth.users
- [x] Seed data: roles, disciplines, academy_settings
- [x] Función is_admin() para verificar role_id = 1

### Módulo 1 — Páginas Públicas / Catálogo
- [x] Landing page (`/`) — Hero, IntroSection, Disciplines, Memberships (desde BD), CTA, Footer
- [x] Horarios (`/horarios`) — Calendario semanal Lun-Dom, grid responsive
- [x] Sobre Nosotros (`/nosotros`) — Filosofía, disciplinas, FAQ, Schema LocalBusiness
- [x] Tienda (`/productos`) — Catálogo con filtros por categoría, display de stock
- [x] Eventos (`/eventos`) — Unificados (torneos + ceremonias) con pestañas de filtro
- [x] Blog (`/blog`) — Feed estilo redes sociales
- [x] Blog post (`/blog/[slug]`) — Publicación individual
- [x] Redirects: `/torneos` → `/eventos`, `/ceremonias` → `/eventos`

### Módulo 2 — Panel Admin
- [x] AdminGuard — Auth guard verificando role_id === 1
- [x] AdminLayout con AdminSidebar (9 links)
- [x] Dashboard admin — 5 stat cards + links rápidos
- [x] CRUD Productos — con `inputMode="numeric"` para React 19
- [x] CRUD Eventos — tipos: torneo, graduacion, seminario, clase_especial
- [x] CRUD Horarios — selects de disciplina y profesor
- [x] CRUD Usuarios — vista, cambio de roles, activar/desactivar
- [x] CRUD Membresías — planes con beneficios dinámicos + vista de membresías
- [x] CRUD Blog — estados: borrador, programado, publicado
- [x] CRUD Notificaciones — tipos: aviso, recordatorio, comunicado, correo_masivo
- [x] CRUD Configuración — edición de settings de la academia
- [x] Asignación manual de membresías — modal con búsqueda de usuario, selección de beneficiario/carga, plan existente
- [x] Edición de membresías — cambiar fecha fin y estado
- [x] Cancelación de membresías — con confirmación
- [x] PDF recibo — descargable con datos del pago y beneficiario
- [x] Upload comprobante — imagen a Supabase Storage

### Dashboard Admin — Métricas
- [x] RevenueChart — gráfico de barras de ingresos mensuales (últimos 6 meses)
- [x] NewStudentsChart — gráfico de área de nuevos alumnos por mes (últimos 12 meses)
- [x] MembershipBreakdown — donut de membresías activas por plan
- [x] MonthlyComparison — comparación mes actual vs anterior (ingresos, usuarios, membresías, asignaciones)
- [x] PaymentOverview — estado de pagos (pagado/pendiente/rechazado/expirado)
- [x] StatsCard con ingresos del mes
- [x] Accesos rápidos (8 links)

### Usuarios — Cargas Agrupadas
- [x] Tabla usuarios muestra cargas indentadas bajo tutor
- [x] Cargas muestran "Carga de [tutor]"
- [x] Búsqueda agrupada en AssignMembershipModal

### Módulo 3 — Pasarela de Pagos (Flow)
- [ ] Integración con Flow SDK
- [ ] Creación de checkout session
- [ ] Webhook de confirmación de pago
- [ ] Asignación automática de membresía tras pago exitoso
- [ ] Historial de transacciones

### Módulo 4 — Asistencia y Ficha Médica
- [ ] Registro de asistencia por clase
- [ ] Ficha médica de alumnos
- [ ] Control de asistencia en admin
- [ ] Reportes de asistencia

### Módulo 5 — Blog y Notificaciones
- [x] Blog feed-style (`/blog`)
- [x] Blog post individual (`/blog/[slug]`)
- [x] CRUD blog admin (borrador/programado/publicado)
- [x] CRUD notificaciones admin
- [x] Campana de notificaciones en Navbar (badge con contador)

## Funcionalidades Transversales

### Auth
- [x] Login con email/password
- [x] Registro de nuevos usuarios
- [x] Forgot password (envío de email)
- [x] Confirmación de email
- [x] Reset de contraseña
- [x] Middleware protegiendo /dashboard, /perfil, /admin
- [x] SessionProvider con profile, isAdmin, isStaff

### UI / UX
- [x] Navbar responsive (desktop + mobile menu)
- [x] Navbar auth-aware (muestra login o perfil según sesión)
- [x] Navbar con campana de notificaciones
- [x] Footer con links
- [x] Modal de contacto (botón flotante + botones CTA)
- [x] Animaciones fade-up con IntersectionObserver
- [x] Tema oscuro Material Design 3
- [x] Responsive mobile-first
- [x] Iconos Material Symbols Outlined

### SEO
- [x] Title tags optimizados por ruta
- [x] Meta descriptions
- [x] OpenGraph tags
- [x] Schema LocalBusiness (JSON-LD en /nosotros)
- [x] FAQ Schema (JSON-LD en /nosotros)
- [x] Keywords targeting local (La Serena)
- [x] Sitemap.xml (dinámico con blog posts y eventos)
- [x] Robots.txt (bloquea /admin, /dashboard, /perfil, /auth)
- [x] metadataBase configurado en layout.tsx

### Infraestructura
- [x] Next.js 16.2.10 + App Router
- [x] Tailwind CSS v4 (`@theme inline`)
- [x] TypeScript sin errores
- [x] Supabase connectado y funcionando
- [x] Build exitoso (27 rutas)

## Pendiente / Ideas Futuras

- [ ] Sección Galería
- [ ] Google Analytics / Tag Manager
- [ ] Formulario de contacto funcional (backend)
- [ ] PWA (Progressive Web App)
- [ ] Internacionalización (i18n)
