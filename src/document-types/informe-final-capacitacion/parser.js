/* =========================================================
Nombre completo: parser.js
Ruta o ubicación: /src/document-types/informe-final-capacitacion/parser.js
Función o funciones:
- Extraer datos generales, objetivos, responsables, anexos y trazabilidad OCR.
- Integrar participantes y certificados mediante parsers especializados.
- Conservar códigos originales, normalizados y diferencias de paginación.
========================================================= */
"use strict";

const path = require("path");
const {
  normalizeLineBreaks,
  normalizeSpaces,
  normalizeForSearch,
  cleanValue,
  firstMatch,
  extractBetween,
  normalizeCodigoDocumento,
  parseCodigoDocumento,
  uniqueValues
} = require("../../extractor/normalizer");
const {
  createDocumentId,
  createRowId,
  extractRegistroFromCodigo,
  extractPeriodoFromCodigo
} = require("../../utils/ids");
const participantsParser = require("./participants.parser");
const certificatesParser = require("./certificates.parser");

const DOCUMENT_TYPE = "informe-final-capacitacion";
const MONTHS = Object.freeze({
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
  noviembre: "11", diciembre: "12"
});

function dateToIso(value) {
  const clean = normalizeSpaces(value);
  let match = clean.match(/(\d{1,2})\s*(?:de\s+)?([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s*(?:de\s+)?(\d{4})/i);
  if (match) {
    const month = MONTHS[normalizeForSearch(match[2])] || "";
    return month ? `${match[3]}-${month}-${String(Number(match[1])).padStart(2, "0")}` : "";
  }
  match = clean.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (match) return `${match[3]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
  return "";
}

function extractOriginalCode(text) {
  const source = normalizeLineBreaks(text);
  const match = source.match(/UGPA\s*-?\s*INF\s*-?\s*\d{1,3}\s*-?\s*PRO[\s\S]{0,45}?\d{4}\s*-\s*\d{2}/i);
  return match ? normalizeSpaces(match[0]) : "";
}

function parseFinalReportCode(text) {
  const parsed = parseCodigoDocumento(text, "134");
  if (parsed && /-INF-/.test(parsed)) return parsed;
  const normalized = normalizeCodigoDocumento(text);
  const complete = normalized.match(/UGPA-INF-\d{1,3}-PRO-134-\d{4}-\d{2}/i);
  if (complete) return complete[0].toUpperCase();
  const missingProcess = normalized.match(/UGPA-INF-(\d{1,3})-PRO-(\d{4})-(\d{2})/i);
  return missingProcess ? `UGPA-INF-${missingProcess[1].padStart(2, "0")}-PRO-134-${missingProcess[2]}-${missingProcess[3]}` : "";
}

function extractReportTitle(text) {
  const source = normalizeLineBreaks(text).slice(0, 8000);
  return firstMatch(source, [
    /Informe\s+Final\s+De\s+La\s+Capacitaci[óo]n\s*:\s*([\s\S]+?)(?=P[áa]gina\s+\d+\s+de\s+\d+|ELABORADO\s+POR|UNIDAD\s+DE\s+GESTI[ÓO]N)/i,
    /Informe\s+Final\s+De\s+Capacitaci[óo]n\s+De\s*:\s*([\s\S]+?)(?=P[áa]gina\s+\d+\s+de\s+\d+|ELABORADO\s+POR|UNIDAD\s+DE\s+GESTI[ÓO]N)/i,
    /Informe\s+Final\s+de\s+la\s+Capacitaci[óo]n\s*:\s*([^\n]+)/i
  ]).replace(/\s+/g, " ");
}

function splitCourseAndTarget(title) {
  const clean = cleanValue(title);
  const directed = clean.match(/^(.+?)[,;]?\s+Dirigido\s+A\s+(.+)$/i);
  if (directed) {
    return { nombre_capacitacion: cleanValue(directed[1]), publico_dirigido: cleanValue(directed[2]) };
  }
  const colon = clean.match(/^([^:]{5,90})\s*:\s*(.{5,})$/);
  if (colon && /carrera|enfermer|estetica|todas|administracion|educacion|talento|alimentos/i.test(colon[1])) {
    return { nombre_capacitacion: cleanValue(colon[2]), publico_dirigido: cleanValue(colon[1]) };
  }
  return { nombre_capacitacion: clean, publico_dirigido: "" };
}

function sectionValue(text, headingPattern, nextHeadingPattern) {
  const source = normalizeLineBreaks(text);
  const match = headingPattern.exec(source);
  if (!match) return "";
  const from = match.index + match[0].length;
  const remaining = source.slice(from);
  const end = nextHeadingPattern ? nextHeadingPattern.exec(remaining) : null;
  return cleanValue(remaining.slice(0, end ? end.index : remaining.length));
}

function extractFacilitator(text) {
  return sectionValue(
    text,
    /\d+\.?\s*NOMBRE\s+DEL\/LOS\s+FACILITADOR\/ES\s*:?/i,
    /\n\s*\d+\.?\s*(?:NOMBRE\s+DEL\s+CURSO|FECHAS\s+DE\s+IMPARTICI[ÓO]N)/i
  ).split("\n").map(cleanValue).filter(Boolean).slice(0, 3).join(" | ");
}

function extractExplicitCourseName(text) {
  return sectionValue(
    text,
    /\d+\.?\s*NOMBRE\s+DEL\s+CURSO\s*:?/i,
    /\n\s*\d+\.?\s*FECHAS\s+DE\s+IMPARTICI[ÓO]N/i
  ).split("\n").map(cleanValue).filter(Boolean).slice(0, 3).join(" ");
}

function extractObjectives(text) {
  const objectiveSection = sectionValue(
    text,
    /\d+\.?\s*OBJETIVO\s+GENERAL\s*:?/i,
    /\n\s*\d+\.?\s*CUMPLIMIENTO\s+DE\s+LOS\s+OBJETIVOS\s+DEL\s+CURSO/i
  );
  const specificIndex = normalizeForSearch(objectiveSection).indexOf("objetivos especificos");
  const general = specificIndex >= 0
    ? cleanValue(objectiveSection.slice(0, specificIndex).replace(/^Objetivo\s+General\s*/i, ""))
    : cleanValue(objectiveSection.replace(/^Objetivo\s+General\s*/i, ""));
  const specific = specificIndex >= 0
    ? cleanValue(objectiveSection.slice(specificIndex).replace(/^Objetivos\s+Espec[ií]ficos\s*/i, ""))
    : "";
  const compliance = sectionValue(
    text,
    /\d+\.?\s*CUMPLIMIENTO\s+DE\s+LOS\s+OBJETIVOS\s+DEL\s+CURSO\s*:?/i,
    /\n\s*\d+\.?\s*MATRIZ\s+CON\s+LOS\s+DATOS\s+DE\s+LOS\s+PARTICIPANTES/i
  );
  return { general, specific, compliance };
}

function extractDeclaredPages(text) {
  const values = [...normalizeLineBreaks(text).slice(0, 12000).matchAll(/P[áa]gina\s+\d+\s+de\s+(\d{1,4})/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => value > 0);
  return values.length ? values[0] : 0;
}

function extractResponsibleRows(text, context) {
  const cover = normalizeSpaces(normalizeLineBreaks(text).slice(0, 8500));
  const roles = [...cover.matchAll(/(ELABORADO\s+POR|REVISADO\s+POR|APROBADO\s+POR)\s*:/gi)]
    .map((match) => normalizeSpaces(match[1]).toUpperCase());
  const names = uniqueValues([...cover.matchAll(/NOMBRE\s*:\s*(.+?)(?=\s+NOMBRE\s*:|\s+CARGO\s*:|\s+P[ÁA]GINA|$)/gi)]
    .map((match) => cleanValue(match[1])));
  const cargos = [...cover.matchAll(/CARGO\s*:\s*(.+?)(?=\s+CARGO\s*:|\s+NOMBRE\s*:|\s+P[ÁA]GINA|$)/gi)]
    .map((match) => cleanValue(match[1]));
  const safeRoles = roles.length ? roles : ["ELABORADO POR", "REVISADO POR", "APROBADO POR"];
  const count = Math.max(safeRoles.length, names.length, cargos.length);
  return Array.from({ length: count }, (_unused, index) => {
    const warnings = [];
    if (!names[index]) warnings.push("No se detectó nombre del responsable.");
    if (!cargos[index]) warnings.push("No se detectó cargo del responsable.");
    return {
      id: createRowId("responsable-informe", context.id_documento, index, `${safeRoles[index] || "RESPONSABLE"}|${names[index] || ""}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      rol_responsable: safeRoles[index] || `RESPONSABLE ${index + 1}`,
      nombre_responsable: names[index] || "",
      cargo_responsable: cargos[index] || "",
      firma_visual_detectada: "NO_VERIFICABLE_AUTOMATICAMENTE",
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    };
  });
}

