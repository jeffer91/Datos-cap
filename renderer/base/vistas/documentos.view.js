/* =========================================================
Nombre completo: documentos.view.js
Ruta o ubicación: /renderer/base/vistas/documentos.view.js
Función o funciones:
- Renderizar una fila por PDF guardado en la base local.
========================================================= */
"use strict";

window.BaseViews = window.BaseViews || {};
window.BaseViews.documentos = function renderDocumentos(container, documents) {
  window.AppUI.renderGenericTable(container, documents || [], {
    columns: [
      "fecha_registro", "nombre_tipo_documental", "nombre_archivo", "codigo_documento",
      "periodo", "docente", "capacitacion", "metodo_extraccion", "paginas_ocr",
      "confianza_ocr", "requiere_revision"
    ],
    labels: {
      fecha_registro: "Fecha",
      nombre_tipo_documental: "Tipo",
      nombre_archivo: "Archivo",
      codigo_documento: "Código",
      periodo: "Periodo",
      docente: "Docente",
      capacitacion: "Capacitación",
      metodo_extraccion: "Lectura",
      paginas_ocr: "Páginas OCR",
      confianza_ocr: "Confianza",
      requiere_revision: "Revisión"
    },
    badgeColumns: ["metodo_extraccion", "requiere_revision"],
    emptyText: "No existen documentos que coincidan con los filtros."
  });
};
