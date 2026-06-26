const { runFfmpeg } = require('../../services/ffmpegService');

function secondsToTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const totalSeconds = Math.floor(safeSeconds);
  const milliseconds = Math.round((safeSeconds - totalSeconds) * 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function removeCloseEvents(events = [], minDistanceSeconds = 0.7) {
  const sorted = [...events].sort((a, b) => a.start_seconds - b.start_seconds);
  const clean = [];

  sorted.forEach((event) => {
    const previous = clean[clean.length - 1];
    if (!previous || event.start_seconds - previous.start_seconds >= minDistanceSeconds) {
      clean.push(event);
    }
  });

  return clean;
}

function parseVisualScan(stderr = '') {
  const lines = String(stderr || '').split(/\r?\n/);
  const events = [];

  lines.forEach((line) => {
    if (!line.includes('pts_time:')) return;
    const match = line.match(/pts_time:([0-9.]+)/);
    if (!match) return;

    const seconds = Number(match[1]);
    if (!Number.isFinite(seconds)) return;

    events.push({
      start_seconds: Number(seconds.toFixed(3)),
      end_seconds: Number(seconds.toFixed(3)),
      start_time: secondsToTime(seconds),
      end_time: secondsToTime(seconds),
      event_type: 'visual_change',
      event_label: 'Cambio visual fuerte',
      confidence: null,
      details_json: {
        detector: 'ffmpeg_scene_select'
      }
    });
  });

  return removeCloseEvents(events);
}

async function scanVisualChanges({ videoPath, threshold = 0.3 }) {
  if (!videoPath) throw new Error('No se recibió la ruta del video para analizar cortes visuales.');

  const result = await runFfmpeg([
    '-i',
    videoPath,
    '-vf',
    `select=gt(scene\\,${threshold}),showinfo`,
    '-f',
    'null',
    '-'
  ]);

  const events = parseVisualScan(result.stderr);

  return {
    ok: true,
    threshold,
    eventCount: events.length,
    events
  };
}

function analyzeVisualFrequency(events = [], durationSeconds = null) {
  const sorted = [...events].sort((a, b) => a.start_seconds - b.start_seconds);
  const intervals = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const interval = Number((sorted[index].start_seconds - sorted[index - 1].start_seconds).toFixed(3));
    if (interval >= 0) intervals.push(interval);
  }

  const averageCutSeconds = intervals.length
    ? Number((intervals.reduce((sum, value) => sum + value, 0) / intervals.length).toFixed(3))
    : null;

  const minutes = durationSeconds ? Number(durationSeconds) / 60 : null;
  const cutsPerMinute = minutes && minutes > 0 ? Number((events.length / minutes).toFixed(3)) : null;

  let rhythmLevel = 'unknown';
  let rhythmLabel = 'Ritmo no determinado';

  if (averageCutSeconds !== null && averageCutSeconds <= 2) {
    rhythmLevel = 'very_high';
    rhythmLabel = 'Ritmo muy alto';
  } else if (averageCutSeconds !== null && averageCutSeconds <= 4) {
    rhythmLevel = 'high';
    rhythmLabel = 'Ritmo alto';
  } else if (averageCutSeconds !== null && averageCutSeconds <= 8) {
    rhythmLevel = 'medium';
    rhythmLabel = 'Ritmo medio';
  } else if (averageCutSeconds !== null) {
    rhythmLevel = 'low';
    rhythmLabel = 'Ritmo bajo';
  }

  return {
    cutCount: events.length,
    intervals,
    averageCutSeconds,
    cutsPerMinute,
    rhythmLevel,
    rhythmLabel
  };
}

module.exports = {
  scanVisualChanges,
  parseVisualScan,
  analyzeVisualFrequency,
  secondsToTime
};
