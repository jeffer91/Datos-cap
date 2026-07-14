/* =========================================================
Nombre completo: parser.js
Ruta o ubicación: /src/document-types/acuerdo-patrocinio/parser.js
Función o funciones:
- Extraer código, fecha, docente, cédula, carrera y capacitación.
- Detectar apoyos institucionales marcados.
- Extraer responsables, cargos y metadatos de lectura digital/OCR.
========================================================= */
"use strict";

const path = require("path");
const {
  normalizeLineBreaks,
  normalizeSpaces,
  normalizeForSearch,
  splitCleanLines,
  cleanValue,
  firstMatch,
  uniqueValues
} = require("../../extractor/normalizer");
const {
  createDocumentId,
  createRowId,
  extractRegistroFromCodigo,
  extractPeriodoFromCodigo
} = require("../../utils/ids");

const DOCUMENT_TYPE = "acuerdo-patrocinio";
const SUPPORT_TYPES = Object.freeze([
  "Financiamiento total del costo del curso",
  "Financiamiento parcial del costo del curso",
  "Anticipo de sueldos/honorarios",
  "Cambio temporal en modalidad de trabajo",
  "Licencia con remuneración",
  "Licencia sin remuneración",
  "Ajuste de horario laboral"
]);
const MONTHS = Object.freeze({
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12"
});

function normalizeInstitutionalCode(value) {
  return normalizeSpaces(value)
    .replace(/[￾\uFFFE]/g, "-")
    .replace(/\s*[-–—]\s*/g, "-")
    .replace(/(?:UGPA|CGC)\s*-\s*/gi, (match) => `${match.replace(/\s|-/g, "").toUpperCase()}-`)
    .replace(/RGI2\s*-\s*/gi, "RGI2-")
    .replace(/PRO\s*-?\s*/gi, "PRO-")
    .replace(/-+/g, "-")
    .toUpperCase();
}

function parseAgreementCode(text) {
  const match = normalizeInstitutionalCode(text).match(/(?:UGPA|CGC)-RGI2-\d{1,3}-PRO-134-\d{4}-\d{2}/i);
  return match ? match[0].toUpperCase() : "";
}

function extractDocumentFields(text) {
  const raw = normalizeLineBreaks(text);
  const compact = normalizeSpaces(raw);
  const docente = firstMatch(raw, [
    /(?:^|\n)DOCENTE\s*:\s*([^\n]+)/i,
    /(?:^|\n)Docente\s*:\s*([^\n]+)/i,
    /señor\(a\)\s+(.+?),\s+con número de c[ée]dula/i
  ]);
  const carrera = firstMatch(raw, [
    /(?:^|\n)CARRERA\s*:\s*([^\n]+)/i,
    /(?:^|\n)Carrera\s*:\s*([^\n]+)/i,
    /DOCENTE\s*:\s*[^\n]+\n([^\n]+)\n\s*CAPACITACI[ÓO]N\s*:/i
  ]);
  const capacitacion = firstMatch(raw, [
    /(?:^|\n)CAPACITACI[ÓO]N\s*:\s*([^\n]+(?:\n(?!UNIDAD|ELABORADO|Código|Codigo)[^\n]+)?)/i,
    /(?:^|\n)Capacitaci[óo]n\s*:\s*([^\n]+)/i,
    /participaci[óo]n de El Colaborador en la capacitaci[óo]n\s+(.+?),\s+con el objetivo/i
  ]);
  const cedula = firstMatch(compact, [
    /número de c[ée]dula\s+([A-Za-z0-9-]{5,20})/i,
    /c[ée]dula\s*:\s*([A-Za-z0-9-]{5,20})/i
  ]);
  const vinculacion = firstMatch(compact, [
    /se encuentra vinculado\(a\) como\s+(.+?)\s+en el ITSQMET/i
  ]);

  return {
    docente: cleanValue(docente),
    carrera: cleanValue(carrera),
    capacitacion: cleanValue(capacitacion).replace(/\s+/g, " "),
    cedula: cleanValue(cedula),
    vinculacion: cleanValue(vinculacion)
  };
}

function parseAgreementDate(text) {
  const match = normalizeSpaces(text).match(
    /En la ciudad de\s+(.+?),\s+a los\s+(\d{1,2})\s+d[ií]as del mes de\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+)\s+de\s+(\d{4})/i
  );
  if (!match) {
    return { ciudad: "", fecha_texto: "", fecha_iso: "", dia: "", mes: "", anio: "" };
  }
  const day = String(Number(match[2])).padStart(2, "0");
  const monthText = normalizeForSearch(match[3]);
  const month = /^\d{1,2}$/.test(monthText)
    ? String(Number(monthText)).padStart(2, "0")
    : (MONTHS[monthText] || "");

  return {
    ciudad: cleanValue(match[1]),
    fecha_texto: `${match[2]} de ${match[3]} de ${match[4]}`,
    fecha_iso: month ? `${match[4]}-${month}-${day}` : "",
    dia: day,
    mes: month,
    anio: match[4]
  };
}

