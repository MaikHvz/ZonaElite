# Componentes

## Componentes de Landing (`src/components/`)

| Componente | Tipo | Archivo | Estado |
|---|---|---|---|
| Navbar | Client | `Navbar.tsx` | Activo |
| Hero | Server | `Hero.tsx` | Activo |
| IntroSection | Server | `IntroSection.tsx` | Activo |
| Disciplines | Server | `Disciplines.tsx` | Activo |
| Memberships | Server | `Memberships.tsx` | Activo |
| CTA | Server | `CTA.tsx` | Activo |
| Footer | Client | `Footer.tsx` | Activo |
| ContactModal | Client | `ContactModal.tsx` | Activo |
| ContactModalContext | Client | `ContactModalContext.tsx` | Activo |
| ContactLink | Client | `ContactLink.tsx` | Activo |
| PageCTA | Client | `PageCTA.tsx` | Activo (usado en /nosotros y /horarios) |
| FadeUpObserver | Client | `FadeUpObserver.tsx` | Activo |

## Componentes no usados en landing (pero existen)

| Componente | Archivo | Nota |
|---|---|---|
| Philosophy | `Philosophy.tsx` | Eliminado de landing, contenido en /nosotros |
| Lifestyle | `Lifestyle.tsx` | Eliminado de landing, contenido en IntroSection |
| Security | `Security.tsx` | Eliminado de landing, contenido en IntroSection |

## Dependencias de componentes

```
layout.tsx
└── ContactModalProvider
    └── children (page.tsx)
        ├── FadeUpObserver
        ├── Navbar
        ├── Hero → ContactLink
        ├── IntroSection → ContactLink
        ├── Disciplines
        ├── Memberships → ContactLink
        ├── CTA → ContactLink
        ├── Footer → ContactLink
        └── ContactModal (usa ContactModalContext)
```
