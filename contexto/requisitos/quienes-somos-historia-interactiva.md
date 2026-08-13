# Requisito: "Quiénes Somos" — Historia Interactiva (Kenpo / Kickboxing / MMA)

> Estado: **planificado** (2026-08-13). Página pública, sin cambios de BD.

---

## 1. Explicación Profunda del Requisito

**Qué se va a hacer**: Rediseñar por completo la página pública `/nosotros` y renombrarla a **"Quiénes Somos"** (`/quienes-somos`). La sección pasa de ser una página estática de presentación a una **historia interactiva** con animaciones profundas, cuyo eje narrativo es el **American Kenpo** (qué es primero y luego su historia completa), acompañado de dos historias secundarias: **Kickboxing** y **MMA**.

**Por qué se necesita**: El usuario dueño de la academia quiere que el visitante entienda, de forma memorable y emocional, la raíz marcial de la academia (el Kenpo) y las otras dos disciplinas que se enseñan. El formato de "historia interactiva" aumenta el tiempo de lectura (engagement), la comprensión y la recordación de marca frente a una página de texto plano.

**Roles que interactúan**:
- **Visitante anónimo** (público): lee la historia, navega entre las 3 disciplinas, avanza por capítulos.
- **Admin**: ve el resultado final (sin panel de edición de contenido; el contenido es estático en el código).

**No interactúan**: alumnos logueados, dashboard, panel admin, sistema de pagos ni BD. Es 100% contenido estático + animación en cliente.

---

## 2. Flujo de Implementación Propuesto

### 2.1 Arquitectura

- **Ruta nueva**: `src/app/quienes-somos/page.tsx` (Server Component) — estructura de la página, SEO, JSON-LD.
- **Datos**: `src/components/history/stories.ts` — contenido estructurado de las 3 disciplinas (introducción "qué es", capítulos con periodo/año/título/párrafos/cita/facts, cierre).
- **Componente interactivo**: `src/components/history/HistoryExplorer.tsx` (`"use client"`) — selector de disciplina + lector con capítulos progresivos, barra de progreso de lectura, revelado por scroll (IntersectionObserver), botones "Continuar leyendo" entre capítulos y navegación rápida.
- **Estilos**: keyframes nuevos en `src/app/globals.css` (revelado de capítulos, ascenso de partículas del hero, línea de tiempo que se "pinta"). Se respeta la regla de accesibilidad del proyecto (**sin backdrop-blur**) y `prefers-reduced-motion`.

### 2.2 Experiencia de la historia interactiva (usabilidad)

1. **Selector de historia** (al inicio): 3 cards — **KENPO** (activa por defecto, badge "Nuestra raíz"), **KICKBOXING** y **MMA**. La card activa se resalta con glow rojo; en móvil es un rail horizontal scrolleable.
2. **Qué es primero**: al abrir Kenpo (por defecto), el lector empieza con la sección **"¿Qué es el American Kenpo?"** — respuesta breve y clara antes de la línea de tiempo.
3. **Capítulos en línea de tiempo vertical**: cada capítulo tiene un marcador de periodo/año (punto en la línea que se "enciende" al llegar), título, párrafos con revelado escalonado, citas destacadas y datos clave.
4. **Progreso de lectura**: barra fija bajo el navbar que se llena según el scroll dentro del lector; etiqueta "Capítulo X de N".
5. **Invitación a seguir leyendo**: entre capítulos, un divisor con botón **"Continuar leyendo ↓"** que hace smooth-scroll al siguiente capítulo. Al final, bloque "Fin de la historia" con CTAs: volver al inicio de la historia o cambiar de disciplina.
6. **Navegación rápida**: chips de capítulos (jump nav) que permiten saltar.

### 2.3 Contenido histórico (preciso)

- **American Kenpo**: origen Shaolin / diaspora china → James Mitose en Hawái → William Chow (Kenpo Karate) → Ed Parker (American Kenpo, 1954-1956) → Hollywood (Elvis, IKKA) → "Infinite Insights" y la ciencia del combate → expansión global y legado hasta ZonaElite La Serena.
- **Kickboxing**: raíces en Muay Thai y boxeo → Japón años 60 (Osamu Noguchi acuña "Kick-Boxing") → Full Contact americano años 70 (PKA, Joe Lewis, Bill Wallace, Benny Urquidez) → K-1 años 90 (globo) → actualidad.
- **MMA**: Pankration (648 a.C.) → Vale Tudo / familia Gracie → UFC 1 (1993, Royce Gracie) → unificación de reglas + Zuffa/TUF (2001-2005) → era moderna y MMA en Chile.

### 2.4 Frontend / API / BD

- **No hay** endpoints de API ni cambios de BD. Solo contenido estático en el bundle.

---

## 3. Análisis de Impacto

### 3.1 Verificación de interacciones con flujos existentes

| Punto de contacto | Impacto |
|---|---|
| `CheckoutModal.tsx` / Flow (`confirmAndCreateMembership`) | **Nulo** — no se toca |
| Zonas horarias (`getChileToday`/`addDaysChile`) | **Nulo** — no se manipulan fechas |
| Dashboard / Tokens / RLS / RPCs | **Nulo** — página pública estática |
| `GalleryCarousel` en `/nosotros` | Se **reutiliza** en la nueva página (sin cambios al componente) |
| `PageCTA` / `Footer` / `Navbar` | Se actualizan los links: `/nosotros` → `/quienes-somos` (label "Quiénes Somos") |
| `sitemap.ts` | Actualiza la URL estática a `/quienes-somos` |
| Admin `/admin/configuracion` (texto "página /nosotros") | Actualización de texto informativo |
| Redirects legacy | Se agrega redirect 301 `/nosotros` → `/quienes-somos` en `next.config.ts` |

### 3.2 Impacto en BD

**Ninguno.** No se crean tablas, RPCs, triggers ni policies. No se toca `squema-sql-actualizado.sql` (el espejo queda 1:1). No se requiere migración de changelog (la regla IA #20 aplica a features que tocan BD/paneles; este cambio es de contenido público — se documenta igualmente en `requisitos-implementados.md`).

### 3.3 Riesgos y mitigaciones

- **Animaciones en cliente** → se implementan con IntersectionObserver (patrón ya usado en `FadeUpObserver`) + `prefers-reduced-motion` para respetar usuarios con movimiento reducido.
- **Contenido histórico impreciso** → se redacta con datos históricos verificados (fechas y figuras reales) evitando afirmaciones no comprobables.
- **Accesibilidad (sin blur)** → todos los paneles usan fondos sólidos/gradientes, nunca `backdrop-filter`.

---

## 4. Documentación y Sincronización Post-Implementación

1. Actualizar `contexto/BRAIN.md` (tabla de rutas: `/quienes-somos`, nota de la nueva sección).
2. Actualizar `documentacion/flujo-modulos.md` (módulo público → ruta y componentes nuevos).
3. Agregar entrada en `documentacion/requisitos-implementados.md`.
4. `squema-sql-actualizado.sql`: **sin cambios** (no hay cambios de esquema).
