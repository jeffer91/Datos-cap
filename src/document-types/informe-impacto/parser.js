/* =========================================================
Nombre completo: parser.js
Ruta o ubicación: /src/document-types/informe-impacto/parser.js
Función o funciones:
- Extraer datos generales de Informes de Impacto PRO-135.
- Identificar indicadores cualitativos y cuantitativos con porcentajes.
- Extraer metodología, objetivos, análisis, conclusiones y recomendaciones.
- Registrar responsables, trazabilidad e inconsistencias de paginación.
========================================================= */

"use strict";

const path = require("path");
const {
  normalizeLineBreaks,
  normalizeSpaces,
  normalizeForSearch,
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

const DOCUMENT_TYPE = "informe-impacto";

const MONTHS = Object.freeze({
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
  noviembre: "11", diciembre: "12"
});

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cloneRegex(regex, global = false) {
  if (!(regex instanceof RegExp)) return new RegExp(escapeRegex(regex), global ? "ig" : "i");
  let flags = regex.flags;
  if (global && !flags.includes("g")) flags += "g";
  return new RegExp(regex.source, flags);
}

function extractSection(text, startPatterns, endPatterns) {
  const source = normalizeLineBreaks(text);
  const starts = Array.isArray(startPatterns) ? startPatterns : [startPatterns];
  const ends = Array.isArray(endPatterns) ? endPatterns : [endPatterns];

  for (const startPattern of starts) {
    const startRegex = cloneRegex(startPattern, false);
    const startMatch = startRegex.exec(source);
    if (!startMatch) continue;

    const from = startMatch.index + startMatch[0].length;
    let endIndex = source.length;

    for (const endPattern of ends) {
      const endRegex = cloneRegex(endPattern, true);
      endRegex.lastIndex = from;
      const endMatch = endRegex.exec(source);
      if (endMatch && endMatch.index < endIndex) endIndex = endMatch.index;
    }

    return cleanValue(source.slice(from, endIndex));
  }

  return "";
}

function parseSpanishDate(value) {
  const raw = cleanValue(value);
  if (!raw) return "";

  const numeric = raw.match(/^(\d{1,2})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{4})$/);
  if (numeric) {
    return `${numeric[3]}-${String(Number(numeric[2])).padStart(2, "0")}-${String(Number(numeric[1])).padStart(2, "0")}`;
  }

  const written = normalizeForSearch(raw).match(/^(\d{1,2})\s*(?:de|-)?\s*([a-z]+)\s*(?:de|-)?\s*(\d{4})$/);
  if (written && MONTHS[written[2]]) {
    return `${written[3]}-${MONTHS[written[2]]}-${String(Number(written[1])).padStart(2, "0")}`;
  }

  return "";
}

function extractHeaderData(text) {
  const compact = normalizeSpaces(text);
  const match = compact.match(/Informe De Impacto De La Capacitaci[óo]n\s*:\s*(.+?)\s+Dirigido A\s+(.+?)(?=\s+UNIDAD DE GESTI[ÓO]N|\s+C[óo]digo\s*:|\s+P[áa]gina\s+\d|\s+ELABORADO POR|$)/i);
  const target = match ? cleanValue(match[2]) : "";
  const career = /todas las carreras/i.test(target)
    ? "Todas las carreras"
    : cleanValue(target
      .replace(/^La\s+Carrera\s+de\s+/i, "")
      .replace(/^Las\s+Carreras\s+de\s+/i, "")
      .replace(/^La\s+Carrera\s+/i, ""));

  return {
    nombre_curso: match ? cleanValue(match[1].replace(/,$/, "")) : "",
    dirigido_a: target,
    carrera_publico: career
  };
}

function extractDateByLabel(text, labels) {
  const compact = normalizeSpaces(text);
  for (const label of labels || []) {
    const regex = new RegExp(`${escapeRegex(label)}\\s*:?\\s*(\\d{1,2}\\s*(?:de|-)?\\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\\s*(?:de|-)?\\s*\\d{4}|\\d{1,2}\\s*[\\/-]\\s*\\d{1,2}\\s*[\\/-]\\s*\\d{4})`, "i");
    const match = compact.match(regex);
    if (match) return { texto: cleanValue(match[1]), iso: parseSpanishDate(match[1]) };
  }
  return { texto: "", iso: "" };
}

