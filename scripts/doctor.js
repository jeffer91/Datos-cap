const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const REQUIRED_FILES = [
  'package.json',
  'electron/main.js',
  'electron/preload.js',
  'electron/windowManager.js',
  'src/app/appController.js',
  'src/database/sqliteConnection.js',
  'src/database/migrations.js',
  'src/ui/index.html',
  'src/ui/scripts/renderer.js'
];

const REQUIRED_DIRECTORIES = [
  'src',
  'electron',
  'src/modules',
  'src/ui',
  'data',
  'data/database',
  'data/videos',
  'data/analysis_json',
  'data/templates',
  'data/logs',
  'data/exports'
];

function exists(relativePath) {
  return fs.existsSync(path.join(PROJECT_ROOT, relativePath));
}

function ensureDir(relativePath) {
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
    return { path: relativePath, created: true, exists: true };
  }
  return { path: relativePath, created: false, exists: true };
}

function checkFiles() {
  return REQUIRED_FILES.map((relativePath) => ({
    path: relativePath,
    exists: exists(relativePath)
  }));
}

function repairDirectories() {
  return REQUIRED_DIRECTORIES.map(ensureDir);
}

function printSection(title) {
  console.log('');
  console.log('============================================================');
  console.log(title);
  console.log('============================================================');
}

function runDoctor() {
  printSection('VIDEO AUDITOR APP - DOCTOR');
  console.log(`Project root: ${PROJECT_ROOT}`);

  const files = checkFiles();
  const directories = repairDirectories();

  printSection('FILES');
  files.forEach((file) => {
    console.log(`${file.exists ? 'OK ' : 'MISS'} ${file.path}`);
  });

  printSection('DIRECTORIES');
  directories.forEach((directory) => {
    console.log(`${directory.created ? 'CREATED' : 'OK     '} ${directory.path}`);
  });

  const missingFiles = files.filter((file) => !file.exists);

  printSection('SUMMARY');
  console.log(`Files checked: ${files.length}`);
  console.log(`Missing files: ${missingFiles.length}`);
  console.log(`Directories checked: ${directories.length}`);

  if (missingFiles.length) {
    console.log('');
    console.log('Missing important files:');
    missingFiles.forEach((file) => console.log(`- ${file.path}`));
    process.exitCode = 1;
    return;
  }

  console.log('Project structure looks stable.');
}

runDoctor();
