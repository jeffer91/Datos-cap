/* =========================================================
Nombre completo: carga.state.js
Ruta o ubicación: /src/funcionalidades/01-carga/carga.state.js
Función principal:
- Definir el estado inicial de la pantalla Carga.
- Centralizar los pasos globales del flujo de edición.
- Preparar la base para mostrar solo 6 pasos visibles en el panel lateral.
========================================================= */
(function(window) {
  'use strict';

  const PASOS_EDITOR_VIDEO = [
    'Carga',
    'Plantillas de estilo',
    'Corrección de audio',
    'Mejora de voz',
    'Eliminación de silencios',
    'Transcripción y revisión',
    'Generación de subtítulos',
    'Capítulos y marcadores',
    'Análisis visual',
    'Partes virales',
    'Limpieza visual',
    'Cortado de video',
    'Ordenar video',
    'Revisión de ritmo',
    'Transiciones',
    'Efectos visuales',
    'Corrección de color',
    'Limpieza de fondo',
    'Biblioteca',
    'Recursos flotantes',
    'Llamadas a la acción',
    'Animación de recursos',
    'Diseño sonoro',
    'Adaptación a plataforma',
    'Encuadre inteligente',
    'Versiones del video',
    'Vista previa final',
    'Exportación'
  ];

  const cargaState = {
    pasoActual: 0,
    ventanaInicio: 0,
    pasosVisibles: 6,
    videos: [],
    listoParaContinuar: false
  };

  function obtenerPasosVisibles() {
    const inicio = Math.max(0, cargaState.ventanaInicio);
    const fin = inicio + cargaState.pasosVisibles;
    return PASOS_EDITOR_VIDEO.slice(inicio, fin).map((nombre, index) => ({
      numero: inicio + index + 1,
      nombre,
      activo: inicio + index === cargaState.pasoActual,
      completado: inicio + index < cargaState.pasoActual
    }));
  }

  function moverVentanaPasos(direccion) {
    const maxInicio = Math.max(0, PASOS_EDITOR_VIDEO.length - cargaState.pasosVisibles);
    const siguiente = cargaState.ventanaInicio + direccion;
    cargaState.ventanaInicio = Math.max(0, Math.min(maxInicio, siguiente));
    return obtenerPasosVisibles();
  }

  window.VideoEditorCargaState = {
    PASOS_EDITOR_VIDEO,
    cargaState,
    obtenerPasosVisibles,
    moverVentanaPasos
  };
})(window);
