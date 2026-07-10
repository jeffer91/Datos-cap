/* =========================================================
Nombre completo: parser.js
Ruta o ubicación: /src/document-types/planificacion-curso/parser.js
Función o funciones:
- Extraer los datos variables de Planificaciones de Capacitación por Curso.
- Reconocer datos generales, opciones marcadas, responsables y fechas.
- Extraer unidades con horas y logros de aprendizaje.
- Extraer parámetros e instrumentos de evaluación.
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
  parseCodigoDocumento,
  uniqueValues
} = require("../../extractor/normalizer");
const {
  createDocumentId,
  createRowId,
  extractRegistroFromCodigo,
  extractPeriodoFromCodigo
} = require("../../utils/ids");

const DOCUMENT_TYPE = "planificacion-curso";

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripRepeatedNoise(text) {
  return normalizeLineBreaks(text)
    .replace(/UNIDAD DE GESTI[ÓO]N DE PROCESOS ACAD[ÉE]MICOS/gi, " ")
    .replace(/P[ÁA]GINA\s+\d+\s+DE\s+\d+/gi, " ")
    .replace(/C[ÓO]DIGO:\s*UGPA-(?:RGI1|RGI2|INF)-\d{1,3}-PRO-?134-\d{4}-\d{2}/gi, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractNumberedSection(text, headingPattern, nextHeadingPatterns) {
  const source = normalizeLineBreaks(text);
  const compact = normalizeSpaces(source);
  const starts = Array.isArray(headingPattern) ? headingPattern : [headingPattern];
  const ends = Array.isArray(nextHeadingPatterns) ? nextHeadingPatterns : [nextHeadingPatterns];

  for (const start of starts) {
    const startRegex = start instanceof RegExp ? start : new RegExp(escapeRegex(start), "i");
    const startMatch = compact.match(startRegex);

    if (!startMatch || typeof startMatch.index !== "number") {
      continue;
    }

    const from = startMatch.index + startMatch[0].length;
    let endIndex = compact.length;

    for (const end of ends) {
      const endRegex = end instanceof RegExp ? new RegExp(end.source, end.flags.includes("g") ? end.flags : `${end.flags}g`) : new RegExp(escapeRegex(end), "ig");
      endRegex.lastIndex = from;
      const endMatch = endRegex.exec(compact);

      if (endMatch && endMatch.index < endIndex) {
        endIndex = endMatch.index;
      }
    }

    return cleanValue(compact.slice(from, endIndex));
  }

  return "";
}

function detectMarkedOption(sectionText, options) {
  const source = normalizeLineBreaks(sectionText);
  const lines = splitCleanLines(source);
  const candidates = Array.isArray(options) ? options : [];

  for (const option of candidates) {
    const optionSearch = normalizeForSearch(option);

    for (const line of lines) {
      const lineSearch = normalizeForSearch(line);
      const marked = /^(?:x|×|☒|■|✓|✔)\s+/i.test(line) || /\s+(?:x|×|☒|■|✓|✔)$/i.test(line);

      if (marked && lineSearch.includes(optionSearch)) {
        return option;
      }
    }

    const compact = normalizeSpaces(source);
    const escaped = escapeRegex(option).replace(/\\ /g, "\\s+");
    const pattern = new RegExp(`(?:^|\\s)(?:X|×|☒|■|✓|✔)\\s+${escaped}(?=\\s|$)`, "i");

    if (pattern.test(compact)) {
      return option;
    }
  }

  return "";
}

function extractCourseName(text) {
  return firstMatch(normalizeSpaces(text), [
    /1\.\s*NOMBRE DEL CURSO\s*:?\s*["“]?(.+?)["”]?\s+2\.\s*DESCRIPCI[ÓO]N DEL CURSO/i,
    /PLANIFICACI[ÓO]N DE (?:LA )?CAPACITACI[ÓO]N\s*:\s*(.+?),\s*DIRIGIDO A/i
  ]);
}

function extractDescription(text) {
  return extractNumberedSection(text,
    /2\.\s*DESCRIPCI[ÓO]N DEL CURSO\s*:?/i,
    [/3\.\s*FORMA DE EJECUCI[ÓO]N/i]
  );
}

function extractDirectedTo(text) {
  return extractNumberedSection(text,
    /8\.\s*DIRIGIDO A\s*:?/i,
    [/9\.\s*ARTICULACI[ÓO]N DEL CURSO/i, /9\.\s*TEXTO Y OTRAS REFERENCIAS/i]
  );
}

function extractObjective(text) {
  return extractNumberedSection(text,
    /\d+\.\s*OBJETIVOS? GENERALES? DEL CURSO[^\n]*?(?:CURSO\))?\s*/i,
    [/\d+\.\s*T[ÓO]PICOS O TEMAS CUBIERTOS/i]
  );
}

