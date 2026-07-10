/* Diagnóstico temporal para revisar la extracción sintética del Informe Final. */
"use strict";

const { assertProcessor } = require("../core/processor.registry");
const { createSyntheticFinalReport } = require("./informe-final.parser.test");

const processor = assertProcessor("informe-final");
const parseResult = processor.parseDocuments([createSyntheticFinalReport()]);
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
  resultados: document.resultados,
  resumen: document.resumen,
  responsables: document.responsables,
  warnings: document.warnings,
  parseValidation: processor.validateParseResult(parseResult)
}, null, 2));
