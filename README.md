# Gestor de Documentos de Capacitación

Aplicación de escritorio desarrollada con Electron para leer PDF digitales o escaneados, extraer información institucional, guardar una base local y generar reportes en Excel y JSON.

## Navegación principal

La aplicación tiene un menú superior con dos módulos separados:

```text
Documentos | Base
```

### Documentos

Página inicial ubicada en:

```text
renderer/documentos/documentos.html
```

Aquí se seleccionan, validan, escanean, entienden, guardan y exportan los PDF.

### Base

Página independiente ubicada en:

```text
renderer/base/base.html
```

Aquí se consulta lo guardado en la base local. No procesa PDF.

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

El parser inicial es flexible: detecta datos generales, ítems numerados, respuestas marcadas, puntajes, resultados, observaciones y recomendaciones. La lógica específica se ajustará cuando se incorporen formatos institucionales reales.

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

El parser inicial detecta indicadores, líneas base, metas, resultados porcentuales, hallazgos, cambios observados, conclusiones y recomendaciones. La lógica específica se ajustará con documentos reales.

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
- los seis tipos documentales;
- detalles completos relacionados por `id_documento`;
- método de extracción;
- páginas y confianza OCR;
- documentos para revisión;
- procesamientos y duplicados.

Cada PDF recibe una huella SHA-256. Si el mismo archivo se procesa nuevamente, puede volver a exportarse, pero no se duplican sus registros locales.

## Nuevas colecciones

### Instrumentos de Evaluación

```text
archivos_instrumento_evaluacion
datos_generales_instrumento
items_instrumento_evaluacion
resultados_instrumento_evaluacion
responsables_instrumento_evaluacion
anexos_instrumento_evaluacion
ocr_paginas_instrumento_evaluacion
```

### Informes de Impacto

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

## Estructura visual

```text
renderer/
├─ shared/
├─ documentos/
│  ├─ documentos.html
│  ├─ documentos.js
│  ├─ documentos.css
│  └─ secciones/
│     ├─ planes.section.js
│     ├─ acuerdos.section.js
│     ├─ planificaciones.section.js
│     ├─ informes-finales.section.js
│     ├─ instrumentos-evaluacion.section.js
│     └─ informes-impacto.section.js
└─ base/
   ├─ base.html
   ├─ base.js
   ├─ base.css
   └─ vistas/
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

La prueba comprueba los seis tipos documentales, exportación Excel/JSON, almacenamiento, consultas y detalles de Base.

## Consideración del primer OCR

La primera ejecución de Tesseract puede tardar más mientras prepara los recursos de reconocimiento. Los documentos extensos también pueden tardar varios minutos porque se procesan página por página para conservar estabilidad y mostrar progreso.