function extractEnvironment(text) {
  return extractNumberedSection(text,
    /\d+\.\s*AMBIENTES? DE APRENDIZAJE\s*:?/i,
    [/\d+\.\s*EVALUACI[ÓO]N DEL CURSO/i]
  );
}

function extractFacilitator(text) {
  const section = extractNumberedSection(text,
    /\d+\.\s*FACILITADOR(?: DE LA CAPACITACI[ÓO]N)?\s*:?/i,
    [/\d+\.\s*ANEXOS/i, /ELABORADO POR/i]
  );

  if (!section) {
    return "";
  }

  return firstMatch(section, [
    /NOMBRE\s*:?\s*(.+?)(?:\s+CARGO\s*:|\s+PERFIL\s*:|$)/i,
    /^(.+?)(?:\s+CARGO\s*:|\s+PERFIL\s*:|$)/i
  ]);
}

function extractDateByLabel(text, labels) {
  const compact = normalizeSpaces(text);

  for (const label of labels) {
    const regex = new RegExp(`${escapeRegex(label)}\\s*:?\\s*(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}|\\d{1,2}\\s*(?:de|-)?\\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\\s*(?:de|-)?\\s*\\d{4})`, "i");
    const match = compact.match(regex);
    if (match) return cleanValue(match[1]);
  }

  return "";
}

function extractSignatories(text) {
  const cover = normalizeSpaces(text).slice(0, 5000);
  const matches = [...cover.matchAll(/NOMBRE\s*:\s*(.+?)(?=\s+NOMBRE\s*:|\s+CARGO\s*:|$)/gi)]
    .map((match) => cleanValue(match[1]))
    .filter(Boolean);
  const names = uniqueValues(matches).slice(0, 3);

  const cargoMatches = [...cover.matchAll(/CARGO\s*:\s*(.+?)(?=\s+CARGO\s*:|\s+NOMBRE\s*:|$)/gi)]
    .map((match) => cleanValue(match[1]))
    .filter(Boolean);
  const cargos = uniqueValues(cargoMatches).slice(0, 3);

  return {
    elaborado_por: names[0] || "",
    cargo_elaborador: cargos[0] || "",
    revisado_por: names[1] || "",
    cargo_revisor: cargos[1] || "",
    aprobado_por: names[2] || "",
    cargo_aprobador: cargos[2] || ""
  };
}

function inferTargetCareer(text, directedTo) {
  const titleTarget = firstMatch(normalizeSpaces(text), [
    /DIRIGIDO A\s+(.+?)(?:\s+P[ÁA]GINA|\s+ELABORADO POR|\s+UNIDAD DE GESTI[ÓO]N|$)/i
  ]);

  if (/TODAS LAS CARRERAS/i.test(titleTarget)) {
    return "Todas las carreras";
  }

  const career = firstMatch(`${titleTarget} ${directedTo}`, [
    /CARRERA(?:S)?(?: DE)?\s+([A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s,&-]{3,100})/i
  ]);

  return cleanValue(career || titleTarget);
}

