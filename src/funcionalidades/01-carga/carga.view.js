/* =========================================================
Nombre completo: carga.view.js
Ruta o ubicación: /src/funcionalidades/01-carga/carga.view.js
Función principal:
- Renderizar la pantalla mínima de Carga.
- Mostrar panel lateral de 6 pasos visibles.
- Mostrar zona central de carga y botón flotante Continuar.
========================================================= */
(function(window) {
  'use strict';

  function renderPasosLaterales() {
    const stateApi = window.VideoEditorCargaState;
    const pasos = stateApi.obtenerPasosVisibles();

    return pasos.map((paso) => {
      const estado = paso.activo ? 'activo' : paso.completado ? 'completado' : 'pendiente';
      const simbolo = paso.activo ? '●' : paso.completado ? '✓' : '○';
      return `
        <button class="carga-step-item is-${estado}" type="button" data-carga-step="${paso.numero}">
          <span class="carga-step-symbol">${simbolo}</span>
          <span class="carga-step-text">
            <b>${String(paso.numero).padStart(2, '0')}</b>
            <small>${paso.nombre}</small>
          </span>
        </button>
      `;
    }).join('');
  }

  function renderCargaView() {
    const service = window.VideoEditorCargaService;
    const mensaje = service.obtenerMensajeInicial();

    return `
      <section class="carga-screen" data-carga-root>
        <aside class="carga-steps-panel" aria-label="Pasos del editor">
          <div class="carga-brand-mini">
            <strong>Editor</strong>
            <span>Video por capas</span>
          </div>

          <button class="carga-step-nav" type="button" data-carga-action="steps-up" aria-label="Ver pasos anteriores">▲</button>

          <nav class="carga-step-list" data-carga-step-list>
            ${renderPasosLaterales()}
          </nav>

          <button class="carga-step-nav" type="button" data-carga-action="steps-down" aria-label="Ver pasos siguientes">▼</button>
        </aside>

        <main class="carga-main-panel">
          <section class="carga-drop-card" data-carga-drop-zone>
            <input id="cargaVideoInput" type="file" accept="video/*,.mp4,.mov,.m4v,.avi,.mkv,.webm" multiple hidden />
            <div class="carga-drop-icon">＋</div>
            <strong>Cargar videos</strong>
            <span>${mensaje}</span>
            <button class="carga-primary-action" type="button" data-carga-action="choose-files">Elegir videos</button>
          </section>
        </main>

        <button class="carga-floating-next" type="button" data-carga-action="continue" disabled>
          Continuar
        </button>
      </section>
    `;
  }

  window.VideoEditorCargaView = {
    renderCargaView,
    renderPasosLaterales
  };
})(window);
