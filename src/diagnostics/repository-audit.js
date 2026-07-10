/* =========================================================
Nombre completo: repository-audit.js
Ruta o ubicación: /src/diagnostics/repository-audit.js
Función o funciones:
- Detectar archivos vacíos, temporales, duplicados o con referencias rotas.
- Verificar coherencia entre tipos documentales, procesadores, tablas y hojas.
- Validar canales IPC, recursos de interfaz, scripts npm y dependencias.
- Bloquear inconsistencias antes de ejecutar las pruebas funcionales.
========================================================= */

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", "coverage", "artifacts"]);
const TEXT_EXTENSIONS = new Set([".js", ".json", ".html", ".css", ".md", ".yml", ".yaml"]);
const TEMP_FILE_PATTERN = /(?:^|[._-])(debug|temp|tmp|copy|copia|old|obsolete|deprecated|backup-old)(?:[._-]|$)/i;
const LAYERED_PARSERS = [
  "src/document-types/planificacion-curso/parser-v2.js",
  "src/document-types/instrumento-evaluacion/parser-v2.js",
  "src/document-types/informe-impacto/parser-v2.js",
  "src/document-types/deteccion-necesidades/parser.adapter.js",
  "src/document-types/plan-general-capacitacion/parser.adapter.js"
];

function rel(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, "/");
}

function walk(directory = ROOT, output = []) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) return;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, output);
    else if (entry.isFile()) output.push(absolute);
  });
  return output;
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function stripCode(content) {
  return String(content || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1")
    .replace(/\s+/g, "")
    .trim();
}

function digest(content) {
  return crypto.createHash("sha256").update(String(content || ""), "utf8").digest("hex");
}

function duplicateValues(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
}

function resolveRelativeModule(sourceFile, request) {
  const base = path.resolve(path.dirname(sourceFile), request);
  const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, "index.js"), path.join(base, "index.json")];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function auditFiles(files, errors, warnings, metrics) {
  const hashGroups = new Map();
  const textFiles = files.filter((file) => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()));

  files.forEach((file) => {
    const name = rel(file);
    const stat = fs.statSync(file);
    if (stat.size === 0) errors.push(`Archivo vacío: ${name}.`);
    if (TEMP_FILE_PATTERN.test(path.basename(file))) errors.push(`Archivo temporal u obsoleto: ${name}.`);
  });

  textFiles.forEach((file) => {
    const name = rel(file);
    const content = read(file);
    const normalized = stripCode(content);
    if (normalized.length >= 20) {
      const key = digest(normalized);
      if (!hashGroups.has(key)) hashGroups.set(key, []);
      hashGroups.get(key).push(name);
    }

    if (path.extname(file) === ".js") {
      [...content.matchAll(/require\(\s*["'](\.[^"']+)["']\s*\)/g)].forEach((match) => {
        if (!resolveRelativeModule(file, match[1])) {
          errors.push(`Referencia local rota en ${name}: require("${match[1]}").`);
        }
      });
    }
  });

  hashGroups.forEach((paths) => {
    if (paths.length > 1) errors.push(`Código duplicado exacto: ${paths.join(" | ")}.`);
  });

  const layered = LAYERED_PARSERS.filter((file) => fs.existsSync(path.join(ROOT, file)));
  if (layered.length) {
    warnings.push(`Parsers por capas detectados: ${layered.join(", ")}. No tienen contenido duplicado exacto y se mantienen hasta validar PDF reales.`);
  }

  metrics.totalFiles = files.length;
  metrics.textFiles = textFiles.length;
  metrics.layeredParsers = layered.length;
}

