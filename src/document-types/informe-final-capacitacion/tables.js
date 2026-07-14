/* =========================================================
Nombre completo: tables.js
Ruta o ubicación: /src/document-types/informe-final-capacitacion/tables.js
Función o funciones:
- Construir nueve tablas relacionadas de los Informes Finales.
- Resumir advertencias, revisiones y diferencias documentales.
========================================================= */
"use strict";

const TABLE_NAMES = Object.freeze({
  archivos: "archivos_informe_final",
  datos: "datos_generales_informe",
  objetivos: "objetivos_informe",
  participantes: "participantes_informe",
  certificados: "certificados_informe",
  resumenCertificados: "resumen_certificados_informe",
  responsables: "responsables_informe",
  anexos: "anexos_informe",
  ocrPaginas: "ocr_paginas_informe"
});

function parsedDocuments(input) {
  if (Array.isArray(input)) return input;
  return input && Array.isArray(input.parsed) ? input.parsed : [];
}

function validateRows(rows, requiredFields) {
  const warnings = [];
  (rows || []).forEach((row, index) => {
    requiredFields.forEach((field) => {
      if (row?.[field] === "" || row?.[field] == null) warnings.push(`Fila ${index + 1}: falta ${field}.`);
    });
  });
  return {
    ok: warnings.length === 0,
    totalRows: (rows || []).length,
    warningCount: warnings.length,
    warnings
  };
}

function buildTables(input) {
  const documents = parsedDocuments(input);
  const tables = {
    [TABLE_NAMES.archivos]: documents.map((doc) => doc.archivo),
    [TABLE_NAMES.datos]: documents.map((doc) => doc.datos_generales),
    [TABLE_NAMES.objetivos]: documents.map((doc) => doc.objetivos),
    [TABLE_NAMES.participantes]: documents.flatMap((doc) => doc.participantes || []),
    [TABLE_NAMES.certificados]: documents.flatMap((doc) => doc.certificados || []),
    [TABLE_NAMES.resumenCertificados]: documents.map((doc) => doc.resumen_certificados).filter(Boolean),
    [TABLE_NAMES.responsables]: documents.flatMap((doc) => doc.responsables || []),
    [TABLE_NAMES.anexos]: documents.flatMap((doc) => doc.anexos || []),
    [TABLE_NAMES.ocrPaginas]: documents.flatMap((doc) => doc.ocr_paginas || [])
  };

  const validations = {
    [TABLE_NAMES.archivos]: validateRows(tables[TABLE_NAMES.archivos], ["id_documento", "nombre_archivo"]),
    [TABLE_NAMES.datos]: validateRows(tables[TABLE_NAMES.datos], ["id_documento", "nombre_capacitacion"]),
    [TABLE_NAMES.objetivos]: validateRows(tables[TABLE_NAMES.objetivos], ["id_documento", "objetivo_general"]),
    [TABLE_NAMES.participantes]: validateRows(tables[TABLE_NAMES.participantes], ["id_documento", "nombres_apellidos", "cedula"]),
    [TABLE_NAMES.certificados]: validateRows(tables[TABLE_NAMES.certificados], ["id_documento", "participante"]),
    [TABLE_NAMES.resumenCertificados]: validateRows(tables[TABLE_NAMES.resumenCertificados], ["id_documento"]),
    [TABLE_NAMES.responsables]: validateRows(tables[TABLE_NAMES.responsables], ["id_documento", "rol_responsable"]),
    [TABLE_NAMES.anexos]: validateRows(tables[TABLE_NAMES.anexos], ["id_documento", "tipo_anexo"]),
    [TABLE_NAMES.ocrPaginas]: validateRows(tables[TABLE_NAMES.ocrPaginas], ["id_documento", "numero_pagina"])
  };

  const rowsByTable = {};
  const warningsByTable = {};
  let totalRows = 0;
  let totalWarnings = 0;
  let reviewRows = 0;
  Object.values(TABLE_NAMES).forEach((name) => {
    const rows = tables[name] || [];
    rowsByTable[name] = rows.length;
    warningsByTable[name] = validations[name].warningCount;
    totalRows += rows.length;
    totalWarnings += validations[name].warningCount;
    reviewRows += rows.filter((row) => row.requiere_revision === "SI").length;
  });

  return {
    tables,
    validations,
    summary: {
      total_tables: 9,
      total_rows: totalRows,
      total_warnings: totalWarnings,
      requiere_revision_rows: reviewRows,
      total_informes: documents.length,
      total_participantes: tables[TABLE_NAMES.participantes].length,
      total_certificados: tables[TABLE_NAMES.certificados].length,
      total_anexos: tables[TABLE_NAMES.anexos].length,
      total_paginas_ocr: tables[TABLE_NAMES.ocrPaginas].length,
      diferencias_paginacion: tables[TABLE_NAMES.archivos].filter((row) => row.coinciden_paginas === "NO").length,
      rows_by_table: rowsByTable,
      warnings_by_table: warningsByTable,
      estado_general: totalWarnings || reviewRows ? "REVISAR" : "OK"
    }
  };
}

function flattenWarnings(validations) {
  return Object.entries(validations || {}).flatMap(([tabla, validation]) =>
    (validation.warnings || []).map((advertencia) => ({ tabla, advertencia }))
  );
}

module.exports = {
  TABLE_NAMES,
  validateRows,
  buildTables,
  flattenWarnings
};
