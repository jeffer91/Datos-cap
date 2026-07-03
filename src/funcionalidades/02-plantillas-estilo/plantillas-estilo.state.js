/* =========================================================
Nombre completo: plantillas-estilo.state.js
Ruta o ubicación: /src/funcionalidades/02-plantillas-estilo/plantillas-estilo.state.js
Función principal:
- Definir el estado inicial de Plantillas de estilo.
- Guardar la plantilla seleccionada en próximos bloques.
- Mantener preparada la pantalla para avanzar al siguiente paso.
========================================================= */
(function(window) {
  'use strict';

  const plantillasEstiloState = {
    plantillaSeleccionadaId: null,
    listoParaContinuar: false,
    error: ''
  };

  function seleccionarPlantilla(plantillaId) {
    plantillasEstiloState.plantillaSeleccionadaId = plantillaId || null;
    plantillasEstiloState.listoParaContinuar = Boolean(plantillaId);
    plantillasEstiloState.error = '';
    return plantillasEstiloState;
  }

  function obtenerPlantillaSeleccionada() {
    return plantillasEstiloState.plantillaSeleccionadaId;
  }

  window.VideoEditorPlantillasEstiloState = {
    plantillasEstiloState,
    seleccionarPlantilla,
    obtenerPlantillaSeleccionada
  };
})(window);
