"use strict";

const { assertProcessor } = require("../core/processor.registry");
const { createSyntheticNeedsDetection } = require("./deteccion-necesidades.parser.test");

const processor = assertProcessor("deteccion-necesidades");
const input = createSyntheticNeedsDetection();
const result = processor.parseDocuments([input]);
const document = result.parsed[0] || {};

console.log("DEBUG_PRIORIDADES");
console.log(JSON.stringify(document.prioridades_carrera || [], null, 2));
console.log("DEBUG_NECESIDADES_ENFERMERIA");
console.log(JSON.stringify((document.necesidades_carrera || []).filter((row) => row.carrera === "Enfermería"), null, 2));
