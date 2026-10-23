# Rediseño visual "fuego y oro" (hero + navbar) — v1.15.0

## Requisito

El usuario pidió mejorar la UX/UI tomando como referencia `idea.jpeg` (raíz del repo), junto con una propuesta escrita:

1. **Fondo con más drama**: la foto del hero con alto contraste, sombras profundas, matices cálidos de fuego (naranja/rojo) y chispas o brasas, con aspecto cinematográfico.
2. **Tipografía "fuego y oro"**: "DOMINA TU CUERPO." en dorado metálico/ámbar y "FORTALECE TU MENTE." en rojo/naranja incandescente.
3. **CTAs**: "Reservar clase" con degradado rojo → naranja y glow; "Ver horarios" con borde dorado/ámbar sutil.
4. **Detalles**: texto descriptivo en blanco; la barra de navegación y el botón "Perfil" con toques de dorado y rojo para unificar la marca.

Roles: afecta solo lo visual público (visitantes y alumnos). Sin cambios de datos ni permisos.

## Implementación

- **Imagen de fondo**: `scripts/grade-hero-image.py` (Pillow + numpy) toma `public/original.jpg` y genera:
  - `public/hero-fire.jpg` (2400×1350, 16:9, encuadre desde la parte alta de la jaula hasta la cintura, para escritorio);
  - `public/hero-fire-mobile.jpg` (1080×1728, recorte vertical del peleador y el coach, para móvil).
  El proceso conserva el **tono natural** (solo baja un poco la saturación): curva S de contraste, compresión de altas luces (techo, paredes, ventanas), penumbra a la izquierda y en el techo, viñeta y un **aura naranja sutil detrás del maestro** (halo en modo screen + contorno cálido solo a su alrededor), con pocas brasas y chispas cerca de él. La posición del aura se pasa por recorte (`grade(crop, (cx, cy, rx, ry))`).
  - Primera versión (descartada por el usuario el 2026-10-23): gradient map de fuego sobre toda la foto, quedaba demasiado naranja.
- **Hero (`src/components/Hero.tsx`)**: dos capas de fondo (`md:hidden` / `hidden md:block`), `hero-fire-overlay` (oscurece la izquierda para leer el texto y funde con la sección siguiente), `hero-fire-flicker` (aura animada muy suave detrás del maestro) y 16 brasas `ember ember-fire` deterministas, concentradas a la derecha. Titular `text-gold-metal` + `text-fire`, párrafo blanco con borde `ember`, CTAs `btn-fire` / `btn-gold-outline`, checks dorados.
- **Navbar (`src/components/Navbar.tsx`)**: fondo casi negro, línea inferior `nav-fire-line` (rojo → naranja → oro), links en Anton (hover dorado, activo `text-ember` con glow), logotipo `text-brand-fire`, Perfil `btn-gold`, Únete `btn-fire` (también en el menú móvil).
- **Estilos (`src/app/globals.css`)**: tokens `--color-gold`, `--color-gold-light`, `--color-ember`, `--color-fire` (utilidades `text-gold`, `border-ember`, etc.) y las clases nuevas. `.btn-primary-gradient` pasa a rojo-naranja (`#ff6a1a → #e5261b → #b71c1c`), así que todos los CTAs del sitio quedan alineados.

## Análisis de impacto

- **Checkout / Flow / transferencias**: no se toca lógica; solo cambia el color de `.btn-primary-gradient` (texto blanco sobre rojo-naranja, sigue legible).
- **Fechas / BD**: sin cambios. Solo la seed de changelog `046_changelog_v1_15_0.sql`.
- **Accesibilidad**: se mantiene la regla de no usar `backdrop-filter`; las animaciones nuevas (`hero-fire-flicker`, brasas, hover de `btn-fire`) respetan `prefers-reduced-motion`. El texto del hero tiene overlay oscuro detrás + `text-shadow`.
- **Hidratación**: las brasas se calculan con fórmulas deterministas (sin `Math.random`), igual que en `/quienes-somos`.
- **Rendimiento**: las imágenes nuevas pesan unos 380 KB (escritorio) y unos 210 KB (móvil); antes el hero cargaba `original.jpg` (5,6 MB) en todos los tamaños. `original.jpg` se conserva en `public/` como fuente del script.
