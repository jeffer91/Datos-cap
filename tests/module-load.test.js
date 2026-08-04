"use strict";

const assert = require("assert");

function run() {
  const moduleUnderTest = require("../src/hybrid-pdf-reader");
  assert.strictEqual(typeof moduleUnderTest.HybridPdfReader, "function");
  assert.strictEqual(typeof moduleUnderTest.assessDigitalText, "function");
  assert.strictEqual(typeof moduleUnderTest.getPdfRenderer, "function");

  const reader = new moduleUnderTest.HybridPdfReader({ maxOcrPages: 6 });
  assert.strictEqual(reader.maxOcrPages, 6);

  console.log("Carga del lector híbrido: correcta.");
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
