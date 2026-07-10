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

La primera etapa incorporó:

- Menú con los ocho apartados.
- Registro central de tipos documentales.
- Reglas de documento repetitivo o único por periodo.
- Procesador documental genérico.
- Validación específica según el apartado.
- Hash SHA-256 para detectar duplicados por contenido.
- Identificadores documentales estables.
- Exportadores dinámicos de Excel y JSON.
- Interfaz nueva en modo claro.

## Etapa 2 completada: migración del Plan Individual

El Plan Individual dejó de estar conectado directamente al pipeline principal. Ahora funciona como un módulo especializado compuesto por:

```text
src/document-types/plan-individual/
├─ definition.js
├─ parser.js
├─ tables.js
├─ validator.js
└─ index.js
```

También se incorporó:

- Registro central de procesadores en `src/core/processor.registry.js`.
- Pipeline desacoplado de parsers y tablas concretas.
- Validación de los datos obtenidos por documento.
- Validación de que existan las cinco tablas esperadas.
- Bloqueo de exportación cuando no se obtiene ningún documento válido.
- Bloqueo de exportación cuando falta una tabla obligatoria.
- Prueba de regresión del parser con un Plan Individual sintético.
- Pruebas automáticas mediante `npm test` y GitHub Actions.

Los archivos anteriores de extracción y tablas se conservan temporalmente como implementación interna. No se eliminarán hasta probar varios PDF reales y confirmar que la salida es equivalente.

## Módulo activo

### Plan Individual de Formación y Capacitación Docente

Genera cinco tablas:

```text
01_archivos
02_identificacion
03_capacidades
04_capacitaciones
05_formacion
```

## Módulo con estructura preparada

### Planificación de Capacitación por Curso

Tiene declaradas cuatro tablas:

```text
01_archivos
02_datos_generales
03_unidades
04_evaluaciones
```

Su parser, lector híbrido y OCR se incorporarán en la siguiente etapa.

## Módulos pendientes de definición final de tablas

- Acuerdos de patrocinio.
- Informes finales.
- Instrumentos de evaluación.
- Informes de impacto.
- Detección de necesidades.
- Plan general de capacitación.

## Flujo actual

```text
Seleccionar apartado
→ Seleccionar PDF del tipo correcto
→ Validar archivos y duplicados
→ Resolver procesador especializado
→ Leer y analizar los PDF
→ Validar estructura obtenida
→ Construir tablas
→ Generar Excel + JSON
```

## Validaciones incorporadas

La app verifica:

- Ruta válida.
- Existencia del archivo.
- Extensión PDF.
- Archivo no vacío.
- Hash SHA-256.
- Duplicados reales por contenido.
- Límite de un documento en apartados únicos.
- Referencias esperadas en el nombre del archivo.
- Procesador especializado disponible.
- Documentos realmente parseados.
- Tablas obligatorias construidas.
- Filas vacías o que necesitan revisión.

Una diferencia en el nombre esperado genera una advertencia, no bloquea automáticamente el documento.

## Estructura modular

```text
├─ package.json
├─ main.js
├─ preload.js
├─ renderer/
│  ├─ index.html
│  ├─ app.js
│  └─ styles/
│     ├─ app.css
│     └─ layout.css
├─ src/
│  ├─ core/
│  │  ├─ document.processor.js
│  │  ├─ document-type.registry.js
│  │  └─ processor.registry.js
│  ├─ document-types/
│  │  ├─ plan-individual/
│  │  │  ├─ definition.js
│  │  │  ├─ parser.js
│  │  │  ├─ tables.js
│  │  │  ├─ validator.js
│  │  │  └─ index.js
│  │  ├─ planificacion-curso/
│  │  ├─ acuerdo-patrocinio/
│  │  ├─ informe-final/
│  │  ├─ instrumento-evaluacion/
│  │  ├─ informe-impacto/
│  │  ├─ deteccion-necesidades/
│  │  └─ plan-general-capacitacion/
│  ├─ diagnostics/
│  │  ├─ selftest.js
│  │  └─ plan-individual.parser.test.js
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

Ejecutar todas las pruebas:

```powershell
npm test
```

Ejecutar solamente el diagnóstico general:

```powershell
npm run selftest
```

Ejecutar la prueba del parser del Plan Individual:

```powershell
npm run test:plan-individual
```

## Próxima etapa

Implementar el procesador específico de **Planificación de Capacitación por Curso**, incluyendo:

- Lectura híbrida de PDF.
- OCR para documentos escaneados.
- Parser de datos generales.
- Parser de unidades y horas.
- Parser de evaluaciones.
- Validaciones propias del documento.
