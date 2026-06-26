# Bloque 16 - Restauracion controlada y modo reparacion

Este bloque agrega una capa de seguridad para revisar respaldos, validar manifiestos y reparar carpetas locales.

## Archivos agregados

### Backup base

- `src/modules/backup/backupManifestBuilder.js`
- `src/modules/backup/backupService.js`
- `src/modules/backup/backupController.js`

### Recuperacion

- `src/modules/restore/restoreManifestReader.js`
- `src/modules/restore/restoreValidator.js`
- `src/modules/restore/restoreService.js`
- `src/modules/restore/restoreController.js`

### UI

- `src/ui/screens/recoveryScreen.js`
- `src/ui/styles/recovery.css`

## Archivos modificados

- `electron/windowManager.js`
- `electron/preload.js`
- `src/ui/index.html`
- `src/ui/scripts/renderer.js`
- `package.json`

## Funciones

- Crear respaldos locales.
- Listar respaldos disponibles.
- Leer manifiesto de respaldo.
- Validar estructura de respaldo.
- Comparar respaldo contra datos actuales.
- Crear vista previa de recuperacion.
- Reparar carpetas locales faltantes.
- Backend con restauracion controlada y confirmacion obligatoria.

## Nota de seguridad

La UI se subio en modo seguro: permite validar y generar vista previa. La ejecucion directa queda protegida desde backend y requiere confirmacion explicita.

## Prueba

```bash
npm install
npm run check
npm start
```

Luego abrir la pantalla `Recuperacion`.
