# Bloque 13 - Centro de control y diagnostico avanzado

Este bloque agrega una vista de control para revisar el estado general de la app local.

## Archivos agregados

- `src/modules/controlCenter/healthChecks.js`
- `src/modules/controlCenter/controlCenterService.js`
- `src/modules/controlCenter/controlCenterController.js`
- `src/ui/screens/controlCenterScreen.js`

## Archivos ajustados

- `src/ui/index.html`
- `src/ui/scripts/renderer.js`
- `package.json`
- `src/modules/library/*`
- `src/modules/mediaProcessing/processingController.js`

## Funciones

- Revisa estado de app base.
- Revisa conteos de biblioteca.
- Revisa modulo de comparacion.
- Revisa modulo de plantillas.
- Muestra recomendaciones segun el estado actual.
- Deja la pantalla Diagnostico conectada al Centro de Control.

## Prueba

```bash
npm install
npm run check
npm start
```

Luego abrir la pantalla `Diagnostico`.

## Nota

El motor completo de procesamiento FFmpeg real sigue pendiente de reforzarse desde VS Code si el conector vuelve a bloquear rutas tecnicas.
