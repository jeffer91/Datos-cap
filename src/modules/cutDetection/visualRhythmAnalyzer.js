function classifyRhythm({ averageCutSeconds, cutsPerMinute }) {
  if (!averageCutSeconds && !cutsPerMinute) {
    return { level: 'unknown', label: 'Ritmo no determinado', description: 'No hay suficientes cortes para clasificar el ritmo.' };
  }
  if (averageCutSeconds !== null && averageCutSeconds <= 2) {
    return { level: 'very_high', label: 'Ritmo muy alto', description: 'Cambios visuales muy frecuentes.' };
  }
  if (averageCutSeconds !== null && averageCutSeconds <= 4) {
    return { level: 'high', label: 'Ritmo alto', description: 'Cortes frecuentes y ritmo dinámico.' };
  }
  if (averageCutSeconds !== null && averageCutSeconds <= 8) {
    return { level: 'medium', label: 'Ritmo medio', description: 'Cambios visuales moderados.' };
  }
  return { level: 'low', label: 'Ritmo bajo', description: 'Pocos cambios visuales.' };
}

function splitIntoMinuteBuckets(events = [], durationSeconds = null) {
  const safeDuration = Number(durationSeconds) || 0;
  const totalMinutes = Math.max(1, Math.ceil(safeDuration / 60));
  const buckets = [];
  for (let index = 0; index < totalMinutes; index += 1) {
    const start = index * 60;
    const end = start + 60;
    const bucketEvents = events.filter((event) => event.start_seconds >= start && event.start_seconds < end);
    buckets.push({ minute: index + 1, start_seconds: start, end_seconds: end, cut_count: bucketEvents.length });
  }
  return buckets;
}

function detectHighActivityMoments(buckets = []) {
  if (!buckets.length) return [];
  const counts = buckets.map((bucket) => bucket.cut_count);
  const avg = counts.reduce((sum, value) => sum + value, 0) / Math.max(1, counts.length);
  return buckets.filter((bucket) => bucket.cut_count > avg && bucket.cut_count >= 3).map((bucket) => ({ ...bucket, label: 'Minuto con alta actividad visual' }));
}

function analyzeVisualRhythm({ events = [], durationSeconds = null, frequency = {} }) {
  const rhythm = classifyRhythm({ averageCutSeconds: frequency.averageCutSeconds, cutsPerMinute: frequency.cutsPerMinute });
  const minuteBuckets = splitIntoMinuteBuckets(events, durationSeconds);
  const highActivityMoments = detectHighActivityMoments(minuteBuckets);
  return { rhythm, minuteBuckets, highActivityMoments };
}

module.exports = { classifyRhythm, splitIntoMinuteBuckets, detectHighActivityMoments, analyzeVisualRhythm };
