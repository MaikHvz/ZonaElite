# Requisito: Perfil de Atleta y Rankings Deportivos

> Estado: **fase 1 (MVP) implementada en v1.17.0 (2026-10-28)** · fases 2 y 3 pendientes.
> Este documento es editable: marca con ✅ / ❌ las decisiones que quedan abiertas en la sección 12.

## 0. Decisiones tomadas (2026-10-28) — prevalecen sobre el resto del documento
- **Sin imágenes**: no hay foto de perfil ni fotos en publicaciones. El avatar muestra las iniciales con un anillo del color del cinturón, y las publicaciones son tarjetas de logros (podios, campeonatos, cinturones, trofeos) generadas a partir de los registros del staff. Se descartan la foto de portada, el recorte de foto y la moderación de imágenes (la portada es un degradado de la paleta).
- **Sin consentimiento del apoderado**: como no se publican imágenes, los perfiles de menores se crean igual que los de adultos. Siguen sin mostrarse edad exacta, fecha de nacimiento, RUT ni datos de contacto.
- **D1 = Solo comunidad**: perfiles y buscador solo con sesión iniciada. Cada alumno puede poner su perfil en **Privado**.
- **Alcance de la v1.17.0 = Fase 1 (MVP)**: perfil, publicaciones de logros, Palmarés, Torneos, personalización, buscador, trofeos otorgados por el admin y la opción de ocultar perfiles. La tabla de torneos con niveles y la migración de `sports_podiums` pasan a la **fase 2**, junto con los rankings (el nivel del torneo solo importa para los puntos).


## 1. Resumen
Cada alumno de ZonaElite tendrá un **Perfil de Atleta** dentro de la plataforma, con una interfaz **muy similar a Instagram**: cabecera con foto y contadores, historias destacadas, cuadrícula de publicaciones y pestañas. El perfil reúne en un solo lugar su identidad deportiva: disciplinas, grado/cinturón, trayectoria, torneos, podios, medallas, trofeos y su posición en los **rankings** de la academia.

El alumno puede **personalizar** su perfil y **cargar su propia trayectoria deportiva**. Un **buscador** permite encontrar a cualquier atleta, y desde cualquier pantalla donde aparezca el nombre de un alumno se puede abrir su perfil.

## 2. Objetivos
1. **Reconocimiento**: hacer visible el esfuerzo y los logros de cada alumno.
2. **Motivación y retención**: los rankings y la trayectoria dan metas concretas (subir de grado, competir, sumar puntos).
3. **Vitrina de la academia**: mostrar el nivel competitivo del club a alumnos, apoderados y visitantes.
4. **Fuente única de verdad**: centralizar los resultados deportivos, que hoy están dispersos (podios en texto libre, eventos sin resultados).

## 3. Alcance
**Incluye**
- Perfil de Atleta con interfaz tipo Instagram (vista pública y vista propia editable).
- Personalización del perfil por el alumno.
- Trayectoria deportiva cargada por el alumno (declarada) y por el staff (verificada).
- Buscador de perfiles con filtros.
- Palmarés: torneos, podios, medallas y trofeos.
- Trayectoria: línea de tiempo de hitos (ingreso, grados, torneos, logros).
- Rankings por disciplina y categoría, por temporada e histórico.
- Enlace al perfil desde todos los nombres de alumnos.
- Gestión admin de resultados, trofeos y rankings.
- Configuración de privacidad (con reglas especiales para menores).

**No incluye (fase futura, ver §12)**
- Comentarios, "me gusta", seguidores, mensajería o un feed de noticias (funciones tipo Facebook). Las publicaciones del perfil sí se incluyen (§5.2).
- Rankings entre academias o federaciones externas.
- App móvil nativa.

## 4. Roles y permisos
| Rol | Puede |
|-----|-------|
| **Visitante** (sin sesión) | Ver solo los perfiles marcados como públicos (si se habilita, §12-D1). |
| **Alumno** | Ver su perfil y el de otros alumnos según privacidad; buscar perfiles; personalizar el suyo (§5.4); agregar, editar y borrar sus **logros declarados** de trayectoria (§6.1) y pedir su verificación. **No** puede editar grados, resultados verificados, medallas oficiales ni puntos. |
| **Apoderado** (de un menor) | Autorizar la visibilidad del perfil del menor y su foto. |
| **Instructor** | Ver perfiles; proponer resultados de torneo (sujeto a aprobación del admin, §12-D5). |
| **Admin** | Todo: registrar torneos y resultados, otorgar trofeos y logros, ajustar puntos, moderar fotos y biografías, ocultar perfiles. |

