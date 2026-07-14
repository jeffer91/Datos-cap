# Gestor de Documentos de Capacitación

Aplicación de escritorio desarrollada con Electron para leer PDF digitales o escaneados, extraer información institucional, guardar una base local y generar reportes en Excel y JSON.

## Navegación principal

La aplicación tiene un menú superior con dos módulos separados:

```text
Documentos | Base
```

### Documentos

Es la página inicial:

```text
renderer/documentos/documentos.html
```

Aquí se seleccionan, validan, escanean, entienden, guardan y exportan los PDF.

### Base

Es una página independiente:

```text
renderer/base/base.html
```

Aquí únicamente se consulta lo que ya fue guardado en la base local. No procesa PDF.

## Cuatro secciones documentales

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

Extrae y guarda únicamente información relevante y comparable:

- código original y código normalizado;
- periodo y fecha de elaboración;
- capacitación y público dirigido;
- facilitador, fechas y duración;
- objetivo general, objetivos específicos y cumplimiento;
- participantes con columnas opcionales;
- certificados individuales y resumen de resultados;
- responsables;
- anexos;
- páginas OCR;
- páginas físicas y páginas declaradas;
- diferencias e inconsistencias que requieren revisión.

Genera nueve hojas:

```text
01_archivos
02_datos_generales
03_objetivos
04_participantes
05_certificados
06_resumen_certificados
07_responsables
08_anexos
09_ocr_paginas
```

## Lectura digital y OCR

Las cuatro secciones utilizan el mismo flujo híbrido:

```text
PDF
→ intentar texto digital
→ evaluar calidad
→ activar OCR cuando sea necesario
→ validar el tipo documental
→ ejecutar el parser correspondiente
```

El OCR utiliza `pdf-to-img` para convertir páginas y `tesseract.js` para reconocer texto en español e inglés.

Durante la validación solo se escanean las primeras páginas para identificar el documento. Durante el procesamiento se escanea el documento completo cuando hace falta.

## Base local

La base utiliza colecciones JSON con escrituras atómicas y respaldo temporal. Se crea dentro de la carpeta de datos de Electron:

```text
local-database/
├─ database.meta.json
└─ collections/
```

La página Base permite consultar:

- resumen general;
- documentos guardados;
- Planes Individuales;
- Acuerdos de Patrocinio;
- Planificaciones de Capacitación;
- Informes Finales de Capacitación;
- detalles completos relacionados por `id_documento`;
- método de extracción;
- páginas y confianza OCR;
- documentos para revisión;
- procesamientos y duplicados.

Cada PDF recibe una huella SHA-256. Si el mismo archivo se procesa nuevamente, puede volver a exportarse, pero no se duplican sus registros locales.

## Colecciones de Informes Finales

```text
archivos_informe_final
datos_generales_informe
objetivos_informe
participantes_informe
certificados_informe
resumen_certificados_informe
responsables_informe
anexos_informe
ocr_paginas_informe
```

Todas se relacionan mediante `id_documento`.

## Estructura visual

```text
renderer/
├─ shared/
│  ├─ menu.js
│  ├─ menu.css
│  ├─ ui.js
│  └─ ui.css
├─ documentos/
│  ├─ documentos.html
│  ├─ documentos.js
│  ├─ documentos.css
│  └─ secciones/
│     ├─ planes.section.js
│     ├─ acuerdos.section.js
│     ├─ planificaciones.section.js
│     └─ informes-finales.section.js
└─ base/
   ├─ base.html
   ├─ base.js
   ├─ base.css
   └─ vistas/
      ├─ resumen.view.js
      ├─ documentos.view.js
      ├─ tipos.view.js
      ├─ detalles.view.js
      └─ procesamientos.view.js
```

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

## Ejecutar diagnóstico

```powershell
npm run selftest
```

La prueba comprueba los cuatro tipos documentales, veintiséis grupos de tablas, exportación Excel/JSON, almacenamiento, consultas y detalles de Base.

## Consideración del primer OCR

La primera ejecución de Tesseract puede tardar más mientras prepara los recursos de reconocimiento. Los documentos extensos también pueden tardar varios minutos porque se procesan página por página para conservar estabilidad y mostrar progreso.
