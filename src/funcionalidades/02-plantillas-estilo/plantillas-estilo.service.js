/* =========================================================
Nombre completo: plantillas-estilo.service.js
Ruta o ubicación: /src/funcionalidades/02-plantillas-estilo/plantillas-estilo.service.js
Función principal:
- Entregar el catálogo base de plantillas de estilo.
- Mantener separada la información de estilos de la vista.
- Preparar la pantalla para selección real en el siguiente bloque.
========================================================= */
(function(window) {
  'use strict';

  const PLANTILLAS_ESTILO = [
    {
      id: 'youtube-profesional',
      nombre: 'YouTube profesional',
      descripcion: 'Limpio, claro y pensado para videos largos.',
      etiqueta: '16:9'
    },
    {
      id: 'tiktok-reels',
      nombre: 'TikTok / Reels',
      descripcion: 'Rápido, vertical y con ritmo alto.',
      etiqueta: '9:16'
    },
    {
      id: 'futbol',
      nombre: 'Fútbol',
      descripcion: 'Energía, cortes fuertes y estilo deportivo.',
      etiqueta: 'Sport'
    },
    {
      id: 'educativo',
      nombre: 'Educativo',
      descripcion: 'Ordenado, entendible y con apoyo visual.',
      etiqueta: 'Clase'
    },
    {
      id: 'podcast',
      nombre: 'Podcast',
      descripcion: 'Conversación clara, sobria y enfocada en voz.',
      etiqueta: 'Voz'
    },
    {
      id: 'institucional',
      nombre: 'Institucional',
      descripcion: 'Formal, elegante y con imagen profesional.',
      etiqueta: 'Formal'
    }
  ];

  function obtenerPlantillas() {
    return PLANTILLAS_ESTILO.slice();
  }

  function buscarPlantillaPorId(plantillaId) {
    return PLANTILLAS_ESTILO.find((plantilla) => plantilla.id === plantillaId) || null;
  }

  window.VideoEditorPlantillasEstiloService = {
    obtenerPlantillas,
    buscarPlantillaPorId
  };
})(window);
