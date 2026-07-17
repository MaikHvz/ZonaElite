# ZONAELITE - Brain (Contexto Principal)

## Cómo usar esta carpeta

Esta carpeta existe para que la IA **no pierda contexto del proyecto** y **gaste menos tokens** leyendo archivos innecesarios. Cada vez que inicies una sesión, lee este archivo primero.

### Estructura

```
project-context/
├── brain.md                  ← LEER PRIMERO. Contexto general y reglas.
├── database.md               ← Schema de base de datos (Supabase).
├── requirements-tasklist.md  ← Requerimientos funcionales y tasklist.
├── requerimientos.md         ← Requerimientos detallados por módulo.
├── components.md             ← Mapa de componentes y su estado.
├── routes.md                 ← Mapa de rutas y qué hacen.
├── design-tokens.md          ← Variables de diseño (colores, fuentes, spacing).
├── sqlmodelcomplete.md       ← SQL completo ejecutado en Supabase.
├── bdmodel.md                ← Diagrama ER de 22 entidades.
└── changelog.md              ← Cambios importantes recientes.
```

### Reglas

1. **Siempre lee `brain.md` primero** antes de cualquier tarea.
2. **Actualiza los archivos** cuando hagas cambios significativos (nuevas rutas, componentes, schemas).
3. **No dupliques información** entre archivos. Cada archivo tiene un propósito claro.
4. **Sé conciso**. Este sistema existe para AHORRAR tokens, no para generar documentación innecesaria.

---

## Proyecto: ZONAELITE

Academia de artes marciales (Kenpo, Kickboxing, MMA) en La Serena, Chile.

### Stack

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 16.2.10 | Framework (App Router) |
| React | 19.2.4 | UI |
| TypeScript | ^5 | Tipado |
| Tailwind CSS | v4 | Estilos (vía `@theme inline` en CSS) |
| PostCSS | `@tailwindcss/postcss` | Procesamiento CSS |
| Supabase | latest | BD, Auth, Storage |
| Recharts | latest | Gráficos del dashboard admin |
| @react-pdf/renderer | latest | Generación de PDF (recibos de membresía) |

### Convenciones

- **App Router** con `src/app/`
- **Componentes** en `src/components/` (landing) y `src/components/admin/` (admin)
- **Librerías** en `src/lib/supabase/`
- **Providers** en `src/providers/`
- **Tailwind v4**: configuración via `@theme inline` en `globals.css` (NO existe `tailwind.config.js`)
- **Fonts**: Anton (headlines), Hanken Grotesk (body), JetBrains Mono (labels) via `next/font/google`
- **Iconos**: Material Symbols Outlined (via CDN link en layout.tsx)
- **Cliente/Servidor**: Componentes con estado usan `"use client"`, el resto son Server Components
- **Navbar + FadeUpObserver + ContactModal**: Globalmente en root layout (`layout.tsx`)
- **Idioma**: Todo el contenido visible está en español
- **Auth**: Supabase Auth con roles (administrador=1, instructor=2, recepcion=3, alumno=4)
- **Admin Guard**: Solo `role_id === 1` accede a `/admin/*`
- **SessionProvider**: Provee `user`, `profile`, `isAdmin`, `isStaff`, `refreshProfile()`

### Paleta de colores (Material Design 3)

- **Primary**: `#ffb4ac` (rojo claro)
- **Primary Container**: `#ff544c` (rojo intenso)
- **Background**: `#131313` (casi negro)
- **Surface**: `#131313`
- **On Surface**: `#e5e2e1` (blanco roto)
- **On Surface Variant**: `#e4beb9` (beige)

### Archivos de referencia

- `design-tokens.md` → Tokens de diseño completos
- `routes.md` → Mapa de rutas
- `components.md` → Estado de componentes
- `requirements-tasklist.md` → Requerimientos y tasklist
- `requerimientos.md` → Requerimientos detallados por módulo
- `database.md` → Schema de BD (Supabase)
- `sqlmodelcomplete.md` → SQL completo ejecutado
- `bdmodel.md` → Diagrama ER
- `changelog.md` → Cambios recientes
