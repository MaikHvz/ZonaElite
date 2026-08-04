# Plan por Fases — Clases de Horario para Modalidad Personalizada

> Ejecución 2026-08-04. Requisito y análisis de impacto: `contexto/requisitos/clases-horario-personalizadas.md`.
> Estado global: **Fases 0–7 completas; Fase 8 (docs) completa; pendiente aplicar migración 010 en Supabase y verificar en vivo.**

## Decisiones de diseño (confirmadas con el usuario)
1. Columna `mode` en `schedules` (`'normal' | 'personalizado'`, default `'normal'`) + tablas propias `personalized_schedule_plans` y `personalized_enrollments` + RPC `enroll_personalized_class`.
2. Reuso de la tabla `attendance` existente; las personalizadas **no usan QR/check-in**.
3. Filtro en admin + público `/horarios` + dashboard `membresias`.

## Fases
| Fase | Contenido | Estado |
|------|-----------|--------|
| 0 | Requisito + análisis de impacto (cruces) | ✅ `contexto/requisitos/clases-horario-personalizadas.md` |
| 1 | Migración `010_personalized_schedule_classes.sql` (mode + CHECK idempotente, 2 tablas, 4 índices, RLS, RPC VOLATILE) | ✅ creada — ⏳ **pendiente aplicar en Supabase** |
| 2 | Espejo 1:1 en `squema-sql-actualizado.sql` + guarda 403 en `/api/checkin` | ✅ |
| 3 | Admin `horarios`: CRUD con modo, planes permitidos, filtro, export | ✅ |
| 4 | Público `/horarios`: toggle Membresías/Personalizadas + `PersonalizedEnrollModal` | ✅ |
| 5 | Admin `asistencia`: badge, sin QR, ausentes desde `personalized_enrollments`, inscribir vía RPC | ✅ |
| 6 | Dashboard `membresias`: sección "Próximas Clases Personalizadas" | ✅ |
| 7 | Suite sección Q (51 tests) + `tsc --noEmit` + `npm run build` | ✅ 295 tests en verde |
| 8 | Docs (`flujo-modulos.md`, `requisitos-implementados.md`, este plan, `BRAIN.md`) | ✅ |

## Pendiente de negocio
- Aplicar `contexto/migrations/010_personalized_schedule_classes.sql` en Supabase (SQL Editor, como la 009) y verificar en vivo: columna `mode`, tablas, FKs, índices, RLS en `pg_policies`, RPC `enroll_personalized_class` (aforo, plan permitido, consumo de pack, idempotencia).
