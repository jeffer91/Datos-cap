# Gestor Documental de Capacitación

Aplicación de escritorio en Electron para procesar documentos institucionales de formación y capacitación docente mediante apartados específicos por tipo documental.

## Arquitectura

- Ocho apartados documentales independientes.
- Motor común de selección, validación, exportación y trazabilidad.
- Procesador especializado por tipo documental.
- Lectura digital y OCR de respaldo.
- Excel y JSON como salidas iniciales antes de conectar la base de datos local.

## Apartados registrados

1. Plan Individual de Formación y Capacitación Docente.
2. Planificación de Capacitación por Curso.
3. Acuerdo de Patrocinio Institucional.
4. Informe Final de Capacitación.
5. Instrumento de Evaluación de la Capacitación.
6. Informe de Impacto de la Capacitación.
7. Detección de Necesidades de Capacitación.
8. Plan General de Capacitación Docente.

Detección de Necesidades y Plan General son documentos únicos por periodo. Los demás admiten varios PDF.

## Bloques completados

### 1. Base modular

Menú con ocho apartados, registro central, reglas de documentos únicos y repetitivos, hash SHA-256, identificadores estables y exportación Excel/JSON.

### 2. Plan Individual

```text
01_archivos
02_identificacion
03_capacidades
04_capacitaciones
05_formacion
```

### 3. Planificación por Curso

```text
01_archivos
02_datos_generales
03_unidades
04_evaluaciones
```

### 4. Acuerdo de Patrocinio Institucional

```text
01_archivos
02_datos_acuerdo
03_apoyos
04_responsables
```

### 5. Informe Final de Capacitación

```text
01_archivos
02_datos_generales
03_participantes
04_resultados
05_resumen
06_responsables
```

### 6. Instrumento de Evaluación de la Capacitación

```text
01_archivos
02_datos_generales
03_participantes
04_indicadores
05_likert
06_objetivos
07_analisis
08_responsables
```

Extrae participantes, resultados cuantitativos, escala Likert, objetivos, conclusiones y recomendaciones. Cuando una marca no conserva su columna en el texto del PDF, solicita revisión en lugar de inventar el dato.

### 7. Informe de Impacto de la Capacitación

Procesa documentos `UGPA-INF-XX-PRO-135-AÑO-MES` y genera siete tablas:

```text
01_archivos
02_datos_generales
03_indicadores
04_objetivos
05_metodologia
06_analisis
07_responsables
```

Extrae:

- Nombre del curso, carrera o público destinatario.
- Periodo, fechas de inicio y finalización.
- Facilitador y número de participantes.
- Fecha de elaboración, versión y código institucional.
- Indicadores cualitativos con sus porcentajes.
- Indicadores cuantitativos de participación, cronograma y aplicabilidad.
- Evaluación del cumplimiento de objetivos.
- Métodos e instrumentos de medición.
- Escalas de satisfacción, observación, pruebas y entrevistas.
- Resultados cualitativos y cuantitativos.
- Análisis de causalidad y variables moderadoras.
- Conclusiones y recomendaciones.
- Elaborado, revisado y aprobado.
- Páginas reales, páginas declaradas e inconsistencias.

Los indicadores se separan incluso cuando el PDF elimina los saltos de línea y junta varios resultados en un solo párrafo. Cada indicador conserva su texto completo, porcentaje, tipo de impacto y documento de origen.

## Módulos activos

- Plan Individual.
- Planificación por Curso.
- Acuerdo de Patrocinio.
- Informe Final de Capacitación.
- Instrumento de Evaluación de la Capacitación.
- Informe de Impacto de la Capacitación.

## Módulos pendientes

- Detección de Necesidades de Capacitación.
- Plan General de Capacitación Docente.
- Base de datos local e integración final.

## Flujo

```text
Seleccionar apartado
→ Seleccionar PDF
→ Validar archivos y duplicados
→ Extraer texto digital
→ Activar OCR si es necesario
→ Ejecutar parser especializado
→ Validar datos y tablas
→ Generar Excel + JSON
```

## Estructura de los módulos más recientes

```text
src/document-types/
├─ instrumento-evaluacion/
│  ├─ definition.js
│  ├─ parser.js
│  ├─ parser-v2.js
│  ├─ tables.js
│  ├─ validator.js
│  └─ index.js
└─ informe-impacto/
   ├─ definition.js
   ├─ parser.js
   ├─ parser-v2.js
   ├─ tables.js
   ├─ validator.js
   └─ index.js
```

## Instalación y ejecución

```powershell
npm install
npm start
```

## Pruebas

```powershell
npm test
```

Pruebas individuales:

```powershell
npm run selftest
npm run test:plan-individual
npm run test:planificacion-curso
npm run test:acuerdo-patrocinio
npm run test:informe-final
npm run test:instrumento-evaluacion
npm run test:informe-impacto
```

## OCR

Los PDF con texto suficiente se procesan directamente. Los PDF vacíos, escaneados o con texto defectuoso pasan por OCR en español e inglés.

## Próxima etapa

Implementar el procesador especializado de Detección de Necesidades de Capacitación como documento único por periodo.
