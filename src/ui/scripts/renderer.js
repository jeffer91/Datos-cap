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
        <p class="eyebrow">Video Auditor App</p>
        <h3>Base local subida a GitHub</h3>
        <p>Proyecto Electron local, modular, con SQLite y estructura para análisis de videos.</p>
      </div>
      <div class="hero-badge"><span>LOCAL</span><strong>PC</strong></div>
    </section>
    <section class="dashboard-grid">
      <article class="info-card"><h4>Electron</h4><p>Ventana principal lista.</p><span class="card-status ready">Activo</span></article>
      <article class="info-card"><h4>SQLite</h4><p>Base local preparada.</p><span class="card-status ready">Activo</span></article>
      <article class="info-card"><h4>Módulos</h4><p>Estructura modular inicial.</p><span class="card-status ready">Base</span></article>
    </section>`;
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
      getElement('#screenTitle').textContent = button.textContent;
      if (button.dataset.screen === 'inicio') renderHomeScreen();
      else getElement('#screenContainer').innerHTML = '<section class="module-card"><div class="empty-state">Módulo preparado para próximos bloques.</div></section>';
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  renderHomeScreen();
  await testElectronConnection();
});
