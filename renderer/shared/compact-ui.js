/* =========================================================
Nombre completo: compact-ui.js
Ruta o ubicación: /renderer/shared/compact-ui.js
Función o funciones:
- Mantener botones cortos y claros en todos los módulos.
- Conservar el texto original como ayuda emergente.
- Adaptar etiquetas dinámicas sin modificar la lógica de cada pantalla.
========================================================= */
"use strict";

(function initializeCompactUi(windowObject, documentObject) {
  const fixedLabels = Object.freeze({
    btnSelectDocuments: "PDF",
    btnSelectDocumentFolder: "Carpeta",
    btnValidateDocuments: "Validar",
    btnChooseOutput: "Salida",
    btnClearDocuments: "Limpiar",
    btnSelectRoot: "Carpeta",
    btnSelectOutput: "Salida",
    btnRefreshBase: "Actualizar",
    btnOpenBaseFolder: "Carpeta",
    btnApplyBaseFilters: "Filtrar",
    btnRefreshIndividualReport: "Actualizar",
    btnPrepareIndividualReport: "Generar",
    btnApplyIndividualFilters: "Filtrar",
    btnRefreshCompliance: "Actualizar",
    btnRunInternalAnalysis: "Analizar",
    btnOpenAiConfiguration: "IA",
    btnGoToExport: "Generar",
    btnApplyComplianceFilters: "Filtrar",
    btnSaveGuide: "Guardar",
    btnTestGuide: "Probar",
    btnRestoreGuide: "Restaurar",
    btnTestAiChain: "Probar IA",
    btnCancelAiConfiguration: "Cerrar",
    btnSaveAiConfiguration: "Guardar"
  });

  function originalText(element) {
    return String(element?.dataset?.fullLabel || element?.textContent || "").trim();
  }

  function dynamicLabel(id, current) {
    if (id === "btnGenerateDocuments") {
      return /procesando/i.test(current) ? "Procesando..." : "Procesar";
    }
    if (id === "btnScanRoot") {
      return /ejecutando|procesando/i.test(current) ? "Escaneando..." : "Escanear";
    }
    if (id === "btnExportScanPdf") {
      return /generando/i.test(current) ? "Generando..." : "Generar PDF";
    }
    if (id === "btnProcessBatch") {
      if (/procesando/i.test(current)) return "Importando...";
      const count = current.match(/\((\d+)\)/)?.[1];
      return count ? `Importar (${count})` : "Importar";
    }
    if (id === "btnExportCompliance") {
      return /generando/i.test(current) ? "Generando..." : "Generar";
    }
    return "";
  }

  function compactButton(element) {
    if (!element?.id) return;
    const current = String(element.textContent || "").trim();
    const target = fixedLabels[element.id] || dynamicLabel(element.id, current);
    if (!target) return;

    if (!element.dataset.fullLabel && current && current !== target) {
      element.dataset.fullLabel = current;
      element.title = current;
    }
    if (current !== target) element.textContent = target;
  }

  function apply() {
    documentObject.querySelectorAll("button[id]").forEach(compactButton);
  }

  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    windowObject.requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  const observer = new MutationObserver(scheduleApply);
  observer.observe(documentObject.documentElement, {
    subtree: true,
    childList: true,
    characterData: true
  });

  if (documentObject.readyState === "loading") {
    documentObject.addEventListener("DOMContentLoaded", apply, { once: true });
  } else {
    apply();
  }
})(window, document);
