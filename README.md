# Gestor Documental de Capacitación

Aplicación de escritorio en Electron para procesar documentos institucionales de formación y capacitación docente mediante apartados específicos por tipo documental.

## Arquitectura

La aplicación utiliza:

- Ocho apartados documentales independientes.
- Un motor común de selección, validación, exportación y trazabilidad.
- Un procesador especializado por tipo documental.
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

- Menú con ocho apartados.
- Registro central de tipos y procesadores.
- Reglas para documentos repetitivos y únicos.
- Hash SHA-256 para duplicados.
- Identificadores estables.
- Exportación dinámica Excel y JSON.

### 2. Plan Individual

Genera cinco tablas:

```text
01_archivos
02_identificacion
03_capacidades
04_capacitaciones
05_formacion
```

### 3. Planificación por Curso

Genera cuatro tablas:

```text
01_archivos
02_datos_generales
03_unidades
04_evaluaciones
```

Extrae modalidad, carácter, certificado, objetivos, unidades, cargas horarias, logros e instrumentos de evaluación.

### 4. Acuerdo de Patrocinio Institucional

Genera cuatro tablas:

```text
01_archivos
02_datos_acuerdo
03_apoyos
04_responsables
```

Reconoce códigos UGPA y CGC, docente, cédula, carrera, capacitación, fecha, siete tipos de apoyo, porcentaje parcial y responsables.

### 5. Informe Final de Capacitación

Genera seis tablas:

```text
01_archivos
02_datos_generales
03_participantes
04_resultados
05_resumen
06_responsables
```

El módulo extrae:

- Código `UGPA-INF-XX-PRO-134-AÑO-MES` y periodo.
- Versión y fecha de elaboración.
- Nombre de la capacitación y público objetivo.
- Carrera o todas las carreras.
- Facilitador, fechas de impartición y duración.
- Objetivos y cumplimiento de objetivos.
- Participantes con identificación, discapacidad, carné y género.
- Resultado de certificación por participante cuando la distribución puede determinarse con seguridad.
- Totales de inscritos, aprobados, participantes, facilitadores, desertores y reprobados.
- Totales por género.
- Elaborado, revisado y aprobado.
- Páginas reales, páginas declaradas e inconsistencias de paginación.

Cuando el texto del PDF no permite determinar con seguridad qué columna está marcada para cada participante, la fila se guarda con estado `REVISAR_DISTRIBUCION` en lugar de inventar un resultado.

## Módulos activos

- Plan Individual.
- Planificación por Curso.
- Acuerdo de Patrocinio.
- Informe Final de Capacitación.

## Módulos pendientes

- Instrumento de Evaluación de la Capacitación.
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

## Estructura principal

```text
├─ package.json
├─ main.js
├─ preload.js
├─ renderer/
├─ src/
│  ├─ core/
│  ├─ document-types/
│  │  ├─ plan-individual/
│  │  ├─ planificacion-curso/
│  │  ├─ acuerdo-patrocinio/
│  │  ├─ informe-final/
│  │  │  ├─ definition.js
│  │  │  ├─ parser.js
│  │  │  ├─ tables.js
│  │  │  ├─ validator.js
│  │  │  └─ index.js
│  │  ├─ instrumento-evaluacion/
│  │  ├─ informe-impacto/
│  │  ├─ deteccion-necesidades/
│  │  └─ plan-general-capacitacion/
│  ├─ readers/
│  ├─ diagnostics/
│  ├─ exporters/
│  ├─ extractor/
│  ├─ processors/
│  ├─ tables/
│  ├─ utils/
│  └─ validators/
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
```

## OCR

Los PDF con texto suficiente se procesan directamente. Los PDF vacíos, escaneados o con texto defectuoso pasan por OCR en español e inglés.

## Próxima etapa

Implementar el procesador especializado del Instrumento de Evaluación de la Capacitación.