> Regla de integridad: el alumno puede **declarar** su trayectoria, pero **ningún dato oficial** (grados, resultados verificados, medallas, puntos de ranking) lo edita el propio alumno. Igual que hoy con `sport_profiles`, esos datos los escribe solo el staff.

## 5. Perfil de Atleta (vista)
### 5.0 Principios de UX/UI
- **Interfaz muy similar a Instagram**: el alumno debe reconocer la estructura sin aprender nada nuevo. Usa la misma disposición de cabecera, historias destacadas, pestañas con íconos y cuadrícula de 3 columnas, con los mismos gestos y patrones de navegación.
- **Mobile-first**: se diseña primero para el celular, con navegación por pestañas y gestos (deslizar entre fotos, tocar para ampliar). En escritorio, el contenido va centrado con un ancho máximo de ~935 px, como Instagram web.
- **Identidad propia**: la estructura es de Instagram, pero la estética es la de ZonaElite ("fuego y oro": fondo oscuro, acentos dorados y rojos), sin copiar marcas, logotipos ni íconos registrados.
- **Rendimiento**: imágenes optimizadas (miniaturas para la cuadrícula, carga diferida), skeletons mientras se carga y transiciones suaves. La carga inicial debe sentirse instantánea en una conexión 4G.
- **Accesibilidad**: contraste AA, textos alternativos en las fotos, áreas táctiles de 44 px como mínimo y navegación por teclado en escritorio.
- **Estados cuidados**: vacíos, de carga, de error y de perfil privado, cada uno con diseño propio (§5.3).
- **Validación con usuarios**: prototipo en Figma revisado con 3 a 5 alumnos o apoderados antes de desarrollar.

### 5.1 Cabecera (estilo Instagram)
- Foto de perfil (circular, con un anillo del **color del cinturón** de su disciplina principal).
- Nombre y apodo deportivo opcional.
- Disciplina(s) y grado actual (cinturón con su color desde `belt_grades`).
- Categoría (Niños / Juveniles / Adultos) y, opcional, categoría de peso.
- Biografía corta (máx. 150 caracteres, moderada).
- **Contadores**: Torneos · Medallas · Trofeos · Años en la academia.
- **Insignia de ranking**: "#3 Kenpo Juveniles · Temporada 2026".
- Botones "Editar perfil" (en el perfil propio) y "Compartir perfil" (enlace copiable).

### 5.1.1 Historias destacadas
Círculos bajo la cabecera, como los "Destacados" de Instagram: "Torneos 2026", "Graduaciones", "Entrenamientos"... Cada uno abre un visor a pantalla completa con fotos y la fecha. El alumno los crea, los nombra y elige la portada.

### 5.2 Pestañas (con íconos, como Instagram)
| Pestaña | Contenido |
|---------|-----------|
| **Publicaciones** | Cuadrícula de 3 columnas con las fotos de la trayectoria del alumno (torneos, graduaciones, entrenamientos) y una descripción. Al tocar una foto se abre en detalle. |
| **Palmarés** | Cuadrícula de medallas y trofeos con foto. Al abrir una: torneo, fecha, categoría, posición y la insignia "Verificado" si corresponde. |
| **Trayectoria** | Línea de tiempo: ingreso a la academia, cambios de grado, torneos, logros especiales y logros declarados por el alumno. |
| **Torneos** | Lista de torneos con resultado, filtrable por año y disciplina. |
| **Rankings** | Posición actual e histórica en cada ranking en el que participa, con puntos y evolución. |
| **Estadísticas** (opcional) | Asistencia del año, racha de entrenamiento, clases tomadas (solo visible para el dueño y el admin). |

### 5.3 Estados
- Perfil sin logros todavía: mensaje motivacional ("Tu primer torneo te espera") en vez de pestañas vacías.
- Perfil privado u oculto: tarjeta mínima (nombre + "Perfil privado").
- Alumno inactivo: el perfil se conserva como histórico, con la marca "Ex alumno" (§12-D7).

### 5.4 Personalización (por el alumno)
Desde "Editar perfil", en una pantalla similar a la de Instagram:
- Foto de perfil (con recorte circular) y **foto o color de portada** dentro de la paleta de la academia.
- Nombre visible, apodo deportivo, **alias** para la URL (único) y biografía (máx. 150 caracteres).
- **Disciplina principal** (define el color del anillo de la foto y la insignia que se destaca).
- Enlaces externos opcionales (Instagram, YouTube), según §12-D10.
- **Medallas o trofeos fijados**: hasta 3 elementos destacados al inicio del Palmarés, como las publicaciones fijadas de Instagram.
- Orden y portada de las historias destacadas.
- Qué pestañas y contadores mostrar (ej. ocultar "Estadísticas").
- Nivel de privacidad (§9).

