# Rutas del Proyecto

## Layout Global

- `src/app/layout.tsx` → Root layout con fonts, metadata, Navbar, FadeUpObserver, ContactModal, SessionProvider
- `src/app/admin/layout.tsx` → AdminGuard + AdminSidebar + header (protegido, solo role_id=1)

## Rutas Públicas

| Ruta | Archivo | Descripción | SEO |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Landing page principal | Title: "ZONAELITE \| Academia de Kenpo, Kickboxing, MMA en La Serena" |
| `/horarios` | `src/app/horarios/page.tsx` | Calendario semanal de clases | Title: "Horarios de Clases \| Kenpo, Kickboxing, MMA La Serena" |
| `/nosotros` | `src/app/nosotros/page.tsx` | Sobre nosotros + FAQ + Schema LocalBusiness | Title: "Academia de Artes Marciales en La Serena \| ZONAELITE" |
| `/productos` | `src/app/productos/page.tsx` | Catálogo de productos con filtros por categoría | Title: "Tienda \| ZONAELITE" |
| `/eventos` | `src/app/eventos/page.tsx` | Eventos unificados (torneos + ceremonias) con pestañas de filtro | Title: "Eventos \| ZONAELITE" |
| `/blog` | `src/app/blog/page.tsx` | Blog estilo feed de redes sociales | Title: "Blog \| ZONAELITE" |
| `/blog/[slug]` | `src/app/blog/[slug]/page.tsx` | Publicación individual del blog (dynamic) | Title: dynamic |

## Rutas de Auth

| Ruta | Archivo | Descripción |
|---|---|---|
| `/auth` | `src/app/auth/page.tsx` | Login / Registro (tabs) |
| `/auth/confirm` | `src/app/auth/confirm/page.tsx` | Confirmación de email |
| `/auth/update-password` | `src/app/auth/update-password/page.tsx` | Reset de contraseña |

## Rutas Protegidas (requieren sesión)

| Ruta | Archivo | Descripción |
|---|---|---|
| `/dashboard` | `src/app/dashboard/page.tsx` | Panel del usuario (alumno) |
| `/perfil` | `src/app/perfil/page.tsx` | Perfil del usuario |

## Rutas Admin (requieren role_id = 1)

| Ruta | Archivo | Descripción |
|---|---|---|
| `/admin` | `src/app/admin/page.tsx` | Dashboard admin con métricas: stats, gráficos de ingresos, alumnos, membresías, pagos |
| `/admin/productos` | `src/app/admin/productos/page.tsx` | CRUD productos |
| `/admin/eventos` | `src/app/admin/eventos/page.tsx` | CRUD eventos (torneo/graduacion/seminario/clase_especial) |
| `/admin/horarios` | `src/app/admin/horarios/page.tsx` | CRUD horarios con selects de disciplina/profesor |
| `/admin/usuarios` | `src/app/admin/usuarios/page.tsx` | Ver usuarios + cargas agrupadas bajo tutor, cambiar roles, activar/desactivar |
| `/admin/membresias` | `src/app/admin/membresias/page.tsx` | CRUD planes + asignación manual + editar/cancelar membresías + PDF recibo |
| `/admin/blog` | `src/app/admin/blog/page.tsx` | CRUD publicaciones del blog (borrador/programado/publicado) |
| `/admin/notificaciones` | `src/app/admin/notificaciones/page.tsx` | CRUD notificaciones (aviso/recordatorio/comunicado/correo_masivo) |
| `/admin/configuracion` | `src/app/admin/configuracion/page.tsx` | Editar configuración de la academia |

## Redirects

| Desde | Hasta | Archivo |
|---|---|---|
| `/torneos` | `/eventos` | `src/app/torneos/page.tsx` |
| `/ceremonias` | `/eventos` | `src/app/ceremonias/page.tsx` |

## Navbar Links

| Label | Href | Tipo |
|---|---|---|
| Logo/ZONAELITE | `/` | Link interno |
| Nosotros | `/nosotros` | Link interno |
| Disciplinas | `/#disciplinas` | Anchor en landing |
| Horarios | `/horarios` | Link interno |
| Membresías | `/#membresias` | Anchor en landing |
| Tienda | `/productos` | Link interno |
| Eventos | `/eventos` | Link interno |
| Blog | `/blog` | Link interno |
| Campana (notificaciones) | — | Badge con contador (solo logueados) |
| Únete Ahora | Abre modal contacto | ContactLink |

## Landing Page (`/`) - Orden de secciones

1. **Hero** → Imagen de fondo, título principal, CTA Reservar + Ver Horarios
2. **IntroSection** → 2 columnas: Estilo de Vida + Seguridad
3. **Disciplines** → Bento grid 4 cards (Kenpo, Kickboxing, Funcional, MMA)
4. **Memberships** → Planes cargados desde Supabase `membership_plans`
5. **CTA** → "¿Estás listo para comenzar?"
6. **Footer**