function extractSupportSection(text) {
  const source = normalizeLineBreaks(text);
  const start = source.search(/El patrocinio institucional comprende los siguientes/i);
  if (start < 0) return source;
  const remaining = source.slice(start);
  const end = remaining.search(/COMPROMISOS(?: DEL COLABORADOR)?/i);
  return end > 0 ? remaining.slice(0, end) : remaining;
}

function extractSupports(text, context) {
  const section = extractSupportSection(text);
  const lines = splitCleanLines(section);

  return SUPPORT_TYPES.map((supportType, index) => {
    const normalizedType = normalizeForSearch(supportType);
    const lineIndex = lines.findIndex((line) => normalizeForSearch(line).includes(normalizedType));
    const line = lineIndex >= 0 ? lines[lineIndex] : "";
    const previous = lineIndex > 0 ? lines[lineIndex - 1] : "";
    const next = lineIndex >= 0 ? (lines[lineIndex + 1] || "") : "";
    const isolatedMark = /^\s*(?:x|×|☒|■|✓|✔)\s*$/i;
    const evidence = `${isolatedMark.test(previous) ? previous : ""} ${line} ${isolatedMark.test(next) ? next : ""}`.trim();
    const percentageMatch = evidence.match(/(\d{1,3})\s*%/i);
    const selected = /(?:^|\s)(?:x|×|☒|■|✓|✔)(?:\s|$)/i.test(evidence) || Boolean(percentageMatch);
    const warnings = [];
    if (!line) warnings.push("No se localizó la opción en el documento.");
    if (/parcial/i.test(supportType) && selected && !percentageMatch) {
      warnings.push("El financiamiento parcial está marcado, pero no se detectó porcentaje.");
    }

    return {
      id: createRowId("apoyo-patrocinio", context.id_documento, index, supportType),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      docente: context.docente,
      capacitacion: context.capacitacion,
      tipo_apoyo: supportType,
      seleccionado: selected ? "SI" : "NO",
      porcentaje_financiamiento: percentageMatch ? Number(percentageMatch[1]) : "",
      evidencia_texto: cleanValue(evidence),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    };
  });
}

function normalizeRole(value) {
  const role = normalizeForSearch(value);
  if (role.includes("elaborado")) return "ELABORADO POR";
  if (role.includes("aprobado")) return "APROBADO POR";
  if (role.includes("revisado")) return "REVISADO POR";
  return String(value || "RESPONSABLE").toUpperCase();
}

