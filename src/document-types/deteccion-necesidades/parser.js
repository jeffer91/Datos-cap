/* =========================================================
Nombre completo: parser.js
Ruta o ubicación: /src/document-types/deteccion-necesidades/parser.js
Función o funciones:
- Extraer datos del documento único de Detección de Necesidades PRO-70.
- Reconocer fuentes, necesidades institucionales y necesidades por carrera.
- Extraer recurrencias, capacitaciones prioritarias y vinculación curricular.
- Consolidar resultados, conclusiones, recomendaciones y responsables.
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

const DOCUMENT_TYPE = "deteccion-necesidades";

const MONTHS = Object.freeze({
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
  noviembre: "11", diciembre: "12"
});

const SOURCE_DEFINITIONS = Object.freeze([
  { id: "ENCUESTA_DOCENTES", label: "Encuesta institucional a docentes", regex: /encuestas? institucional(?:es)?|cuestionario(?:s)? a docentes/i },
  { id: "CUESTIONARIO_COORDINADORES", label: "Cuestionario a coordinadores", regex: /cuestionario(?:s)? (?:estructurado(?:s)? )?(?:dirigido(?:s)? )?a (?:los )?coordinadores/i },
  { id: "ENTREVISTAS", label: "Entrevistas", regex: /entrevistas? (?:a|con) docentes|entrevistas? de los coordinadores/i },
  { id: "REUNIONES_ACADEMICAS", label: "Reuniones académicas", regex: /reuniones? acad[ée]micas?/i },
  { id: "ANALISIS_PEA", label: "Análisis de PEAs", regex: /an[áa]lisis de (?:los )?PEA|an[áa]lisis documental de PEA/i },
  { id: "DIAGNOSTICO_CURRICULAR", label: "Diagnóstico curricular", regex: /diagn[óo]stico curricular/i },
  { id: "MICROSOFT_FORMS", label: "Microsoft Forms", regex: /Microsoft Forms/i },
  { id: "OBSERVACION", label: "Observación", regex: /observaci[óo]n (?:directa|del desempe[ñn]o)/i }
]);

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
  const match = compact.match(/Detecci[óo]n (?:De )?Necesidades (?:De )?Capacitaci[óo]n\.?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s+\d{4}\s*[–—-]\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s+\d{4})/i);
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

function extractSources(text, context) {
  const compact = normalizeSpaces(text);
  const responseMatch = compact.match(/(?:total de\s+)?(\d+)\s+respuestas? v[áa]lidas?/i);
  return SOURCE_DEFINITIONS.filter((source) => source.regex.test(compact)).map((source, index) => ({
    id: createRowId("fuente-deteccion", context.id_documento, index, source.id),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    fuente_id: source.id,
    fuente_informacion: source.label,
    herramienta: source.id === "MICROSOFT_FORMS" ? "Microsoft Forms" : "",
    total_respuestas: source.id === "ENCUESTA_DOCENTES" && responseMatch ? Number(responseMatch[1]) : "",
    evidencia_detectada: firstMatch(compact, [source.regex]) || source.label,
    requiere_revision: "NO",
    observacion_extraccion: ""
  }));
}

function selectedGenericTraining(text) {
  const compact = normalizeSpaces(text);
  return firstMatch(compact, [
    /selecci[óo]n de la capacitaci[óo]n gen[ée]rica institucional [“\"](.+?)[”\"]/i,
    /capacitaci[óo]n gen[ée]rica institucional\s*:?\s*[“\"]?(.+?)[”\"]?(?=\s+es el resultado|\s+Tabla|\.|$)/i
  ]);
}

function extractInstitutionalNeeds(text, context) {
  const section = extractSection(text,
    /Tabla\s+1\s+Necesidades a nivel institucional/i,
    [/Interpretaci[óo]n t[ée]cnica\s*:?/i, /B\)\s*Criterios aplicados/i]
  );
  const compact = normalizeSpaces(section)
    .replace(/Necesidad de capacitaci[óo]n identificada\s+Presencia institucional\s+Porcentaje de recurrencia/i, " ");
  const regex = /(.+?)\s+(Muy alta|Alta|Media|Baja)\s+(\d+(?:[.,]\d+)?)\s*%(?=\s+.+?\s+(?:Muy alta|Alta|Media|Baja)\s+\d|$)/gi;
  const selected = selectedGenericTraining(text);
  const rows = [];
  let match;

  while ((match = regex.exec(compact)) !== null) {
    const need = cleanValue(match[1]);
    rows.push({
      id: createRowId("necesidad-institucional", context.id_documento, rows.length, need),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      necesidad_capacitacion: need,
      presencia_institucional: cleanValue(match[2]),
      porcentaje_recurrencia: Number(match[3].replace(",", ".")),
      es_capacitacion_generica_priorizada: selected && normalizeForSearch(selected).includes(normalizeForSearch(need).slice(0, 18)) ? "SI" : "NO",
      capacitacion_generica_priorizada: selected,
      requiere_revision: "NO",
      observacion_extraccion: ""
    });
  }

  if (!rows.length && selected) {
    rows.push({
      id: createRowId("necesidad-institucional", context.id_documento, 0, selected),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      necesidad_capacitacion: selected,
      presencia_institucional: "",
      porcentaje_recurrencia: "",
      es_capacitacion_generica_priorizada: "SI",
      capacitacion_generica_priorizada: selected,
      requiere_revision: "SI",
      observacion_extraccion: "Se detectó la capacitación genérica priorizada, pero no se reconstruyó completa la tabla institucional."
    });
  }

  return rows;
}

function findCareerBlocks(text) {
  const compact = normalizeSpaces(text);
  const headingRegex = /Tabla\s+\d+\s+Necesidades de capacitaci[óo]n identificadas\s*[–—-]\s*(.+?)(?=\s+N[.º°]\s+Necesidad|\s+N[úu]mero\s+Necesidad|\s+Necesidad de capacitaci[óo]n identificada)/gi;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(compact)) !== null) {
    headings.push({ carrera: cleanValue(match[1]), start: match.index, contentStart: headingRegex.lastIndex });
  }

  return headings.map((heading, index) => ({
    carrera: heading.carrera,
    text: compact.slice(heading.contentStart, headings[index + 1] ? headings[index + 1].start : compact.length)
  }));
}

function parseNeedRows(block, context, startIndex) {
  const tablePart = block.text.split(/Tabla\s+\d+\s+An[áa]lisis(?: cuantitativo)? de recurrencia/i)[0];
  const cleaned = tablePart
    .replace(/N[.º°]\s+Necesidad de capacitaci[óo]n identificada\s+Tipo de necesidad\s+Nivel de recurrencia/i, " ")
    .replace(/Unidad de Gesti[óo]n[\s\S]*?P[áa]gina\s+\d+\s+de\s+\d+/gi, " ");
  const regex = /(\d{1,2})\s+(.+?)\s+((?:Disciplinar|T[ée]cnica|Tecnol[óo]gica|Pedag[óo]gica|Investigaci[óo]n|Gesti[óo]n|Transversal|Cl[íi]nica|Operativa)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s–—\/-]*?)\s+(Muy alta|Alta|Media|Baja)(?=\s+\d{1,2}\s+|$)/gi;
  const rows = [];
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    rows.push({
      id: createRowId("necesidad-carrera", context.id_documento, startIndex + rows.length, `${block.carrera}|${match[1]}|${match[2]}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      carrera: block.carrera,
      numero_necesidad: Number(match[1]),
      necesidad_capacitacion: cleanValue(match[2]),
      tipo_necesidad: cleanValue(match[3]),
      nivel_recurrencia: cleanValue(match[4]),
      porcentaje_recurrencia: "",
      fuente_deteccion: "Diagnóstico consolidado",
      es_priorizada: "NO",
      requiere_revision: "NO",
      observacion_extraccion: ""
    });
  }

  return rows;
}

function parseRecurrenceRows(block) {
  const match = block.text.match(/Tabla\s+\d+\s+An[áa]lisis(?: cuantitativo)? de recurrencia\s+Necesidad\s+Porcentaje de recurrencia\s+(.+?)(?=Interpretaci[óo]n\s*:|An[áa]lisis cualitativo|Vinculaci[óo]n de la capacitaci[óo]n prioritaria|$)/i);
  if (!match) return [];
  const rows = [];
  const regex = /(.+?)\s+(\d+(?:[.,]\d+)?)\s*%(?=\s+.+?\s+\d+(?:[.,]\d+)?\s*%|$)/gi;
  let rowMatch;
  while ((rowMatch = regex.exec(match[1])) !== null) {
    rows.push({ necesidad: cleanValue(rowMatch[1]), porcentaje: Number(rowMatch[2].replace(",", ".")) });
  }
  return rows;
}

function assignRecurrences(needs, recurrences) {
  const unused = [...recurrences];
  needs.forEach((need, index) => {
    const normalizedNeed = normalizeForSearch(need.necesidad_capacitacion);
    let matchedIndex = unused.findIndex((item) => {
      const normalizedItem = normalizeForSearch(item.necesidad);
      return normalizedNeed.includes(normalizedItem.slice(0, 18)) || normalizedItem.includes(normalizedNeed.slice(0, 18));
    });
    if (matchedIndex < 0 && unused[index]) matchedIndex = index;
    if (matchedIndex >= 0 && unused[matchedIndex]) {
      need.porcentaje_recurrencia = unused[matchedIndex].porcentaje;
      unused.splice(matchedIndex, 1);
    }
  });
  return needs;
}

function extractFieldFromBlock(text, label, nextLabels) {
  const compact = normalizeSpaces(text);
  const end = (nextLabels || []).map(escapeRegex).join("|");
  const regex = new RegExp(`${escapeRegex(label)}\\s+(.+?)(?=${end ? `\\s+(?:${end})` : "$"})`, "i");
  const match = compact.match(regex);
  return match ? cleanValue(match[1]) : "";
}

function parsePriority(block, needs, context, index) {
  const compact = normalizeSpaces(block.text);
  let training = firstMatch(compact, [
    /capacitaci[óo]n prioritaria (?:para la carrera de .+? )?corresponde a\s*:\s*(.+?)(?=\s+Tabla\s+\d+\s+Vinculaci[óo]n|\s+Aspecto\s+Vinculaci[óo]n|$)/i
  ]);
  if (!training && needs.length) {
    const sorted = [...needs].sort((a, b) => Number(b.porcentaje_recurrencia || 0) - Number(a.porcentaje_recurrencia || 0));
    training = sorted[0].necesidad_capacitacion;
  }
  needs.forEach((need) => {
    if (training && normalizeForSearch(training).includes(normalizeForSearch(need.necesidad_capacitacion).slice(0, 18))) need.es_priorizada = "SI";
  });
  if (!training) return null;

  return {
    id: createRowId("prioridad-carrera", context.id_documento, index, `${block.carrera}|${training}`),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    carrera: block.carrera,
    capacitacion_priorizada: training,
    porcentaje_recurrencia: needs.find((need) => need.es_priorizada === "SI")?.porcentaje_recurrencia || "",
    perfil_egreso: extractFieldFromBlock(compact, "Perfil de egreso", ["Competencias declaradas", "Impacto en la docencia"]),
    competencias_declaradas: extractFieldFromBlock(compact, "Competencias declaradas", ["Impacto en la docencia", "Pertinencia curricular"]),
    impacto_docencia: extractFieldFromBlock(compact, "Impacto en la docencia", ["Pertinencia curricular", "Alineación institucional"]),
    pertinencia_curricular: extractFieldFromBlock(compact, "Pertinencia curricular", ["Alineación institucional", "Relación con la capacitación genérica institucional"]),
    alineacion_institucional: extractFieldFromBlock(compact, "Alineación institucional", ["Relación con la capacitación genérica institucional"]),
    relacion_capacitacion_generica: firstMatch(compact, [/Relaci[óo]n con la capacitaci[óo]n gen[ée]rica institucional\s+(.+?)(?=\s+\d+\.\d+\.|$)/i]),
    origen_prioridad: "RECURRENCIA_IMPACTO_PERTINENCIA",
    requiere_revision: "NO",
    observacion_extraccion: ""
  };
}

function extractLegacyPriorityRows(text, context, existingCareers) {
  const source = normalizeLineBreaks(text);
  const rows = [];
  const regex = /Curso sugerido\s*:\s*(.+?)(?=\.|\n|$)/gi;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const before = source.slice(Math.max(0, match.index - 7000), match.index);
    const careers = [...before.matchAll(/Carrera de\s+([^\n.]+)/gi)];
    const career = careers.length ? cleanValue(careers[careers.length - 1][1]) : "";
    const training = cleanValue(match[1]);
    if (!career || !training || existingCareers.has(normalizeForSearch(career))) continue;
    existingCareers.add(normalizeForSearch(career));
    rows.push({
      id: createRowId("prioridad-carrera", context.id_documento, 500 + rows.length, `${career}|${training}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      carrera: career,
      capacitacion_priorizada: training,
      porcentaje_recurrencia: "",
      perfil_egreso: "",
      competencias_declaradas: "",
      impacto_docencia: "",
      pertinencia_curricular: "",
      alineacion_institucional: "",
      relacion_capacitacion_generica: "",
      origen_prioridad: "FORMATO_ANTERIOR_CURSO_SUGERIDO",
      requiere_revision: "SI",
      observacion_extraccion: "Prioridad recuperada de un formato anterior; revisar vinculación y recurrencia."
    });
  }
  return rows;
}

function extractCareerData(text, context) {
  const blocks = findCareerBlocks(text);
  const needs = [];
  const priorities = [];

  blocks.forEach((block, blockIndex) => {
    const blockNeeds = assignRecurrences(parseNeedRows(block, context, needs.length), parseRecurrenceRows(block));
    const priority = parsePriority(block, blockNeeds, context, blockIndex);
    needs.push(...blockNeeds);
    if (priority) priorities.push(priority);
  });

  const careers = new Set(priorities.map((row) => normalizeForSearch(row.carrera)));
  priorities.push(...extractLegacyPriorityRows(text, context, careers));
  priorities.forEach((priority, index) => { priority.id = createRowId("prioridad-carrera", context.id_documento, index, `${priority.carrera}|${priority.capacitacion_priorizada}`); });
  return { needs, priorities };
}

function extractConsolidatedRows(text, context, institutionalNeeds, priorities) {
  const rows = [];
  const generic = selectedGenericTraining(text);
  if (generic) {
    rows.push({
      id: createRowId("consolidado-deteccion", context.id_documento, rows.length, `GENERICO|${generic}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      tipo_registro: "CAPACITACION_GENERICA_PRIORIZADA",
      nivel_prioridad: "NIVEL 1",
      alcance: "Institucional",
      carrera: "Todas las carreras",
      capacitacion: generic,
      categoria: "Transversal",
      porcentaje: institutionalNeeds.find((row) => row.es_capacitacion_generica_priorizada === "SI")?.porcentaje_recurrencia || "",
      caracteristicas: "Transversal, estructural, base pedagógica común",
      requiere_revision: "NO",
      observacion_extraccion: ""
    });
  }

  priorities.forEach((priority) => rows.push({
    id: createRowId("consolidado-deteccion", context.id_documento, rows.length, `ESPECIFICO|${priority.carrera}`),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    tipo_registro: "CAPACITACION_ESPECIFICA_PRIORIZADA",
    nivel_prioridad: "NIVEL 2",
    alcance: "Por carrera",
    carrera: priority.carrera,
    capacitacion: priority.capacitacion_priorizada,
    categoria: "Disciplinar o contextualizada",
    porcentaje: priority.porcentaje_recurrencia,
    caracteristicas: "Disciplinar, contextualizada, complementaria",
    requiere_revision: priority.requiere_revision,
    observacion_extraccion: priority.observacion_extraccion
  }));

  const characterization = extractSection(text,
    /Tabla\s+56\s+Caracterizaci[óo]n de las capacitaciones espec[íi]ficas/i,
    [/S[íi]ntesis ejecutiva\s*:?/i, /6\.3\.\s*Priorizaci[óo]n final/i]
  );
  const charRegex = /(Disciplinar\s*\/\s*t[ée]cnica|Pedag[óo]gica especializada|Tecnol[óo]gica aplicada)\s+(\d+(?:[.,]\d+)?)\s*%/gi;
  let match;
  while ((match = charRegex.exec(characterization)) !== null) {
    rows.push({
      id: createRowId("consolidado-deteccion", context.id_documento, rows.length, `CARACTERIZACION|${match[1]}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      tipo_registro: "CARACTERIZACION_ESPECIFICA",
      nivel_prioridad: "",
      alcance: "Consolidado institucional",
      carrera: "",
      capacitacion: "",
      categoria: cleanValue(match[1]),
      porcentaje: Number(match[2].replace(",", ".")),
      caracteristicas: "Distribución aproximada de capacitaciones específicas",
      requiere_revision: "NO",
      observacion_extraccion: ""
    });
  }
  return rows;
}

function extractAnalysis(text, context) {
  const objectives = extractSection(text,
    /Objetivos del Diagn[óo]stico\s*:?/i,
    [/2\.\s*Base Legal/i, /Base Legal\s*:?/i]
  );
  const methodology = extractSection(text,
    [/4\.\s*Metodolog[ií]a del Diagn[óo]stico\s*:?/i, /4\.\s*Metodolog[ií]a\s*:?/i],
    [/5\.\s*Resultados/i, /Resultados del Diagn[óo]stico/i]
  );
  const conclusions = extractSection(text,
    [/7\.\s*Conclusiones del Diagn[óo]stico\s*:?/i, /7\.\s*Conclusiones Generales\s*:?/i],
    [/8\.\s*Recomendaciones/i, /Bibliograf[ií]a/i]
  );
  const recommendations = extractSection(text,
    [/8\.\s*Recomendaciones para la Elaboraci[óo]n del Plan de Capacitaci[óo]n Docente\s*:?/i, /8\.\s*Recomendaciones\s*:?/i],
    [/9\.\s*Bibliograf[ií]a/i, /10\.\s*Anexo/i]
  );
  const warnings = [];
  if (!methodology) warnings.push("No se detectó metodología.");
  if (!conclusions) warnings.push("No se detectaron conclusiones.");
  return {
    id: createRowId("analisis-deteccion", context.id_documento, 0, context.periodo),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    objetivos_diagnostico: objectives,
    metodologia_diagnostico: methodology,
    conclusiones: conclusions,
    recomendaciones_plan_capacitacion: recommendations,
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };
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
    const warnings = [];
    if (!names[index]) warnings.push("No se detectó nombre del responsable.");
    if (!cargos[index]) warnings.push("No se detectó cargo del responsable.");
    rows.push({
      id: createRowId("responsable-deteccion", context.id_documento, index, `${roles[index] || ""}|${names[index] || ""}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      rol_responsable: roles[index] || `RESPONSABLE ${index + 1}`,
      nombre_responsable: names[index] || "",
      cargo_responsable: cargos[index] || "",
      estado_firma: /firmado|signed/i.test(fileName || "") ? "FIRMADO_SEGUN_ARCHIVO" : (names[index] ? "RESPONSABLE_IDENTIFICADO" : "NO_IDENTIFICADO"),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
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
  const sources = extractSources(rawText, context);
  const institutionalNeeds = extractInstitutionalNeeds(rawText, context);
  const careerData = extractCareerData(rawText, context);
  const consolidated = extractConsolidatedRows(rawText, context, institutionalNeeds, careerData.priorities);
  const analysis = extractAnalysis(rawText, context);
  const responsables = extractSignatories(rawText, context, fileName);
  const pageInfo = extractPageInformation(rawText, pdfDocument.pageCount || 0);
  const responseCount = sources.find((row) => row.total_respuestas !== "")?.total_respuestas || "";
  const warnings = [];

  if (!codigoDocumento || !/(?:UGPA|CGC)-RGI1-\d{1,3}-PRO-70-/i.test(codigoDocumento)) warnings.push("No se detectó un código RGI1 de PRO-70 válido.");
  if (!periodText) warnings.push("No se detectó el alcance temporal del diagnóstico.");
  if (!sources.length) warnings.push("No se detectaron fuentes de información.");
  if (!institutionalNeeds.length) warnings.push("No se detectaron necesidades institucionales.");
  if (!careerData.priorities.length) warnings.push("No se detectaron prioridades por carrera.");
  if (!responsables.length) warnings.push("No se detectaron responsables.");
  if (pageInfo.inconsistencia_paginas === "SI") warnings.push("Se detectó inconsistencia entre páginas reales y declaradas.");

  const archivo = {
    id: createRowId("archivo-deteccion", idDocumento, 0, fileName),
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
    id: createRowId("datos-deteccion", idDocumento, 0, periodText),
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    periodo,
    periodo_documental_texto: periodText,
    fecha_elaboracion_texto: elaborationDate.texto,
    fecha_elaboracion: elaborationDate.iso,
    total_respuestas_validas: responseCount,
    total_fuentes_detectadas: sources.length,
    total_necesidades_institucionales: institutionalNeeds.length,
    capacitacion_generica_priorizada: selectedGenericTraining(rawText),
    total_necesidades_carrera: careerData.needs.length,
    total_carreras_con_prioridad: careerData.priorities.length,
    total_registros_consolidados: consolidated.length,
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };

  return {
    document_type: DOCUMENT_TYPE,
    id_documento: idDocumento,
    archivo,
    datos_generales: datosGenerales,
    fuentes: sources,
    necesidades_institucionales: institutionalNeeds,
    necesidades_carrera: careerData.needs,
    prioridades_carrera: careerData.priorities,
    consolidado: consolidated,
    analisis: analysis,
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
      errors: [{ fileName: "", errors: ["Detección de Necesidades admite un solo documento por operación y periodo."] }]
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
      errors.push({ fileName: document.fileName || "", errors: [error.message || "No se pudo analizar la Detección de Necesidades."] });
    }
  });

  return { documentType: DOCUMENT_TYPE, total: documents.length, parsedCount: parsed.length, errorCount: errors.length, parsed, errors };
}

module.exports = {
  DOCUMENT_TYPE,
  SOURCE_DEFINITIONS,
  parseSpanishDate,
  extractSection,
  extractPeriodText,
  extractSources,
  selectedGenericTraining,
  extractInstitutionalNeeds,
  findCareerBlocks,
  parseNeedRows,
  parseRecurrenceRows,
  assignRecurrences,
  parsePriority,
  extractCareerData,
  extractConsolidatedRows,
  extractAnalysis,
  extractPageInformation,
  parseDocument,
  parseDocuments
};
