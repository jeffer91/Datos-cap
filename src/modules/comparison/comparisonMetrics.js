function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getMetricValue(analysis, key) {
  if (!analysis) return null;
  return analysis[key] === undefined || analysis[key] === null ? null : Number(analysis[key]);
}

function average(values = []) {
  const cleanValues = values.filter((value) => Number.isFinite(Number(value)));
  if (!cleanValues.length) return null;
  const total = cleanValues.reduce((sum, value) => sum + Number(value), 0);
  return Number((total / cleanValues.length).toFixed(3));
}

function max(values = []) {
  const cleanValues = values.filter((value) => Number.isFinite(Number(value)));
  if (!cleanValues.length) return null;
  return Math.max(...cleanValues);
}

function min(values = []) {
  const cleanValues = values.filter((value) => Number.isFinite(Number(value)));
  if (!cleanValues.length) return null;
  return Math.min(...cleanValues);
}

function compareNumericMetric(analyses = [], key, label) {
  const values = analyses.map((analysis) => ({
    analysis_local_id: analysis.local_id,
    video_name: analysis.video_original_name || analysis.original_name || analysis.local_id,
    creator_name: analysis.creator_name || 'Sin creador',
    style_name: analysis.style_name || 'Sin estilo',
    value: getMetricValue(analysis, key)
  }));

  const numericValues = values.map((item) => item.value).filter((value) => Number.isFinite(Number(value)));

  const highest = values
    .filter((item) => Number.isFinite(Number(item.value)))
    .sort((a, b) => Number(b.value) - Number(a.value))[0] || null;

  const lowest = values
    .filter((item) => Number.isFinite(Number(item.value)))
    .sort((a, b) => Number(a.value) - Number(b.value))[0] || null;

  return {
    key,
    label,
    average: average(numericValues),
    max: max(numericValues),
    min: min(numericValues),
    highest,
    lowest,
    values
  };
}

function buildComparisonMetrics(analyses = []) {
  return {
    totalAnalyses: analyses.length,
    cutCount: compareNumericMetric(analyses, 'cut_count', 'Cantidad de cortes'),
    averageCutSeconds: compareNumericMetric(analyses, 'average_cut_seconds', 'Promedio entre cortes'),
    frameCount: compareNumericMetric(analyses, 'frame_count', 'Fotogramas extraídos'),
    silenceCount: compareNumericMetric(analyses, 'silence_count', 'Silencios detectados'),
    musicEventCount: compareNumericMetric(analyses, 'music_event_count', 'Eventos de música o sonido continuo'),
    hookCount: compareNumericMetric(analyses, 'hook_count', 'Ganchos detectados'),
    sectionCount: compareNumericMetric(analyses, 'section_count', 'Secciones detectadas')
  };
}

function classifyComparisonIntensity(metrics) {
  const cutAverage = toNumber(metrics?.cutCount?.average, 0);
  const silenceAverage = toNumber(metrics?.silenceCount?.average, 0);
  const sectionAverage = toNumber(metrics?.sectionCount?.average, 0);

  if (cutAverage >= 40 && sectionAverage >= 4) {
    return {
      level: 'high',
      label: 'Comparación de estilos dinámicos',
      description: 'Los videos comparados muestran muchos cortes o una estructura visual intensa.'
    };
  }

  if (silenceAverage >= 15) {
    return {
      level: 'paused',
      label: 'Comparación de estilos pausados',
      description: 'Los videos presentan muchas pausas o silencios. Puede ser un estilo reflexivo o conversacional.'
    };
  }

  return {
    level: 'balanced',
    label: 'Comparación equilibrada',
    description: 'Los videos mantienen un balance entre cortes, pausas y estructura.'
  };
}

module.exports = {
  buildComparisonMetrics,
  compareNumericMetric,
  classifyComparisonIntensity
};
