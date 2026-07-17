# Requerimientos Detallados

## Módulo 3 — Asignación Manual de Membresías

Asignar membresías manualmente cuando el usuario paga por fuera de la web (transferencia, efectivo, etc.). No requiere crear tablas nuevas — usa `payments` y `memberships` existentes.

### Funcionalidades
- Admin busca usuario por nombre/RUT
- Se muestran cargas (dependientes) del usuario como opciones de beneficiario
- Admin selecciona plan existente de `membership_plans`
- Ajusta fecha inicio (para asignaciones tardías)
- Registra método de pago y monto
- Opcionalmente sube comprobante de transferencia
- Genera PDF descargable como recibo/constancia
- Admin puede editar `end_date` de membresías existentes (ajustar días)
- Admin puede cancelar membresías
- Usuario puede tener múltiples membresías activas simultáneamente

### Flujo
```
Admin → Membresías → "Asignar Membresía"
  → Buscar usuario
  → Seleccionar beneficiario (usuario o carga)
  → Seleccionar plan existente
  → Ajustar fecha inicio
  → Método de pago + monto + comprobante
  → Guardar
  → Membresía activa + pago registrado
  → Descargar PDF recibo
```

### Tablas utilizadas (ya existentes)
- `memberships` — crear registro con `status = 'activa'`
- `payments` — registrar pago con `method = 'transferencia'`, `status = 'pagado'`
- `beneficiaries` — obtener `beneficiary_id` del usuario o carga
- `dependents` — listar cargas del usuario
- `membership_plans` — planes activos disponibles

### Archivos a crear/modificar
- `src/components/admin/AssignMembershipModal.tsx` (nuevo)
- `src/components/admin/MembershipReceipt.tsx` (nuevo — PDF)
- `src/app/admin/membresias/page.tsx` (editar — agregar asignación + acciones)
- Dependencia: `@react-pdf/renderer` (ya instalada)

---

## Módulo 3B — Pasarela de Pagos (Flow)

Integración con [Flow.cl](https://www.flow.cl/) para procesar pagos de membresías y productos.

### Funcionalidades
- Crear checkout session con monto, order_id y retorno
- Redirigir a Flow para pago
- Webhook de confirmación (callback)
- Asignar membresía automáticamente tras pago exitoso
- Historial de transacciones en admin
- Estados: pendiente, pagado, rechazado, reembolsado

### Modelos de datos necesarios
- `transactions` — registro de transacciones
- `payments` — pagos asociados a membresías/productos

---

## Módulo 4 — Asistencia y Ficha Médica

Control de asistencia de alumnos y gestión de información médica.

### Funcionalidades
- Registrar asistencia por clase (presente/ausente/justificado)
- Ficha médica: alergias, medicamentos, condiciones, contacto de emergencia
- Vista admin de asistencia por alumno y por clase
- Reportes: asistencia mensual, alumnos activos

### Modelos de datos necesarios
- `attendance` — registros de asistencia
- `medical_records` — fichas médicas de alumnos
- `emergency_contacts` — contactos de emergencia

---

## Galería

- Grid de fotos/videos de la academia
- Categorías: entrenamientos, competencias, eventos, instalaciones
- Admin CRUD galería
- Lightbox para ver en grande

---

## Sitemap y Robots ✅

- `/sitemap.xml` — generado dinámicamente (`src/app/sitemap.ts`) con páginas estáticas + blog posts + eventos desde Supabase
- `/robots.txt` — reglas de acceso (`src/app/robots.ts`): bloquea /admin, /dashboard, /perfil, /auth
- `metadataBase` configurado en layout.tsx para URLs absolutas

---

## SEO Avanzado

- JSON-LD en todas las páginas públicas (no solo /nosotros)
- Breadcrumbs con schema
- Imágenes con alt text optimizado

---

## Open Graph / Share Card para Blog

Generar vista previa al compartir posts en redes sociales (X, Facebook, WhatsApp, etc.).

### Implementación
- Agregar `metadataBase` al root layout (`new URL("https://zonaelite.cl")`)
- Convertir `/blog/[slug]/page.tsx` a Server Component para usar `generateMetadata`
- Generar dinámicamente: `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card` (summary_large_image)
- Usar `cover_image` del post como imagen OG (fallback a imagen default)
- Crear componente `ShareButton.tsx` con acciones: copiar enlace, WhatsApp, X/Twitter, Facebook
- Reemplazar botón "Compartir" estático en `/blog` y `/blog/[slug]` por `<ShareButton />`

### Archivos a crear/modificar
- `src/components/ShareButton.tsx` (nuevo)
- `src/app/layout.tsx` (agregar `metadataBase`)
- `src/app/blog/[slug]/page.tsx` (convertir a server + `generateMetadata`)
- `src/app/blog/page.tsx` (usar `<ShareButton />`)
