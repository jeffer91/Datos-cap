/* =========================================================
Nombre completo: query-service.test.js
Ruta o ubicación: /src/diagnostics/query-service.test.js
Función o funciones:
- Probar filtros por tipo, periodo, carrera, docente, curso y estado.
- Probar búsqueda general sobre filas de distintas colecciones.
- Verificar paginación y recuperación del detalle documental.
- Confirmar opciones dinámicas construidas desde datos reales.
========================================================= */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { createPersistenceService, createQueryService } = require("../database");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function persistDocument(service, config) {
  const document = {
    document_type: config.documentType,
    id_documento: config.id,
    archivo: {
      id_documento: config.id,
      nombre_archivo: config.fileName,
      ruta_archivo: config.fileName,
      hash_archivo: config.hash,
      codigo_documento: config.code,
      periodo: config.period,
      estado_extraccion: config.review ? "REVISAR" : "OK",
      requiere_revision: config.review ? "SI" : "NO"
    },
    source: { file_hash: config.hash }
  };

  const result = service.persistProcessingResult({
    definition: {
      id: config.documentType,
      label: config.label,
      processorId: config.documentType,
      uniquePerPeriod: Boolean(config.uniquePerPeriod)
    },
    documentType: config.documentType,
    processorId: config.documentType,
    outputDir: config.outputDir,
    parseResult: { parsedCount: 1, parsed: [document] },
    tableResult: {
      summary: { total_rows: config.rows.length },
      tables: {
        [config.collection]: config.rows.map((row, index) => ({
          id: `${config.id}-row-${index + 1}`,
          id_documento: config.id,
          codigo_documento: config.code,
          periodo: config.period,
          ...row
        }))
      }
    }
  });

  service.finalizeProcessingRun(result.runId, { ok: true, outputDir: config.outputDir, files: {} });
  return result;
}