Reglas: los cambios de foto, portada y biografía pasan por la moderación del admin (o se publican al tiempo y se pueden retirar, §12-D11). El alumno no puede cambiar su grado, su categoría ni los datos verificados.

### 5.5 Buscador de perfiles
- Acceso desde un ícono de lupa en la navegación (como la pestaña "Buscar" de Instagram) y desde `/atletas`.
- **Búsqueda instantánea** mientras se escribe, por nombre, apodo o alias, que tolera tildes y errores de tipeo ("matias" encuentra "Matías").
- **Filtros**: disciplina, categoría (Niños / Juveniles / Adultos), grado o cinturón, "con medallas" y posición en el ranking.
- **Resultados**: foto, nombre, cinturón, disciplina y una insignia de ranking si corresponde.
- **Sin búsqueda**: página de exploración con "Destacados del mes", el top del ranking y los últimos podios.
- **Búsquedas recientes** guardadas en el dispositivo, con opción de borrarlas.
- **Privacidad**: el buscador respeta §9. Los perfiles privados y los de menores sin autorización no aparecen, y los visitantes sin sesión solo encuentran perfiles públicos.

## 6. Palmarés: definiciones
| Concepto | Definición | Origen |
|----------|------------|--------|
| **Torneo** | Competencia con fecha, lugar, nivel y organizador. | Evento `torneo` del sistema o torneo externo registrado por el admin. |
| **Resultado** | Participación de un alumno en un torneo: disciplina, categoría, división/peso, posición. | Admin (o instructor con aprobación). |
| **Medalla** | Se genera automáticamente con un resultado 🥇 1° / 🥈 2° / 🥉 3°. | Derivada del resultado. |
| **Trofeo** | Reconocimiento especial que **no** es una medalla: campeón absoluto, mejor técnica, alumno del año, etc. | Lo otorga el admin manualmente. |
| **Logro / insignia** | Hito automático: "100 clases", "1 año en la academia", "Primer torneo", "Cinturón negro". | Calculado por el sistema (§12-D6). |

**Niveles de torneo**: Interno · Local/Comunal · Regional · Nacional · Internacional.

### 6.1 Trayectoria cargada por el alumno (declarada vs. verificada)
El alumno puede contar su historia deportiva completa, incluso lo que hizo antes de entrar a ZonaElite o en otras academias.
- **Qué puede agregar**: torneos y resultados externos, grados obtenidos en otras escuelas, seminarios, certificaciones, otros deportes, hitos personales; cada uno con fecha, descripción y fotos o un certificado de respaldo.
- **Dos estados**:

| Estado | Quién lo crea | Cómo se ve | ¿Suma al ranking? |
|--------|---------------|------------|-------------------|
| **Declarado** | El alumno | Visible en su perfil, con la etiqueta discreta "Declarado por el atleta" | ❌ No |
| **Verificado** | El staff, o un logro declarado que el admin aprobó | Con la insignia ✔ "Verificado por ZonaElite" | ✅ Sí, si es un resultado de torneo |

- **Flujo de verificación**: el alumno marca "Solicitar verificación" y adjunta su respaldo. El admin lo ve en una bandeja, lo aprueba (asignándole nivel de torneo y posición) o lo rechaza con un motivo, y el alumno recibe una notificación.
- El alumno puede editar o borrar sus logros declarados. Los verificados solo los cambia el staff.
- El contenido declarado pasa por la misma moderación que las fotos y biografías.

> Migración de datos: los registros actuales de `sports_podiums` (torneo en texto libre) se convierten en resultados vinculados a un torneo, conservando foto, fecha y posición.

## 7. Rankings
### 7.1 Principio
El ranking refleja la **trayectoria competitiva** del alumno: cuánto compite, a qué nivel y con qué resultados. Es transparente: cada alumno ve de dónde salen sus puntos.

### 7.2 Segmentación
- Un ranking por **disciplina × categoría** (ej. "Kenpo · Juveniles").
- **Temporada** anual (enero–diciembre) + **ranking histórico** (toda la trayectoria).
- Opcional: por categoría de peso o por grado.

### 7.3 Sistema de puntos (propuesta editable)
**Puntos por resultado = puntos base por posición × multiplicador por nivel del torneo**

| Posición | Puntos base |
|----------|-------------|
| 1° | 100 |
| 2° | 70 |
| 3° | 50 |
| Participación | 15 |

| Nivel del torneo | Multiplicador |
|------------------|---------------|
| Interno | ×0,5 |
| Local / Comunal | ×1 |
| Regional | ×1,5 |
| Nacional | ×2 |
| Internacional | ×3 |

