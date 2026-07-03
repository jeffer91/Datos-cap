/* =========================================================
Nombre completo: carga.service.js
Ruta o ubicación: /src/funcionalidades/01-carga/carga.service.js
Función principal:
- Preparar funciones base para la futura carga de videos.
- Mantener separada la lógica técnica de la pantalla visual.
- Este bloque todavía no analiza videos; eso queda para el Bloque 2.
========================================================= */
(function(window) {
  'use strict';

  function obtenerMensajeInicial() {
    return 'Selecciona o arrastra tus videos.';
  }

  function esArchivoVideo(archivo) {
    if (!archivo) return false;
    return String(archivo.type || '').startsWith('video/');
  }

  window.VideoEditorCargaService = {
    obtenerMensajeInicial,
    esArchivoVideo
  };
})(window);
