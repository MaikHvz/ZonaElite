# Bio Kenpo La Serena - Requerimientos Funcionales

# Objetivo

Desarrollar un sistema web para la administración completa de la academia Bio Kenpo La Serena.

El sistema deberá contemplar distintos tipos de usuarios, gestión de membresías, pagos, cargas familiares, eventos, blog, catálogo de productos, métricas corporales y un completo panel administrativo.

---

# Roles del sistema

## Visitante

No requiere iniciar sesión.

Puede acceder a:

- Landing Page
- Información de la academia
- Disciplinas
- Horarios
- Eventos públicos
- Blog
- Catálogo de productos
- Registro
- Inicio de sesión

---

## Usuario autenticado

Corresponde a cualquier alumno registrado.

Puede administrar únicamente su información y la de sus cargas.

---

## Administrador

Tiene acceso completo al sistema.

Puede administrar cualquier recurso.

---

# Panel Usuario

## Dashboard

Debe mostrar información resumida del usuario.

### Contenido

- Bienvenida personalizada
- Próxima clase
- Próximo evento
- Membresías activas
- Estado de pagos
- Últimos blogs publicados
- Accesos rápidos

---

# Mi Perfil

## Información Personal

Campos:

- Nombre completo
- Correo electrónico
- Teléfono
- Fecha de nacimiento
- Fotografía
- Cambio de contraseña

---

## Gestión de Cargas

Un usuario puede tener múltiples cargas.

Ejemplo:

- Hijos
- Sobrinos
- Familiares

Cada carga contiene:

- Nombre completo
- RUT
- Fecha de nacimiento
- Categoría (Niño / Adulto)

Acciones:

- Agregar carga
- Editar carga
- Eliminar carga

Las cargas NO poseen cuenta propia.

Todas son administradas por el tutor.

---

## Ficha Médica

Formulario editable.

Debe contener información como:

- Enfermedades
- Lesiones
- Medicamentos
- Alergias
- Contacto de emergencia

---

## Consentimiento de Responsabilidad

Formulario digital.

El usuario completa el documento dentro del sistema.

Al finalizar:

- Generar PDF
- Permitir descargar PDF

El envío del documento será manual mediante WhatsApp.

---

# Membresías

Cada usuario puede comprar membresías para:

- Él mismo
- Cualquiera de sus cargas

Antes de pagar debe seleccionar a quién será asignada.

Ejemplo:

○ Para mí

○ Pedro Hernández

○ Sofía Hernández

Las membresías estarán divididas en:

- Adultos
- Niños

Dependiendo de la categoría de la persona solo podrán mostrarse las membresías compatibles.

---

## Tarjetas de Membresía

Las membresías activas deben mostrarse como tarjetas tipo Apple Wallet.

Cada tarjeta debe mostrar:

- Nombre de la membresía
- Estado
- Persona asignada
- Fecha de expiración
- Tipo de membresía

Ejemplo:

Premium

Asignada a:

Pedro Hernández

Vence:

25 Agosto 2026

Estado:

Activa

Si un usuario posee:

- Él
- Dos hijos

Verá tres tarjetas.

---

# Pagos

Cada usuario posee una vista de pagos.

Debe mostrar:

## Historial

- Fecha
- Concepto
- Monto
- Estado
- Método de pago

Permitir descargar comprobante.

---

# Catálogo de Productos

En esta primera versión NO existirá compra online.

Solo catálogo.

Cada producto debe mostrar:

- Imagen
- Nombre
- Descripción
- Precio

El usuario podrá:

Agregar productos al carrito.

---

## Carrito

El carrito permitirá:

- Agregar productos
- Eliminar productos
- Modificar cantidades

Al finalizar:

Generar automáticamente un mensaje para WhatsApp.

Ejemplo:

Hola.

Quisiera solicitar los siguientes productos:

• Guantes
• Polera
• Protector Bucal

Total:

$58.000

Muchas gracias.

Además dejar preparada la arquitectura para un futuro Checkout Online.

---

# Horarios

Mostrar calendario semanal.

Cada clase debe indicar:

- Disciplina
- Hora
- Profesor

Debajo del calendario:

Mostrar una leyenda con colores.

Ejemplo:

Rojo → Kickboxing

Azul → Kenpo

Negro → MMA

Verde → Funcional

---

# Blog

Listado de publicaciones.

Cada publicación puede contener:

- Imagen
- Texto
- Galería
- Fecha

Cada vez que se publique un nuevo blog:

Enviar una notificación por correo a todos los usuarios registrados.

---

# Eventos

Dividir en tres categorías.

## Torneos

Mostrar:

- Imagen
- Lugar
- Fecha
- Descripción
- Botón "Cómo llegar"

Utilizar Google Maps.

