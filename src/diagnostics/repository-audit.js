/* =========================================================
Nombre completo: repository-audit.js
Ruta o ubicación: /src/diagnostics/repository-audit.js
Función o funciones:
- Auditar archivos vacíos, temporales, duplicados y referencias rotas.
- Verificar coherencia entre definiciones, procesadores, tablas y exportaciones.
- Comprobar simetría de canales IPC, API preload e interfaz.
- Detectar interferencias entre flujos antes de permitir integración.
========================================================= */

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", "build", "coverage", "artifacts"]);
const TEXT_EXTENSIONS = new Set([".js", ".json", ".html", ".css", ".md", ".yml", ".yaml"]);
const SUSPICIOUS_FILE_PATTERN = /(?:^|[._-])(debug|temp|tmp|copy|copia|old|obsolete|deprecated|prueba-final|backup-old)(?:[._-]|$)/i;
const ALLOWED_LAYERED_PARSERS = new Set([
  "src/document-types/planificacion-curso/parser-v2.js",
  "src/document-types/instrumento-evaluacion/parser-v2.js",
  "src/document-types/informe-impacto/parser-v2.js",
  "src/document-types/deteccion-necesidades/parser.adapter.js",
  "src/document-types/plan-general-capacitacion/parser.adapter.js"
]);

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, "/");
}