function extractResponsibleRows(text, context, fileName) {
  const source = normalizeLineBreaks(text);
  const bodyIndex = source.search(/En la ciudad de/i);
  const cover = normalizeSpaces(bodyIndex > 0 ? source.slice(0, bodyIndex) : source.slice(0, 6000));
  const roles = [...cover.matchAll(/(ELABORADO POR|REVISADO POR|APROBADO POR)\s*:/gi)]
    .map((match) => normalizeRole(match[1]));
  const names = uniqueValues(
    [...cover.matchAll(/NOMBRE\s*:\s*(.+?)(?=\s+NOMBRE\s*:|\s+CARGO\s*:|\s+P[ÁA]GINA|$)/gi)]
      .map((match) => cleanValue(match[1]))
  );
  const cargos = [...cover.matchAll(/CARGO\s*:\s*(.+?)(?=\s+CARGO\s*:|\s+NOMBRE\s*:|\s+P[ÁA]GINA|$)/gi)]
    .map((match) => cleanValue(match[1]));
  const safeRoles = roles.length ? roles : ["ELABORADO POR", "APROBADO POR"];
  const count = Math.max(safeRoles.length, names.length, cargos.length);

  return Array.from({ length: count }, (_unused, index) => {
    const name = names[index] || "";
    const cargo = cargos[index] || "";
    const warnings = [];
    if (!name) warnings.push("No se detectó nombre del responsable.");
    if (!cargo) warnings.push("No se detectó cargo del responsable.");

    return {
      id: createRowId("responsable-patrocinio", context.id_documento, index, `${safeRoles[index] || "RESPONSABLE"}|${name}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      docente: context.docente,
      rol_responsable: safeRoles[index] || `RESPONSABLE ${index + 1}`,
      nombre_responsable: name,
      cargo_responsable: cargo,
      estado_firma: /firmado|signed/i.test(fileName || "")
        ? "FIRMADO_SEGUN_ARCHIVO"
        : (name ? "RESPONSABLE_IDENTIFICADO" : "NO_IDENTIFICADO"),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    };
  });
}

function parseDocument(pdfDocument) {
  const rawText = normalizeLineBreaks(pdfDocument.text || "");
  const fileName = pdfDocument.fileName || path.basename(pdfDocument.filePath || "");
  const codigoDocumento = parseAgreementCode(`${rawText} ${fileName}`);
  const idDocumento = createDocumentId(
    pdfDocument.filePath || fileName,
    pdfDocument.index || 0,
    codigoDocumento,
    pdfDocument.fileHash || "",
    DOCUMENT_TYPE
  );
  const fields = extractDocumentFields(rawText);
  const date = parseAgreementDate(rawText);
  const periodo = extractPeriodoFromCodigo(codigoDocumento);
  const warnings = [];
  if (!codigoDocumento) warnings.push("No se detectó código institucional RGI2 PRO-134.");
  if (!fields.docente) warnings.push("No se detectó nombre del docente.");
  if (!fields.cedula) warnings.push("No se detectó cédula del docente.");
  if (!fields.capacitacion) warnings.push("No se detectó nombre de la capacitación.");
  if (!date.fecha_iso) warnings.push("No se detectó una fecha completa del acuerdo.");

  const context = {
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    periodo,
    docente: fields.docente,
    capacitacion: fields.capacitacion
  };
  const apoyos = extractSupports(rawText, context);
  const responsables = extractResponsibleRows(rawText, context, fileName);
  const selectedSupports = apoyos.filter((row) => row.seleccionado === "SI");
  if (!selectedSupports.length) warnings.push("No se detectó ningún apoyo institucional marcado.");

  const archivo = {
    id: createRowId("archivo-acuerdo", idDocumento, 0, fileName),
    id_documento: idDocumento,
    nombre_archivo: fileName,
    ruta_archivo: pdfDocument.filePath || "",
    hash_archivo: pdfDocument.fileHash || "",
    codigo_documento: codigoDocumento,
    numero_registro: extractRegistroFromCodigo(codigoDocumento),
    periodo,
    anio_periodo: periodo.split("-")[0] || "",
    mes_periodo: periodo.split("-")[1] || "",
    total_paginas: pdfDocument.pageCount || 0,
    metodo_extraccion: pdfDocument.extractionMethod || "digital",
    paginas_digitales: pdfDocument.digitalPageCount || 0,
    paginas_ocr: pdfDocument.ocrPageCount || 0,
    confianza_ocr: pdfDocument.ocrConfidence || 0,
    estado_extraccion: warnings.length ? "REVISAR" : "OK",
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };

  const datosAcuerdo = {
    id: createRowId("datos-acuerdo", idDocumento, 0, fields.docente),
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    periodo,
    ciudad_acuerdo: date.ciudad,
    fecha_acuerdo: date.fecha_iso,
    fecha_acuerdo_texto: date.fecha_texto,
    nombre_docente: fields.docente,
    cedula_docente: fields.cedula,
    carrera: fields.carrera,
    vinculacion_institucional: fields.vinculacion,
    nombre_capacitacion: fields.capacitacion,
    total_apoyos_marcados: selectedSupports.length,
    apoyo_principal: selectedSupports.map((row) => row.tipo_apoyo).join(" | "),
    porcentaje_financiamiento_parcial: selectedSupports.find((row) => /parcial/i.test(row.tipo_apoyo))?.porcentaje_financiamiento || "",
    total_responsables: responsables.length,
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };

  return {
    document_type: DOCUMENT_TYPE,
    id_documento: idDocumento,
    archivo,
    datos_acuerdo: datosAcuerdo,
    apoyos,
    responsables,
    warnings,
    source: {
      file_hash: pdfDocument.fileHash || "",
      extraction_method: pdfDocument.extractionMethod || "digital",
      digital_pages: pdfDocument.digitalPageCount || 0,
      ocr_pages: pdfDocument.ocrPageCount || 0,
      ocr_confidence: pdfDocument.ocrConfidence || 0,
      text_length: rawText.length
    }
  };
}

function parseDocuments(pdfDocuments) {
  const parsed = [];
  const errors = [];
  (Array.isArray(pdfDocuments) ? pdfDocuments : []).forEach((document) => {
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
      errors.push({ fileName: document.fileName || "", errors: [error.message || "No se pudo analizar el acuerdo."] });
    }
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
  SUPPORT_TYPES,
  normalizeInstitutionalCode,
  parseAgreementCode,
  extractDocumentFields,
  parseAgreementDate,
  extractSupports,
  extractResponsibleRows,
  parseDocument,
  parseDocuments
};
