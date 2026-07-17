/* =========================================================
Nombre completo: reporte-individual.query.js
Ruta o ubicación: /src/reporte-individual/reporte-individual.query.js
Función o funciones:
- Consultar únicamente las colecciones de la base local.
- Reunir los datos necesarios para construir reportes individuales.
========================================================= */
"use strict";

const COLLECTIONS = Object.freeze({
  documentos: "_documents",
  planes: "identificacion_docente",
  capacitacionesPlan: "capacitaciones_propuestas",
  acuerdos: "datos_acuerdo_patrocinio",
  planificaciones: "datos_planificacion_capacitacion",
  informesFinales: "datos_generales_informe",
  participantesFinales: "participantes_informe",
  instrumentos: "datos_generales_instrumento",
  participantesInstrumentos: "participantes_instrumento_evaluacion",
  impactos: "datos_generales_informe_impacto",
  participantesImpactos: "participantes_informe_impacto"
});

class IndividualReportQuery {
  constructor(database) {
    if (!database) throw new Error("IndividualReportQuery requiere una base local.");
    this.database = database;
  }

  readSafe(collection) {
    try {
      const rows = this.database.readCollection(collection);
      return Array.isArray(rows) ? rows : [];
    } catch (_error) {
      return [];
    }
  }

  loadSnapshot() {
    return Object.fromEntries(
      Object.entries(COLLECTIONS).map(([key, collection]) => [key, this.readSafe(collection)])
    );
  }
}

function createIndividualReportQuery(database) {
  return new IndividualReportQuery(database);
}

module.exports = {
  COLLECTIONS,
  IndividualReportQuery,
  createIndividualReportQuery
};
