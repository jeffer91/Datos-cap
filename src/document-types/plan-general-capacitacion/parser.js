/* =========================================================
Nombre completo: parser.js
Ruta o ubicación: /src/document-types/plan-general-capacitacion/parser.js
Función o funciones:
- Extraer el Plan Semestral de Capacitación Docente PRO-70.
- Reconocer objetivos, capacitaciones, cronograma e indicadores.
- Extraer recursos, presupuesto, responsables y control documental.
- Preparar datos no relacionales para Excel, JSON y base local.
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

const DOCUMENT_TYPE = "plan-general-capacitacion";

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
  if (numeric) return `${numeric[3]}-${String(Number(numeric[2])).padStart(2, "0")}-${String(Number(numeric[1])).padStart(2, "0")}`;
  const written = normalizeForSearch(raw).match(/^(\d{1,2})\s*(?:de|-)?\s*([a-z]+)\s*(?:de|-)?\s*(\d{4})$/);
  if (written && MONTHS[written[2]]) return `${written[3]}-${MONTHS[written[2]]}-${String(Number(written[1])).padStart(2, "0")}`;
  return "";
}

function parseNumber(value) {
  const raw = cleanValue(value).replace(/[$€£]/g, "").replace(/\s/g, "");
  if (!raw) return "";
  let normalized = raw;
  if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(raw)) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(raw)) normalized = raw.replace(/,/g, "");
  else normalized = raw.replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : "";
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

function extractPeriodText(text) {
  const compact = normalizeSpaces(text);
  const match = compact.match(/Plan (?:Semestral|Anual|General) de Capacitaci[óo]n Docente\.?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s+\d{4}\s*[–—-]\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s+\d{4})/i);
  return match ? cleanValue(match[1]) : "";
}

function extractPageInformation(text, actualPages) {
  const totals = [...normalizeSpaces(text).matchAll(/P[áa]gina\s+\d+\s+(?:de|\|)\s*(\d+)/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  const frequencies = new Map();
  totals.forEach((value) => frequencies.set(value, (frequencies.get(value) || 0) + 1));
  const declared = [...frequencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const variants = uniqueValues(totals.map(String));
  return {
    paginas_declaradas: declared,
    variantes_paginas_declaradas: variants.join(" | "),
    inconsistencia_paginas: variants.length > 1 || (declared !== "" && Number(declared) !== Number(actualPages || 0)) ? "SI" : "NO"
  };
}

function extractLabeledValue(block, label, nextLabels) {
  const compact = normalizeSpaces(block);
  const end = (nextLabels || []).map(escapeRegex).join("|");
  const regex = new RegExp(`${escapeRegex(label)}\\s*:?\\s*(.+?)(?=${end ? `\\s+(?:${end})\\s*:?` : "$"})`, "i");
  const match = compact.match(regex);
  return match ? cleanValue(match[1]) : "";
}

function splitNumberedBlocks(text, heading) {
  const compact = normalizeSpaces(text);
  const regex = new RegExp(`${escapeRegex(heading)}\\s+(\\d+)\\s*:?\\s*`, "gi");
  const starts = [];
  let match;
  while ((match = regex.exec(compact)) !== null) starts.push({ number: Number(match[1]), start: match.index, contentStart: regex.lastIndex });
  return starts.map((item, index) => ({
    number: item.number,
    text: compact.slice(item.contentStart, starts[index + 1] ? starts[index + 1].start : compact.length)
  }));
}

function splitBullets(value) {
  const source = normalizeLineBreaks(value);
  const bulletRows = source.split(/(?:^|\n)\s*(?:[•●▪◦-]|\d+[.)])\s+/).map(cleanValue).filter(Boolean);
  if (bulletRows.length > 1) return bulletRows;
  return source.split(/\s*;\s*/).map(cleanValue).filter(Boolean);
}