function extractGeneralData(text) {
  const compact = normalizeSpaces(text);
  const header = extractHeaderData(text);
  const course = firstMatch(compact, [
    /Nombre del Curso\s*:\s*(.+?)(?=\s+[•▪-]?\s*Per[íi]odo de la Capacitaci[óo]n)/i
  ]) || header.nombre_curso;
  const trainingPeriod = firstMatch(compact, [
    /Per[íi]odo de la Capacitaci[óo]n\s*:\s*(.+?)(?=\s+FECHA INICIO)/i
  ]);
  const facilitator = firstMatch(compact, [
    /Facilitador\(es\)\s*:\s*(.+?)(?=\s+[•▪-]?\s*N[úu]mero de Participantes)/i
  ]);
  const participantCount = firstMatch(compact, [
    /N[úu]mero de Participantes\s*:\s*(\d+)/i
  ]);
  const reportDate = extractDateByLabel(text, ["Fecha de Elaboración del Informe", "Fecha de Elaboración"]);
  const startDate = extractDateByLabel(text, ["FECHA INICIO", "Fecha inicio"]);
  const endDate = extractDateByLabel(text, ["FECHA FINAL", "FECHA FIN", "Fecha final"]);

  return {
    nombre_curso: cleanValue(course),
    periodo_capacitacion_texto: cleanValue(trainingPeriod),
    fecha_inicio_texto: startDate.texto,
    fecha_inicio: startDate.iso,
    fecha_fin_texto: endDate.texto,
    fecha_fin: endDate.iso,
    facilitador: cleanValue(facilitator),
    numero_participantes: participantCount ? Number(participantCount) : "",
    fecha_elaboracion_texto: reportDate.texto,
    fecha_elaboracion: reportDate.iso,
    dirigido_a: header.dirigido_a,
    carrera_publico: header.carrera_publico
  };
}

function cleanBulletText(value) {
  return cleanValue(String(value || "")
    .replace(/^[•▪◦o\-–—]+\s*/i, "")
    .replace(/\s+/g, " "));
}

