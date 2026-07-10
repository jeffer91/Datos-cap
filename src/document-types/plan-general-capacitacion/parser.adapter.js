/* =========================================================
Nombre completo: parser.adapter.js
Ruta o ubicación: /src/document-types/plan-general-capacitacion/parser.adapter.js
Función o funciones:
- Corregir y reforzar la extracción de objetivos del plan.
- Reutilizar los extractores de acciones, cronograma e indicadores.
- Construir el documento normalizado sin depender del parser base defectuoso.
========================================================= */

"use strict";

const path = require("path");
const baseParser = require("./parser");
const {
  normalizeLineBreaks,
  normalizeSpaces,
  cleanValue,
  firstMatch,
  parseCodigoDocumento,
  uniqueValues
} = require("../../extractor/normalizer");
const {
  createDocumentId,
  createRowId,
  extractRegistroFromCodigo,
  extractPeriodoFromCodigo
} = require("../../utils/ids");

const DOCUMENT_TYPE = "plan-general-capacitacion";

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractDateByLabel(text, labels) {
  const compact = normalizeSpaces(text);
  for (const label of labels || []) {
    const regex = new RegExp(`${escapeRegex(label)}\\s*:?\\s*(\\d{1,2}\\s*(?:de|-)?\\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\\s*(?:de|-)?\\s*\\d{4}|\\d{1,2}\\s*[\\/-]\\s*\\d{1,2}\\s*[\\/-]\\s*\\d{4})`, "i");
    const match = compact.match(regex);
    if (match) return { texto: cleanValue(match[1]), iso: baseParser.parseSpanishDate(match[1]) };
  }
  return { texto: "", iso: "" };
}

function splitSpecificObjectives(value) {
  const compact = cleanValue(value);
  if (!compact) return [];
  return compact
    .replace(/^[•●▪◦-]\s*/, "")
    .split(/\s*;\s*|\s+[•●▪◦]\s+/)
    .map(cleanValue)
    .filter(Boolean);
}

function extractObjectivesSafe(text, context) {
  const section = baseParser.extractSection(text,
    [/Objetivos del Plan\s*:?/i, /Objetivos\s*:?/i],
    [/Capacitaciones Planificadas/i, /Plan de Acci[óo]n/i, /Cronograma de Ejecuci[óo]n/i]
  );
  const general = firstMatch(section, [
    /Objetivo general\s*:?\s*(.+?)(?=Objetivos espec[íi]ficos|$)/is
  ]);
  const specificSection = firstMatch(section, [
    /Objetivos espec[íi]ficos\s*:?\s*(.+)$/is
  ]);
  const rows = [];

  if (general) {
    rows.push({
      id: createRowId("objetivo-plan-general", context.id_documento, 0, general),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      tipo_objetivo: "GENERAL",
      numero_objetivo: 0,
      objetivo: cleanValue(general),
      eje_estrategico: "",
      indicador_asociado: "",
      requiere_revision: "NO",
      observacion_extraccion: ""
    });
  }

  splitSpecificObjectives(specificSection).forEach((objective, index) => rows.push({
    id: createRowId("objetivo-plan-general", context.id_documento, index + 1, objective),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    tipo_objetivo: "ESPECIFICO",
    numero_objetivo: index + 1,
    objetivo: objective,
    eje_estrategico: "",
    indicador_asociado: "",
    requiere_revision: "NO",
    observacion_extraccion: ""
  }));

  return rows;
}