---

## Graduaciones

Mostrar:

- Fecha
- Lugar
- Horario
- Cinturones convocados
- Recomendaciones

---

## Clases Especiales

Mostrar convocatorias para:

- Seminarios
- Talleres
- Eventos especiales

---

# Métricas Corporales

Cada usuario podrá registrar su evolución.

Datos:

- Peso
- Estatura
- IMC
- Masa muscular
- Grasa corporal

Mostrar historial.

Mostrar gráficos de evolución.

---

# Panel Administrador

---

## Dashboard

Mostrar indicadores generales.

KPIs

- Usuarios registrados
- Alumnos activos
- Membresías activas
- Membresías vencidas
- Ingresos del mes
- Ingresos anuales
- Productos más vendidos
- Próximos eventos

Gráficos:

- Ventas
- Nuevos usuarios
- Membresías
- Asistencia

---

## Usuarios

CRUD completo.

Acciones:

- Buscar
- Filtrar
- Editar
- Eliminar
- Desactivar

Ver:

- Historial
- Membresías
- Compras
- Pagos
- Cargas

---

## Gestión de Cargas

Administrar todas las cargas del sistema.

Permitir:

- Editar
- Eliminar
- Reasignar tutor

---

## Membresías

CRUD completo.

Cada membresía debe definir:

- Nombre
- Precio
- Duración
- Tipo

Adulto

Niño

- Beneficios
- Estado

---

## Pagos

Administración completa.

Estados:

- Pendiente
- Pagado
- Rechazado
- Expirado

Permitir:

- Ver detalle
- Confirmar pago manual
- Registrar pago en efectivo
- Registrar transferencia
- Ver comprobantes

---

## Productos

CRUD.

Campos:

- Nombre
- Categoría
- Descripción
- Precio
- Stock
- Fotografías

Aunque inicialmente sea catálogo, dejar preparado para venta online.

---

## Blog

CRUD completo.

Permitir:

- Editor enriquecido
- Imágenes
- Galerías
- Programar publicación

Al publicar:

Enviar correo automáticamente.

---

## Horarios

CRUD.

Cada horario define:

- Profesor
- Sala
- Disciplina
- Hora
- Cupos

---

## Eventos

CRUD.

Tipos:

- Torneo
- Graduación
- Seminario
- Clase Especial

---

## Estadísticas

Dashboard financiero.

Mostrar:

Ingresos

- Diario
- Semanal
- Mensual
- Anual

Membresías

- Más vendidas
- Renovaciones
- Vencidas

Usuarios

- Nuevos
- Activos
- Inactivos

Productos

- Más vistos
- Más solicitados

---

## Configuración

Configuración general.

Academia:

- Nombre
- Logo
- Dirección
- WhatsApp
- Redes Sociales

Integraciones:

- Flow
- Correo electrónico
- Google Maps

---

## Notificaciones

Permitir enviar:

- Correos masivos
- Avisos
- Recordatorios
- Comunicados

---

## Auditoría

Registrar:

- Inicio de sesión
- Compras
- Cambios de membresía
- Eliminaciones
- Cambios importantes

Mostrar:

- Usuario
- Fecha
- Acción

---

## Roles

El sistema debe soportar distintos roles.

Inicialmente:

- Administrador
- Instructor
- Recepción
- Alumno

Cada uno con permisos independientes.

---

# Control de Asistencia

Cada clase permitirá registrar asistencia.

Debe permitir:

- Marcar asistencia
- Historial de asistencia por alumno
- Porcentaje de asistencia
- Estadísticas
- Alumnos inactivos

Este módulo será utilizado posteriormente para generar reportes y controlar la participación de los alumnos.

---

# Arquitectura General de Navegación

## Landing

- Inicio
- Disciplinas
- Horarios
- Eventos
- Blog
- Catálogo
- Registro
- Inicio de sesión

---

## Panel Usuario

- Dashboard
- Mi Perfil
- Gestión de Cargas
- Ficha Médica
- Consentimiento
- Membresías
- Pagos
- Catálogo
- Carrito
- Horarios
- Blog
- Eventos
- Métricas Corporales

---

## Panel Administrador

- Dashboard
- Usuarios
- Cargas
- Membresías
- Pagos
- Productos
- Horarios
- Blog
- Eventos
- Estadísticas
- Notificaciones
- Auditoría
- Configuración

---

# Futuras Implementaciones

- Compra online de productos.
- Pasarela de pago para catálogo.
- Google OAuth.
- Notificaciones Push.
- Aplicación móvil.
- Reserva de clases.
- Sistema de cinturones y progresión.
- Ranking de alumnos.
- Integración con WhatsApp Business API.
- Integración con calendario (Google Calendar).
- Reportes avanzados.