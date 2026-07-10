/* Diagnóstico temporal del Instrumento de Evaluación. */
"use strict";

const { assertProcessor } = require("../core/processor.registry");
const { createSyntheticEvaluationInstrument } = require("./instrumento-evaluacion.parser.test");

const processor = assertProcessor("instrumento-evaluacion");
const parseResult = processor.parseDocuments([createSyntheticEvaluationInstrument()]);
const document = parseResult.parsed[0] || {};

console.log(JSON.stringify({
  parseResult: {
    parsedCount: parseResult.parsedCount,
    errorCount: parseResult.errorCount,
    errors: parseResult.errors
  },
  archivo: document.archivo,
  datos_generales: document.datos_generales,
  participantes: document.participantes,
  indicadores: document.indicadores,
  likert: document.likert,
  objetivos: document.objetivos,
  analisis: document.analisis,
  responsables: document.responsables,
  warnings: document.warnings,
  parseValidation: processor.validateParseResult(parseResult),
  tables: processor.buildTables(parseResult)
}, null, 2));
