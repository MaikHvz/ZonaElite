# Resumen de ZonaElite

## ¿Qué es ZonaElite?
**ZONAELITE** es una academia de artes marciales ubicada en La Serena, Chile, especializada en disciplinas como Kenpo, Kickboxing, Entrenamiento Funcional y MMA.

La plataforma web es un sistema de gestión integral (SaaS a medida) que maneja toda la operación académica y administrativa de la empresa. Está diseñada tanto para ser el primer punto de contacto (landing page) como el portal operativo para alumnos, instructores y administración.

## ¿En qué consiste la plataforma?
La plataforma sirve a tres grandes propósitos:
1. **Vitrina y Ventas Online**: Una landing page moderna (Material Design 3 Dark) que exhibe las disciplinas, horarios y permite la compra en línea de suscripciones (membresías) e inscripciones utilizando Flow.cl como pasarela de pagos.
2. **Portal del Alumno (Dashboard)**: Un espacio privado donde los alumnos (y sus cargas familiares/dependientes) pueden ver sus membresías activas, historial de pagos, historial de asistencia, datos médicos de emergencia y notificaciones.
3. **Gestión Administrativa (Admin)**: Un panel protegido exclusivo para el equipo de ZonaElite donde pueden:
   - Crear y editar disciplinas, planes de membresía, productos de tienda y eventos.
   - Pasar asistencia clase por clase (la cual descuenta "tokens" o clases de los planes limitados).
   - Administrar usuarios, asignar membresías manualmente y justificar inasistencias.
   - Ver métricas financieras y operativas en tiempo real.

## Stack Tecnológico
- **Frontend / Backend**: Next.js 16.2.10 (App Router, Server Components, API Routes)
- **UI**: React 19, Tailwind CSS v4, Material Symbols
- **Base de Datos / Auth**: Supabase (PostgreSQL) con Row Level Security (RLS)
- **Pagos**: API REST de Flow.cl con validación HMAC-SHA256
