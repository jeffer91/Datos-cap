function getElement(selector) {
  return document.querySelector(selector);
}

function setDiagnostic(message, data = null) {
  const output = getElement('#diagnosticOutput');
  if (!output) return;
  output.textContent = data ? `${message}\n\n${JSON.stringify(data, null, 2)}` : message;
}

function setElectronStatus(ok, text) {
  const statusText = getElement('#electronStatus');
  const statusDot = getElement('.status-dot');
  if (statusText) statusText.textContent = text;
  if (statusDot) statusDot.classList.toggle('ok', Boolean(ok));
}

function renderHomeScreen() {
  const container = getElement('#screenContainer');
  container.innerHTML = `
    <section class="hero-card">
      <div>
        <p class="eyebrow">Bloque 12 activo</p>
        <h3>Plantillas maestras por estilo</h3>
        <p>La app ya tiene base local, comparación y generación de plantillas maestras reutilizables.</p>
      </div>
      <div class="hero-badge"><span>STYLE</span><strong>TPL</strong></div>
    </section>
    <section class="dashboard-grid">
      <article class="info-card"><h4>Electron</h4><p>Ventana principal lista.</p><span class="card-status ready">Activo</span></article>
      <article class="info-card"><h4>SQLite</h4><p>Base local preparada.</p><span class="card-status ready">Activo</span></article>
      <article class="info-card"><h4>Comparación</h4><p>Compara análisis y detecta patrones.</p><span class="card-status ready">Activo</span></article>
      <article class="info-card"><h4>Plantillas</h4><p>Crea JSON/TXT de plantillas maestras.</p><span class="card-status ready">Activo</span></article>
    </section>`;
}

function renderPlaceholderScreen() {
  getElement('#screenContainer').innerHTML = '<section class="module-card"><div class="empty-state">Módulo preparado para próximos bloques.</div></section>';
}

async function changeScreen(screenName, title) {
  getElement('#screenTitle').textContent = title;

  if (screenName === 'inicio') {
    renderHomeScreen();
    setDiagnostic('Inicio cargado.');
    return;
  }

  if (screenName === 'comparacion' && window.VideoAuditorScreens?.renderComparisonScreen) {
    await window.VideoAuditorScreens.renderComparisonScreen(getElement('#screenContainer'));
    return;
  }

  if (screenName === 'plantillas' && window.VideoAuditorScreens?.renderTemplatesScreen) {
    await window.VideoAuditorScreens.renderTemplatesScreen(getElement('#screenContainer'));
    return;
  }

  if (screenName === 'diagnostico') {
    const app = await window.videoAuditor.app.diagnostic();
    const comparison = await window.videoAuditor.comparison.diagnostic();
    const templates = await window.videoAuditor.templates.diagnostic();
    renderPlaceholderScreen();
    setDiagnostic('Diagnóstico general.', { app, comparison, templates });
    return;
  }

  renderPlaceholderScreen();
  setDiagnostic(`Pantalla seleccionada: ${title}`);
}

async function testElectronConnection() {
  try {
    const result = await window.videoAuditor.system.ping();
    setElectronStatus(true, 'Electron conectado');
    setDiagnostic('Conexión correcta con Electron.', result);
  } catch (error) {
    setElectronStatus(false, 'Error de conexión');
    setDiagnostic('Error al probar conexión.', { message: error.message });
  }
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      changeScreen(button.dataset.screen, button.textContent);
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  renderHomeScreen();
  await testElectronConnection();
});
