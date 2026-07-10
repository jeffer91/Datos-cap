# Gestor Documental de Capacitación

Aplicación de escritorio en Electron para procesar documentos institucionales de formación y capacitación docente mediante **apartados específicos por tipo documental**.

## Arquitectura aprobada

La aplicación utiliza:

- Una sola aplicación Electron.
- Ocho apartados visibles e independientes.
- Un motor común de selección, validación, exportación y trazabilidad.
- Un procesador especializado para cada tipo documental.
- Excel y JSON como salidas iniciales antes de conectar una base de datos.

## Apartados registrados

1. Plan Individual de Formación y Capacitación Docente.
2. Planificación de Capacitación por Curso.
3. Acuerdo de Patrocinio Institucional.
4. Informe Final de Capacitación.
5. Instrumento de Evaluación de la Capacitación.
6. Informe de Impacto de la Capacitación.
7. Detección de Necesidades de Capacitación.
8. Plan General de Capacitación Docente.

Los dos últimos se consideran **documentos únicos por periodo**. Los demás son documentos repetitivos que pueden cargarse en grupos del mismo tipo.

## Etapa 1 completada: base modular

- Menú con los ocho apartados.
- Registro central de tipos documentales.
- Reglas para documentos repetitivos y únicos por periodo.
- Hash SHA-256 para detectar duplicados por contenido.
- Identificadores documentales estables.
- Exportadores dinámicos de Excel y JSON.
- Interfaz en modo claro.

## Etapa 2 completada: Plan Individual modular

El Plan Individual funciona mediante un procesador especializado con parser, tablas y validaciones propias. Conserva sus cinco tablas:

```text
01_archivos
02_identificacion
03_capacidades
04_capacitaciones
05_formacion
```

Los constructores anteriores se conservan temporalmente como implementación interna hasta comprobar equivalencia con varios PDF reales.

## Etapa 3 completada: Planificación de Capacitación por Curso

Este apartado ya está activo y admite varios PDF del mismo tipo.

### Lectura híbrida

El flujo intenta primero extraer texto digital. Cuando el texto está vacío, es demasiado corto o presenta baja calidad, activa automáticamente OCR en español e inglés.

El resultado registra:

- Método de extracción utilizado.
- Cantidad de páginas procesadas por OCR.
- Confianza promedio del OCR.
- Huella SHA-256 del archivo.
- Advertencias de lectura o revisión.

### Cuatro tablas generadas

```text
01_archivos
02_datos_generales
03_unidades
04_evaluaciones
```

La tabla de datos generales incluye nombre, descripción, público, carrera, forma de ejecución, tipo de capacitación, carácter, modalidad, certificado, objetivo, fechas, ambiente, facilitador, responsables y total de horas.

La tabla de unidades incluye número, nombre, contenidos, horas teóricas, prácticas, trabajo autónomo, total y logro de aprendizaje.

La tabla de evaluaciones incluye parámetro, temática, cantidad de instrumentos y tipo de evaluación.

### Validaciones propias

- Código institucional correspondiente a `PRO-134`.
- Nombre y descripción del curso.
- Presencia de unidades y cargas horarias.
- Presencia de evaluaciones.
- Cuatro tablas obligatorias.
- Trazabilidad del archivo origen.

## Módulos activos

- Plan Individual de Formación y Capacitación Docente.
- Planificación de Capacitación por Curso.

## Módulos pendientes

- Acuerdo de Patrocinio Institucional.
- Informe Final de Capacitación.
- Instrumento de Evaluación de la Capacitación.
- Informe de Impacto de la Capacitación.
- Detección de Necesidades de Capacitación.
- Plan General de Capacitación Docente.

## Flujo actual

```text
Seleccionar apartado
→ Seleccionar PDF del tipo correcto
→ Validar archivos y duplicados
→ Resolver procesador especializado
→ Extraer texto digital
→ Activar OCR cuando sea necesario
→ Analizar y validar los datos
→ Construir tablas
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
│  │  ├─ document.processor.js
│  │  ├─ document-type.registry.js
│  │  └─ processor.registry.js
│  ├─ document-types/
│  │  ├─ plan-individual/
│  │  ├─ planificacion-curso/
│  │  │  ├─ definition.js
│  │  │  ├─ parser-v2.js
│  │  │  ├─ tables.js
│  │  │  ├─ validator.js
│  │  │  └─ index.js
│  │  ├─ acuerdo-patrocinio/
│  │  ├─ informe-final/
│  │  ├─ instrumento-evaluacion/
│  │  ├─ informe-impacto/
│  │  ├─ deteccion-necesidades/
│  │  └─ plan-general-capacitacion/
│  ├─ readers/
│  │  ├─ text-quality.js
│  │  ├─ pdf-hybrid.reader.js
│  │  └─ pdf-ocr.reader.js
│  ├─ diagnostics/
│  │  ├─ selftest.js
│  │  ├─ plan-individual.parser.test.js
│  │  └─ planificacion-curso.parser.test.js
│  ├─ exporters/
│  ├─ extractor/
│  ├─ processors/
│  ├─ tables/
│  ├─ utils/
│  └─ validators/
```

## Instalación

```powershell
npm install
```

## Ejecutar

```powershell
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
```

## Consideración del OCR

La primera ejecución del OCR puede tardar más porque el motor debe preparar los recursos de reconocimiento. Los PDF que ya contienen texto no pasan por OCR, lo que reduce el tiempo de procesamiento.

## Próxima etapa

Implementar el procesador especializado del **Acuerdo de Patrocinio Institucional**, definiendo sus tablas, campos variables y validaciones.
