/* =========================================================
Nombre completo: validator.js
Ruta o ubicación: /src/document-types/acuerdo-patrocinio/validator.js
Función o funciones:
- Validar que el acuerdo tenga los datos indispensables.
========================================================= */
"use strict";

function validateParsedDocument(document) {
  const agreement = document?.datos_acuerdo || {};
  const warnings = [];
  if (!document?.id_documento) warnings.push("Falta identificador del documento.");
  if (!agreement.codigo_documento) warnings.push("Falta código institucional PRO-134.");
  if (!agreement.nombre_docente) warnings.push("Falta nombre del docente.");
  if (!agreement.cedula_docente) warnings.push("Falta cédula del docente.");
  if (!agreement.nombre_capacitacion) warnings.push("Falta nombre de la capacitación.");
  if (!agreement.fecha_acuerdo) warnings.push("Falta fecha del acuerdo.");
  if (!(document?.apoyos || []).some((row) => row.seleccionado === "SI")) warnings.push("No se detectó apoyo marcado.");
  return { ok: warnings.length === 0, documentId: document?.id_documento || "", warnings };
}

module.exports = { validateParsedDocument };
