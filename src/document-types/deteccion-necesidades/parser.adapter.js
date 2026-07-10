/* =========================================================
Nombre completo: parser.adapter.js
Ruta o ubicación: /src/document-types/deteccion-necesidades/parser.adapter.js
Función o funciones:
- Reforzar la extracción de filas numeradas de necesidades por carrera.
- Separar correctamente necesidad, tipo y nivel de recurrencia.
- Limpiar encabezados residuales N.º en los nombres de carrera.
- Vincular el porcentaje de recurrencia con la capacitación priorizada.
========================================================= */

"use strict";

const baseParser = require("./parser");
const { normalizeSpaces, normalizeForSearch, cleanValue } = require("../../extractor/normalizer");
const { createRowId } = require("../../utils/ids");

const TYPE_PATTERN = [
  "Disciplinar",
  "Técnica",
  "Tecnológica",
  "Pedagógica",
  "Investigación",
  "Gestión",
  "Transversal",
  "Clínica",
  "Operativa"
].join("|");

const TYPE_MODIFIER_PATTERN = [
  "disciplinar",
  "técnica",
  "tecnológica",
  "pedagógica",
  "investigación",
  "gestión",
  "transversal",
  "clínica",
  "operativa",
  "estratégica",
  "práctica",
  "aplicada",
  "especializada",
  "organizacional",
  "digital",
  "metodológica"
].join("|");

function cleanCareerName(value) {
  return cleanValue(value)
    .replace(/\s+N(?:\.?\s*[º°]|\.)\s*$/i, "")
    .replace(/\s+N[.º°]+\s*$/i, "")
    .trim();
}

function parseTypeAndNeed(value) {
  const compact = cleanValue(value);
  const typeRegex = new RegExp(
    `^(.+?)\\s+((?:${TYPE_PATTERN})(?:\\s*(?:[–—/-]\\s*|\\s+)(?:${TYPE_MODIFIER_PATTERN}))?)$`,
    "i"
  );
  const match = compact.match(typeRegex);

  if (!match) {
    return {
      necesidad: compact,
      tipo: "",
      requiere_revision: "SI",
      observacion_extraccion: "No se pudo separar automáticamente el tipo de necesidad."
    };
  }

  return {
    necesidad: cleanValue(match[1]),
    tipo: cleanValue(match[2]),
    requiere_revision: "NO",
    observacion_extraccion: ""
  };
}

function parseRobustNeedRows(block, context, startIndex) {
  const tablePart = String(block.text || "").split(/Tabla\s+\d+\s+An[áa]lisis(?: cuantitativo)? de recurrencia/i)[0];
  const cleaned = normalizeSpaces(tablePart)
    .replace(/N[.º°]\s+Necesidad de capacitaci[óo]n identificada\s+Tipo de necesidad\s+Nivel de recurrencia/i, " ")
    .replace(/Unidad de Gesti[óo]n[\s\S]*?P[áa]gina\s+\d+\s+de\s+\d+/gi, " ");
  const rowRegex = /(?:^|\s)(\d{1,2})\s+(.+?)(?=\s+\d{1,2}\s+|$)/g;
  const rows = [];
  const career = cleanCareerName(block.carrera);
  let match;

  while ((match = rowRegex.exec(cleaned)) !== null) {
    const levelMatch = cleanValue(match[2]).match(/^(.+?)\s+(Muy alta|Alta|Media|Baja)$/i);
    if (!levelMatch) continue;

    const parsed = parseTypeAndNeed(levelMatch[1]);
    rows.push({
      id: createRowId(
        "necesidad-carrera",
        context.id_documento,
        startIndex + rows.length,
        `${career}|${match[1]}|${parsed.necesidad}`
      ),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      carrera: career,
      numero_necesidad: Number(match[1]),
      necesidad_capacitacion: parsed.necesidad,
      tipo_necesidad: parsed.tipo,
      nivel_recurrencia: cleanValue(levelMatch[2]),
      porcentaje_recurrencia: "",
      fuente_deteccion: "Diagnóstico consolidado",
      es_priorizada: "NO",
      requiere_revision: parsed.requiere_revision,
      observacion_extraccion: parsed.observacion_extraccion
    });
  }

  return rows;
}

function sameTraining(first, second) {
  const normalizedFirst = normalizeForSearch(first);
  const normalizedSecond = normalizeForSearch(second);
  if (!normalizedFirst || !normalizedSecond) return false;
  const firstKey = normalizedFirst.slice(0, Math.min(24, normalizedFirst.length));
  const secondKey = normalizedSecond.slice(0, Math.min(24, normalizedSecond.length));
  return normalizedFirst.includes(secondKey) || normalizedSecond.includes(firstKey);
}

function rebuildCareerNeeds(pdfDocument, parsedDocument) {
  const text = pdfDocument && pdfDocument.text ? pdfDocument.text : "";
  const blocks = baseParser.findCareerBlocks(text);
  const context = {
    id_documento: parsedDocument.id_documento,
    codigo_documento: parsedDocument.archivo.codigo_documento,
    periodo: parsedDocument.archivo.periodo
  };
  const needs = [];

  blocks.forEach((block) => {
    const normalizedBlock = { ...block, carrera: cleanCareerName(block.carrera) };
    const blockNeeds = parseRobustNeedRows(normalizedBlock, context, needs.length);
    baseParser.assignRecurrences(blockNeeds, baseParser.parseRecurrenceRows(normalizedBlock));
    needs.push(...blockNeeds);
  });

  const priorities = Array.isArray(parsedDocument.prioridades_carrera)
    ? parsedDocument.prioridades_carrera
    : [];

  priorities.forEach((priority) => {
    priority.carrera = cleanCareerName(priority.carrera);
    const careerNeeds = needs.filter(
      (need) => normalizeForSearch(need.carrera) === normalizeForSearch(priority.carrera)
    );
    const prioritizedNeed = careerNeeds.find((need) =>
      sameTraining(priority.capacitacion_priorizada, need.necesidad_capacitacion)
    );

    if (!prioritizedNeed) return;
    prioritizedNeed.es_priorizada = "SI";
    if (prioritizedNeed.porcentaje_recurrencia !== "") {
      priority.porcentaje_recurrencia = prioritizedNeed.porcentaje_recurrencia;
    }
  });

  if (needs.length) {
    parsedDocument.necesidades_carrera = needs;
    parsedDocument.datos_generales.total_necesidades_carrera = needs.length;
  }

  return parsedDocument;
}

function parseDocuments(pdfDocuments) {
  const result = baseParser.parseDocuments(pdfDocuments);
  if (!result || !Array.isArray(result.parsed)) return result;

  result.parsed = result.parsed.map((document, index) =>
    rebuildCareerNeeds((pdfDocuments || [])[index] || {}, document)
  );

  return result;
}

module.exports = {
  ...baseParser,
  cleanCareerName,
  parseTypeAndNeed,
  parseRobustNeedRows,
  sameTraining,
  rebuildCareerNeeds,
  parseDocuments
};
