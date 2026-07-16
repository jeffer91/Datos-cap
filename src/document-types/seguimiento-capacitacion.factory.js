/* =========================================================
Nombre completo: seguimiento-capacitacion.factory.js
Ruta: /src/document-types/seguimiento-capacitacion.factory.js
Función:
- Crear la lógica flexible de Instrumentos de Evaluación e Informes de Impacto.
- Extraer datos generales, tablas, responsables, anexos y trazabilidad OCR.
========================================================= */
"use strict";

const path = require("path");
const {
  normalizeLineBreaks, normalizeSpaces, normalizeForSearch, splitCleanLines,
  cleanValue, firstMatch, findValueByLabel, extractBetween,
  parseCodigoDocumento, uniqueValues
} = require("../extractor/normalizer");
const {
  createDocumentId, createRowId, extractRegistroFromCodigo, extractPeriodoFromCodigo
} = require("../utils/ids");

const MONTHS = Object.freeze({
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
  noviembre: "11", diciembre: "12"
});

function yesNo(value) { return value ? "SI" : "NO"; }
function rowBase(prefix, context, index, seed) {
  return {
    id: createRowId(prefix, context.id_documento, index, seed),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo
  };
}

function sectionLines(source, starts, ends) {
  const lines = splitCleanLines(source);
  const startLabels = (Array.isArray(starts) ? starts : [starts]).map(normalizeForSearch);
  const endLabels = (Array.isArray(ends) ? ends : [ends]).map(normalizeForSearch);
  const start = lines.findIndex((line) => startLabels.some((label) => normalizeForSearch(line).includes(label)));
  if (start < 0) return "";
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (endLabels.some((label) => normalizeForSearch(lines[index]).includes(label))) { end = index; break; }
  }
  return lines.slice(start + 1, end).join("\n");
}

function parseFlexibleCode(source, processCode = "135") {
  const parsed = parseCodigoDocumento(source, processCode);
  if (parsed) return parsed;
  const compact = normalizeSpaces(source).replace(/[￾\uFFFE]/g, "-")
    .replace(/\s*[-–—]\s*/g, "-").replace(/-+/g, "-").toUpperCase();
  const match = compact.match(new RegExp(`(?:UGPA|CGC)-[A-Z0-9]+-\\d{1,3}-PRO-${processCode}-\\d{4}-\\d{2}`, "i"));
  return match ? match[0].toUpperCase() : "";
}

