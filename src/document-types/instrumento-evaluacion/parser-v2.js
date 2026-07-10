/* =========================================================
Nombre completo: parser-v2.js
Ruta o ubicación: /src/document-types/instrumento-evaluacion/parser-v2.js
Función o funciones:
- Corregir la identificación de participantes para evitar confundir apellidos con cédulas.
- Admitir identificaciones numéricas y alfanuméricas que contengan al menos un dígito.
- Completar el indicador de seguimiento ubicado al final de la tabla cuantitativa.
- Normalizar correctamente valores como 9/10 sin convertirlos en 910.
========================================================= */

"use strict";

const base = require("./parser");
const {
  normalizeSpaces,
  normalizeForSearch,
  cleanValue
} = require("../../extractor/normalizer");
const { createRowId } = require("../../utils/ids");

function cleanParticipantSection(section) {
  return normalizeSpaces(section)
    .replace(/#|N[º°]/g, " ")
    .replace(/Nombres y Apellidos/gi, " ")
    .replace(/C[ée]dula de Identidad/gi, " ")
    .replace(/Tiene discapacidad/gi, " ")
    .replace(/Tipo de discapacidad/gi, " ")
    .replace(/posee carn[ée] de discapacidad/gi, " ")
    .replace(/G[ée]nero/gi, " ")
    .replace(/SI\s+NO\s+SI\s+NO/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGender(value) {
  const gender = normalizeForSearch(value);
  if (gender === "m" || gender.includes("masculino")) return "Masculino";
  if (gender === "f" || gender.includes("femenino")) return "Femenino";
  return cleanValue(value);
}

function extractParticipants(text, context) {
  const section = base.extractSection(text,
    /2\.\s*MATRIZ CON LOS DATOS DE LOS PARTICIPANTES\s*:?/i,
    /3\.\s*RESULTADOS DE EVALUACI[ÓO]N\s*:?/i
  );
  const compact = cleanParticipantSection(section);
  const identificationPattern = "(?:\\d{7,12}|(?=[A-Z0-9-]{6,20}\\b)(?=[A-Z0-9-]*\\d)[A-Z0-9-]{6,20})";
  const regex = new RegExp(`(\\d{1,3})\\s+(.+?)\\s+(${identificationPattern})\\s+(.+?)\\s+(Masculino|Femenino|M|F)(?=\\s+\\d{1,3}\\s+|$)`, "gi");
  const rows = [];
  let match;

  while ((match = regex.exec(compact)) !== null) {
    const flags = base.inferParticipantFlags(match[4]);
    const identification = cleanValue(match[3]);
    const warnings = [];

    if (!/^\d{10}$/.test(identification)) {
      warnings.push("La identificación no tiene 10 dígitos; revisar si corresponde a una persona extranjera.");
    }
    if (flags.observacion) warnings.push(flags.observacion);

    rows.push({
      id: createRowId("participante-instrumento", context.id_documento, rows.length, `${match[1]}|${identification}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      nombre_curso: context.nombre_curso,
      numero_participante: Number(match[1]),
      nombres_apellidos: cleanValue(match[2]),
      cedula_identidad: identification,
      tiene_discapacidad: flags.tiene_discapacidad,
      tipo_discapacidad: flags.tipo_discapacidad,
      posee_carne_discapacidad: flags.posee_carne_discapacidad,
      genero: normalizeGender(match[5]),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    });
  }

  return rows;
}

function parseNumericResult(value) {
  const match = String(value || "").match(/-?\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(",", ".")) : "";
}

function patchIndicators(text, indicators) {
  const rows = Array.isArray(indicators) ? indicators.map((row) => ({
    ...row,
    resultado_numerico: parseNumericResult(row.resultado_texto)
  })) : [];
  const followUp = rows.find((row) => row.criterio === "Seguimiento Post-Curso");

  if (followUp && !followUp.resultado_texto) {
    const compact = normalizeSpaces(text);
    const match = compact.match(/Seguimiento Post.?Curso\s+N[úu]mero de participantes que han recibido seguimiento\s+([0-9]+(?:[.,][0-9]+)?)\s*(.*?)(?=B\.\s*Evaluaci[óo]n Cualitativa|Evaluaci[óo]n Cualitativa|$)/i);

    if (match) {
      followUp.resultado_texto = cleanValue(match[1]);
      followUp.resultado_numerico = parseNumericResult(match[1]);
      followUp.observaciones = cleanValue(match[2] || "");
      followUp.requiere_revision = "NO";
      followUp.observacion_extraccion = "";
    }
  }

  return rows;
}

function recalculateGeneral(document) {
  const participants = document.participantes || [];
  const indicators = document.indicadores || [];
  const genders = participants.reduce((output, participant) => {
    const gender = normalizeForSearch(participant.genero);
    if (gender.includes("masculino")) output.masculino += 1;
    else if (gender.includes("femenino")) output.femenino += 1;
    else output.otro += 1;
    return output;
  }, { masculino: 0, femenino: 0, otro: 0 });

  document.datos_generales = {
    ...document.datos_generales,
    total_participantes: participants.length,
    total_masculino: genders.masculino,
    total_femenino: genders.femenino,
    total_otro_genero: genders.otro,
    total_indicadores: indicators.length,
    indicadores_con_resultado: indicators.filter((row) => row.resultado_texto !== "").length
  };

  document.warnings = (document.warnings || []).filter((warning) => {
    if (participants.length && /No se detectaron participantes/i.test(warning)) return false;
    if (indicators.some((row) => row.resultado_texto) && /No se detectaron resultados cuantitativos/i.test(warning)) return false;
    return true;
  });

  document.archivo.estado_extraccion = document.warnings.length ? "REVISAR" : "OK";
  document.archivo.requiere_revision = document.warnings.length ? "SI" : "NO";
  document.archivo.observacion_extraccion = document.warnings.join(" | ");
  document.datos_generales.requiere_revision = document.warnings.length ? "SI" : "NO";
  document.datos_generales.observacion_extraccion = document.warnings.join(" | ");

  return document;
}

function parseDocument(pdfDocument) {
  const document = base.parseDocument(pdfDocument);
  const context = {
    id_documento: document.id_documento,
    codigo_documento: document.archivo.codigo_documento,
    periodo: document.archivo.periodo,
    nombre_curso: document.datos_generales.nombre_curso
  };

  document.participantes = extractParticipants(pdfDocument.text || "", context);
  document.indicadores = patchIndicators(pdfDocument.text || "", document.indicadores);
  return recalculateGeneral(document);
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
        errors: [error.message || "No se pudo analizar el Instrumento de Evaluación."]
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
  extractParticipants,
  parseNumericResult,
  patchIndicators,
  recalculateGeneral,
  parseDocument,
  parseDocuments
};