function parseIndicatorSection(section, impactType, context, startIndex) {
  const source = normalizeLineBreaks(section)
    .replace(/Coordinaci[óo]n General de Carreras[\s\S]*?P[áa]gina\s+\d+\s*[|de]+\s*\d+/gi, " ");
  const lines = source.split("\n").map(cleanBulletText).filter(Boolean);
  const rows = [];
  let current = "";

  function pushCurrent() {
    if (!current || !current.includes(":")) {
      current = "";
      return;
    }
    const parts = current.split(":");
    const indicator = cleanValue(parts.shift());
    const result = cleanValue(parts.join(":"));
    if (!indicator || !result) {
      current = "";
      return;
    }
    const percentage = result.match(/(\d+(?:[.,]\d+)?)\s*%/);
    rows.push({
      id: createRowId("indicador-impacto", context.id_documento, startIndex + rows.length, `${impactType}|${indicator}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      nombre_curso: context.nombre_curso,
      tipo_impacto: impactType,
      indicador,
      resultado_texto: result,
      porcentaje: percentage ? Number(percentage[1].replace(",", ".")) : "",
      valor_numerico: percentage ? Number(percentage[1].replace(",", ".")) : "",
      unidad: percentage ? "%" : "texto",
      fuente_seccion: "Resumen de hallazgos",
      requiere_revision: "NO",
      observacion_extraccion: ""
    });
    current = "";
  }

  lines.forEach((line) => {
    if (/^(impacto cualitativo|impacto cuantitativo|recomendaciones principales)/i.test(line)) return;
    if (line.includes(":")) {
      pushCurrent();
      current = line;
    } else if (current) {
      current += ` ${line}`;
    }
  });
  pushCurrent();

  return rows;
}

function extractIndicators(text, context) {
  const qualitative = extractSection(text,
    /Impacto Cualitativo\s*:?/i,
    /Impacto Cuantitativo\s*:?/i
  );
  const quantitative = extractSection(text,
    /Impacto Cuantitativo\s*:?/i,
    /Recomendaciones Principales\s*:?/i
  );
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

function extractObjectives(text, context) {
  const section = extractSection(text,
    /Evaluaci[óo]n del Cumplimiento de Objetivos\s*:?/i,
    [/An[áa]lisis de Causalidad\s*:?/i, /Identificaci[óo]n de Variables Moderadoras\s*:?/i, /Conclusiones\s*:?/i]
  );
  const compact = normalizeSpaces(section);
  const matches = [...compact.matchAll(/Objetivo\s+(\d+)\s*:\s*(.+?)(?=\s+Objetivo\s+\d+\s*:|$)/gi)];

  return matches.map((match, index) => {
    const description = cleanValue(match[2]);
    const percentage = description.match(/(\d+(?:[.,]\d+)?)\s*%/);
    const titleEnd = description.search(/\bEl\s+\d|\bLos\s+datos|\bSe\s+/i);
    const objectiveName = titleEnd > 0 ? cleanValue(description.slice(0, titleEnd)) : cleanValue(description.split(".")[0]);

    return {
      id: createRowId("objetivo-impacto", context.id_documento, index, objectiveName),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      nombre_curso: context.nombre_curso,
      numero_objetivo: Number(match[1]),
      objetivo: objectiveName,
      porcentaje_cumplimiento: percentage ? Number(percentage[1].replace(",", ".")) : "",
      evaluacion_resultado: description,
      requiere_revision: percentage ? "NO" : "SI",
      observacion_extraccion: percentage ? "" : "No se detectó porcentaje explícito en la evaluación del objetivo."
    };
  });
}

function extractMethodology(text, context) {
  const methodology = extractSection(text,
    /4\.\s*Metodolog[ií]a\s*:?/i,
    /5\.\s*Resultados Cualitativos\s*:?/i
  );
  const methods = extractSection(methodology,
    /M[ée]todos? de Medici[óo]n\s*:?/i,
    /Instrumentos? de Medici[óo]n\s*:?/i
  );
  const instruments = extractSection(methodology,
    /Instrumentos? de Medici[óo]n\s*:?/i,
    /5\.\s*Resultados Cualitativos\s*:?/i
  ) || methodology;
  const warnings = [];
  if (!methodology) warnings.push("No se detectó la sección de metodología.");

  return {
    id: createRowId("metodologia-impacto", context.id_documento, 0, context.nombre_curso),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    nombre_curso: context.nombre_curso,
    metodologia_texto: cleanValue(methodology),
    metodos_medicion: cleanValue(methods),
    instrumentos_medicion: cleanValue(instruments),
    incluye_escalas_satisfaccion: /Escalas? de Satisfacci[óo]n/i.test(methodology) ? "SI" : "NO",
    incluye_observacion: /Observaci[óo]n/i.test(methodology) ? "SI" : "NO",
    incluye_pruebas_conocimiento: /Pruebas? de Conocimiento/i.test(methodology) ? "SI" : "NO",
    incluye_entrevistas: /Entrevistas?|Grupos? Focales?/i.test(methodology) ? "SI" : "NO",
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };
}

function extractAnalysis(text, context) {
  const executiveObjective = extractSection(text,
    /Objetivo del Informe\s*:?/i,
    /Resumen de Hallazgos Clave\s*:?/i
  );
  const mainRecommendations = extractSection(text,
    /Recomendaciones Principales\s*:?/i,
    /3\.\s*Introducci[óo]n\s*:?/i
  );
  const qualitativeResults = extractSection(text,
    /5\.\s*Resultados Cualitativos\s*:?/i,
    /6\.\s*Resultados Cuantitativos\s*:?/i
  );
  const quantitativeResults = extractSection(text,
    /6\.\s*Resultados Cuantitativos\s*:?/i,
    /7\.\s*An[áa]lisis y Discusi[óo]n\s*:?/i
  );
  const causality = extractSection(text,
    /An[áa]lisis de Causalidad\s*:?/i,
    /Identificaci[óo]n de Variables Moderadoras\s*:?/i
  );
  const moderators = extractSection(text,
    /Identificaci[óo]n de Variables Moderadoras\s*:?/i,
    [/8\.\s*Conclusiones\s*:?/i, /Conclusiones\s*:?/i]
  );
  const conclusions = extractSection(text,
    [/8\.\s*Conclusiones\s*:?/i, /Conclusiones\s*:?/i],
    [/9\.\s*Recomendaciones\s*:?/i, /Recomendaciones\s*:?/i, /10\.\s*Anexos/i]
  );
  const recommendations = extractSection(text,
    [/9\.\s*Recomendaciones\s*:?/i, /Recomendaciones\s*:?/i],
    [/10\.\s*Anexos/i, /Anexos\s*:?/i, /ELABORADO POR/i]
  );
  const warnings = [];
  if (!executiveObjective) warnings.push("No se detectó objetivo ejecutivo del informe.");
  if (!conclusions) warnings.push("No se detectaron conclusiones finales.");

  return {
    id: createRowId("analisis-impacto", context.id_documento, 0, context.nombre_curso),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    nombre_curso: context.nombre_curso,
    objetivo_informe: cleanValue(executiveObjective),
    resultados_cualitativos: cleanValue(qualitativeResults),
    resultados_cuantitativos: cleanValue(quantitativeResults),
    analisis_causalidad: cleanValue(causality),
    variables_moderadoras: cleanValue(moderators),
    recomendaciones_principales: cleanValue(mainRecommendations),
    conclusiones: cleanValue(conclusions),
    recomendaciones_finales: cleanValue(recommendations),
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };
}

function extractSignatories(text, context, fileName) {
  const source = normalizeLineBreaks(text);
  const bodyIndex = source.search(/Nombre del Curso\s*:/i);
  const cover = normalizeSpaces(bodyIndex > 0 ? source.slice(0, bodyIndex) : source.slice(0, 6000));
  const roles = [...cover.matchAll(/(ELABORADO POR|REVISADO POR|APROBADO POR)\s*:/gi)].map((match) => match[1].toUpperCase());
  const names = uniqueValues([...cover.matchAll(/NOMBRE\s*:\s*(.+?)(?=\s+NOMBRE\s*:|\s+CARGO\s*:|\s+P[ÁA]GINA|$)/gi)].map((match) => cleanValue(match[1])));
  const cargos = [...cover.matchAll(/CARGO\s*:\s*(.+?)(?=\s+CARGO\s*:|\s+NOMBRE\s*:|\s+P[ÁA]GINA|$)/gi)].map((match) => cleanValue(match[1]));
  const count = Math.max(roles.length, names.length, cargos.length);
  const rows = [];

  for (let index = 0; index < count; index += 1) {
    const name = names[index] || "";
    const cargo = cargos[index] || "";
    const warnings = [];
    if (!name) warnings.push("No se detectó nombre del responsable.");
    if (!cargo) warnings.push("No se detectó cargo del responsable.");

    rows.push({
      id: createRowId("responsable-impacto", context.id_documento, index, `${roles[index] || ""}|${name}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      nombre_curso: context.nombre_curso,
      rol_responsable: roles[index] || `RESPONSABLE ${index + 1}`,
      nombre_responsable: name,
      cargo_responsable: cargo,
      estado_firma: /firmado|signed/i.test(fileName || "") ? "FIRMADO_SEGUN_ARCHIVO" : (name ? "RESPONSABLE_IDENTIFICADO" : "NO_IDENTIFICADO"),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    });
  }

  return rows;
}

function extractPageInformation(text, actualPages) {
  const totals = [...normalizeSpaces(text).matchAll(/P[áa]gina\s+\d+\s+(?:de|\|)\s*(\d+)/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  const frequencies = new Map();
  totals.forEach((value) => frequencies.set(value, (frequencies.get(value) || 0) + 1));
  const declared = [...frequencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const variants = uniqueValues(totals.map(String));
  const inconsistent = variants.length > 1 || (declared !== "" && Number(declared) !== Number(actualPages || 0));

  return {
    paginas_declaradas: declared,
    variantes_paginas_declaradas: variants.join(" | "),
    inconsistencia_paginas: inconsistent ? "SI" : "NO"
  };
}

function parseDocument(pdfDocument) {
  const rawText = normalizeLineBreaks(pdfDocument.text || "");
  const fileName = pdfDocument.fileName || path.basename(pdfDocument.filePath || "");
  const codigoDocumento = parseCodigoDocumento(`${rawText} ${fileName}`, "135");
  const idDocumento = createDocumentId(pdfDocument.filePath || fileName, pdfDocument.index || 0, codigoDocumento, pdfDocument.fileHash || "", DOCUMENT_TYPE);
  const periodo = extractPeriodoFromCodigo(codigoDocumento);
  const general = extractGeneralData(rawText);
  const context = { id_documento: idDocumento, codigo_documento: codigoDocumento, periodo, nombre_curso: general.nombre_curso };
  const indicadores = extractIndicators(rawText, context);
  const objetivos = extractObjectives(rawText, context);
  const metodologia = extractMethodology(rawText, context);
  const analisis = extractAnalysis(rawText, context);
  const responsables = extractSignatories(rawText, context, fileName);
  const pageInfo = extractPageInformation(rawText, pdfDocument.pageCount || 0);
  const warnings = [];

  if (!codigoDocumento || !/UGPA-INF-\d{1,3}-PRO-135-/i.test(codigoDocumento)) warnings.push("No se detectó un código UGPA-INF de PRO-135 válido.");
  if (!general.nombre_curso) warnings.push("No se detectó nombre del curso.");
  if (!general.facilitador) warnings.push("No se detectó facilitador.");
  if (general.numero_participantes === "") warnings.push("No se detectó número de participantes.");
  if (!indicadores.length) warnings.push("No se detectaron indicadores de impacto.");
  if (!objetivos.length) warnings.push("No se detectó evaluación de objetivos.");
  if (!responsables.length) warnings.push("No se detectaron responsables.");
  if (pageInfo.inconsistencia_paginas === "SI") warnings.push("Se detectó inconsistencia entre páginas reales y declaradas.");

  const archivo = {
    id: createRowId("archivo-impacto", idDocumento, 0, fileName),
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
    fecha_elaboracion_texto: general.fecha_elaboracion_texto,
    fecha_elaboracion: general.fecha_elaboracion,
    total_paginas_reales: pdfDocument.pageCount || 0,
    ...pageInfo,
    metodo_extraccion: pdfDocument.extractionMethod || "digital",
    paginas_ocr: pdfDocument.ocrPageCount || 0,
    confianza_ocr: pdfDocument.ocrConfidence || 0,
    estado_extraccion: warnings.length ? "REVISAR" : "OK",
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };

  const datosGenerales = {
    id: createRowId("datos-impacto", idDocumento, 0, general.nombre_curso),
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    periodo,
    nombre_curso: general.nombre_curso,
    dirigido_a: general.dirigido_a,
    carrera_publico: general.carrera_publico,
    periodo_capacitacion_texto: general.periodo_capacitacion_texto,
    fecha_inicio_texto: general.fecha_inicio_texto,
    fecha_inicio: general.fecha_inicio,
    fecha_fin_texto: general.fecha_fin_texto,
    fecha_fin: general.fecha_fin,
    facilitador: general.facilitador,
    numero_participantes: general.numero_participantes,
    fecha_elaboracion_texto: general.fecha_elaboracion_texto,
    fecha_elaboracion: general.fecha_elaboracion,
    total_indicadores: indicadores.length,
    total_indicadores_cualitativos: indicadores.filter((row) => row.tipo_impacto === "CUALITATIVO").length,
    total_indicadores_cuantitativos: indicadores.filter((row) => row.tipo_impacto === "CUANTITATIVO").length,
    promedio_porcentajes: indicadores.filter((row) => row.porcentaje !== "").length
      ? Number((indicadores.filter((row) => row.porcentaje !== "").reduce((sum, row) => sum + Number(row.porcentaje), 0) / indicadores.filter((row) => row.porcentaje !== "").length).toFixed(2))
      : "",
    total_objetivos_evaluados: objetivos.length,
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };

  return {
    document_type: DOCUMENT_TYPE,
    id_documento: idDocumento,
    archivo,
    datos_generales: datosGenerales,
    indicadores,
    objetivos,
    metodologia,
    analisis,
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
      errors.push({ fileName: document ? document.fileName : "", errors: document && Array.isArray(document.errors) ? document.errors : ["Documento inválido."] });
      return;
    }
    try {
      parsed.push(parseDocument(document));
    } catch (error) {
      errors.push({ fileName: document.fileName || "", errors: [error.message || "No se pudo analizar el Informe de Impacto."] });
    }
  });

  return { documentType: DOCUMENT_TYPE, total: documents.length, parsedCount: parsed.length, errorCount: errors.length, parsed, errors };
}

module.exports = {
  DOCUMENT_TYPE,
  parseSpanishDate,
  extractSection,
  extractHeaderData,
  extractGeneralData,
  extractIndicators,
  extractObjectives,
  extractMethodology,
  extractAnalysis,
  extractPageInformation,
  parseDocument,
  parseDocuments
};