function extractObjectives(text, context) {
  const section = extractSection(text,
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

  splitBullets(specificSection).forEach((objective, index) => rows.push({
    id: createRowId("objetivo-plan-general", context.id_documento, index + 1, objective),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    tipo_objetivo: "ESPECIFICO",
    numero_objetivo: index + 1,
    objetivo,
    eje_estrategico: "",
    indicador_asociado: "",
    requiere_revision: "NO",
    observacion_extraccion: ""
  }));

  return rows;
}

function extractTrainingActions(text, context) {
  const section = extractSection(text,
    [/Capacitaciones Planificadas\s*:?/i, /Plan de Acci[óo]n de Capacitaci[óo]n\s*:?/i],
    [/Cronograma de Ejecuci[óo]n/i, /Seguimiento y Evaluaci[óo]n/i]
  );
  const blocks = splitNumberedBlocks(section, "Capacitación");
  const rows = [];

  blocks.forEach((block, index) => {
    const labels = ["Tipo", "Nivel de prioridad", "Carrera", "Necesidad identificada", "Nombre de la capacitación", "Modalidad", "Fecha de inicio", "Fecha de fin", "Duración en horas", "Beneficiarios", "Facilitador", "Proveedor", "Responsable", "Presupuesto", "Fuente de financiamiento", "Resultado esperado", "Estado"];
    const type = extractLabeledValue(block.text, "Tipo", labels.slice(1));
    const startDate = extractDateByLabel(block.text, ["Fecha de inicio"]);
    const endDate = extractDateByLabel(block.text, ["Fecha de fin"]);
    const name = extractLabeledValue(block.text, "Nombre de la capacitación", labels.slice(5)) || firstMatch(block.text, [/^(.+?)(?=\s+Tipo\s*:)/i]);
    const warnings = [];
    if (!name) warnings.push("No se detectó el nombre de la capacitación.");

    rows.push({
      id: createRowId("capacitacion-planificada", context.id_documento, index, name || block.number),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      numero_capacitacion: block.number,
      tipo_capacitacion: type ? normalizeForSearch(type).toUpperCase().replace(/\s+/g, "_") : "",
      nivel_prioridad: extractLabeledValue(block.text, "Nivel de prioridad", labels.slice(2)),
      carrera: extractLabeledValue(block.text, "Carrera", labels.slice(3)),
      necesidad_identificada: extractLabeledValue(block.text, "Necesidad identificada", labels.slice(4)),
      nombre_capacitacion: name,
      modalidad: extractLabeledValue(block.text, "Modalidad", labels.slice(6)),
      fecha_inicio_texto: startDate.texto,
      fecha_inicio: startDate.iso,
      fecha_fin_texto: endDate.texto,
      fecha_fin: endDate.iso,
      duracion_horas: parseNumber(extractLabeledValue(block.text, "Duración en horas", labels.slice(9))),
      beneficiarios: extractLabeledValue(block.text, "Beneficiarios", labels.slice(10)),
      facilitador_proveedor: extractLabeledValue(block.text, "Facilitador", labels.slice(11)) || extractLabeledValue(block.text, "Proveedor", labels.slice(12)),
      responsable_ejecucion: extractLabeledValue(block.text, "Responsable", labels.slice(13)),
      presupuesto_estimado: parseNumber(extractLabeledValue(block.text, "Presupuesto", labels.slice(14))),
      fuente_financiamiento: extractLabeledValue(block.text, "Fuente de financiamiento", labels.slice(15)),
      resultado_esperado: extractLabeledValue(block.text, "Resultado esperado", labels.slice(16)),
      estado_planificado: extractLabeledValue(block.text, "Estado", []) || "PLANIFICADA",
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    });
  });

  return rows;
}

function extractSchedule(text, context, actions) {
  const section = extractSection(text,
    /Cronograma de Ejecuci[óo]n\s*:?/i,
    [/Seguimiento y Evaluaci[óo]n/i, /Indicadores de Seguimiento/i, /Recursos y Presupuesto/i]
  );
  const blocks = splitNumberedBlocks(section, "Etapa");
  const rows = [];

  blocks.forEach((block, index) => {
    const labels = ["Actividad", "Capacitación asociada", "Fecha de inicio", "Fecha de fin", "Responsable", "Producto", "Estado"];
    const startDate = extractDateByLabel(block.text, ["Fecha de inicio"]);
    const endDate = extractDateByLabel(block.text, ["Fecha de fin"]);
    rows.push({
      id: createRowId("cronograma-plan-general", context.id_documento, index, block.number),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      numero_etapa: block.number,
      actividad: extractLabeledValue(block.text, "Actividad", labels.slice(1)),
      capacitacion_asociada: extractLabeledValue(block.text, "Capacitación asociada", labels.slice(2)),
      fecha_inicio_texto: startDate.texto,
      fecha_inicio: startDate.iso,
      fecha_fin_texto: endDate.texto,
      fecha_fin: endDate.iso,
      responsable: extractLabeledValue(block.text, "Responsable", labels.slice(5)),
      producto_entregable: extractLabeledValue(block.text, "Producto", labels.slice(6)),
      estado_planificado: extractLabeledValue(block.text, "Estado", []) || "PLANIFICADA",
      requiere_revision: "NO",
      observacion_extraccion: ""
    });
  });

  if (!rows.length) {
    actions.forEach((action, index) => rows.push({
      id: createRowId("cronograma-plan-general", context.id_documento, index, action.nombre_capacitacion),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      numero_etapa: index + 1,
      actividad: "Ejecutar capacitación",
      capacitacion_asociada: action.nombre_capacitacion,
      fecha_inicio_texto: action.fecha_inicio_texto,
      fecha_inicio: action.fecha_inicio,
      fecha_fin_texto: action.fecha_fin_texto,
      fecha_fin: action.fecha_fin,
      responsable: action.responsable_ejecucion,
      producto_entregable: "Informe, asistencia y certificación",
      estado_planificado: action.estado_planificado,
      requiere_revision: "SI",
      observacion_extraccion: "Cronograma reconstruido desde las capacitaciones planificadas."
    }));
  }

  return rows;
}

function extractMonitoring(text, context) {
  const section = extractSection(text,
    [/Seguimiento y Evaluaci[óo]n\s*:?/i, /Indicadores de Seguimiento\s*:?/i],
    [/Recursos y Presupuesto/i, /Responsables y Aprobaci[óo]n/i, /Conclusiones/i]
  );
  const blocks = splitNumberedBlocks(section, "Indicador");
  const rows = [];

  blocks.forEach((block, index) => {
    const labels = ["Nombre", "Fórmula", "Meta", "Frecuencia", "Medio de verificación", "Responsable", "Momento de evaluación", "Uso del resultado"];
    const name = extractLabeledValue(block.text, "Nombre", labels.slice(1)) || firstMatch(block.text, [/^(.+?)(?=\s+F[óo]rmula\s*:)/i]);
    rows.push({
      id: createRowId("seguimiento-plan-general", context.id_documento, index, name || block.number),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      numero_indicador: block.number,
      indicador: name,
      formula: extractLabeledValue(block.text, "Fórmula", labels.slice(2)),
      meta: extractLabeledValue(block.text, "Meta", labels.slice(3)),
      frecuencia: extractLabeledValue(block.text, "Frecuencia", labels.slice(4)),
      medio_verificacion: extractLabeledValue(block.text, "Medio de verificación", labels.slice(5)),
      responsable: extractLabeledValue(block.text, "Responsable", labels.slice(6)),
      momento_evaluacion: extractLabeledValue(block.text, "Momento de evaluación", labels.slice(7)),
      uso_resultado: extractLabeledValue(block.text, "Uso del resultado", []),
      requiere_revision: name ? "NO" : "SI",
      observacion_extraccion: name ? "" : "No se detectó el nombre del indicador."
    });
  });

  return rows;
}

function extractResources(text, context) {
  const section = extractSection(text,
    /Recursos y Presupuesto\s*:?/i,
    [/Responsables y Aprobaci[óo]n/i, /Conclusiones/i, /Anexos/i]
  );
  const blocks = splitNumberedBlocks(section, "Recurso");
  const rows = [];

  blocks.forEach((block, index) => {
    const labels = ["Tipo", "Descripción", "Cantidad", "Costo estimado", "Fuente de financiamiento", "Responsable", "Observación"];
    rows.push({
      id: createRowId("recurso-plan-general", context.id_documento, index, block.number),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      numero_recurso: block.number,
      tipo_recurso: extractLabeledValue(block.text, "Tipo", labels.slice(1)),
      descripcion_recurso: extractLabeledValue(block.text, "Descripción", labels.slice(2)),
      cantidad: parseNumber(extractLabeledValue(block.text, "Cantidad", labels.slice(3))),
      costo_estimado: parseNumber(extractLabeledValue(block.text, "Costo estimado", labels.slice(4))),
      fuente_financiamiento: extractLabeledValue(block.text, "Fuente de financiamiento", labels.slice(5)),
      responsable: extractLabeledValue(block.text, "Responsable", labels.slice(6)),
      observacion_recurso: extractLabeledValue(block.text, "Observación", []),
      requiere_revision: "NO",
      observacion_extraccion: ""
    });
  });

  return rows;
}

function extractSignatories(text, context, fileName) {
  const source = normalizeLineBreaks(text);
  const introIndex = source.search(/1\.\s*Introducci[óo]n/i);
  const cover = normalizeSpaces(introIndex > 0 ? source.slice(0, introIndex) : source.slice(0, 7000));
  const roles = [...cover.matchAll(/(ELABORADO POR|REVISADO POR|APROBADO POR)\s*:/gi)].map((match) => match[1].toUpperCase());
  const names = uniqueValues([...cover.matchAll(/NOMBRE\s*:\s*(.+?)(?=\s+NOMBRE\s*:|\s+CARGO\s*:|\s+P[ÁA]GINA|$)/gi)].map((match) => cleanValue(match[1])));
  const cargos = [...cover.matchAll(/CARGO\s*:\s*(.+?)(?=\s+CARGO\s*:|\s+NOMBRE\s*:|\s+P[ÁA]GINA|$)/gi)].map((match) => cleanValue(match[1]));
  const count = Math.max(roles.length, names.length, cargos.length);
  const rows = [];

  for (let index = 0; index < count; index += 1) {
    rows.push({
      id: createRowId("responsable-plan-general", context.id_documento, index, `${roles[index] || ""}|${names[index] || ""}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      rol_responsable: roles[index] || `RESPONSABLE ${index + 1}`,
      nombre_responsable: names[index] || "",
      cargo_responsable: cargos[index] || "",
      estado_firma: /firmado|signed/i.test(fileName || "") ? "FIRMADO_SEGUN_ARCHIVO" : (names[index] ? "RESPONSABLE_IDENTIFICADO" : "NO_IDENTIFICADO"),
      requiere_revision: names[index] && cargos[index] ? "NO" : "SI",
      observacion_extraccion: names[index] && cargos[index] ? "" : "Responsable incompleto."
    });
  }

  return rows;
}

function parseDocument(pdfDocument) {
  const rawText = normalizeLineBreaks(pdfDocument.text || "");
  const fileName = pdfDocument.fileName || path.basename(pdfDocument.filePath || "");
  const codigoDocumento = parseCodigoDocumento(`${rawText} ${fileName}`, "70");
  const idDocumento = createDocumentId(pdfDocument.filePath || fileName, pdfDocument.index || 0, codigoDocumento, pdfDocument.fileHash || "", DOCUMENT_TYPE);
  const periodo = extractPeriodoFromCodigo(codigoDocumento);
  const periodText = extractPeriodText(rawText);
  const elaborationDate = extractDateByLabel(rawText, ["Fecha de Elaboración"]);
  const context = { id_documento: idDocumento, codigo_documento: codigoDocumento, periodo };
  const objectives = extractObjectives(rawText, context);
  const actions = extractTrainingActions(rawText, context);
  const schedule = extractSchedule(rawText, context, actions);
  const monitoring = extractMonitoring(rawText, context);
  const resources = extractResources(rawText, context);
  const responsables = extractSignatories(rawText, context, fileName);
  const pageInfo = extractPageInformation(rawText, pdfDocument.pageCount || 0);
  const warnings = [];

  if (!codigoDocumento || !/(?:UGPA|CGC)-RGI2-\d{1,3}-PRO-70-/i.test(codigoDocumento)) warnings.push("No se detectó un código RGI2 de PRO-70 válido.");
  if (!periodText) warnings.push("No se detectó el alcance temporal del plan.");
  if (!objectives.length) warnings.push("No se detectaron objetivos del plan.");
  if (!actions.length) warnings.push("No se detectaron capacitaciones planificadas.");
  if (!monitoring.length) warnings.push("No se detectaron indicadores de seguimiento.");
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
    tipo_plan: /anual/i.test(rawText) ? "ANUAL" : "SEMESTRAL",
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
  DOCUMENT_TYPE,
  parseSpanishDate,
  parseNumber,
  extractSection,
  extractPeriodText,
  extractPageInformation,
  extractLabeledValue,
  splitNumberedBlocks,
  splitBullets,
  extractObjectives,
  extractTrainingActions,
  extractSchedule,
  extractMonitoring,
  extractResources,
  extractSignatories,
  parseDocument,
  parseDocuments
};
