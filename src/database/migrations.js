const fs = require('fs');
const path = require('path');

const { getDatabase } = require('./sqliteConnection');
const { logInfo, logError } = require('../services/loggerService');

const CURRENT_SCHEMA_VERSION = '001_initial_video_auditor_schema';

function getSchemaPath() {
  return path.join(__dirname, 'schema.sql');
}

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL UNIQUE,
      description TEXT,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function hasMigration(db, version) {
  const result = db
    .prepare(
      `
      SELECT version
      FROM schema_migrations
      WHERE version = ?
      LIMIT 1
      `
    )
    .get(version);

  return Boolean(result);
}

function registerMigration(db, version, description) {
  db.prepare(
    `
    INSERT OR IGNORE INTO schema_migrations (
      version,
      description
    )
    VALUES (?, ?)
    `
  ).run(version, description);
}

function runMigrations() {
  const db = getDatabase();

  try {
    ensureMigrationsTable(db);

    if (!hasMigration(db, CURRENT_SCHEMA_VERSION)) {
      const schemaPath = getSchemaPath();
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      db.exec(schemaSql);

      registerMigration(
        db,
        CURRENT_SCHEMA_VERSION,
        'Esquema inicial para videos, análisis, eventos técnicos, reportes, comparaciones y plantillas.'
      );

      logInfo('Migración SQLite aplicada correctamente', {
        version: CURRENT_SCHEMA_VERSION
      });
    } else {
      logInfo('Migración SQLite ya estaba aplicada', {
        version: CURRENT_SCHEMA_VERSION
      });
    }

    return {
      ok: true,
      version: CURRENT_SCHEMA_VERSION,
      message: 'Base de datos SQLite lista.'
    };
  } catch (error) {
    logError('Error al ejecutar migraciones SQLite', error);

    return {
      ok: false,
      version: CURRENT_SCHEMA_VERSION,
      message: 'No se pudieron ejecutar las migraciones SQLite.',
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

function getMigrationStatus() {
  const db = getDatabase();

  ensureMigrationsTable(db);

  const migrations = db
    .prepare(
      `
      SELECT id, version, description, applied_at
      FROM schema_migrations
      ORDER BY id ASC
      `
    )
    .all();

  return {
    ok: true,
    currentVersion: CURRENT_SCHEMA_VERSION,
    migrations
  };
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  runMigrations,
  getMigrationStatus
};
