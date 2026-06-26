# Bloque 11 - Comparacion entre youtubers y estilos

Este bloque agrega la base para comparar dos o mas analisis guardados.

## Archivos agregados

- `src/modules/comparison/comparisonMetrics.js`
- `src/modules/comparison/styleComparator.js`
- `src/modules/comparison/comparisonService.js`
- `src/modules/comparison/comparisonController.js`
- `src/ui/screens/comparisonScreen.js`

## Funciones principales

- Listar analisis comparables.
- Comparar cortes, silencios, frames, secciones y eventos.
- Agrupar por creador, estilo y estado.
- Detectar patrones comunes.
- Crear una plantilla maestra base.
- Exportar resultado en JSON dentro de `data/exports`.

## Pendiente de conexion UI/Electron

Por los bloqueos previos del conector, puede ser necesario conectar manualmente en VS Code:

- `electron/windowManager.js`
- `electron/preload.js`
- `src/ui/index.html`
- `src/ui/scripts/renderer.js`
- `src/ui/styles/global.css`

## IPC sugeridos

```js
ipcMain.handle('comparison:listAnalyses', async (_event, limit) => {
  return handleListComparableAnalyses(limit);
});

ipcMain.handle('comparison:compare', async (_event, payload) => {
  return handleCompareAnalyses(payload);
});

ipcMain.handle('comparison:diagnostic', async () => {
  return handleComparisonDiagnostic();
});
```

## Preload sugerido

```js
comparison: {
  listAnalyses: (limit = 50) => ipcRenderer.invoke('comparison:listAnalyses', limit),
  compare: (payload) => ipcRenderer.invoke('comparison:compare', payload),
  diagnostic: () => ipcRenderer.invoke('comparison:diagnostic')
}
```
