# Design Tokens

## Fuentes

| Token | Font | Uso |
|---|---|---|
| `--font-headline-lg` | Anton | Títulos grandes |
| `--font-headline-md` | Anton | Títulos medios, botones |
| `--font-headline-lg-mobile` | Anton | Títulos mobile |
| `--font-display-xl` | Anton | Hero title |
| `--font-body-lg` | Hanken Grotesk | Texto grande |
| `--font-body-md` | Hanken Grotesk | Texto base |
| `--font-label-sm` | JetBrains Mono | Labels, badges |

## Colores Principales

| Token | Hex | Uso |
|---|---|---|
| `--color-primary` | `#ffb4ac` | Acentos, links, bordes activos |
| `--color-primary-container` | `#ff544c` | Botones CTA, badges |
| `--color-background` | `#131313` | Fondo general |
| `--color-surface` | `#131313` | Superficies |
| `--color-surface-container` | `#201f1f` | Cards, paneles |
| `--color-surface-container-low` | `#1c1b1b` | Fondo alternativo |
| `--color-surface-container-lowest` | `#0e0e0e` | Footer, modales |
| `--color-on-surface` | `#e5e2e1` | Texto principal |
| `--color-on-surface-variant` | `#e4beb9` | Texto secundario |

## Clases Custom (globals.css)

| Clase | Uso |
|---|---|
| `.btn-primary-gradient` | `background: linear-gradient(135deg, #ff544c, #d32f2f, #b71c1c)` |
| `.hero-gradient` | Gradiente vertical para hero overlay |
| `.glass-panel` | `backdrop-filter: blur(12px)` + fondo semi-transparente |
| `.text-glow-red` | `text-shadow` rojo para títulos hero |
| `.fade-up` | Animación de entrada (opacity + translateY) |
| `.fade-up.visible` | Estado final de la animación |

## Breakpoints (Tailwind v4 default)

| Prefijo | Ancho |
|---|---|
| `md:` | 768px |
| `lg:` | 1024px |
