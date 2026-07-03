/* =========================================================
Nombre completo: plantillas-estilo.view.js
Ruta o ubicación: /src/funcionalidades/02-plantillas-estilo/plantillas-estilo.view.js
Función principal:
- Mostrar una pantalla mínima para el paso Plantillas de estilo.
- Servir como destino real del botón Continuar desde Carga.
- Mantener el panel lateral de 6 pasos visibles.
========================================================= */
(function(window) {
  'use strict';

  function renderPlantillasEstiloView() {
    return `
      <section class="carga-screen plantillas-estilo-screen" data-plantillas-estilo-root>
        <aside class="carga-steps-panel" aria-label="Pasos del editor">
          <div class="carga-brand-mini">
            <strong>Editor</strong>
            <span>Video por capas</span>
          </div>

          <button class="carga-step-nav" type="button" data-plantillas-action="steps-up" aria-label="Ver pasos anteriores">▲</button>

          <nav class="carga-step-list" data-carga-step-list>
            ${window.VideoEditorCargaView.renderPasosLaterales()}
          </nav>

          <button class="carga-step-nav" type="button" data-plantillas-action="steps-down" aria-label="Ver pasos siguientes">▼</button>
        </aside>

        <main class="carga-main-panel">
          <section class="carga-drop-card plantillas-estilo-card">
            <div class="carga-drop-icon">✦</div>
            <strong>Plantillas de estilo</strong>
            <span>Pantalla lista para el siguiente bloque.</span>
          </section>
        </main>
      </section>
    `;
  }

  window.VideoEditorPlantillasEstiloView = {
    renderPlantillasEstiloView
  };
})(window);