function runQueryServiceTest() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-query-"));
  const persistence = createPersistenceService(tempDirectory);

  persistDocument(persistence, {
    documentType: "informe-final",
    label: "Informe Final de Capacitación",
    id: "doc-finanzas",
    hash: "hash-finanzas",
    code: "UGPA-INF-01-PRO-134-2026-01",
    period: "2026-01",
    fileName: "informe-finanzas.pdf",
    outputDir: tempDirectory,
    collection: "datos_informe_final",
    rows: [{
      carrera_publico: "Administración",
      nombre_docente: "Ana Torres",
      nombre_curso: "Educación Financiera",
      conclusiones: "La capacitación fortaleció la gestión del presupuesto familiar."
    }]
  });

  persistDocument(persistence, {
    documentType: "planificacion-curso",
    label: "Planificación por Curso",
    id: "doc-ciberseguridad",
    hash: "hash-ciberseguridad",
    code: "UGPA-RGI1-02-PRO-134-2026-02",
    period: "2026-02",
    fileName: "plan-ciberseguridad.pdf",
    outputDir: tempDirectory,
    collection: "datos_planificacion_curso",
    rows: [{
      carrera: "Desarrollo de Software",
      facilitador: "Luis Mendoza",
      nombre_curso: "Ciberseguridad Aplicada",
      objetivo: "Reducir riesgos de phishing y fortalecer controles de acceso."
    }]
  });

  persistDocument(persistence, {
    documentType: "deteccion-necesidades",
    label: "Detección de Necesidades",
    uniquePerPeriod: true,
    id: "diagnostico-2026-v1",
    hash: "hash-diagnostico-1",
    code: "UGPA-RGI1-01-PRO-70-2026-03",
    period: "2026-03",
    fileName: "diagnostico-v1.pdf",
    outputDir: tempDirectory,
    collection: "necesidades_carrera",
    rows: [{
      carrera: "Marketing",
      nombre_docente: "María López",
      necesidad_capacitacion: "Analítica digital"
    }]
  });

  persistDocument(persistence, {
    documentType: "deteccion-necesidades",
    label: "Detección de Necesidades",
    uniquePerPeriod: true,
    id: "diagnostico-2026-v2",
    hash: "hash-diagnostico-2",
    code: "UGPA-RGI1-02-PRO-70-2026-03",
    period: "2026-03",
    fileName: "diagnostico-v2.pdf",
    outputDir: tempDirectory,
    collection: "necesidades_carrera",
    rows: [{
      carrera: "Marketing",
      nombre_docente: "María López",
      necesidad_capacitacion: "Inteligencia artificial aplicada al marketing"
    }]
  });

  const queryService = createQueryService(persistence.database);
  const options = queryService.getFilterOptions();

  assertCondition(options.ok, "No se generaron opciones de filtros.");
  assertCondition(options.documentTypes.includes("informe-final"), "Falta el tipo Informe Final.");
  assertCondition(options.periods.includes("2026-03"), "Falta el periodo 2026-03.");
  assertCondition(options.careers.includes("Administración"), "No se indexó la carrera Administración.");
  assertCondition(options.teachers.includes("Luis Mendoza"), "No se indexó el facilitador Luis Mendoza.");
  assertCondition(options.courses.includes("Ciberseguridad Aplicada"), "No se indexó el curso de ciberseguridad.");

  const byType = queryService.queryDocuments({ documentType: "informe-final" });
  assertCondition(byType.pagination.total === 1, "El filtro por tipo documental es incorrecto.");
  assertCondition(byType.items[0].id_documento === "doc-finanzas", "El tipo documental devolvió otro documento.");

  const byPeriod = queryService.queryDocuments({ period: "2026-02" });
  assertCondition(byPeriod.pagination.total === 1, "El filtro por periodo es incorrecto.");
  assertCondition(byPeriod.items[0].id_documento === "doc-ciberseguridad", "El periodo devolvió otro documento.");

  const byCareer = queryService.queryDocuments({ career: "administracion" });
  assertCondition(byCareer.pagination.total === 1, "El filtro por carrera no ignora tildes correctamente.");

  const byTeacher = queryService.queryDocuments({ teacher: "Luis" });
  assertCondition(byTeacher.pagination.total === 1, "El filtro por docente o facilitador es incorrecto.");

  const byCourse = queryService.queryDocuments({ course: "ciberseguridad" });
  assertCondition(byCourse.pagination.total === 1, "El filtro por curso es incorrecto.");

  const byGeneralSearch = queryService.queryDocuments({ search: "presupuesto familiar" });
  assertCondition(byGeneralSearch.pagination.total === 1, "La búsqueda general no revisó las conclusiones.");
  assertCondition(byGeneralSearch.items[0].id_documento === "doc-finanzas", "La búsqueda general devolvió otro documento.");

  const superseded = queryService.queryDocuments({ state: "SUPERADO" });
  assertCondition(superseded.pagination.total === 1, "No se encontró la versión superada.");
  assertCondition(superseded.items[0].id_documento === "diagnostico-2026-v1", "La versión superada es incorrecta.");

  const active = queryService.queryDocuments({ state: "ACTIVO" });
  assertCondition(active.pagination.total === 3, "El filtro de documentos activos es incorrecto.");
  assertCondition(!active.items.some((item) => item.id_documento === "diagnostico-2026-v1"), "La versión superada aparece como activa.");

  const paginated = queryService.queryDocuments({ page: 2, pageSize: 2 });
  assertCondition(paginated.pagination.total === 4, "La paginación perdió documentos.");
  assertCondition(paginated.pagination.totalPages === 2, "La cantidad de páginas es incorrecta.");
  assertCondition(paginated.items.length === 2, "La segunda página no contiene dos documentos.");

  const detail = queryService.getDocumentDetail("doc-finanzas");
  assertCondition(detail.ok, "No se recuperó el detalle documental.");
  assertCondition(detail.summary.totalCollections === 1, "El detalle no contiene una colección.");
  assertCondition(detail.summary.totalRows === 1, "El detalle no contiene una fila.");
  assertCondition(detail.collections[0].rows[0].nombre_curso === "Educación Financiera", "El detalle perdió la fila del curso.");

  return {
    ok: true,
    tempDirectory,
    options: {
      documentTypes: options.documentTypes.length,
      periods: options.periods.length,
      careers: options.careers.length,
      teachers: options.teachers.length,
      courses: options.courses.length
    },
    totalDocuments: paginated.pagination.total,
    activeDocuments: active.pagination.total,
    supersededDocuments: superseded.pagination.total,
    detailCollections: detail.summary.totalCollections
  };
}

if (require.main === module) {
  try {
    console.log("QUERY_SERVICE_OK");
    console.log(JSON.stringify(runQueryServiceTest(), null, 2));
  } catch (error) {
    console.error("QUERY_SERVICE_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  persistDocument,
  runQueryServiceTest
};
