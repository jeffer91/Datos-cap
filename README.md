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

## Estado de la etapa 1

La primera etapa incorpora:

- Menú con los ocho apartados.
- Registro central de tipos documentales.
- Reglas de documento repetitivo o único por periodo.
- Procesador documental genérico.
- Validación específica según el apartado.
- Hash SHA-256 para detectar duplicados por contenido.
- Identificadores documentales estables.
- Exportadores dinámicos de Excel y JSON.
- Compatibilidad con el extractor actual de Plan Individual.

### Módulo activo

Actualmente el módulo funcional es:

- **Plan Individual de Formación y Capacitación Docente**.

Genera cinco tablas:

```text
01_archivos
02_identificacion
03_capacidades
04_capacitaciones
05_formacion
```

### Módulo con estructura preparada

- **Planificación de Capacitación por Curso**.

Ya tiene declaradas cuatro tablas, pero su parser y OCR se incorporarán en la siguiente etapa:

```text
01_archivos
02_datos_generales
03_unidades
04_evaluaciones
```

### Módulos pendientes de definición final de tablas

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
→ Elegir carpeta de salida
→ Ejecutar procesador especializado
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
│  │  └─ document-type.registry.js
│  ├─ document-types/
│  │  ├─ plan-individual/
│  │  ├─ planificacion-curso/
│  │  ├─ acuerdo-patrocinio/
│  │  ├─ informe-final/
│  │  ├─ instrumento-evaluacion/
│  │  ├─ informe-impacto/
│  │  ├─ deteccion-necesidades/
│  │  └─ plan-general-capacitacion/
│  ├─ diagnostics/
│  ├─ exporters/
│  ├─ extractor/
│  ├─ processors/
│  ├─ tables/
│  ├─ utils/
│  │  ├─ date.utils.js
│  │  ├─ file.utils.js
│  │  ├─ hash.utils.js
│  │  └─ ids.js
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

## Diagnóstico

```powershell
npm run selftest
```

El diagnóstico verifica:

- Registro de los ocho tipos documentales.
- Cinco tablas del Plan Individual.
- Exportación dinámica a Excel.
- Metadatos del tipo documental en JSON.
- Creación de archivos temporales de prueba.

## Próxima etapa

La siguiente etapa debe implementar el procesador específico de **Planificación de Capacitación por Curso**, incluyendo:

- Lectura híbrida de PDF.
- OCR para documentos escaneados.
- Parser de datos generales.
- Parser de unidades y horas.
- Parser de evaluaciones.
- Validaciones propias del documento.
