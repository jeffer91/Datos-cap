"use strict";

window.ComplianceComponents = window.ComplianceComponents || {};

(function exposeExportCenter(namespace, documentObject) {
  namespace.selectedSectionIds = function selectedSectionIds() {
    return [...documentObject.querySelectorAll("[data-export-section]:checked")].map((input) => input.dataset.exportSection);
  };

  namespace.readExportOptions = function readExportOptions() {
    return {
      scope: documentObject.querySelector('input[name="exportScope"]:checked')?.value || "SELECTED",
      format: documentObject.querySelector('input[name="exportFormat"]:checked')?.value || "BOTH",
      sectionIds: namespace.selectedSectionIds(),
      includeCharts: documentObject.getElementById("exportIncludeCharts").checked,
      includeTables: documentObject.getElementById("exportIncludeTables").checked,
      includeAnnexes: documentObject.getElementById("exportIncludeAnnexes").checked,
      includeCareerDetail: documentObject.getElementById("exportIncludeCareerDetail").checked,
      includeTrainingDetail: documentObject.getElementById("exportIncludeTrainingDetail").checked,
      includeAlerts: documentObject.getElementById("exportIncludeAlerts").checked
    };
  };
})(window.ComplianceComponents, document);