function parseDocument(pdfDocument) {
  const rawText = normalizeLineBreaks(pdfDocument.text || "");
  const fileName = pdfDocument.fileName || path.basename(pdfDocument.filePath || "");
  const codigoDocumento = parseCodigoDocumento(`${rawText} ${fileName}`, "70");
  const idDocumento = createDocumentId(pdfDocument.filePath || fileName, pdfDocument.index || 0, codigoDocumento, pdfDocument.fileHash || "", DOCUMENT_TYPE);
  const periodo = extractPeriodoFromCodigo(codigoDocumento);
  const periodText = baseParser.extractPeriodText(rawText);
  const elaborationDate = extractDateByLabel(rawText, ["Fecha de Elaboración"]);
  const context = { id_documento: idDocumento, codigo_documento: codigoDocumento, periodo };
  const objectives = extractObjectivesSafe(rawText, context);
  const actions = baseParser.extractTrainingActions(rawText, context);
  const schedule = baseParser.extractSchedule(rawText, context, actions);
  const monitoring = baseParser.extractMonitoring(rawText, context);
  const resources = baseParser.extractResources(rawText, context);
  const responsables = baseParser.extractSignatories(rawText, context, fileName);
  const pageInfo = baseParser.extractPageInformation(rawText, pdfDocument.pageCount || 0);
  const warnings = [];

  if (!codigoDocumento || !/(?:UGPA|CGC)-RGI2-\d{1,3}-PRO-70-/i.test(codigoDocumento)) warnings.push("No se detectó un código RGI2 de PRO-70 válido.");
  if (!periodText) warnings.push("No se detectó el alcance temporal del plan.");
  if (!objectives.length) warnings.push("No se detectaron objetivos del plan.");
  if (!actions.length) warnings.push("No se detectaron capacitaciones planificadas.");
  if (!monitoring.length) warnings.push("No se detectaron indicadores de seguimiento.");
  if (!resources.length) warnings.push("No se detectaron recursos o presupuesto.");
  if (!responsables.length) warnings.push("No se detectaron responsables.");
  if (pageInfo.inconsistencia_paginas === "SI") warnings.push("Se detectó inconsistencia entre páginas reales y declaradas.");

  const budgetFromActions = actions.reduce((sum, row) => sum + Number(row.presupuesto_estimado || 0), 0);
  const budgetFromResources = resources.reduce((sum, row) => sum + Number(row.costo_estimado || 0), 0);
  const totalBudget = budgetFromResources || budgetFromActions;
  const careers = uniqueValues(actions.map((row) => row.carrera).filter(Boolean));

  const archivo = {
    id: createRowId("archivo-plan-general", idDocumento, 0, fileName),
    id_documento: idDocumento,
    nombre_archivo: fileName,
    ruta_archivo: pdfDocument.filePath || "",
    hash_archivo: pdfDocument.fileHash || "",
    codigo_documento: codigoDocumento,
    numero_registro: extractRegistroFromCodigo(codigoDocumento),
    periodo,
    anio_periodo: periodo.split("-")[0] || "",
    mes_periodo: periodo.split("-")[1] || "",
    version_documento: firstMatch(rawText, [/Versi[óo]n\s*:\s*([^\n]+)/i]),
    fecha_elaboracion_texto: elaborationDate.texto,
    fecha_elaboracion: elaborationDate.iso,
    total_paginas_reales: pdfDocument.pageCount || 0,
    ...pageInfo,
    metodo_extraccion: pdfDocument.extractionMethod || "digital",
    paginas_ocr: pdfDocument.ocrPageCount || 0,
    confianza_ocr: pdfDocument.ocrConfidence || 0,
    documento_unico_periodo: "SI",
    estado_extraccion: warnings.length ? "REVISAR" : "OK",
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };

  const datosGenerales = {
    id: createRowId("datos-plan-general", idDocumento, 0, periodText),
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    periodo,
    periodo_documental_texto: periodText,
    tipo_plan: /Plan Anual de Capacitaci[óo]n/i.test(rawText) ? "ANUAL" : "SEMESTRAL",
    fecha_elaboracion_texto: elaborationDate.texto,
    fecha_elaboracion: elaborationDate.iso,
    objetivo_general: objectives.find((row) => row.tipo_objetivo === "GENERAL")?.objetivo || "",
    total_objetivos: objectives.length,
    total_capacitaciones: actions.length,
    total_capacitaciones_genericas: actions.filter((row) => /GENERICA/.test(row.tipo_capacitacion)).length,
    total_capacitaciones_especificas: actions.filter((row) => /ESPECIFICA/.test(row.tipo_capacitacion)).length,
    total_carreras: careers.length,
    carreras_incluidas: careers.join(" | "),
    total_horas_planificadas: actions.reduce((sum, row) => sum + Number(row.duracion_horas || 0), 0),
    presupuesto_total_estimado: totalBudget,
    total_indicadores: monitoring.length,
    total_recursos: resources.length,
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };

  return {
    document_type: DOCUMENT_TYPE,
    id_documento: idDocumento,
    archivo,
    datos_generales: datosGenerales,
    objetivos: objectives,
    capacitaciones: actions,
    cronograma: schedule,
    seguimiento: monitoring,
    recursos: resources,
    responsables,
    warnings,
    source: {
      file_hash: pdfDocument.fileHash || "",
      extraction_method: pdfDocument.extractionMethod || "digital",
      ocr_pages: pdfDocument.ocrPageCount || 0,
      ocr_confidence: pdfDocument.ocrConfidence || 0,
      text_length: rawText.length
    }
  };
}

function parseDocuments(pdfDocuments) {
  const documents = Array.isArray(pdfDocuments) ? pdfDocuments : [];
  const parsed = [];
  const errors = [];

  if (documents.length > 1) {
    return {
      documentType: DOCUMENT_TYPE,
      total: documents.length,
      parsedCount: 0,
      errorCount: 1,
      parsed: [],
      errors: [{ fileName: "", errors: ["El Plan Semestral de Capacitación admite un solo documento por operación y periodo."] }]
    };
  }

  documents.forEach((document) => {
    if (!document || !document.ok) {
      errors.push({ fileName: document ? document.fileName : "", errors: document && Array.isArray(document.errors) ? document.errors : ["Documento inválido."] });
      return;
    }
    try {
      parsed.push(parseDocument(document));
    } catch (error) {
      errors.push({ fileName: document.fileName || "", errors: [error.message || "No se pudo analizar el Plan Semestral de Capacitación."] });
    }
  });

  return { documentType: DOCUMENT_TYPE, total: documents.length, parsedCount: parsed.length, errorCount: errors.length, parsed, errors };
}

module.exports = {
  ...baseParser,
  extractDateByLabel,
  splitSpecificObjectives,
  extractObjectivesSafe,
  parseDocument,
  parseDocuments
};
