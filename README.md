# Gestor de Documentos de Capacitación

Aplicación de escritorio desarrollada con Electron para leer PDF digitales o escaneados, extraer información institucional, guardar una base local y generar reportes en Excel y JSON.

## Navegación principal

La aplicación tiene un menú superior con dos módulos separados:

```text
Documentos | Base
```

### Documentos

Es la página inicial y se encuentra en:

```text
renderer/documentos/documentos.html
```

Aquí se seleccionan, validan, escanean, procesan y exportan los PDF.

### Base

Es una página independiente y se encuentra en:

```text
renderer/base/base.html
```

Aquí únicamente se consulta lo que ya fue guardado en la base local. No procesa PDF.

## Tres secciones documentales

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

Extrae:

- datos generales del curso;
- carrera o público objetivo;
- forma de ejecución;
- tipo de capacitación;
- carácter y modalidad;
- certificado;
- objetivo, fechas y horario;
- unidades, contenidos y horas;
- evaluaciones;
- responsables y facilitadores;
- anexos;
- texto y confianza OCR por página.

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

## Lectura digital y OCR

Las tres secciones utilizan el mismo flujo híbrido:

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
- método de extracción;
- páginas y confianza OCR;
- documentos para revisión;
- procesamientos y duplicados.

Cada PDF recibe una huella SHA-256. Si el mismo archivo se procesa nuevamente, puede volver a exportarse, pero no se duplican sus registros locales.

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
│     └─ planificaciones.section.js
└─ base/
   ├─ base.html
   ├─ base.js
   ├─ base.css
   └─ vistas/
      ├─ resumen.view.js
      ├─ documentos.view.js
      ├─ tipos.view.js
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

La prueba comprueba los tres tipos documentales, trece grupos de tablas, exportación Excel/JSON, almacenamiento y consultas de Base.

## Consideración del primer OCR

La primera ejecución de Tesseract puede tardar más mientras prepara los recursos de reconocimiento. Los documentos extensos también pueden tardar varios minutos porque se procesan página por página para conservar estabilidad y mostrar progreso.
