/* =========================================================
Nombre completo: validator.js
Ruta o ubicación: /src/document-types/informe-final-capacitacion/validator.js
Función o funciones:
- Validar datos esenciales del Informe Final.
- Comparar participantes, certificados, totales y paginación.
========================================================= */
"use strict";

function validateParsedDocument(document) {
  const general = document?.datos_generales || {};
  const summary = document?.resumen_certificados || {};
  const participants = document?.participantes || [];
  const certificates = document?.certificados || [];
  const warnings = [];

  if (!document?.id_documento) warnings.push("Falta identificador del documento.");
  if (!general.codigo_documento) warnings.push("Falta código institucional normalizado.");
  if (!general.nombre_capacitacion) warnings.push("Falta nombre de la capacitación.");
  if (!general.facilitador) warnings.push("Falta facilitador.");
  if (!participants.length) warnings.push("No se detectaron participantes.");
  if (general.paginas_fisicas && general.paginas_declaradas && general.paginas_fisicas !== general.paginas_declaradas) {
    warnings.push("La cantidad de páginas físicas no coincide con la declarada.");
  }
  if (summary.total_inscritos && participants.length && summary.total_inscritos !== participants.length) {
    warnings.push(`El resumen declara ${summary.total_inscritos} inscritos y se detectaron ${participants.length} participantes.`);
  }
  if (certificates.length && participants.length && certificates.length > participants.length) {
    warnings.push("Existen más filas de certificados que participantes detectados.");
  }

  return {
    ok: warnings.length === 0,
    documentId: document?.id_documento || "",
    warnings
  };
}

module.exports = { validateParsedDocument };