function classifyAnnexPage(text, pageNumber, declaredPages) {
  const search = normalizeForSearch(text);
  if (declaredPages && pageNumber > declaredPages) return "Página adicional";
  if (search.includes("certificado")) return "Certificado o constancia";
  if (search.includes("captura") || search.includes("plataforma")) return "Captura de plataforma";
  if (search.includes("correo") || search.includes("email")) return "Correo o comunicación";
  if (search.includes("fotografia") || search.includes("evidencia fotografica")) return "Evidencia fotográfica";
  if (search.includes("anexo")) return "Anexo declarado";
  return "";
}

function buildPageRows(pdfDocument, context, declaredPages) {
  const pages = Array.isArray(pdfDocument.pages) ? pdfDocument.pages : [];
  const ocrRows = pages.map((page, index) => ({
    id: createRowId("ocr-pagina-informe", context.id_documento, index, String(page.pageNumber || index + 1)),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    numero_pagina: Number(page.pageNumber || index + 1),
    texto_ocr: cleanValue(page.text || ""),
    confianza_ocr: Number(page.confidence || 0),
    metodo_extraccion: "ocr",
    longitud_texto: Number(page.textLength || String(page.text || "").length),
    requiere_revision: Number(page.confidence || 0) > 0 && Number(page.confidence || 0) < 65 ? "SI" : "NO",
    observacion_extraccion: Number(page.confidence || 0) > 0 && Number(page.confidence || 0) < 65 ? "Confianza OCR baja." : ""
  }));

  const annexes = pages.map((page, index) => {
    const pageNumber = Number(page.pageNumber || index + 1);
    const type = classifyAnnexPage(page.text || "", pageNumber, declaredPages);
    if (!type) return null;
    return {
      id: createRowId("anexo-informe", context.id_documento, index, `${pageNumber}|${type}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      numero_pagina: pageNumber,
      tipo_anexo: type,
      descripcion: cleanValue(String(page.text || "").slice(0, 500)),
      metodo_extraccion: "ocr",
      confianza_ocr: Number(page.confidence || 0),
      requiere_revision: "NO",
      observacion_extraccion: ""
    };
  }).filter(Boolean);

  if (!pages.length && declaredPages && Number(pdfDocument.pageCount || 0) > declaredPages) {
    annexes.push({
      id: createRowId("anexo-informe", context.id_documento, 0, "paginas-adicionales"),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      numero_pagina: declaredPages + 1,
      tipo_anexo: "Páginas adicionales",
      descripcion: `El PDF contiene ${pdfDocument.pageCount} páginas físicas y declara ${declaredPages}.`,
      metodo_extraccion: pdfDocument.extractionMethod || "digital",
      confianza_ocr: Number(pdfDocument.ocrConfidence || 0),
      requiere_revision: "SI",
      observacion_extraccion: "Revisar el contenido de las páginas adicionales."
    });
  }
  return { ocrRows, annexes };
}

function parseDocument(pdfDocument) {
  const rawText = normalizeLineBreaks(pdfDocument.text || "");
  const fileName = pdfDocument.fileName || path.basename(pdfDocument.filePath || "");
  const codigoOriginal = extractOriginalCode(rawText);
  const codigoDocumento = parseFinalReportCode(`${rawText}\n${fileName}`);
  const idDocumento = createDocumentId(pdfDocument.filePath || fileName, pdfDocument.index || 0, codigoDocumento);
  const periodo = extractPeriodoFromCodigo(codigoDocumento);
  const reportTitle = extractReportTitle(rawText);
  const splitTitle = splitCourseAndTarget(reportTitle);
  const explicitCourse = extractExplicitCourseName(rawText);
  const nombreCapacitacion = explicitCourse || splitTitle.nombre_capacitacion;
  const facilitator = extractFacilitator(rawText);
  const fechaElaboracionTexto = firstMatch(rawText, [
    /Fecha\s+de\s+Elaboraci[óo]n\s*:\s*([^\n]+)/i,
    /Fecha\s+de\s+Elaboraci[óo]n\s*\n\s*([^\n]+)/i
  ]);
  const fechaInicioTexto = firstMatch(rawText, [/FECHA\s+INICIO\s*:\s*([^\n]+)/i]);
  const fechaFinalTexto = firstMatch(rawText, [/FECHA\s+FINAL\s*:\s*([^\n]+)/i]);
  const duracion = firstMatch(rawText, [/DURACI[ÓO]N\s*:\s*([^\n]+)/i, /DURACI[ÓO]N\s*\n\s*([^\n]+)/i]);
  const periodoSemestral = firstMatch(rawText, [/PER[ÍI]ODO\s+SEMESTRAL\s*:\s*([^\n]+)/i]);
  const declaredPages = extractDeclaredPages(rawText);
  const physicalPages = Number(pdfDocument.pageCount || 0);
  const objectives = extractObjectives(rawText);
  const context = { id_documento: idDocumento, codigo_documento: codigoDocumento, periodo };
  const participants = participantsParser.createParticipantRows(rawText, context);
  const certificates = certificatesParser.parseCertificates(rawText, context, participants);
  const responsables = extractResponsibleRows(rawText, context);
  const pageRows = buildPageRows(pdfDocument, context, declaredPages);
  const warnings = [];
  if (!codigoDocumento) warnings.push("No se detectó un código institucional INF válido.");
  if (!nombreCapacitacion) warnings.push("No se detectó el nombre de la capacitación.");
  if (!facilitator) warnings.push("No se detectó facilitador.");
  if (!participants.length) warnings.push("No se detectaron participantes.");
  if (physicalPages && declaredPages && physicalPages !== declaredPages) {
    warnings.push(`Las páginas físicas (${physicalPages}) no coinciden con las declaradas (${declaredPages}).`);
  }
  if (codigoOriginal && codigoDocumento && normalizeCodigoDocumento(codigoOriginal) !== codigoDocumento) {
    warnings.push("El código original requirió normalización o reconstrucción.");
  }

  const source = {
    extraction_method: pdfDocument.extractionMethod || "digital",
    digital_pages: Number(pdfDocument.digitalPageCount || 0),
    ocr_pages: Number(pdfDocument.ocrPageCount || 0),
    ocr_confidence: Number(pdfDocument.ocrConfidence || 0),
    file_hash: pdfDocument.fileHash || ""
  };

  return {
    document_type: DOCUMENT_TYPE,
    id_documento: idDocumento,
    source,
    archivo: {
      id: createRowId("archivo-informe-final", idDocumento, 0, fileName),
      id_documento: idDocumento,
      nombre_archivo: fileName,
      ruta_archivo: pdfDocument.filePath || "",
      hash_archivo: source.file_hash,
      codigo_original: codigoOriginal,
      codigo_documento: codigoDocumento,
      numero_registro: extractRegistroFromCodigo(codigoDocumento),
      periodo,
      paginas_fisicas: physicalPages,
      paginas_declaradas: declaredPages,
      coinciden_paginas: physicalPages && declaredPages ? (physicalPages === declaredPages ? "SI" : "NO") : "NO_VERIFICABLE",
      total_paginas: physicalPages,
      metodo_extraccion: source.extraction_method,
      paginas_digitales: source.digital_pages,
      paginas_ocr: source.ocr_pages,
      confianza_ocr: source.ocr_confidence,
      estado_extraccion: warnings.length ? "REVISAR" : "OK",
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    },
    datos_generales: {
      id: createRowId("datos-informe-final", idDocumento, 0, nombreCapacitacion),
      id_documento: idDocumento,
      codigo_original: codigoOriginal,
      codigo_documento: codigoDocumento,
      periodo,
      periodo_semestral: periodoSemestral,
      fecha_elaboracion: dateToIso(fechaElaboracionTexto),
      fecha_elaboracion_texto: fechaElaboracionTexto,
      titulo_informe: reportTitle,
      nombre_capacitacion: nombreCapacitacion,
      publico_dirigido: splitTitle.publico_dirigido,
      facilitador: facilitator,
      fecha_inicio: dateToIso(fechaInicioTexto),
      fecha_inicio_texto: fechaInicioTexto,
      fecha_final: dateToIso(fechaFinalTexto),
      fecha_final_texto: fechaFinalTexto,
      duracion,
      total_participantes_detectados: participants.length,
      total_certificados_detectados: certificates.rows.length,
      paginas_fisicas: physicalPages,
      paginas_declaradas: declaredPages,
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    },
    objetivos: {
      id: createRowId("objetivos-informe", idDocumento, 0, nombreCapacitacion),
      id_documento: idDocumento,
      codigo_documento: codigoDocumento,
      periodo,
      objetivo_general: objectives.general,
      objetivos_especificos: objectives.specific,
      cumplimiento_objetivos: objectives.compliance,
      requiere_revision: objectives.general && objectives.compliance ? "NO" : "SI",
      observacion_extraccion: objectives.general && objectives.compliance ? "" : "Faltan uno o más apartados de objetivos."
    },
    participantes: participants,
    certificados: certificates.rows,
    resumen_certificados: certificates.summary,
    responsables,
    anexos: pageRows.annexes,
    ocr_paginas: pageRows.ocrRows,
    warnings
  };
}

function parseDocuments(pdfDocuments) {
  const parsed = [];
  const errors = [];
  (Array.isArray(pdfDocuments) ? pdfDocuments : []).forEach((document) => {
    if (!document || !document.ok) {
      errors.push({ fileName: document?.fileName || "", errors: document?.errors || ["Documento inválido."] });
      return;
    }
    try { parsed.push(parseDocument(document)); }
    catch (error) { errors.push({ fileName: document.fileName || "", errors: [error.message] }); }
  });
  return {
    documentType: DOCUMENT_TYPE,
    total: parsed.length + errors.length,
    parsedCount: parsed.length,
    errorCount: errors.length,
    parsed,
    errors
  };
}

module.exports = {
  DOCUMENT_TYPE,
  dateToIso,
  extractOriginalCode,
  parseFinalReportCode,
  extractReportTitle,
  splitCourseAndTarget,
  extractFacilitator,
  extractExplicitCourseName,
  extractObjectives,
  extractDeclaredPages,
  extractResponsibleRows,
  classifyAnnexPage,
  buildPageRows,
  parseDocument,
  parseDocuments
};
