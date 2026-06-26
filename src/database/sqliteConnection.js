const path = require('path');
const Database = require('better-sqlite3');

const { getStoragePaths } = require('../services/pathService');
const { ensureDir } = require('../services/fileService');

let dbInstance = null;

function getDatabasePath() {
  const storagePaths = getStoragePaths();
  return path.join(storagePaths.database, 'app.sqlite');
}

function openDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const databasePath = getDatabasePath();

  ensureDir(path.dirname(databasePath));

  dbInstance = new Database(databasePath);

  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  return dbInstance;
}

function getDatabase() {
  return openDatabase();
}

function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function runStatement(sql, params = {}) {
  const db = getDatabase();
  return db.prepare(sql).run(params);
}

function getOne(sql, params = {}) {
  const db = getDatabase();
  return db.prepare(sql).get(params);
}

function getAll(sql, params = {}) {
  const db = getDatabase();
  return db.prepare(sql).all(params);
}

function transaction(callback) {
  const db = getDatabase();
  const executeTransaction = db.transaction(callback);
  return executeTransaction();
}

function getDatabaseInfo() {
  const databasePath = getDatabasePath();
  const db = getDatabase();

  const tables = db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name ASC
      `
    )
    .all()
    .map((row) => row.name);

  return {
    ok: true,
    databasePath,
    tables,
    tableCount: tables.length
  };
}

module.exports = {
  getDatabasePath,
  openDatabase,
  getDatabase,
  closeDatabase,
  runStatement,
  getOne,
  getAll,
  transaction,
  getDatabaseInfo
};
