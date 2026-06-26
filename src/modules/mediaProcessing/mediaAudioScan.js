const { runFfmpeg } = require('../../services/ffmpegService');

function secondsToTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const totalSeconds = Math.floor(safeSeconds);
  const milliseconds = Math.round((safeSeconds - totalSeconds) * 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function parseAudioPauses(stderr = '') {
  const lines = String(stderr || '').split(/\r?\n/);
  const pauses = [];
  let currentStart = null;

  lines.forEach((line) => {
    const startMatch = line.match(/silence_start:\s*([0-9.]+)/);
    const endMatch = line.match(/silence_end:\s*([0-9.]+)/);
    const durationMatch = line.match(/silence_duration:\s*([0-9.]+)/);

    if (startMatch) currentStart = Number(startMatch[1]);

    if (endMatch) {
      const endSeconds = Number(endMatch[1]);
      const durationSeconds = durationMatch ? Number(durationMatch[1]) : null;
      const startSeconds = currentStart !== null ? currentStart : durationSeconds !== null ? endSeconds - durationSeconds : null;

      if (Number.isFinite(startSeconds) && Number.isFinite(endSeconds) && endSeconds >= startSeconds) {
        pauses.push({
          start_seconds: Number(startSeconds.toFixed(3)),
          end_seconds: Number(endSeconds.toFixed(3)),
          duration_seconds: Number((endSeconds - startSeconds).toFixed(3)),
          start_time: secondsToTime(startSeconds),
          end_time: secondsToTime(endSeconds)
        });
      }

      currentStart = null;
    }
  });

  return pauses;
}

async function scanAudioPauses({ audioPath, noiseThreshold = '-35dB', minSilenceDuration = 0.35 }) {
  if (!audioPath) throw new Error('No se recibió la ruta del audio para analizar pausas.');

  const result = await runFfmpeg([
    '-i',
    audioPath,
    '-af',
    `silencedetect=n=${noiseThreshold}:d=${minSilenceDuration}`,
    '-f',
    'null',
    '-'
  ]);

  const pauses = parseAudioPauses(result.stderr);
  const technicalEvents = pauses.map((pause, index) => ({
    event_type: pause.duration_seconds >= 1.2 ? 'long_pause_detected' : 'pause_detected',
    event_label: pause.duration_seconds >= 1.2 ? `Pausa larga ${index + 1}` : `Pausa ${index + 1}`,
    start_time: pause.start_time,
    end_time: pause.end_time,
    start_seconds: pause.start_seconds,
    end_seconds: pause.end_seconds,
    confidence: null,
    details_json: {
      durationSeconds: pause.duration_seconds,
      detector: 'ffmpeg_silencedetect'
    }
  }));

  return {
    ok: true,
    detector: 'ffmpeg_silencedetect',
    noiseThreshold,
    minSilenceDuration,
    silenceCount: pauses.length,
    silences: pauses,
    technicalEvents
  };
}

function buildSpeechSegments({ silences = [], durationSeconds = null }) {
  const duration = Number(durationSeconds) || 0;
  if (duration <= 0) return [];

  const sorted = [...silences].sort((a, b) => a.start_seconds - b.start_seconds);
  const segments = [];
  let cursor = 0;

  sorted.forEach((pause) => {
    const start = Number(pause.start_seconds) || 0;
    const end = Number(pause.end_seconds) || start;

    if (start > cursor) {
      const segmentDuration = start - cursor;
      if (segmentDuration >= 0.25) {
        segments.push({
          start_seconds: Number(cursor.toFixed(3)),
          end_seconds: Number(start.toFixed(3)),
          duration_seconds: Number(segmentDuration.toFixed(3))
        });
      }
    }

    cursor = Math.max(cursor, end);
  });

  if (cursor < duration) {
    const segmentDuration = duration - cursor;
    if (segmentDuration >= 0.25) {
      segments.push({
        start_seconds: Number(cursor.toFixed(3)),
        end_seconds: Number(duration.toFixed(3)),
        duration_seconds: Number(segmentDuration.toFixed(3))
      });
    }
  }

  return segments;
}

function analyzeAudioPacing({ silences = [], durationSeconds = null }) {
  const duration = Number(durationSeconds) || 0;
  const speechSegments = buildSpeechSegments({ silences, durationSeconds: duration });
  const minutes = duration > 0 ? duration / 60 : null;
  const pausesPerMinute = minutes ? Number((silences.length / minutes).toFixed(3)) : null;
  const totalSilenceSeconds = silences.reduce((sum, item) => sum + (Number(item.duration_seconds) || 0), 0);
  const totalSpeechSeconds = speechSegments.reduce((sum, item) => sum + (Number(item.duration_seconds) || 0), 0);
  const speechRatio = duration > 0 ? Number((totalSpeechSeconds / duration).toFixed(3)) : null;

  let level = 'unknown';
  let label = 'Ritmo de audio no determinado';

  if (speechRatio !== null && speechRatio >= 0.82 && (pausesPerMinute || 0) <= 8) {
    level = 'fast';
    label = 'Ritmo de audio rápido';
  } else if (speechRatio !== null && speechRatio >= 0.62) {
    level = 'balanced';
    label = 'Ritmo de audio equilibrado';
  } else if (speechRatio !== null) {
    level = 'paused';
    label = 'Ritmo de audio pausado';
  }

  return {
    ok: true,
    silenceCount: silences.length,
    speechSegmentCount: speechSegments.length,
    totalSilenceSeconds: Number(totalSilenceSeconds.toFixed(3)),
    totalSpeechSeconds: Number(totalSpeechSeconds.toFixed(3)),
    speechRatio,
    pausesPerMinute,
    speechSegments,
    rhythm: {
      level,
      label,
      description: label
    },
    technicalEvents: []
  };
}

module.exports = {
  scanAudioPauses,
  parseAudioPauses,
  analyzeAudioPacing,
  buildSpeechSegments,
  secondsToTime
};
