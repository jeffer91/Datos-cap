/* =========================================================
Nombre completo: parser-v2.js
Ruta o ubicación: /src/document-types/informe-impacto/parser-v2.js
Función o funciones:
- Corregir la construcción de indicadores cualitativos y cuantitativos.
- Separar varios indicadores aunque el PDF elimine los saltos de línea.
- Recalcular resúmenes, responsables y advertencias del documento.
========================================================= */

"use strict";

const base = require("./parser");
const {
  normalizeSpaces,
  normalizeForSearch,
  cleanValue
} = require("../../extractor/normalizer");
const { createRowId } = require("../../utils/ids");

function parseIndicatorSection(section, impactType, context, startIndex) {
  const compact = normalizeSpaces(section)
    .replace(/^[•▪◦o\-–—]+\s*/i, "")
    .trim();
  const rows = [];
  const regex = /([A-ZÁÉÍÓÚÜÑa-záéíóúüñ][A-ZÁÉÍÓÚÜÑa-záéíóúüñ\s\/\-]{2,70})\s*:\s*(.+?)(?=\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ][A-ZÁÉÍÓÚÜÑa-záéíóúüñ\s\/\-]{2,70}\s*:|$)/g;
  let match;

  while ((match = regex.exec(compact)) !== null) {
    const indicator = cleanValue(match[1]);
    const result = cleanValue(match[2]);
    if (!indicator || !result) continue;

    const percentage = result.match(/(\d+(?:[.,]\d+)?)\s*%/);
    rows.push({
      id: createRowId("indicador-impacto", context.id_documento, startIndex + rows.length, `${impactType}|${indicator}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      nombre_curso: context.nombre_curso,
      tipo_impacto: impactType,
      indicador: indicator,
      resultado_texto: result,
      porcentaje: percentage ? Number(percentage[1].replace(",", ".")) : "",
      valor_numerico: percentage ? Number(percentage[1].replace(",", ".")) : "",
      unidad: percentage ? "%" : "texto",
      fuente_seccion: "Resumen de hallazgos",
      requiere_revision: "NO",
      observacion_extraccion: ""
    });
  }

  return rows;
}

function extractIndicators(text, context) {
  const qualitative = base.extractSection(text, /Impacto Cualitativo\s*:?/i, /Impacto Cuantitativo\s*:?/i);
  const quantitative = base.extractSection(text, /Impacto Cuantitativo\s*:?/i, /Recomendaciones Principales\s*:?/i);
  const rows = [
    ...parseIndicatorSection(qualitative, "CUALITATIVO", context, 0),
    ...parseIndicatorSection(quantitative, "CUANTITATIVO", context, 100)
  ];
  const seen = new Set();

  return rows.filter((row) => {
    const key = `${normalizeForSearch(row.tipo_impacto)}|${normalizeForSearch(row.indicador)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function textWithoutSummaryIndicators(text) {
  return String(text || "")
    .replace(/Impacto Cualitativo/gi, "Resumen cualitativo")
    .replace(/Impacto Cuantitativo/gi, "Resumen cuantitativo");
}

function cleanResponsibleRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    cargo_responsable: cleanValue(String(row.cargo_responsable || "")
      .replace(/\s+\d+\.\s*Datos Generales del Informe[\s\S]*$/i, "")
      .replace(/\s+Nombre del Curso[\s\S]*$/i, ""))
  }));
}

function recalculateDocument(document, indicators) {
  const percentages = indicators.filter((row) => row.porcentaje !== "");
  document.indicadores = indicators;
  document.responsables = cleanResponsibleRows(document.responsables);
  document.datos_generales = {
    ...document.datos_generales,
    total_indicadores: indicators.length,
    total_indicadores_cualitativos: indicators.filter((row) => row.tipo_impacto === "CUALITATIVO").length,
    total_indicadores_cuantitativos: indicators.filter((row) => row.tipo_impacto === "CUANTITATIVO").length,
    promedio_porcentajes: percentages.length
      ? Number((percentages.reduce((sum, row) => sum + Number(row.porcentaje), 0) / percentages.length).toFixed(2))
      : ""
  };

  document.warnings = (document.warnings || []).filter((warning) => !/No se detectaron indicadores de impacto/i.test(warning));
  if (!indicators.length) document.warnings.push("No se detectaron indicadores de impacto.");

  document.archivo.estado_extraccion = document.warnings.length ? "REVISAR" : "OK";
  document.archivo.requiere_revision = document.warnings.length ? "SI" : "NO";
  document.archivo.observacion_extraccion = document.warnings.join(" | ");
  document.datos_generales.requiere_revision = document.warnings.length ? "SI" : "NO";
  document.datos_generales.observacion_extraccion = document.warnings.join(" | ");
  return document;
}

function parseDocument(pdfDocument) {
  const originalText = String(pdfDocument.text || "");
  const baseDocument = base.parseDocument({
    ...pdfDocument,
    text: textWithoutSummaryIndicators(originalText)
  });
  const context = {
    id_documento: baseDocument.id_documento,
    codigo_documento: baseDocument.archivo.codigo_documento,
    periodo: baseDocument.archivo.periodo,
    nombre_curso: baseDocument.datos_generales.nombre_curso
  };
  const indicators = extractIndicators(originalText, context);
  baseDocument.source.text_length = originalText.length;
  return recalculateDocument(baseDocument, indicators);
}

function parseDocuments(pdfDocuments) {
  const documents = Array.isArray(pdfDocuments) ? pdfDocuments : [];
  const parsed = [];
  const errors = [];

  documents.forEach((document) => {
    if (!document || !document.ok) {
      errors.push({
        fileName: document ? document.fileName : "",
        errors: document && Array.isArray(document.errors) ? document.errors : ["Documento inválido."]
      });
      return;
    }

    try {
      parsed.push(parseDocument(document));
    } catch (error) {
      errors.push({
        fileName: document.fileName || "",
        errors: [error.message || "No se pudo analizar el Informe de Impacto."]
      });
    }
  });

  return {
    documentType: base.DOCUMENT_TYPE,
    total: documents.length,
    parsedCount: parsed.length,
    errorCount: errors.length,
    parsed,
    errors
  };
}

module.exports = {
  ...base,
  parseIndicatorSection,
  extractIndicators,
  cleanResponsibleRows,
  recalculateDocument,
  parseDocument,
  parseDocuments
};
