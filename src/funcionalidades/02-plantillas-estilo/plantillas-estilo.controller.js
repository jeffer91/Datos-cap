/* =========================================================
Nombre completo: plantillas-estilo.controller.js
Ruta o ubicación: /src/funcionalidades/02-plantillas-estilo/plantillas-estilo.controller.js
Función principal:
- Montar la pantalla mínima de Plantillas de estilo.
- Mantener navegación lateral de 6 pasos visibles.
- Preparar el destino del botón Continuar de Carga.
========================================================= */
(function(window, document) {
  'use strict';

  function actualizarPasos(container) {
    const lista = container.querySelector('[data-carga-step-list]');
    if (!lista || !window.VideoEditorCargaView) return;
    lista.innerHTML = window.VideoEditorCargaView.renderPasosLaterales();
  }

  function bindPlantillasEvents(container) {
    container.querySelectorAll('[data-plantillas-action]').forEach((elemento) => {
      elemento.addEventListener('click', () => {
        const action = elemento.dataset.plantillasAction;

        if (action === 'steps-up') {
          window.VideoEditorCargaState.moverVentanaPasos(-1);
          actualizarPasos(container);
          return;
        }

        if (action === 'steps-down') {
          window.VideoEditorCargaState.moverVentanaPasos(1);
          actualizarPasos(container);
        }
      });
    });
  }

  function renderPlantillasEstiloScreen(container) {
    if (!container || !window.VideoEditorPlantillasEstiloView) return;
    document.body.classList.add('editor-carga-activa');
    window.VideoEditorCargaState.definirPasoActual(1);
    container.innerHTML = window.VideoEditorPlantillasEstiloView.renderPlantillasEstiloView();
    bindPlantillasEvents(container);
  }

  window.VideoEditorPlantillasEstiloController = {
    renderPlantillasEstiloScreen
  };
})(window, document);
