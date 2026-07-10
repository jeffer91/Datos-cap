/* Diagnóstico temporal del Informe de Impacto. */
"use strict";

const { assertProcessor } = require("../core/processor.registry");
const { createSyntheticImpactReport } = require("./informe-impacto.parser.test");

const processor = assertProcessor("informe-impacto");
const parseResult = processor.parseDocuments([createSyntheticImpactReport()]);
const document = parseResult.parsed[0] || {};

console.log(JSON.stringify({
  parseResult: {
    parsedCount: parseResult.parsedCount,
    errorCount: parseResult.errorCount,
    errors: parseResult.errors
  },
  archivo: document.archivo,
  datos_generales: document.datos_generales,
  indicadores: document.indicadores,
  objetivos: document.objetivos,
  metodologia: document.metodologia,
  analisis: document.analisis,
  responsables: document.responsables,
  warnings: document.warnings,
  parseValidation: processor.validateParseResult(parseResult),
  tables: processor.buildTables(parseResult)
}, null, 2));
