/* =========================================================
Nombre completo: parser.js
Ruta o ubicación: /src/document-types/acuerdo-patrocinio/parser.js
Función o funciones:
- Extraer los datos variables de Acuerdos de Patrocinio Institucional.
- Reconocer docente, cédula, carrera, capacitación, fecha y código.
- Identificar apoyos institucionales marcados y porcentajes parciales.
- Extraer responsables, cargos y estado inferido de firma.
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
  findValueByLabel,
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

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  const compact = normalizeInstitutionalCode(text);
  const match = compact.match(/(?:UGPA|CGC)-RGI2-\d{1,3}-PRO-134-\d{4}-\d{2}/i);
  return match ? match[0].toUpperCase() : "";
}

function extractCoverFallbackCareer(text) {
  return firstMatch(normalizeLineBreaks(text), [
    /DOCENTE\s*:\s*[^\n]+\n([^\n]+)\n\s*CAPACITACI[ÓO]N\s*:/i
  ]);
}

function extractDocumentFields(text) {
  const raw = normalizeLineBreaks(text);
  const docente = findValueByLabel(raw, ["Docente"], { maxLookAhead: 2 }) || firstMatch(normalizeSpaces(raw), [
    /señor\(a\)\s+(.+?),\s+con número de c[ée]dula/i,
    /señor\(a\)\s+(.+?),\s+quien en lo sucesivo/i
  ]);
  const carrera = findValueByLabel(raw, ["Carrera"], { maxLookAhead: 1 }) || extractCoverFallbackCareer(raw);
  const capacitacion = findValueByLabel(raw, ["Capacitación", "Capacitacion"], { maxLookAhead: 2 }) || firstMatch(normalizeSpaces(raw), [
    /participaci[óo]n de El Colaborador en la capacitaci[óo]n\s+(.+?),\s+con el objetivo/i
  ]);
  const cedula = firstMatch(normalizeSpaces(raw), [
    /número de c[ée]dula\s+([A-Za-z0-9-]{5,20})/i,
    /c[ée]dula\s*:\s*([A-Za-z0-9-]{5,20})/i
  ]);
  const vinculacion = firstMatch(normalizeSpaces(raw), [
    /se encuentra vinculado\(a\) como\s+(.+?)\s+en el ITSQMET/i
  ]);

  return {
    docente: cleanValue(docente),
    carrera: cleanValue(carrera),
    capacitacion: cleanValue(capacitacion),
    cedula: cleanValue(cedula),
    vinculacion: cleanValue(vinculacion)
  };
}

function parseAgreementDate(text) {
  const compact = normalizeSpaces(text);
  const match = compact.match(/En la ciudad de\s+(.+?),\s+a los\s+(\d{1,2})\s+d[ií]as del mes de\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+)\s+de\s+(\d{4})/i);

  if (!match) {
    return {
      ciudad: "",
      fecha_texto: "",
      fecha_iso: "",
      dia: "",
      mes: "",
      anio: ""
    };
  }

  const city = cleanValue(match[1]);
  const day = String(Number(match[2])).padStart(2, "0");
  const monthText = normalizeForSearch(match[3]);
  const month = /^\d{1,2}$/.test(monthText)
    ? String(Number(monthText)).padStart(2, "0")
    : (MONTHS[monthText] || "");
  const year = match[4];

  return {
    ciudad: city,
    fecha_texto: `${match[2]} de ${match[3]} de ${year}`,
    fecha_iso: month ? `${year}-${month}-${day}` : "",
    dia: day,
    mes: month,
    anio: year
  };
}

function extractSupportSection(text) {
  const source = normalizeLineBreaks(text);
  const start = source.search(/El patrocinio institucional comprende los siguientes/i);
  if (start < 0) return source;
  const remaining = source.slice(start);
  const end = remaining.search(/COMPROMISOS(?: DEL COLABORADOR)?|Compromisos/i);
  return end > 0 ? remaining.slice(0, end) : remaining;
}

function findSupportSegment(section, supportType, allTypes) {
  const compact = normalizeSpaces(section);
  const search = normalizeForSearch(compact);
  const label = normalizeForSearch(supportType);
  const start = search.indexOf(label);

  if (start < 0) return "";

  let end = compact.length;
  for (const otherType of allTypes) {
    if (otherType === supportType) continue;
    const found = search.indexOf(normalizeForSearch(otherType), start + label.length);
    if (found >= 0 && found < end) end = found;
  }

  return cleanValue(compact.slice(start + supportType.length, end));
}

function extractSupports(text, context) {
  const section = extractSupportSection(text);
  const lines = splitCleanLines(section);
  const rows = [];

  SUPPORT_TYPES.forEach((supportType, index) => {
    const lineIndex = lines.findIndex((line) => normalizeForSearch(line).includes(normalizeForSearch(supportType)));
    const line = lineIndex >= 0 ? lines[lineIndex] : "";
    const nextLine = lineIndex >= 0 ? (lines[lineIndex + 1] || "") : "";
    const segment = findSupportSegment(section, supportType, SUPPORT_TYPES);
    const markText = `${line} ${/^\s*(?:x|×|☒|■|✓|✔)\s*$/i.test(nextLine) ? nextLine : ""} ${segment}`;
    const percentageMatch = markText.match(/(?:porcentaje\s*:?\s*|\b)(\d{1,3})\s*%/i);
    const selected = /(?:^|\s)(?:x|×|☒|■|✓|✔)(?:\s|$)/i.test(markText) || Boolean(percentageMatch);
    const percentage = percentageMatch ? Number(percentageMatch[1]) : "";
    const warnings = [];

    if (!line && !segment) warnings.push("No se localizó la opción en el documento.");
    if (/parcial/i.test(supportType) && selected && percentage === "") {
      warnings.push("El financiamiento parcial está marcado, pero no se detectó porcentaje.");
    }

    rows.push({
      id: createRowId("apoyo-patrocinio", context.id_documento, index, supportType),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      docente: context.docente,
      capacitacion: context.capacitacion,
      tipo_apoyo: supportType,
      seleccionado: selected ? "SI" : "NO",
      porcentaje_financiamiento: percentage,
      evidencia_texto: cleanValue(line || segment),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    });
  });

  return rows;
}

function normalizeRole(value) {
  const role = normalizeForSearch(value);
  if (role.includes("elaborado")) return "ELABORADO POR";
  if (role.includes("revisado")) return "REVISADO POR";
  if (role.includes("aprobado")) return "APROBADO POR";
  if (role.includes("firma")) return "COLABORADOR";
  return String(value || "").toUpperCase();
}

function inferSignatureStatus(fileName, name) {
  if (/firmado|signed/i.test(fileName || "")) return "FIRMADO_SEGUN_ARCHIVO";
  if (name) return "RESPONSABLE_IDENTIFICADO";
  return "NO_IDENTIFICADO";
}

function extractResponsibleRows(text, context, fileName) {
  const source = normalizeLineBreaks(text);
  const firstBodyIndex = source.search(/En la ciudad de/i);
  const cover = normalizeSpaces(firstBodyIndex > 0 ? source.slice(0, firstBodyIndex) : source.slice(0, 6000));
  const roleMatches = [...cover.matchAll(/(ELABORADO POR|REVISADO POR|APROBADO POR|FIRMA|APROBADO)\s*:/gi)]
    .map((match) => normalizeRole(match[1]));
  const names = uniqueValues(
    [...cover.matchAll(/NOMBRE\s*:\s*(.+?)(?=\s+NOMBRE\s*:|\s+CARGO\s*:|\s+P[ÁA]GINA|$)/gi)]
      .map((match) => cleanValue(match[1]))
  );
  const cargos = [...cover.matchAll(/CARGO\s*:\s*(.+?)(?=\s+CARGO\s*:|\s+NOMBRE\s*:|\s+P[ÁA]GINA|$)/gi)]
    .map((match) => cleanValue(match[1]));
  const roles = roleMatches.length ? roleMatches : ["COLABORADOR", "APROBADO POR"];
  const count = Math.max(roles.length, names.length, cargos.length);
  const rows = [];

  for (let index = 0; index < count; index += 1) {
    const role = roles[index] || `RESPONSABLE ${index + 1}`;
    const name = names[index] || "";
    const cargo = cargos[index] || "";
    const warnings = [];

    if (!name) warnings.push("No se detectó nombre del responsable.");
    if (!cargo) warnings.push("No se detectó cargo del responsable.");

    rows.push({
      id: createRowId("responsable-patrocinio", context.id_documento, index, `${role}|${name}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      docente: context.docente,
      rol_responsable: role,
      nombre_responsable: name,
      cargo_responsable: cargo,
      estado_firma: inferSignatureStatus(fileName, name),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    });
  }

  return rows;
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

  if (!codigoDocumento) warnings.push("No se detectó código institucional PRO-134.");
  if (!fields.docente) warnings.push("No se detectó nombre del docente.");
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
  if (!responsables.length) warnings.push("No se detectaron responsables del acuerdo.");

  const archivo = {
    id: createRowId("archivo-acuerdo", idDocumento, 0, fileName),
    id_documento: idDocumento,
    nombre_archivo: fileName,
    ruta_archivo: pdfDocument.filePath || "",
    hash_archivo: pdfDocument.fileHash || "",
    codigo_documento: codigoDocumento,
    prefijo_institucional: codigoDocumento.split("-")[0] || "",
    numero_registro: extractRegistroFromCodigo(codigoDocumento),
    periodo,
    anio_periodo: periodo.split("-")[0] || "",
    mes_periodo: periodo.split("-")[1] || "",
    total_paginas: pdfDocument.pageCount || 0,
    metodo_extraccion: pdfDocument.extractionMethod || "digital",
    paginas_ocr: pdfDocument.ocrPageCount || 0,
    confianza_ocr: pdfDocument.ocrConfidence || 0,
    estado_firma_documento: inferSignatureStatus(fileName, responsables.some((row) => row.nombre_responsable)),
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
    dia_acuerdo: date.dia,
    mes_acuerdo: date.mes,
    anio_acuerdo: date.anio,
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
        errors: [error.message || "No se pudo analizar el Acuerdo de Patrocinio."]
      });
    }
  });

  return {
    documentType: DOCUMENT_TYPE,
    total: documents.length,
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