Componentes opcionales (definir en §12-D3):
- **Grado**: bonus al subir de cinturón (ej. +30 por grado).
- **Constancia**: puntos por asistencia (ej. +1 por clase, tope mensual), para que también suban quienes no compiten.
- **Trofeos especiales**: puntos fijos definidos por el admin.

**Desempate**: 1) más oros, 2) más platas, 3) más bronces, 4) resultado más reciente.

### 7.4 Reglas
- Los puntos solo se suman con resultados **confirmados por el admin**.
- Cada movimiento de puntos queda registrado (quién, cuándo, motivo) para auditoría y reclamos.
- El admin puede hacer un **ajuste manual** con motivo obligatorio.
- El ranking de la temporada se reinicia el 1 de enero; el histórico nunca se reinicia.
- Página pública `/rankings` con filtros por disciplina, categoría y temporada; el top 3 se destaca con podio visual.

## 8. Enlace al perfil desde los nombres
- **Regla**: todo nombre de alumno en la plataforma es un enlace a su perfil.
- **Admin**: se mantiene la ficha rápida actual (`UserNameButton`) y se agrega un botón "Ver perfil de atleta".
- **Público / alumnos**: rankings, listas de asistentes a eventos, resultados de torneos y publicaciones del blog que mencionen alumnos.
- URL amigable: `/atletas/[usuario]` (alias único) en vez del ID interno.
- En móvil, el nombre abre el perfil completo; en escritorio puede abrir una vista previa al pasar el mouse (opcional).

## 9. Privacidad y protección de menores (crítico)
La academia tiene alumnos menores de edad. El requisito debe cumplir la **Ley 19.628** y la **Ley 21.719** de protección de datos personales (Chile).
- **Niveles de visibilidad**: Público (cualquiera) · Comunidad (solo alumnos con sesión iniciada) · Privado (solo el alumno y el staff).
- **Por defecto**: adultos en "Comunidad"; **menores en "Privado"** hasta que el apoderado lo autorice.
- **Menores**: la foto y la visibilidad requieren el consentimiento del apoderado (registrado con fecha). Nunca se muestran edad exacta, fecha de nacimiento, RUT, colegio, teléfono, dirección ni ubicación.
- **Datos que nunca son públicos**: RUT, contacto, datos médicos y físicos, estado de membresía, deudas y pagos.
- **Fotos**: subidas por el alumno o el staff y moderables por el admin; se pueden retirar a pedido.
- **Derecho a retiro**: el alumno o el apoderado puede ocultar el perfil en cualquier momento; sus resultados siguen contando en el ranking de forma anónima ("Atleta privado") o se excluyen (§12-D2).
- Las políticas de base de datos (RLS) deben aplicar estas reglas en el servidor, no solo en la interfaz.

## 10. Gestión administrativa
- **Torneos**: crear, editar y archivar (nombre, fecha, lugar, nivel, organizador, disciplinas). Se pueden crear desde un evento `torneo` existente.
- **Resultados**: carga por torneo (seleccionar alumnos, posición, categoría y foto), incluida la **carga masiva** después de un torneo.
- **Trofeos y logros**: otorgar y revocar con motivo.
- **Rankings**: configurar la tabla de puntos y los multiplicadores, recalcular, hacer ajustes manuales y cerrar la temporada.
- **Verificación**: bandeja de logros declarados pendientes (aprobar o rechazar con motivo).
- **Moderación**: aprobar o rechazar fotos, portadas, biografías y publicaciones, y ocultar perfiles.
- **Auditoría**: historial de cambios de puntos y resultados.

## 11. Criterios de aceptación
1. Desde cualquier lista (admin o pública) se abre el perfil de un alumno con un clic en su nombre.
2. El perfil muestra cabecera, contadores y pestañas; los contadores coinciden con los resultados registrados.
3. Al registrar un 1° lugar en un torneo nacional, el alumno recibe la medalla de oro, sube 200 puntos (100 × 2) y su posición en el ranking se actualiza.
4. Un alumno no puede modificar sus grados, resultados ni puntos, ni siquiera llamando directamente a la API.
5. El perfil de un menor sin autorización del apoderado no es visible para otros alumnos ni para visitantes.
6. Los datos sensibles (RUT, contacto, salud, pagos) no aparecen en ninguna vista ni respuesta de la API del perfil.
7. Los podios existentes se migran sin perder fotos, fechas ni posiciones.
8. El ranking muestra el desglose de puntos de cada alumno.
9. La vista funciona en móvil (prioridad) y escritorio, con la estética "fuego y oro" del sitio.
10. Un usuario de Instagram identifica la cabecera, las historias destacadas, las pestañas y la cuadrícula sin explicación; en una prueba con 5 usuarios, al menos 4 completan "abrir el perfil de un compañero y ver sus medallas" en menos de 30 segundos.
11. El buscador devuelve resultados mientras se escribe (menos de 300 ms percibidos), tolera tildes y nunca muestra perfiles privados ni de menores sin autorización.
12. El alumno puede cambiar su foto, portada, biografía, disciplina principal y elementos fijados, y ver el resultado al instante en su perfil.
13. El alumno puede agregar un logro a su trayectoria; aparece como "Declarado" y **no** cambia sus puntos. Cuando el admin lo verifica, recibe la insignia ✔ y, si es un resultado de torneo, suma puntos.

