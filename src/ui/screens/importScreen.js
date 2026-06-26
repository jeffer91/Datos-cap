(function () {
  let selectedVideoPath = '';

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
            <p class="eyebrow">Bloque 19 activo</p>
            <h3>Importar y procesar video</h3>
            <p>Selecciona un video local, registra sus datos y procésalo con el motor FFmpeg real.</p>
          </div>
          <button id="btnReloadImportedVideos" type="button" class="secondary-button">Actualizar</button>
        </div>
      </section>

      <section class="module-card">
        <div class="module-header">
          <div>
            <h3>Nuevo video</h3>
            <p>El video se registra en SQLite y luego puede procesarse.</p>
          </div>
        </div>

        <div class="file-picker-row">
          <input id="selectedVideoPath" type="text" readonly placeholder="Selecciona un video" />
          <button id="btnSelectVideo" type="button" class="secondary-button">Seleccionar</button>
        </div>

        <form id="importVideoForm" class="form-grid">
          <div>
            <label>Creador / youtuber</label>
            <input id="creatorName" type="text" placeholder="Ejemplo: El Zone" />
          </div>
          <div>
            <label>Estilo</label>
            <select id="styleName"></select>
          </div>
          <div>
            <label>Tema</label>
            <input id="topic" type="text" placeholder="Ejemplo: análisis fútbol" />
          </div>
          <div>
            <label>Objetivo</label>
            <input id="objective" type="text" placeholder="Qué quieres aprender del estilo" />
          </div>
          <div class="form-full">
            <label>Notas</label>
            <input id="notes" type="text" placeholder="Notas internas" />
          </div>
          <div class="form-actions form-full">
            <button type="submit" class="primary-button">Importar a biblioteca</button>
          </div>
        </form>
      </section>

      <section class="module-card">
        <div class="module-header compact">
          <div>
            <h3>Videos importados</h3>
            <p>Procesa un video para generar metadatos, audio, frames, cortes y pausas.</p>
          </div>
        </div>
        <div id="importedVideosContainer" class="analysis-list">Cargando videos...</div>
      </section>
    `;
  }

  function renderStyleOptions(styles = []) {
    const select = getElement('#styleName');
    if (!select) return;
    select.innerHTML = styles.map((style) => `<option value="${escapeHtml(style)}">${escapeHtml(style)}</option>`).join('');
  }

  function renderVideos(videos = []) {
    if (!videos.length) {
      return '<div class="empty-state">Todavía no hay videos importados.</div>';
    }

    return videos.map((video) => `
      <article class="analysis-card">
        <div class="analysis-main">
          <div class="analysis-topline">
            <span class="mini-badge ready">${escapeHtml(video.status || 'imported')}</span>
            <span class="analysis-date">${escapeHtml(video.created_at || '')}</span>
          </div>
          <h4>${escapeHtml(video.original_name || video.local_id)}</h4>
          <p><strong>Creador:</strong> ${escapeHtml(video.creator_name || 'Sin creador')} · <strong>Estilo:</strong> ${escapeHtml(video.style_name || 'Sin estilo')}</p>
          <p><strong>Tema:</strong> ${escapeHtml(video.topic || 'Sin tema')}</p>
          <small>${escapeHtml(video.local_video_path || video.source_path || '')}</small>
        </div>
        <div class="analysis-actions">
          <button class="primary-button small-button btn-process-video" data-video-id="${escapeHtml(video.local_id)}">Procesar</button>
          <button class="secondary-button small-button btn-open-video" data-path="${escapeHtml(video.local_video_path || video.source_path || '')}">Abrir</button>
        </div>
      </article>
    `).join('');
  }

  async function loadOptions() {
    const result = await window.videoAuditor.videoImport.getOptions();
    if (result.ok) renderStyleOptions(result.styles || []);
  }

  async function loadVideos() {
    const container = getElement('#importedVideosContainer');
    if (!container) return;
    container.innerHTML = 'Cargando videos...';

    const result = await window.videoAuditor.videoImport.listRecentVideos(20);
    container.innerHTML = renderVideos(result.videos || []);

    document.querySelectorAll('.btn-process-video').forEach((button) => {
      button.addEventListener('click', async () => {
        await processVideo(button.dataset.videoId);
      });
    });

    document.querySelectorAll('.btn-open-video').forEach((button) => {
      button.addEventListener('click', async () => {
        const result = await window.videoAuditor.fileSystem.openPath(button.dataset.path);
        setDiagnostic('Apertura de video.', result);
      });
    });
  }

  async function selectVideo() {
    const result = await window.videoAuditor.fileSystem.selectVideo();

    if (!result.ok || result.canceled) {
      setDiagnostic('Selección de video cancelada.', result);
      return;
    }

    selectedVideoPath = result.filePath;
    getElement('#selectedVideoPath').value = selectedVideoPath;
    setDiagnostic('Video seleccionado.', result);
  }

  async function importVideo(event) {
    event.preventDefault();

    const payload = {
      sourcePath: selectedVideoPath,
      creatorName: getElement('#creatorName')?.value || '',
      styleName: getElement('#styleName')?.value || 'Otro',
      topic: getElement('#topic')?.value || '',
      objective: getElement('#objective')?.value || '',
      notes: getElement('#notes')?.value || ''
    };

    const result = await window.videoAuditor.videoImport.importVideo(payload);
    setDiagnostic('Resultado de importación.', result);
    await loadVideos();
  }

  async function processVideo(videoLocalId) {
    setDiagnostic('Procesando video con FFmpeg real...', { videoLocalId });

    const result = await window.videoAuditor.mediaProcessing.processVideo({
      videoLocalId,
      analysisMode: 'local'
    });

    setDiagnostic('Resultado de procesamiento.', result);
    await loadVideos();
  }

  function bindEvents() {
    getElement('#btnSelectVideo')?.addEventListener('click', selectVideo);
    getElement('#importVideoForm')?.addEventListener('submit', importVideo);
    getElement('#btnReloadImportedVideos')?.addEventListener('click', loadVideos);
  }

  async function renderImportScreen(container) {
    if (!container) return;
    container.innerHTML = renderBase();
    bindEvents();
    await loadOptions();
    await loadVideos();
  }

  window.VideoAuditorScreens = window.VideoAuditorScreens || {};
  window.VideoAuditorScreens.renderImportScreen = renderImportScreen;
})();
