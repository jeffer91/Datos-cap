const { spawn } = require('child_process');

const ffmpegPath = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

function getFfmpegPath() {
  if (!ffmpegPath) {
    throw new Error('No se encontró ffmpeg-static.');
  }
  return ffmpegPath;
}

function getFfprobePath() {
  if (!ffprobeStatic || !ffprobeStatic.path) {
    throw new Error('No se encontró ffprobe-static.');
  }
  return ffprobeStatic.path;
}

function runProcess(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`El proceso terminó con código ${code}.\n\nSTDERR:\n${stderr}`));
        return;
      }
      resolve({ ok: true, code, stdout, stderr });
    });
  });
}

async function runFfprobeJson(filePath) {
  const result = await runProcess(getFfprobePath(), [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath
  ]);

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`No se pudo leer la respuesta JSON de FFprobe: ${error.message}`);
  }
}

async function runFfmpeg(args = []) {
  return runProcess(getFfmpegPath(), args);
}

function getFfmpegDiagnostic() {
  return {
    ok: true,
    ffmpegPath: getFfmpegPath(),
    ffprobePath: getFfprobePath()
  };
}

module.exports = {
  getFfmpegPath,
  getFfprobePath,
  runFfprobeJson,
  runFfmpeg,
  getFfmpegDiagnostic
};
