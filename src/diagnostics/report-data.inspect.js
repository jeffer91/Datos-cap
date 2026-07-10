/* Diagnóstico controlado del modelo consolidado durante CI. */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { LocalDatabase } = require("../database");
const {
  DOCUMENTS_COLLECTION,
  createReportDataRepository,
  normalizePeriod
} = require("../reporting");
const { seed } = require("./report-data.repository.test");

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-reporting-inspect-"));
const database = new LocalDatabase(path.join(tempDirectory, "database"));
database.initialize();
seed(database);
const repository = createReportDataRepository(database);
const rawDocuments = database.readCollection(DOCUMENTS_COLLECTION);
const snapshot = repository.loadSnapshot({ period: "Marzo 2026" });
console.log(JSON.stringify({
  documentsCollection: DOCUMENTS_COLLECTION,
  requestedPeriod: normalizePeriod("Marzo 2026"),
  rawDocumentCount: rawDocuments.length,
  rawDocuments: rawDocuments.map((item) => ({
    id: item.id_documento,
    type: item.tipo_documental,
    active: item.activo,
    state: item.estado_version,
    period: item.periodo,
    normalizedPeriod: normalizePeriod(item.periodo)
  })),
  summary: snapshot.summary,
  periods: snapshot.periods,
  documents: snapshot.documents.map((item) => ({
    id: item.id_documento,
    type: item.tipo_documental,
    active: item.activo,
    state: item.estado_version,
    period: item.periodo
  })),
  people: snapshot.people.map((item) => ({
    key: item.personKey,
    name: item.preferredName,
    identity: item.preferredIdentity,
    periods: item.periods,
    sourceCount: item.sources.length
  })),
  courses: snapshot.courses.map((item) => ({
    key: item.courseKey,
    name: item.preferredName,
    sources: item.sourceKeys
  })),
  issues: snapshot.issues
}, null, 2));
