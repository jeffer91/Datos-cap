/* =========================================================
Nombre completo: procesamientos.view.js
Ruta o ubicación: /renderer/base/vistas/procesamientos.view.js
Función o funciones:
- Renderizar el historial de procesamientos de la base local.
========================================================= */
"use strict";

window.BaseViews = window.BaseViews || {};
window.BaseViews.procesamientos = function renderProcesamientos(container, runs) {
  window.AppUI.renderGenericTable(container, runs || [], {
    columns: [
      "fecha_fin", "nombre_tipo_documental", "documentos_recibidos", "documentos_guardados",
      "documentos_duplicados_omitidos", "filas_guardadas", "paginas_ocr", "estado",
      "carpeta_salida", "mensaje_error"
    ],
    labels: {
      fecha_fin: "Fecha",
      nombre_tipo_documental: "Tipo",
      documentos_recibidos: "Recibidos",
      documentos_guardados: "Guardados",
      documentos_duplicados_omitidos: "Duplicados",
      filas_guardadas: "Filas",
      paginas_ocr: "Páginas OCR",
      estado: "Estado",
      carpeta_salida: "Salida",
      mensaje_error: "Error"
    },
    badgeColumns: ["estado"],
    emptyText: "Todavía no existen procesamientos registrados."
  });
};
