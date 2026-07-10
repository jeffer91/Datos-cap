# Gestor Documental de Capacitación

Aplicación de escritorio en Electron para procesar documentos institucionales de formación y capacitación docente. La aplicación extrae información desde PDF digitales o escaneados, guarda los resultados en una base local y genera archivos Excel y JSON.

## Estado

Los ocho módulos, la base local, las consultas y los respaldos están implementados y cubiertos por pruebas automáticas. Antes de considerarla lista para producción todavía deben ejecutarse pruebas manuales con PDF institucionales reales de los ocho tipos.

## Tipos documentales

### 1. Plan Individual de Formación y Capacitación Docente

Documento repetitivo. Admite varios PDF por operación.

```text
01_archivos
02_identificacion
03_capacidades
04_capacitaciones
05_formacion
```

### 2. Planificación de Capacitación por Curso

Documento repetitivo. Admite varios PDF por operación.

```text
01_archivos
02_datos_generales
03_unidades
04_evaluaciones
```

### 3. Acuerdo de Patrocinio Institucional

Documento repetitivo. Admite varios PDF por operación.

```text
01_archivos
02_datos_acuerdo
03_apoyos
04_responsables
```

### 4. Informe Final de Capacitación

Documento repetitivo. Admite varios PDF por operación.

```text
01_archivos
02_datos_generales
03_participantes
04_resultados
05_resumen
06_responsables
```

### 5. Instrumento de Evaluación de la Capacitación

Documento repetitivo. Admite varios PDF por operación.

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

### 6. Informe de Impacto de la Capacitación

Documento repetitivo. Admite varios PDF por operación.

```text
01_archivos
02_datos_generales
03_indicadores
04_objetivos
05_metodologia
06_analisis
07_responsables
```

### 7. Detección de Necesidades de Capacitación

Documento único por periodo. Solo admite un PDF por operación y conserva versiones anteriores.

```text
01_archivos
02_datos_generales
03_fuentes
04_institucionales
05_necesidades_carrera
06_prioridades_carrera
07_consolidado
08_analisis
09_responsables
```

### 8. Plan Semestral de Capacitación Docente

Documento único por periodo. Solo admite un PDF por operación y conserva versiones anteriores.

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

El identificador técnico `plan-general-capacitacion` se conserva por compatibilidad con la base local y las pruebas existentes. El nombre visible y oficial en la interfaz es **Plan Semestral de Capacitación Docente**.

## Flujo de procesamiento

```text
Seleccionar apartado
→ Seleccionar PDF
→ Validar extensión, existencia, tamaño, tipo y duplicados
→ Leer texto digital
→ Activar OCR cuando el texto digital sea insuficiente
→ Ejecutar el parser especializado
→ Validar tablas y campos esenciales
→ Guardar documentos y filas en la base local
→ Generar Excel y JSON
→ Registrar el procesamiento
→ Crear respaldo automático
```

Los flujos comparten únicamente los servicios comunes de lectura, validación, persistencia, consulta, exportación y respaldo. Cada tipo documental conserva su propia definición, parser, tablas y validaciones.

## Base local

La base se crea dentro de la carpeta de datos de usuario de Electron:

```text
<userData>/local-database/
├─ database.meta.json
├─ backups/
└─ collections/
   ├─ _documents.json
   ├─ _processing_runs.json
   └─ una colección JSON por cada tabla documental
```

Reglas principales:

- Los duplicados se detectan por SHA-256, no solo por nombre.
- Un PDF ya guardado no duplica documentos ni filas.
- Los documentos únicos se versionan por tipo y periodo.
- Una versión reemplazada se conserva con estado `SUPERADO`.
- Las escrituras usan archivos temporales, respaldos y reversión básica.

## Consultas

La interfaz permite filtrar por tipo documental, periodo, carrera, docente, responsable, curso y estado. También incluye búsqueda general sobre metadatos y filas guardadas, paginación y detalle por colección.

## Respaldo y restauración

Los respaldos usan la extensión `.capbackup`, compresión GZIP y checksum SHA-256. Se puede:

- Crear un respaldo manual completo.
- Crear respaldos automáticos después del procesamiento.
- Mantener un respaldo diario cuando existen datos.
- Restaurar reemplazando la base.
- Restaurar combinando datos por identificador.
- Crear un respaldo de seguridad antes de restaurar.

## Seguridad

- `contextIsolation` activado.
- `nodeIntegration` desactivado.
- `sandbox` activado.
- Una sola API segura expuesta como `window.documentAppAPI`.
- Lista cerrada de canales IPC.
- Sin canales heredados del extractor anterior.

## Instalación

```powershell
npm install
npm start
```

## Verificación

Auditoría estructural:

```powershell
npm run audit
```

Suite completa:

```powershell
npm test
```

La auditoría comprueba archivos vacíos o temporales, código duplicado exacto, referencias locales rotas, tipos y procesadores duplicados, colecciones compartidas, contratos incompletos, canales IPC inconsistentes, recursos de interfaz inexistentes y documentación desactualizada.

## Pendiente antes de producción

1. Procesar PDF institucionales reales de los ocho tipos desde Electron.
2. Comparar cada PDF con su Excel, JSON y registros locales.
3. Corregir casos particulares de formato u OCR que aparezcan.
4. Integrar la rama con `main` mediante una historia limpia o squash.
