# Rutas del Proyecto

## Rutas Activas

| Ruta | Archivo | Descripción | SEO |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Landing page principal | Title: "ZONAELITE \| Academia de Kenpo, Kickboxing, MMA en La Serena" |
| `/horarios` | `src/app/horarios/page.tsx` | Calendario semanal de clases | Title: "Horarios de Clases \| Kenpo, Kickboxing, MMA La Serena" |
| `/nosotros` | `src/app/nosotros/page.tsx` | Sobre nosotros + FAQ + Schema | Title: "Academia de Artes Marciales en La Serena \| ZONAELITE" |

## Layout Global

- `src/app/layout.tsx` → Root layout con fonts, metadata, ContactModalProvider

## Landing Page (`/`) - Orden de secciones

1. **Hero** → Imagen de fondo, título principal, CTA Reservar + Ver Horarios
2. **IntroSection** → 2 columnas: Estilo de Vida + Seguridad
3. **Disciplines** → Bento grid 4 cards (Kenpo, Kickboxing, Funcional, MMA)
4. **Memberships** → 3 planes de pricing ($19.990 / $29.990 / $39.990)
5. **CTA** → "¿Estás listo para comenzar?"
6. **Footer**

## Navbar Links

| Label | Href | Nota |
|---|---|---|
| Nosotros | `/nosotros` | Ruta externa |
| Disciplinas | `/#disciplinas` | Anchor en landing |
| Horarios | `/horarios` | Ruta externa |
| Membresías | `/#membresias` | Anchor en landing |
| Galería | `#galeria` | Sin implementar |
| Logo/ZONAELITE | `/` | Home |
| Únete Ahora | Abre modal contacto | ContactLink |
