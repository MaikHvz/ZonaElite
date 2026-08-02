# Fix: Navbar público tapa el menú CRUD del admin en móvil

## Estado
- **Fecha:** 2026-08-02
- **Tipo:** Bug fix (UX / navegación)
- **B-017**

## Requisito / Problema
En el celular, dentro del panel admin (`/admin/*`), el usuario toca el botón de menú y se abre el menú del sitio público (Inicio, Nosotros, Disciplinas, Tienda, Blog...), NO el menú de CRUD del admin (Productos, Eventos, Horarios, Usuarios, Deudas, etc.). El menú de CRUD del admin nunca se ve en móvil.

## Causa raíz (diagnóstico confirmado)
- El layout raíz (`src/app/layout.tsx`) renderiza `<Navbar />` (navbar público) en **todas** las rutas, incluido `/admin`.
- El `Navbar` público es `fixed top-0 z-50` con su propio botón ☰ que abre el menú móvil del sitio público.
- El layout del admin (`src/app/admin/layout.tsx`) **no tiene offset superior** (`pt-*`), a diferencia del layout de dashboard (`src/app/dashboard/layout.tsx` que usa `pt-24 md:pt-28`).
- Resultado: el navbar público (fijo, z-50) queda por encima del header del admin. El ☰ propio del admin (que abre el drawer de CRUD) queda **invisible/enterrado** debajo. El único ☰ visible es el del navbar público → abre el menú público.

## Flujo de implementación propuesto
1. Ocultar el `<Navbar />` público en rutas `/admin`:
   - En `src/components/Navbar.tsx` usar `usePathname()` y retornar `null` si `pathname.startsWith("/admin")`.
2. Como el navbar público (que proveía "Mi Panel", "Perfil", "Cerrar Sesión") ya no estará en `/admin`, el header del admin debe proveer lo mínimo necesario:
   - Enlace del círculo de perfil a `/perfil`.
   - Botón "Cerrar Sesión" (icono `logout`) usando `signOut()` de `@/lib/supabase/auth` + `router.push("/auth")`.
3. No requiere migración SQL ni cambios de base de datos.

## Impacto
- **Navbar.tsx:** solo se oculta en rutas que empiezan con `/admin`. El resto del sitio (home, `/dashboard`, `/auth`, públicas) mantiene el navbar actual. `/dashboard` sigue con su offset `pt-24 md:pt-28` y funciona igual.
- **admin/layout.tsx:** header auto-contenido (☰ drawer, Ver sitio, Perfil, Cerrar Sesión). No altera el `AdminGuard`, ni el check-in, ni fechas (no usa helpers de fecha), ni la BD.
- No toca `CheckoutModal`, webhook Flow, ni vistas del dashboard.

## Verificación
- Suite `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs` (nueva sección L).
- `npm run build` sin errores.
