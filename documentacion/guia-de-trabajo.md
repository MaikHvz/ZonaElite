# Skill: Flujo de Trabajo y Nuevas Implementaciones (ZonaElite)

Este documento define el **Estándar Operativo (SOP)** obligatorio que cualquier IA o desarrollador debe seguir antes de escribir una sola línea de código para implementar una nueva funcionalidad en el ecosistema ZonaElite. 

El objetivo es proteger la estabilidad de la arquitectura, prevenir colisiones con los flujos ya probados (ej. Checkout Flow.cl, Tokens, Manejo de Cargas) y asegurar que la base de conocimiento se mantenga perfectamente sincronizada.

---

## 1. Fase de Planificación (Obligatoria)
Antes de programar, **TODO CAMBIO** debe iniciar creando un archivo de requisitos temporal o de planificación (ej. `contexto/requisitos/[nombre-feature].md`).
Este archivo debe contener:
- **Explicación Profunda del Requisito**: Qué se va a hacer, por qué se necesita y qué roles del sistema (Admin, Instructor, Alumno, Tutor) interactuarán con él.
- **Flujo de Implementación Propuesto**: Un paso a paso técnico de cómo interactuarán el frontend, los endpoints de la API y los cambios en la base de datos Supabase.

## 2. Fase de Análisis de Impacto (No Romper Nada)
Una vez diseñado el flujo, se debe realizar un cruce de impacto contra el código existente:
1. **Verificar Interacciones**: ¿La nueva función altera el proceso de Check-out en `CheckoutModal.tsx` o el webhook de Flow en `confirmAndCreateMembership`?
2. **Impacto en Zonas Horarias**: Si hay manipulación de fechas, ¿se están respetando `getChileToday()` y `addDaysChile()` ubicados en `src/lib/dates.ts` para prevenir el *bug* del salto de día GMT-4?
3. **Impacto de Base de Datos**: ¿Afecta a las vistas actuales del Dashboard (tokens, memberships) que dependen de sentencias strictas como el Bulk Update o los JOINS de asistencias?

*Solo si se confirma y garantiza matemáticamente que los flujos anteriores no colapsarán, se aprueba el paso a la implementación.*

## 3. Fase de Implementación
- Escribir el código utilizando los estándares definidos en este repositorio (App Router, Server Components, `@supabase/ssr`).
- Priorizar actualizaciones masivas (`Bulk Updates`) por sobre `maybeSingle()` para prever corrupciones en la BD.
- Mantener la cohesión visual UI/UX (Tailwind, Material Symbols, y componentes base como `FormModal` o `DataTable`).

## 4. Fase de Documentación y Sincronización (Post-Implementación)
Una vez implementado exitosamente, es **OBLIGATORIO** actualizar el mapa mental del proyecto:
1. **Actualizar el Contexto General**: Agregar un resumen de la nueva funcionalidad en `documentacion/flujo-modulos.md` y en `documentacion/requisitos-implementados.md`.
2. **Sincronización del Esquema SQL**: Si la nueva funcionalidad requirió crear tablas, modificar funciones RPC, triggers o policies, **debes copiar el DDL completo y añadirlo al archivo `documentacion/squema-sql-actualizado.sql`**. La base de datos documentada debe ser un reflejo 1:1 de la base de datos en producción.

---
**Instrucción para la IA:** Considera este documento como una `Rule` / `Skill` primordial. Ejecuta siempre estos 4 pasos ante cualquier solicitud de nueva característica (Feature Request).
