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

  function renderTemplatesBase() {
    return `
      <section class="module-card">
        <div class="module-header compact">
          <div>
            <p class="eyebrow">Bloque 12 activo</p>
            <h3>Plantillas maestras por estilo</h3>
            <p>Crea plantillas reutilizables a partir de uno o varios análisis guardados.</p>
          </div>
          <button id="btnReloadTemplates" type="button" class="secondary-button">Actualizar</button>
        </div>
      </section>

      <section class="module-card">
        <div class="module-header compact">
          <div>
            <h3>Análisis fuente</h3>
            <p>Selecciona análisis para construir una plantilla maestra.</p>
          </div>
          <button id="btnCreateTemplate" type="button" class="primary-button">Crear plantilla</button>
        </div>
        <input id="templateNameInput" type="text" placeholder="Nombre opcional de la plantilla" />
        <div id="templateSourceAnalyses" class="analysis-list">Cargando análisis...</div>
      </section>

      <section class="module-card">
        <div class="module-header compact">
          <div>
            <h3>Plantillas guardadas</h3>
            <p>Historial local de plantillas generadas.</p>
          </div>
        </div>
        <div id="templatesListContainer" class="analysis-list">Cargando plantillas...</div>
      </section>
    `;
  }

  function renderAnalysisOptions(analyses = []) {
    if (!analyses.length) return '<div class="empty-state">No hay análisis disponibles.</div>';
    return analyses.map((analysis) => `
      <label class="comparison-option">
        <input type="checkbox" class="template-analysis-checkbox" value="${escapeHtml(analysis.local_id)}" />
        <div>
          <strong>${escapeHtml(analysis.video_original_name || analysis.local_id)}</strong>
          <p>Creador: ${escapeHtml(analysis.creator_name || 'Sin creador')} · Estilo: ${escapeHtml(analysis.style_name || 'Sin estilo')}</p>
          <small>Cortes: ${escapeHtml(analysis.cut_count || 0)} · Silencios: ${escapeHtml(analysis.silence_count || 0)} · Secciones: ${escapeHtml(analysis.section_count || 0)}</small>
        </div>
      </label>
    `).join('');
  }

  function renderTemplates(templates = []) {
    if (!templates.length) return '<div class="empty-state">Todavía no hay plantillas creadas.</div>';
    return templates.map((template) => `
      <article class="analysis-card">
        <div class="analysis-main">
          <div class="analysis-topline"><span class="mini-badge ready">${escapeHtml(template.status || 'active')}</span></div>
          <h4>${escapeHtml(template.template_name)}</h4>
          <p><strong>Estilo:</strong> ${escapeHtml(template.style_name || 'Sin estilo')}</p>
          <p>${escapeHtml(template.description || 'Plantilla generada localmente.')}</p>
          <small>${escapeHtml(template.created_at || '')}</small>
        </div>
        <div class="analysis-actions">
          <button class="secondary-button small-button btn-open-template" data-path="${escapeHtml(template.template_txt_path || '')}">Abrir TXT</button>
          <button class="secondary-button small-button btn-open-template" data-path="${escapeHtml(template.template_json_path || '')}">Abrir JSON</button>
        </div>
      </article>
    `).join('');
  }

  async function loadSourceAnalyses() {
    const container = getElement('#templateSourceAnalyses');
    if (!container) return;
    const result = await window.videoAuditor.comparison.listAnalyses(50);
    container.innerHTML = renderAnalysisOptions(result.analyses || []);
  }

  async function loadTemplates() {
    const container = getElement('#templatesListContainer');
    if (!container) return;
    const result = await window.videoAuditor.templates.list({});
    container.innerHTML = renderTemplates(result.templates || []);
    document.querySelectorAll('.btn-open-template').forEach((button) => {
      button.addEventListener('click', async () => {
        const opened = await window.videoAuditor.fileSystem.openPath(button.dataset.path);
        setDiagnostic('Apertura de plantilla.', opened);
      });
    });
  }

  async function createTemplate() {
    const selected = Array.from(document.querySelectorAll('.template-analysis-checkbox:checked')).map((input) => input.value);
    const name = getElement('#templateNameInput')?.value || '';

    if (!selected.length) {
      setDiagnostic('Selecciona al menos un análisis para crear una plantilla.');
      return;
    }

    const result = await window.videoAuditor.templates.createMaster({ analysisIds: selected, name });
    setDiagnostic('Resultado de creación de plantilla.', result);
    await loadTemplates();
  }

  function bindTemplateEvents() {
    const reload = getElement('#btnReloadTemplates');
    const create = getElement('#btnCreateTemplate');
    if (reload) reload.addEventListener('click', async () => { await loadSourceAnalyses(); await loadTemplates(); });
    if (create) create.addEventListener('click', createTemplate);
  }

  async function renderTemplatesScreen(container) {
    if (!container) return;
    container.innerHTML = renderTemplatesBase();
    bindTemplateEvents();
    await loadSourceAnalyses();
    await loadTemplates();
  }

  window.VideoAuditorScreens = window.VideoAuditorScreens || {};
  window.VideoAuditorScreens.renderTemplatesScreen = renderTemplatesScreen;
})();
