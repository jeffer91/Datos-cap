"use strict";

const { cloneDefaults } = require("./guias.defaults");
const { validateGuide } = require("./guia.validator");

const GUIDES_COLLECTION = "informe_cumplimiento_guias";
const GUIDE_VERSIONS_COLLECTION = "informe_cumplimiento_guias_versiones";

function nowIso() { return new Date().toISOString(); }

class GuidesRepository {
  constructor(database) {
    if (!database) throw new Error("GuidesRepository requiere la base local.");
    this.database = database;
  }

  read(collection) {
    try { return this.database.readCollection(collection); }
    catch (_error) { return []; }
  }

  list() {
    const saved = new Map(this.read(GUIDES_COLLECTION).map((guide) => [guide.id, guide]));
    return cloneDefaults()
      .map((guide) => ({ ...guide, ...(saved.get(guide.id) || {}), isDefault: !saved.has(guide.id) }))
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  }

  get(id) {
    return this.list().find((guide) => guide.id === String(id || "").trim()) || null;
  }

  save(input) {
    const validation = validateGuide(input);
    if (!validation.ok) throw new Error(validation.issues.join(" "));
    const current = this.get(validation.value.id);
    if (current) this.saveVersion(current, "BEFORE_UPDATE");
    const row = { ...validation.value, updatedAt: nowIso(), isDefault: false };
    this.database.upsertMany(GUIDES_COLLECTION, [row], "id");
    return row;
  }

  restore(id) {
    const cleanId = String(id || "").trim();
    const current = this.get(cleanId);
    if (current) this.saveVersion(current, "BEFORE_RESTORE");
    const rows = this.read(GUIDES_COLLECTION).filter((guide) => guide.id !== cleanId);
    this.database.writeCollection(GUIDES_COLLECTION, rows);
    const restored = this.get(cleanId);
    if (!restored) throw new Error("No existe una guía predeterminada con ese identificador.");
    return restored;
  }

  saveVersion(guide, reason) {
    const version = {
      id: `${guide.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      guideId: guide.id,
      reason,
      createdAt: nowIso(),
      snapshot: { ...guide }
    };
    this.database.upsertMany(GUIDE_VERSIONS_COLLECTION, [version], "id");
    return version;
  }

  versions(id) {
    return this.read(GUIDE_VERSIONS_COLLECTION)
      .filter((row) => row.guideId === String(id || "").trim())
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
}

function createGuidesRepository(database) { return new GuidesRepository(database); }

module.exports = {
  GUIDES_COLLECTION,
  GUIDE_VERSIONS_COLLECTION,
  GuidesRepository,
  createGuidesRepository
};
