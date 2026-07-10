"use strict";

const { assertProcessor } = require("../core/processor.registry");
const { createSyntheticGeneralPlan } = require("./plan-general-capacitacion.parser.test");

const processor = assertProcessor("plan-general-capacitacion");
const result = processor.parseDocuments([createSyntheticGeneralPlan()]);
console.log(JSON.stringify(result, null, 2));