function normalizeDate(value) {
  const raw = cleanValue(value);
  if (!raw) return "";
  let match = raw.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
  if (match) return `${match[3]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
  match = normalizeForSearch(raw).match(/\b(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})\b/);
  if (match && MONTHS[match[2]]) return `${match[3]}-${MONTHS[match[2]]}-${String(Number(match[1])).padStart(2, "0")}`;
  match = normalizeForSearch(raw).match(/\b(\d{1,2})[- ]([a-z]+)[- ](\d{4})\b/);
  return match && MONTHS[match[2]] ? `${match[3]}-${MONTHS[match[2]]}-${String(Number(match[1])).padStart(2, "0")}` : raw;
}

function extractDate(source) {
  const value = firstMatch(source, [
    /fecha\s+de\s+elaboraci[oó]n\s*:?\s*([^\n]+)/i,
    /fecha\s+de\s+evaluaci[oó]n\s*:?\s*([^\n]+)/i,
    /fecha\s+del\s+informe\s*:?\s*([^\n]+)/i,
    /(?:^|\n)fecha\s*:?\s*([^\n]+)/i
  ]);
  return { texto: cleanValue(value), iso: normalizeDate(value) };
}

function extractCommon(source, kind) {
  const titlePattern = kind === "impact"
    ? /informe\s+de\s+impacto(?:\s+de\s+la\s+capacitaci[oó]n)?\s*:?\s*([^\n]+)/i
    : /instrumento\s+de\s+evaluaci[oó]n(?:\s+de\s+la\s+capacitaci[oó]n)?\s*:?\s*([^\n]+)/i;
  return {
    nombre_capacitacion: cleanValue(firstMatch(source, [
      /(?:nombre\s+de\s+la\s+capacitaci[oó]n|capacitaci[oó]n|nombre\s+del\s+curso|curso)\s*:?\s*([^\n]+)/i,
      titlePattern
    ])),
    publico_dirigido: findValueByLabel(source, ["Dirigido a", "Público dirigido", "Grupo evaluado"]),
    carrera: findValueByLabel(source, ["Carrera", "Área", "Unidad académica", "Departamento"]),
    facilitador: findValueByLabel(source, ["Facilitador", "Instructor", "Capacitador"]),
    evaluador: findValueByLabel(source, ["Evaluador", "Responsable de evaluación", "Elaborado por"]),
    objetivo: findValueByLabel(source, ["Objetivo general", "Objetivo", "Propósito"]),
    modalidad: findValueByLabel(source, ["Modalidad", "Forma de ejecución"]),
    periodo_evaluado: findValueByLabel(source, ["Periodo evaluado", "Período evaluado", "Periodo de medición", "Período de medición"]),
    metodologia: findValueByLabel(source, ["Metodología", "Método de evaluación", "Técnica", "Instrumento aplicado"]),
    escala: findValueByLabel(source, ["Escala de valoración", "Escala", "Opciones de respuesta"])
  };
}

function extractResponsibilities(source, context, prefix) {
  const compact = normalizeSpaces(source.slice(0, 8000));
  const roles = [...compact.matchAll(/(ELABORADO POR|REVISADO POR|APROBADO POR|EVALUADO POR|RESPONSABLE)\s*:?/gi)]
    .map((match) => match[1].toUpperCase());
  const names = uniqueValues([...compact.matchAll(/NOMBRE\s*:\s*(.+?)(?=\s+NOMBRE\s*:\s*|\s+CARGO\s*:\s*|\s+FIRMA\s*:\s*|\s+P[ÁA]GINA|$)/gi)]
    .map((match) => cleanValue(match[1])));
  const cargos = [...compact.matchAll(/CARGO\s*:\s*(.+?)(?=\s+CARGO\s*:\s*|\s+NOMBRE\s*:\s*|\s+FIRMA\s*:\s*|\s+P[ÁA]GINA|$)/gi)]
    .map((match) => cleanValue(match[1]));
  const count = Math.max(roles.length, names.length, cargos.length);
  return Array.from({ length: count }, (_unused, index) => ({
    ...rowBase(prefix, context, index, `${roles[index] || "RESPONSABLE"}|${names[index] || ""}`),
    rol_responsable: roles[index] || `RESPONSABLE ${index + 1}`,
    nombre_responsable: names[index] || "",
    cargo_responsable: cargos[index] || "",
    estado_firma: names[index] ? "RESPONSABLE_IDENTIFICADO" : "NO_IDENTIFICADO",
    requiere_revision: yesNo(!names[index]),
    observacion_extraccion: names[index] ? "" : "No se detectó el nombre del responsable."
  }));
}

function extractAttachments(source, context, prefix) {
  const section = sectionLines(source, ["ANEXOS", "ANEXO"], ["RESPONSABLES", "ELABORADO POR", "REVISADO POR", "APROBADO POR"]);
  return uniqueValues(splitCleanLines(section).filter((line) => line.length > 3)).slice(0, 50).map((description, index) => ({
    ...rowBase(prefix, context, index, description),
    numero_anexo: index + 1,
    descripcion_anexo: description,
    requiere_revision: "NO",
    observacion_extraccion: ""
  }));
}

function extractOcrRows(pdf, context, prefix) {
  return (Array.isArray(pdf.pages) ? pdf.pages : []).map((page, index) => {
    const low = Number(page.confidence || 0) > 0 && Number(page.confidence || 0) < 65;
    return {
      ...rowBase(prefix, context, index, page.pageNumber || index + 1),
      pagina: Number(page.pageNumber || index + 1),
      metodo_extraccion: page.method || pdf.extractionMethod || "digital",
      confianza_ocr: Number(page.confidence || 0),
      longitud_texto: Number(page.textLength || String(page.text || "").length || 0),
      requiere_revision: yesNo(low),
      observacion_extraccion: low ? "Confianza OCR baja." : ""
    };
  });
}

function selectedAnswer(line) {
  const options = ["totalmente de acuerdo", "de acuerdo", "ni de acuerdo ni en desacuerdo", "en desacuerdo",
    "totalmente en desacuerdo", "excelente", "muy bueno", "bueno", "regular", "malo", "cumple", "no cumple", "si", "no"];
  const normalized = normalizeForSearch(line);
  return options.find((option) => {
    const index = normalized.indexOf(option);
    return index >= 0 && /[x×☒■✓✔]/i.test(line.slice(Math.max(0, index - 6), index + option.length + 6));
  })?.toUpperCase() || "";
}

function evaluationItems(source, context) {
  const section = sectionLines(source,
    ["CRITERIOS DE EVALUACIÓN", "CRITERIOS DE EVALUACION", "PREGUNTAS", "ÍTEMS", "ITEMS", "CUESTIONARIO"],
    ["RESULTADOS", "OBSERVACIONES", "COMENTARIOS", "RECOMENDACIONES", "RESPONSABLES", "ANEXOS"]
  ) || source;
  return splitCleanLines(section).filter((line) => /^\d+[.)-]?\s+/.test(line) || /[x×☒■✓✔]/i.test(line) ||
    /(?:puntaje|calificaci[oó]n|valor)\s*:?\s*\d/i.test(line)).slice(0, 200).map((line, index) => {
    const number = line.match(/^\s*(\d+)[.)-]?\s*/);
    const score = line.match(/(?:puntaje|calificaci[oó]n|valor)\s*:?\s*(\d+(?:[.,]\d+)?)/i) || line.match(/\b([1-5])\s*(?:\/\s*5)?\s*$/);
    const answer = selectedAnswer(line);
    return {
      ...rowBase("pregunta-evaluacion", context, index, line),
      numero_item: number ? Number(number[1]) : index + 1,
      dimension: "GENERAL",
      criterio_pregunta: cleanValue(line.replace(/^\s*\d+[.)-]?\s*/, "").replace(/(?:^|\s)[x×☒■✓✔](?=\s|$)/gi, " ")),
      respuesta_seleccionada: answer,
      puntaje: score ? Number(score[1].replace(",", ".")) : "",
      evidencia_texto: line,
      requiere_revision: yesNo(!answer && !score),
      observacion_extraccion: !answer && !score ? "Ítem detectado sin respuesta inequívoca." : ""
    };
  });
}

function evaluationResult(source, context, items) {
  const scores = items.map((row) => Number(row.puntaje)).filter((value) => Number.isFinite(value) && value > 0);
  const average = scores.length ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2)) : "";
  const explicit = firstMatch(source, [/(?:resultado|satisfacci[oó]n|cumplimiento|porcentaje)\s*:?\s*(\d{1,3}(?:[.,]\d+)?)\s*%/i]);
  const percentage = explicit ? Number(explicit.replace(",", ".")) : (average !== "" ? Number(((average / 5) * 100).toFixed(2)) : "");
  return {
    ...rowBase("resultado-instrumento", context, 0, percentage),
    total_items_detectados: items.length,
    total_items_con_respuesta: items.filter((row) => row.respuesta_seleccionada || row.puntaje !== "").length,
    promedio_puntaje: average,
    porcentaje_resultado: percentage,
    nivel_resultado: percentage === "" ? "NO_DETERMINADO" : percentage >= 90 ? "EXCELENTE" : percentage >= 80 ? "MUY_BUENO" : percentage >= 70 ? "BUENO" : percentage >= 60 ? "REGULAR" : "BAJO",
    observaciones: cleanValue(extractBetween(source, ["OBSERVACIONES", "COMENTARIOS"], ["RECOMENDACIONES", "RESPONSABLES", "ANEXOS"])),
    recomendaciones: cleanValue(extractBetween(source, ["RECOMENDACIONES"], ["RESPONSABLES", "ANEXOS"])),
    requiere_revision: yesNo(!items.length),
    observacion_extraccion: items.length ? "" : "No se detectaron ítems de evaluación."
  };
}

function impactIndicators(source, context) {
  const section = sectionLines(source,
    ["INDICADORES DE IMPACTO", "INDICADORES", "MATRIZ DE IMPACTO", "MEDICIÓN DE IMPACTO", "MEDICION DE IMPACTO"],
    ["RESULTADOS", "HALLAZGOS", "CONCLUSIONES", "RECOMENDACIONES", "RESPONSABLES", "ANEXOS"]
  ) || source;
  return uniqueValues(splitCleanLines(section).filter((line) => /^\d+[.)-]?\s+/.test(line) || /%/.test(line) ||
    /(?:indicador|l[ií]nea base|meta|resultado|cumplimiento|impacto)/i.test(line))).slice(0, 150).map((line, index) => {
    const values = [...line.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*%/g)].map((match) => Number(match[1].replace(",", ".")));
    const number = line.match(/^\s*(\d+)[.)-]?\s*/);
    return {
      ...rowBase("indicador-impacto", context, index, line),
      numero_indicador: number ? Number(number[1]) : index + 1,
      dimension: "GENERAL",
      indicador: cleanValue(line.replace(/^\s*\d+[.)-]?\s*/, "")),
      linea_base: values.length > 1 ? values[0] : "",
      meta: values.length > 2 ? values[1] : "",
      resultado: values.length ? values[values.length - 1] : "",
      unidad_medida: values.length ? "%" : "",
      porcentaje_cumplimiento: values.length ? values[values.length - 1] : "",
      evidencia_texto: line,
      requiere_revision: yesNo(!values.length),
      observacion_extraccion: values.length ? "" : "Indicador detectado sin valor porcentual inequívoco."
    };
  });
}

function impactResult(source, context, indicators) {
  const values = indicators.map((row) => Number(row.porcentaje_cumplimiento)).filter((value) => Number.isFinite(value) && value >= 0);
  const average = values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : "";
  return {
    ...rowBase("resultado-impacto", context, 0, average),
    total_indicadores_detectados: indicators.length,
    promedio_cumplimiento: average,
    nivel_impacto: average === "" ? "NO_DETERMINADO" : average >= 85 ? "ALTO" : average >= 60 ? "MEDIO" : "BAJO",
    cambios_observados: cleanValue(extractBetween(source, ["CAMBIOS OBSERVADOS", "IMPACTO OBSERVADO", "APLICACIÓN DE LO APRENDIDO"], ["CONCLUSIONES", "RECOMENDACIONES", "RESPONSABLES", "ANEXOS"])),
    principales_hallazgos: cleanValue(extractBetween(source, ["RESULTADOS", "HALLAZGOS", "PRINCIPALES RESULTADOS"], ["CONCLUSIONES", "RECOMENDACIONES", "RESPONSABLES", "ANEXOS"])),
    conclusiones: cleanValue(extractBetween(source, ["CONCLUSIONES", "CONCLUSIÓN"], ["RECOMENDACIONES", "RESPONSABLES", "ANEXOS"])),
    requiere_revision: yesNo(!indicators.length),
    observacion_extraccion: indicators.length ? "" : "No se detectaron indicadores de impacto."
  };
}

function recommendationRows(source, context) {
  const section = sectionLines(source, ["RECOMENDACIONES", "PLAN DE MEJORA", "ACCIONES DE MEJORA"], ["RESPONSABLES", "ANEXOS"]);
  return uniqueValues(splitCleanLines(section).filter((line) => line.length > 5)).slice(0, 50).map((line, index) => ({
    ...rowBase("recomendacion-impacto", context, index, line),
    numero_recomendacion: index + 1,
    recomendacion: cleanValue(line.replace(/^\s*\d+[.)-]?\s*/, "")),
    responsable: "", plazo: "", estado: "PENDIENTE_DE_AJUSTE",
    requiere_revision: "SI",
    observacion_extraccion: "Responsable, plazo y estado requieren confirmación."
  }));
}

function participantRows(source, context) {
  const matches = [...normalizeLineBreaks(source).matchAll(/(?:^|\n)\s*(?:\d+[.)-]?\s+)?([A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ.' -]{5,80}?)\s+(\d{9,10})\b/g)];
  return matches.slice(0, 500).map((match, index) => ({
    ...rowBase("participante-impacto", context, index, `${match[1]}|${match[2]}`),
    numero: index + 1,
    nombre_participante: cleanValue(match[1]),
    identificacion: match[2],
    carrera_area: "", evidencia_aplicacion: "", resultado_individual: "",
    requiere_revision: "SI",
    observacion_extraccion: "Complete los datos específicos cuando se defina el formato real."
  }));
}

function tableNames(kind) {
  return kind === "evaluation" ? Object.freeze({
    archivos: "archivos_instrumento_evaluacion", datos: "datos_generales_instrumento",
    items: "items_instrumento_evaluacion", resultados: "resultados_instrumento_evaluacion",
    responsables: "responsables_instrumento_evaluacion", anexos: "anexos_instrumento_evaluacion",
    ocr: "ocr_paginas_instrumento_evaluacion"
  }) : Object.freeze({
    archivos: "archivos_informe_impacto", datos: "datos_generales_informe_impacto",
    indicadores: "indicadores_informe_impacto", resultados: "resultados_informe_impacto",
    recomendaciones: "recomendaciones_informe_impacto", participantes: "participantes_informe_impacto",
    responsables: "responsables_informe_impacto", anexos: "anexos_informe_impacto",
    ocr: "ocr_paginas_informe_impacto"
  });
}

function buildFactory(config) {
  const names = tableNames(config.kind);
  const definition = Object.freeze({
    id: config.id, label: config.label, shortLabel: config.shortLabel,
    description: config.description, allowMultiple: true,
    fileNameHints: config.fileNameHints || ["PRO-135"], reportPrefix: config.reportPrefix,
    tables: Object.entries(names).map(([key, name], index) => ({ key, name, sheet: `${String(index + 1).padStart(2, "0")}_${key}` }))
  });

  function parseDocument(pdf) {
    const raw = normalizeLineBreaks(pdf.text || "");
    const fileName = pdf.fileName || path.basename(pdf.filePath || "");
    const code = parseFlexibleCode(`${raw} ${fileName}`, config.processCode || "135");
    const id = createDocumentId(pdf.filePath || fileName, pdf.index || 0, code, pdf.fileHash || "", config.id);
    const context = { id_documento: id, codigo_documento: code, periodo: extractPeriodoFromCodigo(code) };
    const date = extractDate(raw);
    const common = extractCommon(raw, config.kind);
    const warnings = [];
    if (!code) warnings.push(`No se detectó un código institucional PRO-${config.processCode || "135"}.`);
    if (!common.nombre_capacitacion) warnings.push("No se detectó el nombre de la capacitación.");
    if (!date.texto) warnings.push("No se detectó la fecha del documento.");

    const responsables = extractResponsibilities(raw, context, `responsable-${config.id}`);
    const anexos = extractAttachments(raw, context, `anexo-${config.id}`);
    const ocrPaginas = extractOcrRows(pdf, context, `ocr-${config.id}`);
    const specific = config.kind === "evaluation"
      ? (() => { const items = evaluationItems(raw, context); if (!items.length) warnings.push("No se detectaron ítems de evaluación."); return { items, resultados: [evaluationResult(raw, context, items)] }; })()
      : (() => { const indicadores = impactIndicators(raw, context); if (!indicadores.length) warnings.push("No se detectaron indicadores de impacto."); return { indicadores, resultados: [impactResult(raw, context, indicadores)], recomendaciones: recommendationRows(raw, context), participantes: participantRows(raw, context) }; })();

    const revision = yesNo(warnings.length > 0);
    const archivo = {
      ...rowBase(`archivo-${config.id}`, context, 0, fileName),
      nombre_archivo: fileName, ruta_archivo: pdf.filePath || "", hash_archivo: pdf.fileHash || "",
      codigo_original: code, numero_registro: extractRegistroFromCodigo(code),
      total_paginas: Number(pdf.pageCount || 0), metodo_extraccion: pdf.extractionMethod || "digital",
      paginas_digitales: Number(pdf.digitalPageCount || 0), paginas_ocr: Number(pdf.ocrPageCount || 0),
      confianza_ocr: Number(pdf.ocrConfidence || 0), estado_extraccion: warnings.length ? "REVISAR" : "OK",
      requiere_revision: revision, observacion_extraccion: warnings.join(" | ")
    };
    const datosGenerales = {
      ...rowBase(`datos-${config.id}`, context, 0, common.nombre_capacitacion),
      tipo_documental: config.label, fecha_documento: date.iso, fecha_documento_texto: date.texto,
      nombre_capacitacion: common.nombre_capacitacion, publico_dirigido: common.publico_dirigido,
      carrera: common.carrera, facilitador: common.facilitador, evaluador: common.evaluador,
      objetivo: common.objetivo, modalidad: common.modalidad, periodo_evaluado: common.periodo_evaluado,
      metodologia: common.metodologia, escala_valoracion: common.escala,
      total_responsables: responsables.length, total_anexos: anexos.length,
      requiere_revision: revision, observacion_extraccion: warnings.join(" | ")
    };
    return {
      document_type: config.id, id_documento: id, archivo, datos_generales: datosGenerales,
      responsables, anexos, ocr_paginas: ocrPaginas, ...specific, warnings,
      source: { file_hash: pdf.fileHash || "", extraction_method: pdf.extractionMethod || "digital",
        digital_pages: Number(pdf.digitalPageCount || 0), ocr_pages: Number(pdf.ocrPageCount || 0),
        ocr_confidence: Number(pdf.ocrConfidence || 0), text_length: raw.length }
    };
  }

  function parseDocuments(input) {
    const parsed = [], errors = [];
    (Array.isArray(input) ? input : []).forEach((document) => {
      if (!document || !document.ok) { errors.push({ fileName: document?.fileName || "", errors: document?.errors || ["Documento inválido."] }); return; }
      try { parsed.push(parseDocument(document)); }
      catch (error) { errors.push({ fileName: document.fileName || "", errors: [error.message || `No se pudo analizar ${config.label}.`] }); }
    });
    return { documentType: config.id, total: parsed.length + errors.length, parsedCount: parsed.length, errorCount: errors.length, parsed, errors };
  }

  function validateRows(rows, required = ["id_documento"]) {
    const warnings = [];
    (rows || []).forEach((row, index) => required.forEach((field) => {
      if (row[field] === "" || row[field] == null) warnings.push(`Fila ${index + 1}: falta ${field}.`);
    }));
    return { ok: !warnings.length, totalRows: (rows || []).length, warningCount: warnings.length, warnings };
  }

  function buildTables(input) {
    const documents = Array.isArray(input) ? input : (input?.parsed || []);
    const tables = config.kind === "evaluation" ? {
      [names.archivos]: documents.map((doc) => doc.archivo), [names.datos]: documents.map((doc) => doc.datos_generales),
      [names.items]: documents.flatMap((doc) => doc.items || []), [names.resultados]: documents.flatMap((doc) => doc.resultados || []),
      [names.responsables]: documents.flatMap((doc) => doc.responsables || []), [names.anexos]: documents.flatMap((doc) => doc.anexos || []),
      [names.ocr]: documents.flatMap((doc) => doc.ocr_paginas || [])
    } : {
      [names.archivos]: documents.map((doc) => doc.archivo), [names.datos]: documents.map((doc) => doc.datos_generales),
      [names.indicadores]: documents.flatMap((doc) => doc.indicadores || []), [names.resultados]: documents.flatMap((doc) => doc.resultados || []),
      [names.recomendaciones]: documents.flatMap((doc) => doc.recomendaciones || []), [names.participantes]: documents.flatMap((doc) => doc.participantes || []),
      [names.responsables]: documents.flatMap((doc) => doc.responsables || []), [names.anexos]: documents.flatMap((doc) => doc.anexos || []),
      [names.ocr]: documents.flatMap((doc) => doc.ocr_paginas || [])
    };
    const validations = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, validateRows(rows)]));
    const rowsByTable = {}, warningsByTable = {};
    let totalRows = 0, totalWarnings = 0, revisionRows = 0;
    Object.entries(tables).forEach(([name, rows]) => {
      rowsByTable[name] = rows.length; warningsByTable[name] = validations[name].warningCount;
      totalRows += rows.length; totalWarnings += validations[name].warningCount;
      revisionRows += rows.filter((row) => row.requiere_revision === "SI").length;
    });
    return { tables, validations, summary: {
      total_tables: Object.keys(tables).length, total_rows: totalRows, total_warnings: totalWarnings,
      requiere_revision_rows: revisionRows, rows_by_table: rowsByTable, warnings_by_table: warningsByTable,
      estado_general: totalWarnings || revisionRows ? "REVISAR" : "OK"
    } };
  }

  function flattenWarnings(validations) {
    return Object.entries(validations || {}).flatMap(([tabla, validation]) =>
      (validation.warnings || []).map((advertencia) => ({ tabla, advertencia })));
  }

  function validateParsedDocument(document) {
    const general = document?.datos_generales || {}, warnings = [];
    if (!document?.id_documento) warnings.push("Falta identificador del documento.");
    if (!general.codigo_documento) warnings.push(`Falta código institucional PRO-${config.processCode || "135"}.`);
    if (!general.nombre_capacitacion) warnings.push("Falta nombre de la capacitación.");
    if (!general.fecha_documento) warnings.push("Falta fecha del documento.");
    if (config.kind === "evaluation" && !(document?.items || []).length) warnings.push("No se detectaron ítems de evaluación.");
    if (config.kind === "impact" && !(document?.indicadores || []).length) warnings.push("No se detectaron indicadores de impacto.");
    return { ok: !warnings.length, documentId: document?.id_documento || "", warnings };
  }

  return {
    definition,
    parser: { parseFlexibleCode, extractDate, extractCommonFields: extractCommon, parseDocument, parseDocuments },
    tables: { TABLE_NAMES: names, buildTables, validateRows, flattenWarnings },
    validator: { validateParsedDocument }
  };
}

module.exports = { buildFactory, parseFlexibleCode, normalizeDate, extractDate };
