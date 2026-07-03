/* =========================================================
Nombre completo: carga.controller.js
Ruta o ubicación: /src/funcionalidades/01-carga/carga.controller.js
Función principal:
- Montar la pantalla Carga en el contenedor principal.
- Conectar navegación lateral de 6 pasos visibles.
- Cargar uno o varios videos y ejecutar análisis básico.
========================================================= */
(function(window, document) {
  'use strict';

  function actualizarPasos(container) {
    const lista = container.querySelector('[data-carga-step-list]');
    if (!lista || !window.VideoEditorCargaView) return;
    lista.innerHTML = window.VideoEditorCargaView.renderPasosLaterales();
  }

  function renderizarPantalla(container) {
    container.innerHTML = window.VideoEditorCargaView.renderCargaView();
    bindCargaEvents(container);
  }

  async function procesarArchivos(container, archivos) {
    const stateApi = window.VideoEditorCargaState;
    const service = window.VideoEditorCargaService;

    try {
      stateApi.iniciarCarga();
      renderizarPantalla(container);

      const videos = await service.analizarVideos(archivos);
      stateApi.guardarVideosAnalizados(videos);
      stateApi.finalizarCarga();
      renderizarPantalla(container);
    } catch (error) {
      stateApi.guardarError(error.message);
      renderizarPantalla(container);
    }
  }

  function bindCargaEvents(container) {
    const input = container.querySelector('#cargaVideoInput');
    const dropZone = container.querySelector('[data-carga-drop-zone]');

    container.querySelectorAll('[data-carga-action]').forEach((elemento) => {
      elemento.addEventListener('click', () => {
        const action = elemento.dataset.cargaAction;

        if (action === 'choose-files' && input) {
          input.click();
          return;
        }

        if (action === 'steps-up') {
          window.VideoEditorCargaState.moverVentanaPasos(-1);
          actualizarPasos(container);
          return;
        }

        if (action === 'steps-down') {
          window.VideoEditorCargaState.moverVentanaPasos(1);
          actualizarPasos(container);
          return;
        }

        if (action === 'continue') {
          return;
        }
      });
    });

    if (input) {
      input.addEventListener('change', () => {
        if (input.files && input.files.length) {
          procesarArchivos(container, input.files);
        }
      });
    }

    if (dropZone) {
      dropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropZone.classList.add('is-dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('is-dragover');
      });

      dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropZone.classList.remove('is-dragover');

        if (event.dataTransfer?.files?.length) {
          procesarArchivos(container, event.dataTransfer.files);
        }
      });
    }
  }

  function renderCargaScreen(container) {
    if (!container || !window.VideoEditorCargaView) return;
    document.body.classList.add('editor-carga-activa');
    renderizarPantalla(container);
  }

  window.VideoEditorCargaController = {
    renderCargaScreen
  };
})(window, document);
