/* =========================================================
Nombre completo: report-data.repository.js
Ruta o ubicación: /src/reporting/repositories/report-data.repository.js
Función o funciones:
- Leer de forma segura las colecciones necesarias para los nuevos reportes.
- Filtrar versiones activas y propagar periodo desde el registro maestro.
- Construir índices normalizados de personas, cursos y vínculos persona-curso.
- Informar disponibilidad, faltantes y limitaciones sin inventar datos.
========================================================= */

"use strict";

const {
  DOCUMENTS_COLLECTION,
  SOURCES,
  PERSON_SOURCE_KEYS,
  COURSE_SOURCE_KEYS,
  listCollections,
  getReportingCapabilities
} = require("../schema/reporting-schema.registry");
const {
  displayText,
  normalizePeriod,
  firstNonEmpty
} = require("../normalization/text.normalizer");
const {
  extractPerson,
  choosePreferredPersonName
} = require("../normalization/person.normalizer");
const {
  extractCourse,
  choosePreferredCourseName,
  normalizeCareer
} = require("../normalization/course.normalizer");

function unique(values) {
  return [...new Set((values || []).filter((value) => value !== "" && value !== null && typeof value !== "undefined"))];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isActiveDocument(document) {
  return document && document.activo !== false && String(document.estado_version || "").toUpperCase() !== "SUPERADO";
}

function createSourceReference(sourceKey, collection, row, document) {
  return {
    sourceKey,
    documentType: document ? document.tipo_documental : SOURCES[sourceKey].documentType,
    collection,
    rowId: displayText(row && row.id),
    documentId: displayText(row && row.id_documento),
    documentCode: displayText((row && row.codigo_documento) || (document && document.codigo_documento)),
    period: displayText((row && row.periodo) || (document && document.periodo)),
    requiresReview: String(row && row.requiere_revision || "").toUpperCase() === "SI"
  };
}

function mergePersonEntity(target, input, reference, career, period) {
  target.names = unique([...target.names, input.name]);
  target.identities = unique([...target.identities, input.identity]);
  target.careers = unique([...target.careers, displayText(career)]);
  target.periods = unique([...target.periods, displayText(period)]);
  target.documentIds = unique([...target.documentIds, reference.documentId]);
  target.sources.push(reference);
  target.preferredName = choosePreferredPersonName(target.names);
  target.preferredIdentity = target.identities[0] || "";
  target.hasReliableIdentity = target.identities.length > 0;
  target.requiresReview = target.requiresReview || reference.requiresReview;
  return target;
}

function mergeCourseEntity(target, input, reference) {
  target.names = unique([...target.names, input.name]);
  target.periods = unique([...target.periods, input.period]);
  target.careers = unique([...target.careers, input.career]);
  target.documentIds = unique([...target.documentIds, reference.documentId]);
  target.sources.push(reference);
  target.preferredName = choosePreferredCourseName(target.names);
  target.periodKey = input.periodKey || target.periodKey;
  target.requiresReview = target.requiresReview || reference.requiresReview;
  return target;
}

class ReportDataRepository {
  constructor(localDatabase) {
    if (!localDatabase || typeof localDatabase.readCollection !== "function") {
      throw new Error("El repositorio de reportes requiere una base local válida.");
    }
    this.database = localDatabase;
  }

  listExistingCollections() {
    return typeof this.database.listCollections === "function"
      ? this.database.listCollections()
      : [];
  }

  readDocuments(options = {}) {
    const includeSuperseded = Boolean(options.includeSuperseded);
    const requestedPeriod = normalizePeriod(options.period);

    return this.database.readCollection(DOCUMENTS_COLLECTION)
      .filter((document) => includeSuperseded || isActiveDocument(document))
      .filter((document) => !requestedPeriod || normalizePeriod(document.period) === requestedPeriod)
      .map((document) => ({ ...document }));
  }

  readRows(collection, documentIds) {
    const allowedIds = documentIds instanceof Set ? documentIds : new Set(documentIds || []);
    return this.database.readCollection(collection)
      .filter((row) => {
        const documentId = displayText(row && row.id_documento);
        return documentId && allowedIds.has(documentId);
      })
      .map((row) => ({ ...row }));
  }

  loadCollections(documents) {
    const documentIds = new Set(documents.map((document) => displayText(document.id_documento || document.id)).filter(Boolean));
    const output = {};

    listCollections().forEach((collection) => {
      if (collection === DOCUMENTS_COLLECTION) {
        output[collection] = documents.map((document) => ({ ...document }));
      } else {
        output[collection] = this.readRows(collection, documentIds);
      }
    });

    return output;
  }

  buildDocumentMaps(documents) {
    const byId = new Map();
    const byType = new Map();

    documents.forEach((document) => {
      const id = displayText(document.id_documento || document.id);
      if (id) byId.set(id, document);
      const type = displayText(document.tipo_documental);
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(document);
    });

    return { byId, byType };
  }

  buildDocumentCourseMap(collections, documentById) {
    const output = new Map();

    COURSE_SOURCE_KEYS.forEach((sourceKey) => {
      const source = SOURCES[sourceKey];
      Object.values(source.collections).forEach((collection) => {
        (collections[collection] || []).forEach((row) => {
          const documentId = displayText(row.id_documento);
          if (!documentId || output.has(documentId)) return;
          const document = documentById.get(documentId);
          const extracted = extractCourse(row, source, document && document.period);
          if (extracted.courseKey) output.set(documentId, extracted);
        });
      });
    });

    return output;
  }

  buildPeople(collections, documentById, documentCourseById) {
    const people = new Map();
    const nameToKey = new Map();
    const identityToKey = new Map();
    const links = [];
    const seenLinks = new Set();

    PERSON_SOURCE_KEYS.forEach((sourceKey) => {
      const source = SOURCES[sourceKey];
      Object.values(source.collections).forEach((collection) => {
        (collections[collection] || []).forEach((row) => {
          const documentId = displayText(row.id_documento);
          const document = documentById.get(documentId);
          const person = extractPerson(row, source);
          if (!person.personKey) return;

          let key = "";
          if (person.identityKey && identityToKey.has(person.identityKey)) key = identityToKey.get(person.identityKey);
          if (!key && person.nameKey && nameToKey.has(person.nameKey)) key = nameToKey.get(person.nameKey);
          if (!key) key = person.personKey;

          if (!people.has(key)) {
            people.set(key, {
              personKey: key,
              preferredName: "",
              preferredIdentity: "",
              names: [],
              identities: [],
              careers: [],
              periods: [],
              documentIds: [],
              sources: [],
              hasReliableIdentity: false,
              requiresReview: false
            });
          }

          const period = firstNonEmpty(row, source.periodFields) || (document && document.period) || "";
          const career = firstNonEmpty(row, source.careerFields);
          const reference = createSourceReference(sourceKey, collection, row, document);
          mergePersonEntity(people.get(key), person, reference, career, period);

          if (person.identityKey) identityToKey.set(person.identityKey, key);
          if (person.nameKey) nameToKey.set(person.nameKey, key);

          let course = extractCourse(row, source, period);
          if (!course.courseKey && documentCourseById.has(documentId)) course = documentCourseById.get(documentId);
          if (course && course.courseKey) {
            const linkKey = `${key}|${course.courseKey}|${sourceKey}|${collection}|${reference.rowId || documentId}`;
            if (!seenLinks.has(linkKey)) {
              seenLinks.add(linkKey);
              links.push({
                personKey: key,
                courseKey: course.courseKey,
                sourceKey,
                collection,
                documentId,
                rowId: reference.rowId,
                period: course.period,
                periodKey: course.periodKey,
                personName: person.name,
                personIdentity: person.identity,
                courseName: course.name,
                career: course.career || career,
                requiresReview: reference.requiresReview
              });
            }
          }
        });
      });
    });

    return {
      people: [...people.values()].sort((a, b) => a.preferredName.localeCompare(b.preferredName, "es")),
      links
    };
  }

  buildCourses(collections, documentById) {
    const courses = new Map();

    COURSE_SOURCE_KEYS.forEach((sourceKey) => {
      const source = SOURCES[sourceKey];
      Object.values(source.collections).forEach((collection) => {
        (collections[collection] || []).forEach((row) => {
          const documentId = displayText(row.id_documento);
          const document = documentById.get(documentId);
          const course = extractCourse(row, source, document && document.period);
          if (!course.courseKey) return;

          if (!courses.has(course.courseKey)) {
            courses.set(course.courseKey, {
              courseKey: course.courseKey,
              preferredName: "",
              names: [],
              periods: [],
              periodKey: course.periodKey,
              careers: [],
              careerKeys: [],
              documentIds: [],
              sourceKeys: [],
              sources: [],
              requiresReview: false
            });
          }

          const reference = createSourceReference(sourceKey, collection, row, document);
          const target = mergeCourseEntity(courses.get(course.courseKey), course, reference);
          target.sourceKeys = unique([...target.sourceKeys, sourceKey]);
          target.careerKeys = unique([...target.careerKeys, normalizeCareer(course.career)]);
        });
      });
    });

    return [...courses.values()].sort((a, b) => {
      const periodCompare = String(b.periodKey || "").localeCompare(String(a.periodKey || ""));
      return periodCompare || a.preferredName.localeCompare(b.preferredName, "es");
    });
  }

  buildAvailability(documents, collections) {
    const existing = new Set(this.listExistingCollections());
    const sources = {};

    Object.entries(SOURCES).forEach(([sourceKey, source]) => {
      const sourceDocuments = documents.filter((document) => document.tipo_documental === source.documentType);
      const collectionStatus = Object.fromEntries(Object.values(source.collections).map((collection) => [collection, {
        exists: existing.has(collection),
        rows: (collections[collection] || []).length
      }]));

      sources[sourceKey] = {
        documentType: source.documentType,
        documents: sourceDocuments.length,
        collections: collectionStatus,
        available: sourceDocuments.length > 0
      };
    });

    return sources;
  }

  loadSnapshot(options = {}) {
    const documents = this.readDocuments(options);
    const collections = this.loadCollections(documents);
    const maps = this.buildDocumentMaps(documents);
    const documentCourseById = this.buildDocumentCourseMap(collections, maps.byId);
    const peopleData = this.buildPeople(collections, maps.byId, documentCourseById);
    const courses = this.buildCourses(collections, maps.byId);
    const capabilities = getReportingCapabilities();
    const issues = [];

    if (!capabilities.canResolveImpactParticipants) {
      issues.push({
        code: "IMPACT_PARTICIPANTS_NOT_STORED",
        severity: "BLOCKING_FOR_INDIVIDUAL_TRACEABILITY",
        message: capabilities.impactParticipantLimitation
      });
    }

    documents.filter((document) => !normalizePeriod(document.period)).forEach((document) => {
      issues.push({
        code: "DOCUMENT_WITHOUT_PERIOD",
        severity: "REVIEW",
        documentId: document.id_documento,
        documentType: document.tipo_documental,
        message: "El documento no tiene un periodo utilizable para consolidación."
      });
    });

    return {
      ok: true,
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      filters: {
        period: displayText(options.period),
        periodKey: normalizePeriod(options.period),
        includeSuperseded: Boolean(options.includeSuperseded)
      },
      capabilities,
      summary: {
        documents: documents.length,
        people: peopleData.people.length,
        courses: courses.length,
        personCourseLinks: peopleData.links.length,
        collectionsRead: Object.keys(collections).length,
        issues: issues.length
      },
      periods: unique(documents.map((document) => normalizePeriod(document.period))).sort().reverse(),
      documents: clone(documents),
      people: peopleData.people,
      courses,
      personCourseLinks: peopleData.links,
      availability: this.buildAvailability(documents, collections),
      globalInputs: {
        needsDetection: clone(Object.fromEntries(Object.entries(SOURCES.needsDetection.collections).map(([role, collection]) => [role, collections[collection] || []]))),
        semesterPlan: clone(Object.fromEntries(Object.entries(SOURCES.semesterPlan.collections).map(([role, collection]) => [role, collections[collection] || []])))
      },
      issues
    };
  }

  getDataDictionary() {
    const existing = new Set(this.listExistingCollections());
    return {
      schemaVersion: 1,
      capabilities: getReportingCapabilities(),
      sources: Object.fromEntries(Object.entries(SOURCES).map(([key, source]) => [key, {
        documentType: source.documentType,
        personFields: [...source.personFields],
        identityFields: [...source.identityFields],
        careerFields: [...source.careerFields],
        courseFields: [...source.courseFields],
        periodFields: [...source.periodFields],
        collections: Object.fromEntries(Object.entries(source.collections).map(([role, collection]) => [role, {
          name: collection,
          exists: existing.has(collection)
        }]))
      }]))
    };
  }
}

function createReportDataRepository(localDatabase) {
  return new ReportDataRepository(localDatabase);
}

module.exports = {
  unique,
  clone,
  isActiveDocument,
  createSourceReference,
  mergePersonEntity,
  mergeCourseEntity,
  ReportDataRepository,
  createReportDataRepository
};