function auditDocumentArchitecture(errors, metrics) {
  const documentRegistry = require(path.join(ROOT, "src/core/document-type.registry"));
  const processorRegistry = require(path.join(ROOT, "src/core/processor.registry"));
  const definitions = documentRegistry.listDocumentTypes();
  const processors = processorRegistry.listProcessors();
  const allTables = [];

  if (definitions.length !== 8) errors.push(`Se esperaban 8 tipos documentales y existen ${definitions.length}.`);
  if (processors.length !== 8) errors.push(`Se esperaban 8 procesadores y existen ${processors.length}.`);

  duplicateValues(definitions.map((item) => item.id)).forEach((item) => errors.push(`Tipo documental duplicado: ${item.value}.`));
  duplicateValues(processors.map((item) => item.id)).forEach((item) => errors.push(`Procesador duplicado: ${item.value}.`));
  duplicateValues(definitions.map((item) => item.reportPrefix)).forEach((item) => errors.push(`Prefijo de reporte duplicado: ${item.value}.`));

  definitions.forEach((definition) => {
    const prefix = `Tipo ${definition.id || "sin-id"}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id || "")) errors.push(`${prefix}: identificador inválido.`);
    if (!definition.label || !definition.shortLabel || !definition.description) errors.push(`${prefix}: faltan textos de interfaz.`);
    if (!definition.enabled || definition.status !== "active") errors.push(`${prefix}: estado de activación inconsistente.`);
    if (definition.processorId !== definition.id) errors.push(`${prefix}: processorId no coincide con id.`);
    if (!Array.isArray(definition.fileNameHints) || !definition.fileNameHints.length) errors.push(`${prefix}: no declara pistas de nombre.`);
    if (!Array.isArray(definition.tables) || !definition.tables.length) errors.push(`${prefix}: no declara tablas.`);

    if (definition.uniquePerPeriod) {
      if (definition.allowMultiple) errors.push(`${prefix}: un documento único no puede admitir varios PDF.`);
      if (definition.mode !== "unique-period") errors.push(`${prefix}: mode debe ser unique-period.`);
    } else {
      if (!definition.allowMultiple) errors.push(`${prefix}: un documento repetitivo debe admitir varios PDF.`);
      if (definition.mode !== "repetitive") errors.push(`${prefix}: mode debe ser repetitive.`);
    }

    const names = (definition.tables || []).map((table) => table.name);
    const sheets = (definition.tables || []).map((table) => table.sheet);
    duplicateValues(names).forEach((item) => errors.push(`${prefix}: tabla duplicada ${item.value}.`));
    duplicateValues(sheets).forEach((item) => errors.push(`${prefix}: hoja duplicada ${item.value}.`));

    (definition.tables || []).forEach((table) => {
      if (!/^[a-z0-9_]+$/.test(table.name || "")) errors.push(`${prefix}: colección inválida ${table.name || "vacía"}.`);
      if (!table.sheet || table.sheet.length > 31 || /[\\/?*\[\]:]/.test(table.sheet)) {
        errors.push(`${prefix}: hoja Excel inválida ${table.sheet || "vacía"}.`);
      }
      allTables.push({ name: table.name, owner: definition.id });
    });

    const processor = processorRegistry.assertProcessor(definition.processorId);
    if (processor.id !== definition.id) errors.push(`${prefix}: el procesador resuelto tiene otro id.`);
    if (!processor.definition || processor.definition.id !== definition.id) errors.push(`${prefix}: la definición del procesador no coincide.`);
    ["parseDocuments", "buildTables", "validateParseResult", "validateTableResult"].forEach((method) => {
      if (typeof processor[method] !== "function") errors.push(`${prefix}: falta ${method}().`);
    });
  });

  duplicateValues(allTables.map((item) => item.name)).forEach((duplicate) => {
    const owners = allTables.filter((item) => item.name === duplicate.value).map((item) => item.owner);
    errors.push(`Colección compartida entre flujos: ${duplicate.value} (${owners.join(", ")}).`);
  });

  const definitionIds = new Set(definitions.map((item) => item.id));
  const processorIds = new Set(processors.map((item) => item.id));
  [...definitionIds].filter((id) => !processorIds.has(id)).forEach((id) => errors.push(`Tipo sin procesador: ${id}.`));
  [...processorIds].filter((id) => !definitionIds.has(id)).forEach((id) => errors.push(`Procesador sin tipo: ${id}.`));

  metrics.documentTypes = definitions.length;
  metrics.processors = processors.length;
  metrics.collections = allTables.length;
}

function channelsFromMain(content) {
  return [...content.matchAll(/ipcMain\.handle\(\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

function channelsFromPreload(content) {
  const block = content.match(/const\s+ALLOWED_CHANNELS\s*=\s*new\s+Set\(\s*\[([\s\S]*?)\]\s*\)/);
  return block ? [...block[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]) : [];
}

function invokedChannels(content) {
  return [...content.matchAll(/invokeSafe\(\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

function auditIpc(errors, metrics) {
  const main = read(path.join(ROOT, "main.js"));
  const preload = read(path.join(ROOT, "preload.js"));
  const mainChannels = channelsFromMain(main);
  const allowedChannels = channelsFromPreload(preload);
  const invoked = invokedChannels(preload);

  duplicateValues(mainChannels).forEach((item) => errors.push(`Canal IPC duplicado en main.js: ${item.value}.`));
  duplicateValues(allowedChannels).forEach((item) => errors.push(`Canal duplicado en preload.js: ${item.value}.`));

  const mainSet = new Set(mainChannels);
  const allowedSet = new Set(allowedChannels);
  const invokedSet = new Set(invoked);

  [...allowedSet].filter((channel) => !mainSet.has(channel)).forEach((channel) => errors.push(`Canal permitido sin manejador: ${channel}.`));
  [...mainSet].filter((channel) => !allowedSet.has(channel)).forEach((channel) => errors.push(`Canal registrado y no permitido: ${channel}.`));
  [...invokedSet].filter((channel) => !allowedSet.has(channel)).forEach((channel) => errors.push(`Canal invocado fuera de la lista segura: ${channel}.`));
  [...allowedSet].filter((channel) => !invokedSet.has(channel)).forEach((channel) => errors.push(`Canal permitido pero sin uso: ${channel}.`));

  if (/planDocenteAPI|dialog:select-pdfs|files:validate-pdfs|reports:generate-plan-report/.test(`${main}\n${preload}`)) {
    errors.push("Permanece compatibilidad heredada que puede interferir con el flujo modular.");
  }

  metrics.ipcChannels = mainChannels.length;
}

function htmlIds(content) {
  return [...content.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

function scriptCreatesId(content, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\bid\\s*=\\s*["']${escaped}["']`).test(content);
}

function auditRenderer(errors, metrics) {
  const htmlPath = path.join(ROOT, "renderer/index.html");
  const html = read(htmlPath);
  const ids = htmlIds(html);
  const idSet = new Set(ids);
  const scripts = ["renderer/app.js", "renderer/database.js", "renderer/backup.js", "renderer/query.js"];

  duplicateValues(ids).forEach((item) => errors.push(`ID HTML duplicado: ${item.value}.`));

  const assets = [
    ...[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]),
    ...[...html.matchAll(/<link[^>]+href=["']([^"']+)["']/gi)].map((match) => match[1])
  ].filter((asset) => asset.startsWith("."));
  assets.forEach((asset) => {
    if (!fs.existsSync(path.resolve(path.dirname(htmlPath), asset))) errors.push(`Recurso de interfaz inexistente: ${asset}.`);
  });

  scripts.forEach((script) => {
    const scriptPath = path.join(ROOT, script);
    if (!fs.existsSync(scriptPath)) {
      errors.push(`Script de interfaz inexistente: ${script}.`);
      return;
    }
    const content = read(scriptPath);
    [...content.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)].forEach((match) => {
      const id = match[1];
      if (!idSet.has(id) && !scriptCreatesId(content, id)) {
        errors.push(`${script}: referencia un ID inexistente: ${id}.`);
      }
    });
  });

  const rendererContent = scripts.map((script) => read(path.join(ROOT, script))).join("\n");
  if (/planDocenteAPI/.test(rendererContent)) errors.push("La interfaz utiliza la API heredada planDocenteAPI.");
  if (!/documentAppAPI/.test(rendererContent)) errors.push("La interfaz no utiliza documentAppAPI.");

  metrics.htmlIds = ids.length;
  metrics.rendererScripts = scripts.length;
}

