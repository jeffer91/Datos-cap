/* =========================================================
Nombre completo: menu.js
Ruta o ubicación: /renderer/shared/menu.js
Función o funciones:
- Construir el menú superior compartido.
- Marcar la página activa y mostrar la versión instalada.
========================================================= */
"use strict";

(function initializeSharedMenu(windowObject, documentObject) {
  async function renderMenu() {
    const root = documentObject.querySelector("[data-menu-root]");
    if (!root) return;
    const active = documentObject.body.dataset.activeMenu || "documentos";
    root.innerHTML = `
      <header class="app-menu">
        <div class="app-brand">
          <strong>Gestor de Capacitación</strong>
        </div>
        <nav class="app-nav" aria-label="Navegación principal">
          <a class="${active === "documentos" ? "active" : ""}" href="../documentos/documentos.html">Documentos</a>
          <a class="${active === "importacion-masiva" ? "active" : ""}" href="../importacion-masiva/importacion-masiva.html">SCAN</a>
          <a class="${active === "base" ? "active" : ""}" href="../base/base.html">Base</a>
          <a class="${active === "reporte-individual" ? "active" : ""}" href="../reporte-individual/reporte-individual.html">Docentes</a>
          <a class="${active === "informe-cumplimiento" ? "active" : ""}" href="../informe-cumplimiento/informe-cumplimiento.html">Informe</a>
        </nav>
        <div class="app-version" id="sharedAppVersion">...</div>
      </header>`;

    try {
      const info = await windowObject.documentAppAPI.getAppInfo();
      const version = documentObject.getElementById("sharedAppVersion");
      if (version) version.textContent = `v${info.version}`;
    } catch (_error) {
      const version = documentObject.getElementById("sharedAppVersion");
      if (version) version.textContent = "—";
    }
  }

  if (documentObject.readyState === "loading") documentObject.addEventListener("DOMContentLoaded", renderMenu, { once: true });
  else renderMenu();
})(window, document);