function walkFiles(directory = ROOT, output = []) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) return;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(absolute, output);
    else if (entry.isFile()) output.push(absolute);
  });
  return output;
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function normalizeCode(content) {
  return String(content || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1")
    .replace(/\s+/g, "")
    .trim();
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function resolveLocalModule(sourceFile, request) {
  const base = path.resolve(path.dirname(sourceFile), request);
  const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, "index.js"), path.join(base, "index.json")];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function extractRelativeRequires(content) {
  return [...String(content || "").matchAll(/require\(\s*["'](\.[^"']+)["']\s*\)/g)].map((match) => match[1]);
}

function extractIpcMainChannels(content) {
  return [...String(content || "").matchAll(/ipcMain\.handle\(\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

function extractAllowedChannels(content) {
  const block = String(content || "").match(/const\s+ALLOWED_CHANNELS\s*=\s*new\s+Set\(\s*\[([\s\S]*?)\]\s*\)/);
  if (!block) return [];
  return [...block[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function extractInvokedChannels(content) {
  return [...String(content || "").matchAll(/invokeSafe\(\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

function extractHtmlIds(content) {
  return [...String(content || "").matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

function extractGetElementIds(content) {
  return [...String(content || "").matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1]);
}

function extractHtmlAssets(content) {
  const scripts = [...String(content || "").matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);
  const styles = [...String(content || "").matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  return [...scripts, ...styles].filter((asset) => asset.startsWith("."));
}

function duplicates(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
}

function auditFiles(files, errors, warnings, metrics) {
  const textFiles = files.filter((file) => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const normalizedHashes = new Map();

  files.forEach((file) => {
    const name = relative(file);
    const size = fs.statSync(file).size;
    if (size === 0) errors.push(`Archivo vacío: ${name}.`);
    if (SUSPICIOUS_FILE_PATTERN.test(path.basename(file))) errors.push(`Archivo temporal u obsoleto: ${name}.`);
  });

  textFiles.forEach((file) => {
    const name = relative(file);
    const content = readText(file);
    const normalized = normalizeCode(content);
    if (normalized.length < 20) return;
    const digest = hash(normalized);
    if (!normalizedHashes.has(digest)) normalizedHashes.set(digest, []);
    normalizedHashes.get(digest).push(name);

    if (path.extname(file) === ".js") {
      extractRelativeRequires(content).forEach((request) => {
        if (!resolveLocalModule(file, request)) errors.push(`Referencia local rota en ${name}: require("${request}").`);
      });
    }
  });

  normalizedHashes.forEach((paths) => {
    if (paths.length > 1) errors.push(`Código duplicado exacto: ${paths.join(" | ")}.`);
  });

  const layered = files.map(relative).filter((name) => ALLOWED_LAYERED_PARSERS.has(name));
  if (layered.length) {
    warnings.push(`Arquitectura por capas detectada en parsers: ${layered.join(", ")}. No son copias exactas; deben mantenerse documentados hasta validar PDF reales.`);
  }

  metrics.totalFiles = files.length;
  metrics.textFiles = textFiles.length;
  metrics.layeredParsers = layered.length;
}

function auditDefinitions(errors, warnings, metrics) {
  const documentRegistry = require(path.join(ROOT, "src/core/document-type.registry"));
  const processorRegistry = require(path.join(ROOT, "src/core/processor.registry"));
  const definitions = documentRegistry.listDocumentTypes();
  const processors = processorRegistry.listProcessors();

  if (definitions.length !== 8) errors.push(`Se esperaban 8 tipos documentales y existen ${definitions.length}.`);
  if (processors.length !== 8) errors.push(`Se esperaban 8 procesadores y existen ${processors.length}.`);

  duplicates(definitions.map((item) => item.id)).forEach((duplicate) => {
    errors.push(`Identificador documental duplicado: ${duplicate.value}.`);
  });
  duplicates(processors.map((item) => item.id)).forEach((duplicate) => {
    errors.push(`Procesador duplicado: ${duplicate.value}.`);
  });
  duplicates(definitions.map((item) => item.reportPrefix)).forEach((duplicate) => {
    errors.push(`Prefijo de reporte duplicado: ${duplicate.value}.`);
  });

  const globalTables = [];
  definitions.forEach((definition) => {
    const prefix = `Tipo ${definition.id}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id || "")) errors.push(`${prefix}: id inválido.`);
    if (!definition.label || !definition.shortLabel || !definition.description) errors.push(`${prefix}: faltan textos de interfaz.`);
    if (!definition.enabled || definition.status !== "active") errors.push(`${prefix}: el módulo no está activo de forma coherente.`);
    if (definition.processorId !== definition.id) errors.push(`${prefix}: processorId no coincide con id.`);
    if (!Array.isArray(definition.fileNameHints) || !definition.fileNameHints.length) warnings.push(`${prefix}: no tiene pistas de nombre de archivo.`);
    if (!Array.isArray(definition.tables) || !definition.tables.length) errors.push(`${prefix}: no declara tablas.`);

    if (definition.uniquePerPeriod) {
      if (definition.allowMultiple) errors.push(`${prefix}: un documento único por periodo no puede admitir carga múltiple.`);
      if (definition.mode !== "unique-period") errors.push(`${prefix}: mode debe ser unique-period.`);
    } else {
      if (!definition.allowMultiple) errors.push(`${prefix}: un documento repetitivo debe admitir varios PDF.`);
      if (definition.mode !== "repetitive") errors.push(`${prefix}: mode debe ser repetitive.`);
    }

    const tableNames = (definition.tables || []).map((table) => table.name);
    const sheetNames = (definition.tables || []).map((table) => table.sheet);
    duplicates(tableNames).forEach((duplicate) => errors.push(`${prefix}: tabla duplicada ${duplicate.value}.`));
    duplicates(sheetNames).forEach((duplicate) => errors.push(`${prefix}: hoja duplicada ${duplicate.value}.`));

    (definition.tables || []).forEach((table) => {
      if (!/^[a-z0-9_]+$/.test(table.name || "")) errors.push(`${prefix}: nombre de colección inválido ${table.name}.`);
      if (!table.sheet || table.sheet.length > 31 || /[\\/?*\[\]:]/.test(table.sheet)) {
        errors.push(`${prefix}: nombre de hoja Excel inválido ${table.sheet || "vacío"}.`);
      }
      globalTables.push({ name: table.name, owner: definition.id });
    });

    const processor = processorRegistry.assertProcessor(definition.processorId);
    if (processor.id !== definition.id) errors.push(`${prefix}: el procesador resuelto tiene otro id.`);
    if (!processor.definition || processor.definition.id !== definition.id) errors.push(`${prefix}: el procesador expone otra definición.`);
    ["parseDocuments", "buildTables", "validateParseResult", "validateTableResult"].forEach((method) => {
      if (typeof processor[method] !== "function") errors.push(`${prefix}: falta ${method}().`);
    });
  });

  duplicates(globalTables.map((table) => table.name)).forEach((duplicate) => {
    const owners = globalTables.filter((table) => table.name === duplicate.value).map((table) => table.owner);
    errors.push(`Colección compartida por varios flujos: ${duplicate.value} (${owners.join(", ")}).`);
  });

  const definitionIds = new Set(definitions.map((item) => item.id));
  const processorIds = new Set(processors.map((item) => item.id));
  [...definitionIds].filter((id) => !processorIds.has(id)).forEach((id) => errors.push(`Tipo sin procesador: ${id}.`));
  [...processorIds].filter((id) => !definitionIds.has(id)).forEach((id) => errors.push(`Procesador sin tipo documental: ${id}.`));

  metrics.documentTypes = definitions.length;
  metrics.processors = processors.length;
  metrics.collections = globalTables.length;
}

function auditElectronFlow(errors, metrics) {
  const mainPath = path.join(ROOT, "main.js");
  const preloadPath = path.join(ROOT, "preload.js");
  const mainContent = readText(mainPath);
  const preloadContent = readText(preloadPath);
  const mainChannels = extractIpcMainChannels(mainContent);
  const allowedChannels = extractAllowedChannels(preloadContent);
  const invokedChannels = extractInvokedChannels(preloadContent);

  duplicates(mainChannels).forEach((duplicate) => errors.push(`Canal IPC registrado varias veces en main.js: ${duplicate.value}.`));
  duplicates(allowedChannels).forEach((duplicate) => errors.push(`Canal repetido en ALLOWED_CHANNELS: ${duplicate.value}.`));

  const mainSet = new Set(mainChannels);
  const allowedSet = new Set(allowedChannels);
  const invokedSet = new Set(invokedChannels);

  [...allowedSet].filter((channel) => !mainSet.has(channel)).forEach((channel) => {
    errors.push(`Preload permite un canal sin manejador: ${channel}.`);
  });
  [...mainSet].filter((channel) => !allowedSet.has(channel)).forEach((channel) => {
    errors.push(`Main registra un canal no permitido por preload: ${channel}.`);
  });
  [...invokedSet].filter((channel) => !allowedSet.has(channel)).forEach((channel) => {
    errors.push(`La API invoca un canal fuera de la lista segura: ${channel}.`);
  });
  [...allowedSet].filter((channel) => !invokedSet.has(channel)).forEach((channel) => {
    errors.push(`Canal permitido pero no utilizado por la API: ${channel}.`);
  });

  if (/planDocenteAPI|dialog:select-pdfs|files:validate-pdfs|reports:generate-plan-report/.test(`${mainContent}\n${preloadContent}`)) {
    errors.push("Permanece compatibilidad heredada de Plan Docente que puede interferir con el flujo modular.");
  }

  metrics.ipcChannels = mainChannels.length;
}

function auditRenderer(errors, metrics) {
  const htmlPath = path.join(ROOT, "renderer/index.html");
  const html = readText(htmlPath);
  const ids = extractHtmlIds(html);
  const idSet = new Set(ids);
  const rendererScripts = ["renderer/app.js", "renderer/database.js", "renderer/backup.js", "renderer/query.js"];

  duplicates(ids).forEach((duplicate) => errors.push(`ID HTML duplicado: ${duplicate.value}.`));
  extractHtmlAssets(html).forEach((asset) => {
    const resolved = path.resolve(path.dirname(htmlPath), asset);
    if (!fs.existsSync(resolved)) errors.push(`Recurso de interfaz inexistente: ${asset}.`);
  });

  rendererScripts.forEach((script) => {
    const scriptPath = path.join(ROOT, script);
    if (!fs.existsSync(scriptPath)) {
      errors.push(`Script principal de interfaz inexistente: ${script}.`);
      return;
    }
    extractGetElementIds(readText(scriptPath)).forEach((id) => {
      if (!idSet.has(id)) errors.push(`${script}: referencia un ID inexistente: ${id}.`);
    });
  });

  const rendererContent = rendererScripts.filter((script) => fs.existsSync(path.join(ROOT, script)))
    .map((script) => readText(path.join(ROOT, script))).join("\n");
  if (/planDocenteAPI/.test(rendererContent)) errors.push("La interfaz todavía utiliza la API heredada planDocenteAPI.");
  if (!/documentAppAPI/.test(rendererContent)) errors.push("La interfaz no utiliza la API modular documentAppAPI.");

  metrics.htmlIds = ids.length;
  metrics.rendererScripts = rendererScripts.length;
}

function auditPackage(errors, warnings, metrics) {
  const packagePath = path.join(ROOT, "package.json");
  const packageData = JSON.parse(readText(packagePath));
  const scripts = packageData.scripts || {};

  Object.entries(scripts).forEach(([name, command]) => {
    const matches = [...String(command).matchAll(/(?:^|&&|\s)node\s+([^\s&]+)/g)];
    matches.forEach((match) => {
      const target = path.resolve(ROOT, match[1]);
      if (!fs.existsSync(target)) errors.push(`Script npm ${name} apunta a un archivo inexistente: ${match[1]}.`);
    });
  });

  if (!scripts.audit || !/repository-audit\.js/.test(scripts.audit)) errors.push("package.json no expone el script npm run audit.");
  if (!scripts.test || !/npm run audit/.test(scripts.test)) errors.push("La suite npm test no incluye la auditoría estructural.");

  const productionContent = walkFiles(path.join(ROOT, "src"))
    .filter((file) => path.extname(file) === ".js")
    .map(readText)
    .join("\n") + readText(path.join(ROOT, "main.js"));
  Object.keys(packageData.dependencies || {}).forEach((dependency) => {
    if (dependency === "electron") return;
    const escaped = dependency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`require\\(\\s*["']${escaped}["']\\s*\\)`).test(productionContent)) {
      warnings.push(`Dependencia sin require directo detectado: ${dependency}. Revisar si es transitiva o innecesaria.`);
    }
  });

  metrics.npmScripts = Object.keys(scripts).length;
  metrics.dependencies = Object.keys(packageData.dependencies || {}).length;
}

function auditReadme(errors) {
  const readme = readText(path.join(ROOT, "README.md"));
  const definitions = require(path.join(ROOT, "src/core/document-type.registry")).listDocumentTypes();
  definitions.forEach((definition) => {
    if (!readme.includes(definition.label)) errors.push(`README no menciona el nombre oficial: ${definition.label}.`);
    (definition.tables || []).forEach((table) => {
      if (!readme.includes(table.sheet)) errors.push(`README no documenta la hoja ${table.sheet} de ${definition.id}.`);
    });
  });
}

function runRepositoryAudit() {
  const errors = [];
  const warnings = [];
  const metrics = {};
  const files = walkFiles();

  auditFiles(files, errors, warnings, metrics);
  auditDefinitions(errors, warnings, metrics);
  auditElectronFlow(errors, metrics);
  auditRenderer(errors, metrics);
  auditPackage(errors, warnings, metrics);
  auditReadme(errors);

  return {
    ok: errors.length === 0,
    auditedAt: new Date().toISOString(),
    root: ROOT,
    metrics,
    errors,
    warnings
  };
}

if (require.main === module) {
  const result = runRepositoryAudit();
  console.log(result.ok ? "REPOSITORY_AUDIT_OK" : "REPOSITORY_AUDIT_ERROR");
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

module.exports = {
  ROOT,
  walkFiles,
  normalizeCode,
  resolveLocalModule,
  extractRelativeRequires,
  extractIpcMainChannels,
  extractAllowedChannels,
  extractInvokedChannels,
  extractHtmlIds,
  extractGetElementIds,
  extractHtmlAssets,
  runRepositoryAudit
};