function dependencyUsed(content, dependency) {
  const escaped = dependency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:require\\(\\s*["']${escaped}["']\\s*\\)|import\\(\\s*["']${escaped}["']\\s*\\)|from\\s+["']${escaped}["'])`).test(content);
}

function auditPackage(errors, metrics) {
  const packageData = JSON.parse(read(path.join(ROOT, "package.json")));
  const scripts = packageData.scripts || {};

  Object.entries(scripts).forEach(([name, command]) => {
    [...String(command).matchAll(/(?:^|&&|\s)node\s+([^\s&]+)/g)].forEach((match) => {
      if (!fs.existsSync(path.resolve(ROOT, match[1]))) {
        errors.push(`Script npm ${name} apunta a un archivo inexistente: ${match[1]}.`);
      }
    });
  });

  if (!scripts.audit || !/repository-audit\.js/.test(scripts.audit)) errors.push("Falta el script npm run audit.");
  if (!scripts.test || !/npm run audit/.test(scripts.test)) errors.push("npm test no incluye la auditoría estructural.");

  const productionContent = [
    read(path.join(ROOT, "main.js")),
    read(path.join(ROOT, "preload.js")),
    ...walk(path.join(ROOT, "src")).filter((file) => path.extname(file) === ".js").map(read)
  ].join("\n");

  Object.keys(packageData.dependencies || {}).forEach((dependency) => {
    if (dependency === "electron") return;
    if (!dependencyUsed(productionContent, dependency)) errors.push(`Dependencia declarada pero no utilizada: ${dependency}.`);
  });

  metrics.npmScripts = Object.keys(scripts).length;
  metrics.dependencies = Object.keys(packageData.dependencies || {}).length;
}

function auditReadme(errors) {
  const readme = read(path.join(ROOT, "README.md"));
  const definitions = require(path.join(ROOT, "src/core/document-type.registry")).listDocumentTypes();
  definitions.forEach((definition) => {
    if (!readme.includes(definition.label)) errors.push(`README no menciona el nombre oficial: ${definition.label}.`);
    (definition.tables || []).forEach((table) => {
      if (!readme.includes(table.sheet)) errors.push(`README no documenta ${table.sheet} de ${definition.id}.`);
    });
  });
}

function runRepositoryAudit() {
  const errors = [];
  const warnings = [];
  const metrics = {};
  const files = walk();

  auditFiles(files, errors, warnings, metrics);
  auditDocumentArchitecture(errors, metrics);
  auditIpc(errors, metrics);
  auditRenderer(errors, metrics);
  auditPackage(errors, metrics);
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
  walk,
  stripCode,
  resolveRelativeModule,
  channelsFromMain,
  channelsFromPreload,
  invokedChannels,
  htmlIds,
  scriptCreatesId,
  dependencyUsed,
  runRepositoryAudit
};
