/* =========================================================
Nombre completo: query.service.js
Ruta o ubicación: /src/database/query.service.js
Función o funciones:
- Consultar documentos y filas guardadas en todas las colecciones locales.
- Filtrar por tipo, periodo, carrera, docente, curso y estado.
- Construir opciones dinámicas de filtros a partir de los datos reales.
- Recuperar el detalle completo de un documento agrupado por tabla.
========================================================= */

"use strict";

const DOCUMENTS_COLLECTION = "_documents";

const FIELD_GROUPS = Object.freeze({
  career: new Set([
    "carrera", "carrera_publico", "carrera_docente", "nombre_carrera", "carrera_beneficiaria",
    "publico_objetivo", "dirigido_a", "beneficiarios", "grupo_destinatario"
  ]),
  teacher: new Set([
    "docente", "nombre_docente", "nombres_apellidos", "nombre_responsable", "responsable",
    "facilitador", "facilitadores", "capacitador", "nombre_facilitador", "instructor"
  ]),
  course: new Set([
    "curso", "nombre_curso", "capacitacion", "nombre_capacitacion", "tema_capacitacion",
    "titulo_capacitacion", "formacion", "actividad_capacitacion", "necesidad_capacitacion"
  ])
});

function normalizeText(value) {
  return String(value === null || typeof value === "undefined" ? "" : value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function displayText(value) {
  return String(value === null || typeof value === "undefined" ? "" : value).trim();
}

function uniqueSorted(values, limit = 200) {
  const map = new Map();
  (values || []).forEach((value) => {
    const display = displayText(value);
    const normalized = normalizeText(display);
    if (normalized && !map.has(normalized)) map.set(normalized, display);
  });
  return [...map.values()]
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
    .slice(0, limit);
}

function recordValues(record) {
  return Object.values(record || {}).filter((value) =>
    value !== null &&
    typeof value !== "undefined" &&
    typeof value !== "object"
  );
}

function extractGroupedValues(record, fieldGroup) {
  const allowed = FIELD_GROUPS[fieldGroup] || new Set();
  return Object.entries(record || {})
    .filter(([key, value]) => allowed.has(normalizeText(key)) && displayText(value))
    .map(([, value]) => displayText(value));
}

function matchesTerm(values, term) {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return true;
  return (values || []).some((value) => normalizeText(value).includes(normalizedTerm));
}

function matchesState(document, state) {
  const filter = String(state || "").trim().toUpperCase();
  if (!filter || filter === "TODOS") return true;

  if (filter === "ACTIVO") {
    return document.activo !== false && String(document.estado_version || "").toUpperCase() !== "SUPERADO";
  }
  if (filter === "SUPERADO") {
    return document.activo === false || String(document.estado_version || "").toUpperCase() === "SUPERADO";
  }
  if (filter === "REVISAR") {
    return String(document.requiere_revision || "").toUpperCase() === "SI" ||
      String(document.estado_extraccion || "").toUpperCase() === "REVISAR";
  }
  if (filter === "OK") {
    return String(document.requiere_revision || "").toUpperCase() !== "SI" &&
      String(document.estado_extraccion || "OK").toUpperCase() !== "REVISAR";
  }
  return String(document.estado_version || "").toUpperCase() === filter ||
    String(document.estado_extraccion || "").toUpperCase() === filter;
}

function createEmptyIndex(document) {
  return {
    document,
    allValues: recordValues(document),
    careers: [],
    teachers: [],
    courses: [],
    rowCount: 0,
    collections: new Map()
  };
}

function addRowToIndex(entry, collection, row) {
  entry.rowCount += 1;
  entry.allValues.push(...recordValues(row));
  entry.careers.push(...extractGroupedValues(row, "career"));
  entry.teachers.push(...extractGroupedValues(row, "teacher"));
  entry.courses.push(...extractGroupedValues(row, "course"));

  if (!entry.collections.has(collection)) entry.collections.set(collection, []);
  entry.collections.get(collection).push(row);
}

function createPreview(values, maxItems = 3) {
  return uniqueSorted(values, maxItems).join(" | ");
}

class QueryService {
  constructor(localDatabase) {
    if (!localDatabase) throw new Error("El servicio de consultas requiere una base local.");
    this.database = localDatabase;
  }

  listDataCollections() {
    return this.database.listCollections().filter((name) => !name.startsWith("_"));
  }

  buildIndex() {
    const documents = this.database.readCollection(DOCUMENTS_COLLECTION);
    const byDocumentId = new Map();

    documents.forEach((document) => {
      const id = displayText(document.id_documento || document.id);
      if (id) byDocumentId.set(id, createEmptyIndex(document));
    });

    this.listDataCollections().forEach((collection) => {
      this.database.readCollection(collection).forEach((row) => {
        const documentId = displayText(row && row.id_documento);
        if (!documentId || !byDocumentId.has(documentId)) return;
        addRowToIndex(byDocumentId.get(documentId), collection, row);
      });
    });

    return byDocumentId;
  }

  getFilterOptions() {
    const index = this.buildIndex();
    const documents = [...index.values()];

    return {
      ok: true,
      documentTypes: uniqueSorted(documents.map((entry) => entry.document.tipo_documental)),
      documentTypeLabels: documents.reduce((output, entry) => {
        const id = displayText(entry.document.tipo_documental);
        if (id && !output[id]) output[id] = displayText(entry.document.nombre_tipo_documental || id);
        return output;
      }, {}),
      periods: uniqueSorted(documents.map((entry) => entry.document.periodo)).reverse(),
      careers: uniqueSorted(documents.flatMap((entry) => entry.careers), 300),
      teachers: uniqueSorted(documents.flatMap((entry) => entry.teachers), 300),
      courses: uniqueSorted(documents.flatMap((entry) => entry.courses), 300),
      states: ["ACTIVO", "SUPERADO", "REVISAR", "OK"],
      totalDocuments: documents.length
    };
  }

  queryDocuments(filters = {}) {
    const index = this.buildIndex();
    const documentType = displayText(filters.documentType);
    const period = displayText(filters.period);
    const career = displayText(filters.career);
    const teacher = displayText(filters.teacher);
    const course = displayText(filters.course);
    const search = displayText(filters.search);
    const state = displayText(filters.state);
    const page = Math.max(1, Number(filters.page || 1));
    const pageSize = Math.max(1, Math.min(Number(filters.pageSize || 25), 100));

    const filtered = [...index.values()].filter((entry) => {
      const document = entry.document;
      if (documentType && document.tipo_documental !== documentType) return false;
      if (period && document.periodo !== period) return false;
      if (!matchesState(document, state)) return false;
      if (!matchesTerm(entry.careers, career)) return false;
      if (!matchesTerm(entry.teachers, teacher)) return false;
      if (!matchesTerm(entry.courses, course)) return false;
      if (!matchesTerm(entry.allValues, search)) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const dateA = String(a.document.ultima_fecha_procesamiento || a.document.fecha_registro || "");
      const dateB = String(b.document.ultima_fecha_procesamiento || b.document.fecha_registro || "");
      return dateB.localeCompare(dateA);
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map((entry) => ({
      id_documento: entry.document.id_documento || entry.document.id,
      tipo_documental: entry.document.tipo_documental,
      nombre_tipo_documental: entry.document.nombre_tipo_documental,
      codigo_documento: entry.document.codigo_documento,
      periodo: entry.document.periodo,
      nombre_archivo: entry.document.nombre_archivo,
      version_local: entry.document.version_local,
      activo: entry.document.activo !== false,
      estado_version: entry.document.estado_version,
      estado_extraccion: entry.document.estado_extraccion,
      requiere_revision: entry.document.requiere_revision,
      fecha_registro: entry.document.fecha_registro,
      ultima_fecha_procesamiento: entry.document.ultima_fecha_procesamiento,
      carreras: createPreview(entry.careers),
      docentes: createPreview(entry.teachers),
      cursos: createPreview(entry.courses),
      total_filas: entry.rowCount,
      total_colecciones: entry.collections.size
    }));

    return {
      ok: true,
      filters: { documentType, period, career, teacher, course, search, state },
      pagination: { page: safePage, pageSize, total, totalPages },
      items
    };
  }

  getDocumentDetail(documentId, options = {}) {
    const id = displayText(documentId);
    if (!id) throw new Error("Debes indicar el documento que deseas consultar.");

    const index = this.buildIndex();
    const entry = index.get(id);
    if (!entry) throw new Error("El documento solicitado no existe en la base local.");

    const maxRowsPerCollection = Math.max(1, Math.min(Number(options.maxRowsPerCollection || 200), 1000));
    const collections = [...entry.collections.entries()]
      .sort(([nameA], [nameB]) => nameA.localeCompare(nameB, "es"))
      .map(([name, rows]) => ({
        name,
        totalRows: rows.length,
        truncated: rows.length > maxRowsPerCollection,
        rows: rows.slice(0, maxRowsPerCollection)
      }));

    return {
      ok: true,
      document: entry.document,
      summary: {
        totalCollections: collections.length,
        totalRows: entry.rowCount,
        careers: uniqueSorted(entry.careers, 50),
        teachers: uniqueSorted(entry.teachers, 50),
        courses: uniqueSorted(entry.courses, 50)
      },
      collections
    };
  }
}

function createQueryService(localDatabase) {
  return new QueryService(localDatabase);
}

module.exports = {
  FIELD_GROUPS,
  normalizeText,
  displayText,
  uniqueSorted,
  recordValues,
  extractGroupedValues,
  matchesTerm,
  matchesState,
  createEmptyIndex,
  addRowToIndex,
  QueryService,
  createQueryService
};
