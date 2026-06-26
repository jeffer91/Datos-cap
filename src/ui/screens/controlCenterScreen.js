(function () {
  function getElement(selector) {
    return document.querySelector(selector);
  }

  function setDiagnostic(message, data = null) {
    const output = getElement('#diagnosticOutput');
    if (!output) return;
    output.textContent = data ? `${message}\n\n${JSON.stringify(data, null, 2)}` : message;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderBase() {
    return `
      <section class="module-card">
        <div class="module-header compact">
          <div>
            <p class="eyebrow">Bloque 13 activo</p>
            <h3>Centro de control</h3>
            <p>Revisa el estado general de Electron, SQLite, biblioteca, comparación y plantillas.</p>
          </div>
          <button id="btnReloadControlCenter" type="button" class="secondary-button">Actualizar</button>
        </div>
      </section>

      <section class="dashboard-grid" id="controlCenterCards">
        <article class="info-card"><h4>App</h4><p>Cargando...</p><span class="card-status pending">Pendiente</span></article>
        <article class="info-card"><h4>Biblioteca</h4><p>Cargando...</p><span class="card-status pending">Pendiente</span></article>
        <article class="info-card"><h4>Comparación</h4><p>Cargando...</p><span class="card-status pending">Pendiente</span></article>
        <article class="info-card"><h4>Plantillas</h4><p>Cargando...</p><span class="card-status pending">Pendiente</span></article>
      </section>

      <section class="module-card">
        <div class="module-header">
          <div>
            <h3>Recomendaciones</h3>
            <p>Acciones sugeridas según el estado de la app.</p>
          </div>
        </div>
        <div id="controlCenterRecommendations" class="empty-state">Cargando recomendaciones...</div>
      </section>
    `;
  }

  function renderStatusBadge(ok) {
    return ok ? '<span class="card-status ready">OK</span>' : '<span class="card-status pending">Revisar</span>';
  }

  function renderCards(snapshot) {
    const container = getElement('#controlCenterCards');
    if (!container) return;

    const appOk = Boolean(snapshot.app?.ok);
    const libraryOk = Boolean(snapshot.library?.ok);
    const comparisonOk = Boolean(snapshot.comparison?.ok);
    const templatesOk = Boolean(snapshot.templates?.ok);

    container.innerHTML = `
      <article class="info-card">
        <h4>App base</h4>
        <p>${escapeHtml(snapshot.app?.message || 'Estado de app consultado.')}</p>
        ${renderStatusBadge(appOk)}
      </article>
      <article class="info-card">
        <h4>Biblioteca</h4>
        <p>Videos: ${escapeHtml(snapshot.library?.counts?.videos || 0)} · Análisis: ${escapeHtml(snapshot.library?.counts?.analyses || 0)} · Plantillas: ${escapeHtml(snapshot.library?.counts?.templates || 0)}</p>
        ${renderStatusBadge(libraryOk)}
      </article>
      <article class="info-card">
        <h4>Comparación</h4>
        <p>${escapeHtml(snapshot.comparison?.status || 'Sin estado')} · ${escapeHtml(snapshot.comparison?.features?.length || 0)} funciones</p>
        ${renderStatusBadge(comparisonOk)}
      </article>
      <article class="info-card">
        <h4>Plantillas</h4>
        <p>${escapeHtml(snapshot.templates?.status || 'Sin estado')} · ${escapeHtml(snapshot.templates?.features?.length || 0)} funciones</p>
        ${renderStatusBadge(templatesOk)}
      </article>
    `;
  }

  function buildRecommendations(snapshot) {
    const items = [];

    if (!snapshot.app?.ok) items.push('Revisar inicialización general de la app.');
    if ((snapshot.library?.counts?.analyses || 0) === 0) items.push('Procesar al menos un video para alimentar biblioteca y comparación.');
    if ((snapshot.library?.counts?.templates || 0) === 0) items.push('Crear una primera plantilla maestra desde análisis guardados.');
    if (!snapshot.comparison?.ok) items.push('Revisar el módulo de comparación.');
    if (!snapshot.templates?.ok) items.push('Revisar el módulo de plantillas.');
    if (!items.length) items.push('El sistema base está listo para seguir con reportes, comparación avanzada y mejoras de procesamiento.');

    return items;
  }

  function renderRecommendations(items = []) {
    const container = getElement('#controlCenterRecommendations');
    if (!container) return;

    container.innerHTML = items.map((item) => `<p>• ${escapeHtml(item)}</p>`).join('');
  }

  async function loadControlCenter() {
    const snapshot = {};

    try {
      snapshot.app = await window.videoAuditor.app.diagnostic();
    } catch (error) {
      snapshot.app = { ok: false, message: error.message };
    }

    try {
      snapshot.library = await window.videoAuditor.library.getSummary();
    } catch (error) {
      snapshot.library = { ok: false, message: error.message, counts: { videos: 0, analyses: 0, templates: 0 } };
    }

    try {
      snapshot.comparison = await window.videoAuditor.comparison.diagnostic();
    } catch (error) {
      snapshot.comparison = { ok: false, message: error.message };
    }

    try {
      snapshot.templates = await window.videoAuditor.templates.diagnostic();
    } catch (error) {
      snapshot.templates = { ok: false, message: error.message };
    }

    snapshot.generatedAt = new Date().toISOString();

    renderCards(snapshot);
    renderRecommendations(buildRecommendations(snapshot));
    setDiagnostic('Centro de control actualizado.', snapshot);
  }

  function bindEvents() {
    const button = getElement('#btnReloadControlCenter');
    if (button) button.addEventListener('click', loadControlCenter);
  }

  async function renderControlCenterScreen(container) {
    if (!container) return;
    container.innerHTML = renderBase();
    bindEvents();
    await loadControlCenter();
  }

  window.VideoAuditorScreens = window.VideoAuditorScreens || {};
  window.VideoAuditorScreens.renderControlCenterScreen = renderControlCenterScreen;
})();
