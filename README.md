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

## Etapa 2 completada: Plan Individual

Genera cinco tablas:

```text
01_archivos
02_identificacion
03_capacidades
04_capacitaciones
05_formacion
```

## Etapa 3 completada: Planificación por Curso

Incluye lectura digital, OCR automático y cuatro tablas:

```text
01_archivos
02_datos_generales
03_unidades
04_evaluaciones
```

Extrae datos generales, modalidad, carácter, certificado, objetivos, unidades, horas, logros e instrumentos de evaluación.

## Etapa 4 completada: Acuerdo de Patrocinio Institucional

Este apartado ya está activo, admite varios PDF y utiliza el lector híbrido con OCR cuando sea necesario.

### Cuatro tablas generadas

```text
01_archivos
02_datos_acuerdo
03_apoyos
04_responsables
```

La tabla de datos del acuerdo incluye:

- Código y periodo.
- Ciudad y fecha normalizada.
- Docente y cédula.
- Carrera y vínculo institucional.
- Capacitación patrocinada.
- Cantidad de apoyos marcados.
- Apoyo principal y porcentaje parcial.

La tabla de apoyos registra las siete opciones institucionales, indicando si cada una fue seleccionada:

- Financiamiento total.
- Financiamiento parcial.
- Anticipo de sueldos u honorarios.
- Cambio temporal de modalidad de trabajo.
- Licencia con remuneración.
- Licencia sin remuneración.
- Ajuste de horario laboral.

La tabla de responsables registra rol, nombre, cargo y estado de firma inferido.

### Compatibilidad documental

El módulo reconoce códigos con prefijo `UGPA` y versiones antiguas con prefijo `CGC`, siempre que correspondan a `RGI2` y `PRO-134`.

### Validaciones propias

- Código institucional válido.
- Docente y cédula.
- Capacitación.
- Fecha completa del acuerdo.
- Al menos un apoyo marcado.
- Responsables identificados.
- Cuatro tablas obligatorias.
- Huella del archivo origen.

## Módulos activos

- Plan Individual de Formación y Capacitación Docente.
- Planificación de Capacitación por Curso.
- Acuerdo de Patrocinio Institucional.

## Módulos pendientes

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
│  ├─ document-types/
│  │  ├─ plan-individual/
│  │  ├─ planificacion-curso/
│  │  ├─ acuerdo-patrocinio/
│  │  │  ├─ definition.js
│  │  │  ├─ parser.js
│  │  │  ├─ tables.js
│  │  │  ├─ validator.js
│  │  │  └─ index.js
│  │  ├─ informe-final/
│  │  ├─ instrumento-evaluacion/
│  │  ├─ informe-impacto/
│  │  ├─ deteccion-necesidades/
│  │  └─ plan-general-capacitacion/
│  ├─ readers/
│  ├─ diagnostics/
│  │  ├─ selftest.js
│  │  ├─ plan-individual.parser.test.js
│  │  ├─ planificacion-curso.parser.test.js
│  │  └─ acuerdo-patrocinio.parser.test.js
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
npm run test:acuerdo-patrocinio
```

## Consideración del OCR

La primera ejecución del OCR puede tardar más porque el motor debe preparar los recursos de reconocimiento. Los PDF que ya contienen texto no pasan por OCR.

## Próxima etapa

Implementar el procesador especializado del **Informe Final de Capacitación**, con sus participantes, resultados, totales, responsables y validaciones.
