# Plan Docente Extractor

Aplicación de escritorio en Electron para cargar varios PDF del **Plan Individual de Formación y Capacitación Docente**, extraer los campos variables y generar un reporte en **Excel + JSON**.

## Objetivo

La app permite convertir varios documentos PDF institucionales en cinco tablas no relacionales listas para revisión y futura carga a una base de datos.

## Flujo principal

```text
Seleccionar PDF
→ Validar documentos
→ Seleccionar carpeta de salida
→ Generar Excel + JSON
```

## Tablas generadas

El Excel contiene cinco hojas:

```text
01_archivos
02_identificacion
03_capacidades
04_capacitaciones
05_formacion
```

El JSON contiene la misma información dentro de:

```json
{
  "metadata": {},
  "resumen": {},
  "validaciones": {},
  "advertencias": [],
  "errores": [],
  "tablas": {
    "archivos_plan_individual": [],
    "identificacion_docente": [],
    "capacidades_docente": [],
    "capacitaciones_propuestas": [],
    "formacion_docente": []
  }
}
```

## Estructura del proyecto

```text
plan-docente-extractor/
├─ package.json
├─ main.js
├─ preload.js
├─ renderer/
│  ├─ index.html
│  └─ app.js
├─ src/
│  ├─ diagnostics/
│  │  └─ selftest.js
│  ├─ exporters/
│  │  ├─ excel.exporter.js
│  │  ├─ json.exporter.js
│  │  └─ index.js
│  ├─ extractor/
│  │  ├─ fields.parser.js
│  │  ├─ normalizer.js
│  │  └─ pdf.reader.js
│  ├─ processors/
│  │  └─ report.processor.js
│  ├─ tables/
│  │  ├─ archivos.table.js
│  │  ├─ capacidades.table.js
│  │  ├─ capacitaciones.table.js
│  │  ├─ formacion.table.js
│  │  ├─ identificacion.table.js
│  │  └─ index.js
│  └─ utils/
│     └─ ids.js
```

## Instalación

Desde PowerShell, dentro de la carpeta del proyecto:

```powershell
npm install
```

## Ejecutar la app

```powershell
npm start
```

También puedes usar:

```powershell
npm run dev
```

## Probar módulos sin abrir Electron

```powershell
npm run selftest
```

Esta prueba crea datos simulados, genera tablas y exporta archivos temporales Excel + JSON para verificar que los módulos principales estén funcionando.

## Salida esperada

Cuando se genera el reporte, la aplicación crea archivos con nombre similar a:

```text
reporte_plan_individual_20260709_163000.xlsx
reporte_plan_individual_20260709_163000.json
```

## Criterio de revisión

Si un PDF tiene datos incompletos, el sistema no bloquea la exportación. Marca el registro con:

```text
requiere_revision = SI
```

Esto permite revisar manualmente los casos con campos faltantes, fechas sospechosas o información no detectada.