function findHoursTriple(blockText) {
  const matches = [...normalizeSpaces(blockText).matchAll(/\b(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\b/g)];
  if (!matches.length) return null;

  const match = matches[matches.length - 1];
  return {
    index: match.index,
    full: match[0],
    teoricas: Number(match[1]),
    practicas: Number(match[2]),
    autonomo: Number(match[3])
  };
}

function extractUnitNameAndContent(preHoursText, unitHeader) {
  const source = normalizeLineBreaks(preHoursText);
  const lines = splitCleanLines(source);
  const headerRemainder = cleanValue(String(unitHeader || "").replace(/^UNIDAD\s+\d+\s*:?/i, ""));
  const candidates = headerRemainder ? [headerRemainder, ...lines] : lines;
  const nameLines = [];
  let length = 0;

  for (const line of candidates) {
    if (nameLines.length >= 5) break;
    nameLines.push(line);
    length += line.length;
    if (length >= 35 && nameLines.length >= 2) break;
  }

  const name = cleanValue(nameLines.join(" "));
  let content = normalizeSpaces(source);

  for (const line of nameLines) {
    const position = normalizeForSearch(content).indexOf(normalizeForSearch(line));
    if (position >= 0) {
      content = cleanValue(content.slice(position + line.length));
    }
  }

  return {
    nombre: name,
    contenido: content
  };
}

function extractUnits(text, context) {
  const section = extractNumberedSection(text,
    /\d+\.\s*T[ÓO]PICOS O TEMAS CUBIERTOS\s*:?/i,
    [/\d+\.\s*(?:RECURSOS|MATERIALES|AMBIENTES? DE APRENDIZAJE|EVALUACI[ÓO]N DEL CURSO)/i]
  );
  const source = normalizeLineBreaks(section);
  const markerRegex = /UNIDAD\s+(\d+)\s*:\s*([^\n]*)/gi;
  const markers = [...source.matchAll(markerRegex)];
  const units = [];

  markers.forEach((marker, index) => {
    const start = marker.index + marker[0].length;
    const end = index + 1 < markers.length ? markers[index + 1].index : source.length;
    const block = cleanValue(source.slice(start, end));
    const hours = findHoursTriple(block);
    const compactBlock = normalizeSpaces(block);
    const beforeHours = hours ? compactBlock.slice(0, hours.index) : compactBlock;
    const afterHours = hours ? compactBlock.slice(hours.index + hours.full.length) : "";
    const nameContent = extractUnitNameAndContent(beforeHours, marker[0]);
    const theoretical = hours ? hours.teoricas : 0;
    const practical = hours ? hours.practicas : 0;
    const autonomous = hours ? hours.autonomo : 0;
    const total = theoretical + practical + autonomous;
    const warnings = [];

    if (!nameContent.nombre) warnings.push("No se detectó nombre de unidad.");
    if (!hours) warnings.push("No se detectaron las tres cargas horarias.");
    if (!afterHours) warnings.push("No se detectó logro de aprendizaje.");

    units.push({
      id: createRowId("unidad-capacitacion", context.id_documento, units.length, marker[0]),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      nombre_curso: context.nombre_curso,
      numero_unidad: Number(marker[1]),
      nombre_unidad: nameContent.nombre,
      contenidos: nameContent.contenido,
      horas_teoricas: theoretical,
      horas_practicas: practical,
      trabajo_autonomo: autonomous,
      total_horas: total,
      logro_aprendizaje: cleanValue(afterHours),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    });
  });

  return units;
}

function inferEvaluationType(parameter) {
  if (/PARCIAL|FINAL/i.test(parameter)) return "Sumativa";
  if (/TRABAJO|EXPOSICI[ÓO]N|INVESTIGACI[ÓO]N/i.test(parameter)) return "Formativa";
  return "";
}

function extractEvaluations(text, context) {
  const section = extractNumberedSection(text,
    /\d+\.\s*EVALUACI[ÓO]N DEL CURSO\s*:?/i,
    [/\d+\.\s*FACILITADOR/i, /\d+\.\s*ANEXOS/i, /ELABORADO POR/i]
  );
  const compact = normalizeSpaces(section)
    .replace(/PAR[ÁA]METROS? DE EVALUACI[ÓO]N/gi, " ")
    .replace(/TEM[ÁA]TICA/gi, " ")
    .replace(/N[ÚU]MERO DE INSTRUMENTOS? DE EVALUACI[ÓO]N/gi, " ");
  const parameters = [
    "Exposiciones u Otros",
    "Trabajo Grupal",
    "Trabajo de Investigación",
    "Evaluación parcial",
    "Evaluación final",
    "Otros (especificar)"
  ];
  const rows = [];

  parameters.forEach((parameter) => {
    const regex = new RegExp(`${escapeRegex(parameter).replace(/\\ /g, "\\s+")}\\s*(.*?)\\s+(\\d{1,3})(?=\\s|$)`, "i");
    const match = compact.match(regex);

    if (match) {
      rows.push({
        id: createRowId("evaluacion-capacitacion", context.id_documento, rows.length, parameter),
        id_documento: context.id_documento,
        codigo_documento: context.codigo_documento,
        nombre_curso: context.nombre_curso,
        orden_evaluacion: rows.length + 1,
        parametro_evaluacion: parameter,
        tematica_evaluada: cleanValue(match[1]),
        numero_instrumentos: Number(match[2]),
        tipo_evaluacion: inferEvaluationType(parameter),
        requiere_revision: "NO",
        observacion_extraccion: ""
      });
    }
  });

  return rows;
}

function parseDocument(pdfDocument) {
  const rawText = normalizeLineBreaks(pdfDocument.text || "");
  const text = stripRepeatedNoise(rawText);
  const fileName = pdfDocument.fileName || path.basename(pdfDocument.filePath || "");
  const codigoDocumento = parseCodigoDocumento(`${rawText} ${fileName}`, "134");
  const idDocumento = createDocumentId(
    pdfDocument.filePath || fileName,
    pdfDocument.index || 0,
    codigoDocumento,
    pdfDocument.fileHash || "",
    DOCUMENT_TYPE
  );
  const nombreCurso = extractCourseName(text);
  const descripcion = extractDescription(text);
  const dirigidoA = extractDirectedTo(text);
  const responsables = extractSignatories(rawText);
  const formaSection = extractNumberedSection(text, /3\.\s*FORMA DE EJECUCI[ÓO]N[^)]*\)?/i, [/4\.\s*TIPO DE CAPACITACI[ÓO]N/i]);
  const tipoSection = extractNumberedSection(text, /4\.\s*TIPO DE CAPACITACI[ÓO]N[^)]*\)?/i, [/5\.\s*CAR[ÁA]CTER/i]);
  const caracterSection = extractNumberedSection(text, /5\.\s*CAR[ÁA]CTER[^)]*\)?/i, [/6\.\s*MODALIDAD/i]);
  const modalidadSection = extractNumberedSection(text, /6\.\s*MODALIDAD[^)]*\)?/i, [/7\.\s*TIPO DE CERTIFICADO/i]);
  const certificadoSection = extractNumberedSection(text, /7\.\s*TIPO DE CERTIFICADO[^)]*\)?/i, [/8\.\s*DIRIGIDO A/i]);
  const warnings = [];

  if (!codigoDocumento) warnings.push("No se detectó código PRO-134.");
  if (!nombreCurso) warnings.push("No se detectó nombre del curso.");

  const context = {
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    nombre_curso: nombreCurso
  };
  const unidades = extractUnits(text, context);
  const evaluaciones = extractEvaluations(text, context);
  const totalHoras = unidades.reduce((sum, unit) => sum + Number(unit.total_horas || 0), 0);

  if (!unidades.length) warnings.push("No se detectaron unidades del curso.");
  if (!evaluaciones.length) warnings.push("No se detectaron evaluaciones del curso.");

  const periodo = extractPeriodoFromCodigo(codigoDocumento);
  const archivo = {
    id: createRowId("archivo-planificacion", idDocumento, 0, fileName),
    id_documento: idDocumento,
    nombre_archivo: fileName,
    ruta_archivo: pdfDocument.filePath || "",
    hash_archivo: pdfDocument.fileHash || "",
    codigo_documento: codigoDocumento,
    numero_registro: extractRegistroFromCodigo(codigoDocumento),
    periodo,
    anio_periodo: periodo.split("-")[0] || "",
    mes_periodo: periodo.split("-")[1] || "",
    version_documento: firstMatch(rawText, [/VERSI[ÓO]N\s*:\s*([^\n]+)/i]),
    fecha_elaboracion: firstMatch(rawText, [/FECHA DE ELABORACI[ÓO]N\s*:\s*([^\n]+)/i]),
    total_paginas: pdfDocument.pageCount || 0,
    metodo_extraccion: pdfDocument.extractionMethod || "digital",
    paginas_ocr: pdfDocument.ocrPageCount || 0,
    confianza_ocr: pdfDocument.ocrConfidence || 0,
    estado_extraccion: warnings.length ? "REVISAR" : "OK",
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };

  const datosGenerales = {
    id: createRowId("datos-planificacion", idDocumento, 0, nombreCurso),
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    periodo,
    nombre_curso: nombreCurso,
    descripcion_curso: descripcion,
    dirigido_a: dirigidoA,
    carrera_publico: inferTargetCareer(rawText, dirigidoA),
    forma_ejecucion: detectMarkedOption(formaSection, ["CURSO", "SEMINARIO", "TALLER", "CONFERENCIA", "OTRA"]),
    tipo_capacitacion: detectMarkedOption(tipoSection, ["CAPACITACIÓN CONCRETA ESPECÍFICA", "CAPACITACIÓN INTELECTUAL GENÉRICA"]),
    caracter_capacitacion: detectMarkedOption(caracterSection, ["NACIONAL", "INTERNACIONAL"]),
    modalidad: detectMarkedOption(modalidadSection, ["PRESENCIAL", "SEMI PRESENCIAL", "VIRTUAL", "HÍBRIDA"]),
    tipo_certificado: detectMarkedOption(certificadoSection, ["APROBACIÓN", "PARTICIPACIÓN"]),
    objetivo_general: extractObjective(text),
    fecha_inicio: extractDateByLabel(text, ["Fecha de inicio", "Inicio del curso"]),
    fecha_fin: extractDateByLabel(text, ["Fecha de finalización", "Fecha de fin", "Fin del curso"]),
    ambiente_aprendizaje: extractEnvironment(text),
    facilitador: extractFacilitator(text),
    total_horas: totalHoras,
    ...responsables,
    requiere_revision: (!nombreCurso || !descripcion || !unidades.length) ? "SI" : "NO",
    observacion_extraccion: (!nombreCurso || !descripcion || !unidades.length)
      ? "Faltan datos generales o unidades esenciales."
      : ""
  };

  return {
    document_type: DOCUMENT_TYPE,
    id_documento: idDocumento,
    archivo,
    datos_generales: datosGenerales,
    unidades,
    evaluaciones,
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
        errors: [error.message || "No se pudo analizar la planificación."]
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
  stripRepeatedNoise,
  extractNumberedSection,
  detectMarkedOption,
  extractCourseName,
  extractDescription,
  extractDirectedTo,
  extractObjective,
  extractEnvironment,
  extractFacilitator,
  extractUnits,
  extractEvaluations,
  parseDocument,
  parseDocuments
};
