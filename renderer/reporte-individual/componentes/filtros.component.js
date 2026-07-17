/* =========================================================
Nombre completo: filtros.component.js
Ruta: /renderer/reporte-individual/componentes/filtros.component.js
Función: Leer los filtros de la pantalla Reporte Individual.
========================================================= */
"use strict";

window.IndividualReportComponents = window.IndividualReportComponents || {};
window.IndividualReportComponents.readFilters = function readFilters(documentObject) {
  return {
    query: documentObject.getElementById("individualReportSearch")?.value.trim() || "",
    status: documentObject.getElementById("individualReportStatus")?.value || ""
  };
};
