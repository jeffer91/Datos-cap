# Gestor de Documentos de Capacitación

Aplicación de escritorio desarrollada con Electron para leer PDF digitales o escaneados, extraer información institucional, guardar una base local y generar reportes en Excel y JSON.

## Navegación principal

La aplicación tiene un menú superior con tres módulos:

```text
Documentos | Base | Reporte Individual
```

### Documentos

Página ubicada en:

```text
renderer/documentos/documentos.html
```

Aquí se seleccionan, validan, escanean, entienden, guardan y exportan los PDF.

### Base

Página ubicada en:

```text
renderer/base/base.html
```

Aquí se consulta lo guardado en la base local. No procesa PDF.

### Reporte Individual

Página ubicada en:

```text
renderer/reporte-individual/reporte-individual.html
```

Esta pantalla no vuelve a leer carpetas ni PDF. Consulta directamente la base local y construye un reporte por docente.

## Seis tipos documentales

### 1. Planes Individuales

Reconoce:

```text
PLAN INDIVIDUAL DE FORMACIÓN Y CAPACITACIÓN DOCENTE
RGI1
PRO-251
```

Genera cinco tablas con archivos, identificación, capacidades, capacitaciones y formación docente.

### 2. Acuerdos de Patrocinio

Reconoce:

```text
ACUERDO DE PATROCINIO INSTITUCIONAL
RGI2
PRO-134
```

Extrae docente, cédula, carrera, capacitación, fecha, apoyos institucionales y responsables.

### 3. Planificaciones de Capacitación

Reconoce:

```text
PLANIFICACIÓN DE CAPACITACIÓN
RGI1
PRO-134
```

Extrae datos generales, modalidad, unidades, contenidos, horas, evaluaciones, responsables, facilitadores, anexos y trazabilidad OCR.

Genera ocho hojas:

```text
01_archivos
02_datos
03_temario
04_evaluaciones
05_responsables
06_facilitadores
07_anexos
08_ocr_paginas
```

### 4. Informes Finales de Capacitación

Reconoce variaciones como:

```text
INFORME FINAL DE LA CAPACITACIÓN
INFORME FINAL DE CAPACITACIÓN DE
INF
PRO-134
```

Extrae datos generales, objetivos, participantes, certificados, responsables, anexos, páginas OCR e inconsistencias de paginación.

### 5. Instrumentos de Evaluación

Reconoce títulos y variantes como:

```text
INSTRUMENTO DE EVALUACIÓN
INSTRUMENTO PARA LA EVALUACIÓN
FICHA DE EVALUACIÓN DE LA CAPACITACIÓN
ENCUESTA DE EVALUACIÓN DE LA CAPACITACIÓN
PRO-135
```

La estructura queda preparada para extraer:

```text
01_archivos
02_datos_generales
03_items
04_resultados
05_responsables
06_anexos
07_ocr_paginas
```

El parser inicial es flexible y se ajustará cuando se incorporen formatos institucionales reales.

### 6. Informes de Impacto

Reconoce títulos y variantes como:

```text
INFORME DE IMPACTO
MEDICIÓN DE IMPACTO DE LA CAPACITACIÓN
EVALUACIÓN DE IMPACTO DE LA CAPACITACIÓN
PRO-135
```

La estructura queda preparada para extraer:

```text
01_archivos
02_datos_generales
03_indicadores
04_resultados
05_recomendaciones
06_participantes
07_responsables
08_anexos
09_ocr_paginas
```

El parser inicial detecta indicadores, líneas base, metas, resultados porcentuales, hallazgos, cambios observados, conclusiones y recomendaciones.

## Lectura digital y OCR

Los seis tipos utilizan el mismo flujo híbrido:

```text
PDF
→ intentar texto digital
→ evaluar calidad
→ activar OCR cuando sea necesario
→ validar el tipo documental
→ ejecutar el parser correspondiente
```

El OCR utiliza `pdf-to-img` y `tesseract.js`.

## Base local

La base utiliza colecciones JSON con escrituras atómicas y respaldo temporal:

```text
local-database/
├─ database.meta.json
└─ collections/
```