## 12. Decisiones pendientes (marcar ✅ / ❌ o completar)
- **D1. Visibilidad para visitantes**: ✅ Solo comunidad (con sesión iniciada).
- **D2. Perfiles privados en el ranking**: ¿aparecen como "Atleta privado" o se excluyen?
- **D3. Fórmula de puntos**: ¿solo torneos, o también grado y asistencia? ¿Se aprueban los valores de §7.3?
- **D4. Segmentación**: ¿agregar categorías de peso o rangos de grado a los rankings?
- **D5. Instructores**: ¿pueden cargar resultados directamente o solo proponerlos?
- **D6. Logros automáticos**: ¿cuáles se incluyen en la primera versión?
- **D7. Ex alumnos**: ¿su perfil se conserva visible como histórico?
- **D8. Funciones sociales** (comentarios, likes, seguidores, feed): ¿se descartan o quedan para una fase 3? Requieren moderación y aumentan el riesgo con menores.
- **D9. Torneos externos**: ¿se pueden registrar torneos de otras organizaciones o solo los creados en el sistema?
- **D10. Enlaces a redes externas** en el perfil: ¿se permiten? ¿También para menores?
- **D11. Moderación**: ✅ resuelta: no hay fotos. La biografía se publica al instante y el admin puede ocultar el perfil completo.
- **D12. Logros declarados**: ¿se muestran a otros alumnos o solo después de verificarse?

## 13. Fases sugeridas
| Fase | Entrega |
|------|---------|
| **0 – Diseño** | Prototipo en Figma tipo Instagram (perfil, editar perfil, buscador) validado con alumnos. |
| **1 – MVP** | Perfil de Atleta (cabecera, pestañas Publicaciones, Palmarés y Torneos), personalización básica (foto, portada, biografía, disciplina principal), buscador, privacidad y consentimiento del apoderado, enlace desde los nombres y migración de `sports_podiums` a torneos y resultados. |
| **2 – Trayectoria y rankings** | Trayectoria declarada y flujo de verificación, motor de puntos, `/rankings`, insignia en el perfil, auditoría y cierre de temporada. |
| **3 – Comunidad** | Historias destacadas, elementos fijados, página de exploración, logros automáticos y, si se aprueba D8, funciones sociales. |

## 14. Impacto en el sistema actual (para la fase de análisis)
- **Reutiliza**: `sport_profiles`, `belt_grades`, `sports_podiums` (se migra), `events` tipo `torneo`, `UserNameButton`, `categoryFromBirth()` y el bucket `podiums/`.
- **Nuevo (estimado)**: foto, portada, alias, biografía, personalización y privacidad del perfil; tablas de torneos, resultados, trofeos, logros, trayectoria declarada (con estado y verificación), publicaciones e historias destacadas, consentimientos y movimientos de puntos; vistas o funciones de ranking y una búsqueda por texto tolerante a tildes (ej. `unaccent` + `pg_trgm` en PostgreSQL); un bucket de almacenamiento para fotos de perfil y publicaciones.
- **RLS**: hoy los datos deportivos los leen solo el dueño o el admin. Abrir la lectura pública exige **vistas o funciones seguras** que expongan solo los campos permitidos, nunca las tablas completas.
- **No toca**: membresías, tokens, pagos, Flow, asistencia ni deudas (solo lectura opcional de asistencia para estadísticas).
- Según la guía de trabajo: migraciones numeradas, espejo SQL, entrada de changelog y una sección nueva en `scripts/test-flows.mjs`.

## 15. Métricas de éxito
- % de alumnos activos con foto y perfil completo.
- % de alumnos que cargan al menos un logro en su trayectoria.
- Visitas a perfiles y rankings por semana, y búsquedas realizadas.
- Cantidad de alumnos que compiten por temporada (antes y después).
- Retención de alumnos que aparecen en el ranking frente a los que no.
