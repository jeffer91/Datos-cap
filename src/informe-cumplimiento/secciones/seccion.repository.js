"use strict";

const SECTIONS_COLLECTION = "informe_cumplimiento_secciones";

function stableFiltersKey(filters = {}) {
  return ["period", "career", "modality", "query"]
    .map((key) => `${key}:${String(filters[key] || "").trim().toLowerCase()}`)
    .join("|");
}

class SectionRepository {
  constructor(database) {
    if (!database) throw new Error("SectionRepository requiere la base local.");
    this.database = database;
  }
  read() {
    try { return this.database.readCollection(SECTIONS_COLLECTION); }
    catch (_error) { return []; }
  }
  save(section, filters = {}) {
    const filtersKey = stableFiltersKey(filters);
    const row = {
      ...section,
      id: `${filtersKey}::${section.id}`,
      sectionId: section.id,
      filtersKey,
      filters: { ...filters },
      generatedAt: section.generatedAt || new Date().toISOString()
    };
    this.database.upsertMany(SECTIONS_COLLECTION, [row], "id");
    return row;
  }
  list(filters = {}) {
    const key = stableFiltersKey(filters);
    return this.read().filter((row) => row.filtersKey === key);
  }
  get(sectionId, filters = {}) {
    const key = stableFiltersKey(filters);
    return this.read().find((row) => row.filtersKey === key && row.sectionId === sectionId) || null;
  }
}

module.exports = { SECTIONS_COLLECTION, stableFiltersKey, SectionRepository };
