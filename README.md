# Gestor de Documentos de Capacitación

Aplicación de escritorio desarrollada con Electron para procesar documentos institucionales de capacitación docente, guardar la información en una base local y generar reportes en Excel y JSON.

## Tipos documentales disponibles

### 1. Plan Individual de Formación y Capacitación Docente

Reconoce documentos con referencias como:

```text
RGI1
PRO-251
PLAN INDIVIDUAL DE FORMACIÓN Y CAPACITACIÓN DOCENTE
```

Genera cinco tablas:

```text
01_archivos
02_identificacion
03_capacidades
04_capacitaciones
05_formacion
```

### 2. Acuerdo de Patrocinio Institucional

Reconoce documentos con referencias como:

```text
RGI2
PRO-134
ACUERDO DE PATROCINIO INSTITUCIONAL
```

Extrae docente, cédula, carrera, capacitación, fecha, ciudad, apoyo institucional y responsables.

Genera cuatro tablas:

```text
01_archivos
02_datos_acuerdo
03_apoyos
04_responsables
```

## Base local

La aplicación guarda automáticamente los resultados en una base local formada por colecciones JSON. La ubicación se crea dentro de la carpeta de datos de Electron:

```text
local-database/
├─ database.meta.json
└─ collections/
```

El panel de la aplicación permite ver:

- documentos guardados;
- cantidad de planes y acuerdos;
- filas almacenadas;
- ejecuciones recientes;
- duplicados omitidos;
- últimos documentos procesados.

La opción **Abrir carpeta** permite revisar físicamente los archivos JSON.

## Control de duplicados

Cada PDF recibe una huella SHA-256. Si el mismo contenido se procesa nuevamente, la aplicación puede generar otro Excel y JSON, pero no vuelve a duplicar los registros en la base local.

## Instalación

Desde PowerShell, dentro de la carpeta del proyecto:

```powershell
npm install
```

## Ejecutar

```powershell
npm start
```

También puede utilizarse:

```powershell
npm run dev
```

## Diagnóstico automático

```powershell
npm run selftest
```

La prueba comprueba:

- cinco tablas de Planes Individuales;
- cuatro tablas de Acuerdos de Patrocinio;
- detección de cédula y apoyo marcado;
- generación de Excel y JSON;
- almacenamiento en la base local.

## Flujo de uso

```text
Seleccionar documentos
→ Validar el tipo documental
→ Seleccionar carpeta de salida
→ Procesar y guardar localmente
→ Generar Excel + JSON
→ Revisar la base local
```

Los Planes Individuales y los Acuerdos de Patrocinio se manejan en secciones independientes para evitar que sus archivos y resultados se mezclen.
