# ZONAELITE - Brain (Contexto Principal)

## Cómo usar esta carpeta

Esta carpeta existe para que la IA **no pierda contexto del proyecto** y **gaste menos tokens** leyendo archivos innecesarios. Cada vez que inicies una sesión, lee este archivo primero.

### Estructura

```
project-context/
├── brain.md              ← LEER PRIMERO. Contexto general y reglas.
├── database.md           ← Schema de base de datos (cuando exista).
├── requirements.md       ← Requerimientos funcionales y no funcionales.
├── components.md         ← Mapa de componentes y su estado.
├── routes.md             ← Mapa de rutas y qué hacen.
├── design-tokens.md      ← Variables de diseño (colores, fuentes, spacing).
└── changelog.md          ← Cambios importantes recientes.
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

### Convenciones

- **App Router** con `src/app/`
- **Componentes** en `src/components/`
- **Tailwind v4**: configuración via `@theme inline` en `globals.css` (NO existe `tailwind.config.js`)
- **Fonts**: Anton, Hanken Grotesk, JetBrains Mono (via `next/font/google`)
- **Iconos**: Material Symbols Outlined (via CDN link en layout.tsx)
- **Cliente/Servidor**: Componentes con estado usan `"use client"`, el resto son Server Components
- **Modal de contacto**: Usa `ContactModalContext` + `ContactLink` para abrir desde cualquier página
- **Idioma**: Todo el contenido visible está en español

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
- `requirements.md` → Requerimientos
- `database.md` → Schema de BD (pendiente)
- `changelog.md` → Cambios recientes
