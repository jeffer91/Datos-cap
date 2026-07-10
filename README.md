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

Procesa documentos `UGPA-RGI1-XX-PRO-135-AÑO-MES` y genera ocho tablas:

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

Extrae:

- Curso, periodo de capacitación, facilitador, fecha y carrera.
- Participantes con identificación, discapacidad, carné y género.
- Cumplimiento del cronograma.
- Participación activa.
- Uso de recursos tecnológicos.
- Actividades metodológicas.
- Ajustes del facilitador.
- Promedio de aprendizaje, satisfacción, aprobación, aplicabilidad y seguimiento.
- Escala Likert de cinco ítems.
- Objetivos de aprendizaje y porcentaje de cumplimiento.
- Resultados cualitativos, observaciones, conclusiones y recomendaciones.
- Elaborado, revisado y aprobado.
- Páginas reales, páginas declaradas e inconsistencias.

Cuando el PDF contiene una marca `X`, pero el texto extraído no conserva la columna Likert, el módulo guarda `MARCA_SIN_COLUMNA` y solicita revisión visual en lugar de inventar la respuesta.

Las identificaciones pueden ser de 10 dígitos, más cortas o alfanuméricas. Las que no tengan 10 dígitos se conservan con advertencia, sin bloquear el procesamiento.

## Módulos activos

- Plan Individual.
- Planificación por Curso.
- Acuerdo de Patrocinio.
- Informe Final de Capacitación.
- Instrumento de Evaluación de la Capacitación.

## Módulos pendientes

- Informe de Impacto de la Capacitación.
- Detección de Necesidades de Capacitación.
- Plan General de Capacitación Docente.

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

## Estructura del módulo de evaluación

```text
src/document-types/instrumento-evaluacion/
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
```

## OCR

Los PDF con texto suficiente se procesan directamente. Los PDF vacíos, escaneados o con texto defectuoso pasan por OCR en español e inglés.

## Próxima etapa

Implementar el procesador especializado del Informe de Impacto de la Capacitación.
