/* =========================================================
Nombre completo: plantillas-estilo.view.js
Ruta o ubicación: /src/funcionalidades/02-plantillas-estilo/plantillas-estilo.view.js
Función principal:
- Mostrar la pantalla visual de Plantillas de estilo.
- Renderizar tarjetas de estilos disponibles.
- Mantener el panel lateral de 6 pasos visibles.
========================================================= */
(function(window) {
  'use strict';

  function renderPlantillaCard(plantilla) {
    return `
      <button class="plantilla-estilo-card" type="button" data-plantilla-id="${plantilla.id}">
        <span class="plantilla-estilo-top">
          <strong>${plantilla.nombre}</strong>
          <small class="plantilla-estilo-badge">${plantilla.etiqueta}</small>
        </span>
        <p>${plantilla.descripcion}</p>
      </button>
    `;
  }

  function renderPlantillasEstiloView() {
    const service = window.VideoEditorPlantillasEstiloService;
    const plantillas = service.obtenerPlantillas();

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

        <main class="plantillas-estilo-main">
          <section class="plantillas-estilo-wrap">
            <header class="plantillas-estilo-header">
              <div class="plantillas-estilo-title">
                <span>Paso 02</span>
                <strong>Plantillas de estilo</strong>
                <small>Elige el estilo general del video.</small>
              </div>
            </header>

            <div class="plantillas-estilo-grid" data-plantillas-grid>
              ${plantillas.map(renderPlantillaCard).join('')}
            </div>

            <div class="plantillas-estilo-actions">
              <button class="plantillas-estilo-next" type="button" disabled>Continuar</button>
            </div>
          </section>
        </main>
      </section>
    `;
  }

  window.VideoEditorPlantillasEstiloView = {
    renderPlantillasEstiloView,
    renderPlantillaCard
  };
})(window);
