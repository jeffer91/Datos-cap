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
            <p class="eyebrow">Bloque 20 activo</p>
            <h3>Biblioteca local y reportes rápidos</h3>
            <p>Consulta análisis generados y crea reportes rápidos HTML/TXT desde cada análisis.</p>
          </div>
          <button id="btnReloadLibrary" type="button" class="secondary-button">Actualizar</button>
        </div>
      </section>

      <section class="dashboard-grid" id="librarySummaryGrid">
        <article class="info-card"><h4>Videos</h4><p>Cargando...</p><span class="card-status pending">...</span></article>
        <article class="info-card"><h4>Análisis</h4><p>Cargando...</p><span class="card-status pending">...</span></article>
        <article class="info-card"><h4>Plantillas</h4><p>Cargando...</p><span class="card-status pending">...</span></article>
      </section>

      <section class="module-card">
        <div class="module-header compact">
          <div>
            <h3>Análisis guardados</h3>
            <p>Historial local registrado en SQLite.</p>
          </div>
        </div>
        <div id="libraryAnalysesContainer" class="analysis-list">Cargando análisis...</div>
      </section>
    `;
  }

  function renderSummary(summary) {
    const container = getElement('#librarySummaryGrid');
    if (!container) return;

    const counts = summary?.counts || { videos: 0, analyses: 0, templates: 0 };

    container.innerHTML = `
      <article class="info-card"><h4>Videos</h4><p>${escapeHtml(counts.videos)} registrados</p><span class="card-status ready">OK</span></article>
      <article class="info-card"><h4>Análisis</h4><p>${escapeHtml(counts.analyses)} generados</p><span class="card-status ready">OK</span></article>
      <article class="info-card"><h4>Plantillas</h4><p>${escapeHtml(counts.templates)} guardadas</p><span class="card-status ready">OK</span></article>
    `;
  }

  function renderAnalyses(analyses = []) {
    if (!analyses.length) {
      return '<div class="empty-state">Todavía no hay análisis guardados. Procesa un video primero.</div>';
    }

    return analyses.map((analysis) => `
      <article class="analysis-card">
        <div class="analysis-main">
          <div class="analysis-topline">
            <span class="mini-badge ready">${escapeHtml(analysis.status || 'analysis')}</span>
            <span class="analysis-date">${escapeHtml(analysis.created_at || '')}</span>
          </div>
          <h4>${escapeHtml(analysis.video_original_name || analysis.local_id)}</h4>
          <p><strong>Creador:</strong> ${escapeHtml(analysis.creator_name || 'Sin creador')} · <strong>Estilo:</strong> ${escapeHtml(analysis.style_name || 'Sin estilo')}</p>
          <p>${escapeHtml(analysis.summary || 'Sin resumen disponible.')}</p>
          <p>Cortes: ${escapeHtml(analysis.cut_count || 0)} · Frames: ${escapeHtml(analysis.frame_count || 0)} · Pausas: ${escapeHtml(analysis.silence_count || 0)}</p>
        </div>
        <div class="analysis-actions">
          <button class="primary-button small-button btn-create-quick-report" data-id="${escapeHtml(analysis.local_id)}">Crear reporte</button>
          <button class="secondary-button small-button btn-analysis-detail" data-id="${escapeHtml(analysis.local_id)}">Detalle</button>
          <button class="secondary-button small-button btn-open-analysis-json" data-path="${escapeHtml(analysis.analysis_json_path || '')}">Abrir JSON</button>
          <button class="secondary-button small-button btn-open-report" data-path="${escapeHtml(analysis.pdf_report_path || '')}" ${analysis.pdf_report_path ? '' : 'disabled'}>Abrir HTML</button>
          <button class="secondary-button small-button btn-open-report" data-path="${escapeHtml(analysis.txt_report_path || '')}" ${analysis.txt_report_path ? '' : 'disabled'}>Abrir TXT</button>
        </div>
      </article>
    `).join('');
  }

  function bindAnalysisButtons() {
    document.querySelectorAll('.btn-analysis-detail').forEach((button) => {
      button.addEventListener('click', async () => {
        const detail = await window.videoAuditor.library.getAnalysisDetails(button.dataset.id);
        setDiagnostic('Detalle del análisis.', detail);
      });
    });

    document.querySelectorAll('.btn-open-analysis-json').forEach((button) => {
      button.addEventListener('click', async () => {
        const opened = await window.videoAuditor.fileSystem.openPath(button.dataset.path);
        setDiagnostic('Apertura de JSON técnico.', opened);
      });
    });

    document.querySelectorAll('.btn-open-report').forEach((button) => {
      button.addEventListener('click', async () => {
        const opened = await window.videoAuditor.fileSystem.openPath(button.dataset.path);
        setDiagnostic('Apertura de reporte.', opened);
      });
    });

    document.querySelectorAll('.btn-create-quick-report').forEach((button) => {
      button.addEventListener('click', async () => {
        const result = await window.videoAuditor.quickReport.create(button.dataset.id);
        setDiagnostic('Reporte rápido generado.', result);
        await loadLibrary();
      });
    });
  }

  async function loadLibrary() {
    const summary = await window.videoAuditor.library.getSummary();
    renderSummary(summary);

    const result = await window.videoAuditor.library.listAnalyses({});
    const container = getElement('#libraryAnalysesContainer');
    if (container) container.innerHTML = renderAnalyses(result.analyses || []);

    bindAnalysisButtons();

    setDiagnostic('Biblioteca cargada.', { summary, analyses: result.total });
  }

  function bindEvents() {
    getElement('#btnReloadLibrary')?.addEventListener('click', loadLibrary);
  }

  async function renderLibraryScreen(container) {
    if (!container) return;
    container.innerHTML = renderBase();
    bindEvents();
    await loadLibrary();
  }

  window.VideoAuditorScreens = window.VideoAuditorScreens || {};
  window.VideoAuditorScreens.renderLibraryScreen = renderLibraryScreen;
})();
