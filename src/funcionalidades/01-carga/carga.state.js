/* =========================================================
Nombre completo: carga.state.js
Ruta o ubicación: /src/funcionalidades/01-carga/carga.state.js
Función principal:
- Definir el estado inicial de la pantalla Carga.
- Centralizar los pasos globales del flujo de edición.
- Guardar videos cargados y su análisis básico.
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
    resumen: null,
    cargando: false,
    error: '',
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

  function calcularResumen(videos) {
    const lista = Array.isArray(videos) ? videos : [];
    const formatos = lista.reduce((acc, video) => {
      const clave = video.orientacion || 'desconocido';
      acc[clave] = (acc[clave] || 0) + 1;
      return acc;
    }, {});

    return {
      totalVideos: lista.length,
      pesoTotalBytes: lista.reduce((total, video) => total + Number(video.pesoBytes || 0), 0),
      formatos
    };
  }

  function guardarVideosAnalizados(videos) {
    cargaState.videos = Array.isArray(videos) ? videos : [];
    cargaState.resumen = calcularResumen(cargaState.videos);
    cargaState.listoParaContinuar = cargaState.videos.length > 0;
    cargaState.error = '';
    return cargaState;
  }

  function iniciarCarga() {
    cargaState.cargando = true;
    cargaState.error = '';
    return cargaState;
  }

  function finalizarCarga() {
    cargaState.cargando = false;
    return cargaState;
  }

  function guardarError(error) {
    cargaState.cargando = false;
    cargaState.error = error || 'No se pudo cargar el video.';
    return cargaState;
  }

  window.VideoEditorCargaState = {
    PASOS_EDITOR_VIDEO,
    cargaState,
    obtenerPasosVisibles,
    moverVentanaPasos,
    guardarVideosAnalizados,
    iniciarCarga,
    finalizarCarga,
    guardarError
  };
})(window);