Cada PDF recibe una huella SHA-256 para evitar duplicados.

## Reporte Individual

El reporte se construye por docente, utilizando como punto de partida su Plan Individual y las capacitaciones guardadas en `capacitaciones_propuestas`.

### Requisitos para generar

El reporte solo puede prepararse cuando:

```text
Existe el Plan Individual.
Existe al menos una capacitación reconocida.
Existe un Acuerdo de Patrocinio por cada capacitación.
```

La ausencia de una Planificación, Informe Final, Instrumento de Evaluación o Informe de Impacto no bloquea la preparación. Esos documentos funcionan como comprobación y generan advertencias.

### Cruce del docente

La cédula es el identificador principal para comprobar que el docente aparece dentro de:

```text
Informe Final
Instrumento de Evaluación
Informe de Impacto
```

Cuando todavía no existe una cédula disponible, el nombre normalizado se utiliza como respaldo y el resultado puede marcarse para revisión.

### Cruce de capacitaciones

Los nombres se normalizan para tolerar diferencias como:

```text
Planificación DUA
Planificación de DUA
Curso de Planificación DUA
```

El comparador elimina tildes, signos, artículos y preposiciones poco relevantes. Después calcula una coincidencia:

```text
EXACTA
ALTA
DUDOSA
SIN_COINCIDENCIA
```

### Estados

```text
COMPLETO
GENERABLE_CON_ADVERTENCIAS
NO_GENERABLE
```

- `COMPLETO`: existen los requisitos individuales y todas las comprobaciones.
- `GENERABLE_CON_ADVERTENCIAS`: existen Plan y acuerdos, pero falta alguna comprobación.
- `NO_GENERABLE`: falta el Plan, una capacitación reconocida o un acuerdo requerido.

### Estructura del módulo

```text
renderer/reporte-individual/
├─ reporte-individual.html
├─ reporte-individual.css
├─ reporte-individual.js
├─ componentes/
│  ├─ filtros.component.js
│  ├─ resumen-docente.component.js
│  ├─ capacitaciones.component.js
│  ├─ estado-documental.component.js
│  └─ alertas.component.js
└─ vistas/
   ├─ listado-docentes.view.js
   ├─ detalle-docente.view.js
   └─ vista-previa-reporte.view.js

src/reporte-individual/
├─ index.js
├─ reporte-individual.service.js
├─ reporte-individual.query.js
├─ docente.matcher.js
├─ capacitacion.matcher.js
├─ reporte-individual.rules.js
├─ reporte-individual.builder.js
├─ reporte-individual.validator.js
└─ reporte-individual.exporter.js
```

La salida actual es un borrador estructurado. El diseño definitivo se conectará cuando se incorpore la plantilla institucional.

## Colecciones de Instrumentos de Evaluación

```text
archivos_instrumento_evaluacion
datos_generales_instrumento
items_instrumento_evaluacion
resultados_instrumento_evaluacion
responsables_instrumento_evaluacion
anexos_instrumento_evaluacion
ocr_paginas_instrumento_evaluacion
```

La consulta del Reporte Individual también queda preparada para la colección futura:

```text
participantes_instrumento_evaluacion
```

## Colecciones de Informes de Impacto

```text
archivos_informe_impacto
datos_generales_informe_impacto
indicadores_informe_impacto
resultados_informe_impacto
recomendaciones_informe_impacto
participantes_informe_impacto
responsables_informe_impacto
anexos_informe_impacto
ocr_paginas_informe_impacto
```

Todas las colecciones se relacionan mediante `id_documento`.

## Instalar

```powershell
npm install
```

## Ejecutar

```powershell
npm start
```

## Revisar sintaxis principal

```powershell
npm run check
```

## Ejecutar diagnósticos

```powershell
npm run selftest
```

Las pruebas comprueban los seis tipos documentales y el cruce preliminar del Reporte Individual por cédula y nombre de capacitación normalizado.

## Consideración del primer OCR

La primera ejecución de Tesseract puede tardar más mientras prepara los recursos de reconocimiento. Los documentos extensos también pueden tardar varios minutos porque se procesan página por página.
