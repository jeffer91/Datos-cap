/* =========================================================
Nombre completo: plantillas-estilo.controller.js
Ruta o ubicación: /src/funcionalidades/02-plantillas-estilo/plantillas-estilo.controller.js
Función principal:
- Montar la pantalla visual de Plantillas de estilo.
- Mantener navegación lateral de 6 pasos visibles.
- Preparar eventos base para selección real en el siguiente bloque.
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

    container.querySelectorAll('[data-plantilla-id]').forEach((boton) => {
      boton.addEventListener('click', () => {
        container.querySelectorAll('[data-plantilla-id]').forEach((item) => item.classList.remove('is-selected'));
        boton.classList.add('is-selected');
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
