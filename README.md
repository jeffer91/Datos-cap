# Gestor Documental de Capacitación

Aplicación de escritorio en Electron para procesar, guardar y exportar documentos institucionales de formación y capacitación docente mediante apartados específicos.

## Estado actual

La aplicación cuenta con:

- Ocho apartados documentales activos.
- Un procesador especializado por tipo documental.
- Lectura digital y OCR de respaldo.
- Validación por tipo, tamaño, extensión y huella SHA-256.
- Base local no relacional organizada por colecciones.
- Control de duplicados y versiones por periodo.
- Exportación Excel y JSON.
- Pruebas automáticas para los ocho procesadores y la persistencia local.

## Apartados activos

1. Plan Individual de Formación y Capacitación Docente.
2. Planificación de Capacitación por Curso.
3. Acuerdo de Patrocinio Institucional.
4. Informe Final de Capacitación.
5. Instrumento de Evaluación de la Capacitación.
6. Informe de Impacto de la Capacitación.
7. Detección de Necesidades de Capacitación.
8. Plan Semestral de Capacitación Docente.

Detección de Necesidades y Plan Semestral son documentos únicos por periodo. Los demás admiten varios PDF por operación.

## Tablas por apartado

### Plan Individual

```text
01_archivos
02_identificacion
03_capacidades
04_capacitaciones
05_formacion
```

### Planificación por Curso

```text
01_archivos
02_datos_generales
03_unidades
04_evaluaciones
```

### Acuerdo de Patrocinio

```text
01_archivos
02_datos_acuerdo
03_apoyos
04_responsables
```

### Informe Final

```text
01_archivos
02_datos_generales
03_participantes
04_resultados
05_resumen
06_responsables
```

### Instrumento de Evaluación

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

### Informe de Impacto

```text
01_archivos
02_datos_generales
03_indicadores
04_objetivos
05_metodologia
06_analisis
07_responsables
```

### Detección de Necesidades

```text
01_archivos
02_datos_generales
03_fuentes
04_necesidades_carrera
05_prioridades_carrera
06_necesidades_institucionales
07_evidencias
08_analisis
09_responsables
```

### Plan Semestral de Capacitación

```text
01_archivos
02_datos_generales
03_objetivos
04_capacitaciones
05_cronograma
06_seguimiento
07_recursos
08_responsables
```

## Base de datos local

La base local se crea dentro de la carpeta de datos de usuario de Electron:

```text
<userData>/local-database/
├─ database.meta.json
└─ collections/
   ├─ _documents.json
   ├─ _processing_runs.json
   ├─ archivos_plan_individual.json
   ├─ datos_informe_final.json
   └─ ...una colección por cada tabla documental
```

### Reglas de persistencia

- Cada tabla se guarda como una colección JSON independiente.
- Las escrituras utilizan archivos temporales y respaldos para evitar archivos incompletos.
- Las operaciones de varias colecciones aplican reversión básica cuando una escritura falla.
- Un PDF repetitivo con la misma huella SHA-256 no duplica documentos ni filas.
- Un documento único con el mismo periodo y contenido diferente crea una nueva versión.
- La versión anterior se conserva con estado `SUPERADO` y queda enlazada con la versión activa.
- Cada procesamiento registra fecha, tipo, documentos nuevos, duplicados omitidos, filas y archivos exportados.

## Flujo completo

```text
Seleccionar apartado
→ Seleccionar PDF
→ Validar archivos, tipo y duplicados
→ Extraer texto digital
→ Activar OCR cuando sea necesario
→ Ejecutar parser especializado
→ Validar estructura y tablas
→ Guardar documentos y filas en la base local
→ Generar Excel y JSON
→ Registrar el procesamiento en el historial
```

## Interfaz

El panel principal muestra:

- Los ocho apartados.
- Reglas de documentos repetitivos o únicos.
- Archivos seleccionados y su huella digital.
- Tablas esperadas por módulo.
- Cantidad de documentos registrados y activos.
- Total de filas guardadas.
- Historial de procesamientos recientes.
- Acceso directo a la carpeta física de la base local.

## Estructura principal

```text
├─ main.js
├─ preload.js
├─ renderer/
│  ├─ index.html
│  ├─ app.js
│  ├─ database.js
│  └─ styles/
│     ├─ app.css
│     ├─ layout.css
│     └─ database.css
└─ src/
   ├─ core/
   ├─ database/
   │  ├─ index.js
   │  ├─ local-database.js
   │  └─ persistence.service.js
   ├─ document-types/
   ├─ diagnostics/
   ├─ exporters/
   ├─ extractor/
   ├─ processors/
   ├─ readers/
   ├─ tables/
   ├─ utils/
   └─ validators/
```

## Instalación y ejecución

```powershell
npm install
npm start
```

## Pruebas

Ejecutar todas las pruebas:

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
npm run test:deteccion-necesidades
npm run test:plan-general-capacitacion
npm run test:local-database
```

## Seguridad y trazabilidad

- `contextIsolation` activado.
- `nodeIntegration` desactivado.
- Preload con lista cerrada de canales IPC.
- Duplicados detectados por contenido, no solo por nombre.
- Datos ambiguos conservados con advertencia en lugar de inventarse.
- Documentos únicos versionados sin eliminación silenciosa.
- Historial local de cada procesamiento.

## Próximos bloques

1. Consultas, filtros y visualización detallada de la información guardada.
2. Respaldo y restauración completa de la base local.
3. Pruebas integrales con lotes de PDF reales y OCR desde Electron.
4. Limpieza de compatibilidad heredada y auditoría final.
5. Integración definitiva de la rama con `main`.
