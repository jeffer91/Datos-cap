function groupByValue(items = [], key) {
  const groups = {};

  items.forEach((item) => {
    const value = item[key] || 'Sin definir';
    if (!groups[value]) groups[value] = [];
    groups[value].push(item);
  });

  return groups;
}

function summarizeGroups(groups = {}) {
  return Object.entries(groups).map(([name, items]) => ({
    name,
    count: items.length,
    analysisIds: items.map((item) => item.local_id),
    creators: [...new Set(items.map((item) => item.creator_name || 'Sin creador'))]
  }));
}

function detectCommonPatterns(analyses = []) {
  const patterns = [];

  const highCutAnalyses = analyses.filter((analysis) => Number(analysis.cut_count || 0) >= 30);
  const longPauseAnalyses = analyses.filter((analysis) => Number(analysis.silence_count || 0) >= 10);
  const structuredAnalyses = analyses.filter((analysis) => Number(analysis.section_count || 0) >= 4);

  if (highCutAnalyses.length >= 2) {
    patterns.push({
      pattern: 'alto_ritmo_visual',
      label: 'Ritmo visual alto',
      description: 'Dos o más análisis tienen una cantidad alta de cortes o cambios visuales.',
      analysisIds: highCutAnalyses.map((item) => item.local_id)
    });
  }

  if (longPauseAnalyses.length >= 2) {
    patterns.push({
      pattern: 'pausas_frecuentes',
      label: 'Pausas frecuentes',
      description: 'Dos o más análisis muestran una cantidad alta de silencios o pausas.',
      analysisIds: longPauseAnalyses.map((item) => item.local_id)
    });
  }

  if (structuredAnalyses.length >= 2) {
    patterns.push({
      pattern: 'estructura_clara',
      label: 'Estructura clara',
      description: 'Dos o más análisis tienen varias secciones detectadas.',
      analysisIds: structuredAnalyses.map((item) => item.local_id)
    });
  }

  if (!patterns.length) {
    patterns.push({
      pattern: 'sin_patron_dominante',
      label: 'Sin patrón dominante todavía',
      description: 'No hay suficientes similitudes fuertes entre los análisis seleccionados.',
      analysisIds: analyses.map((item) => item.local_id)
    });
  }

  return patterns;
}

function compareStyles(analyses = []) {
  const byCreator = summarizeGroups(groupByValue(analyses, 'creator_name'));
  const byStyle = summarizeGroups(groupByValue(analyses, 'style_name'));
  const byStatus = summarizeGroups(groupByValue(analyses, 'status'));
  const patterns = detectCommonPatterns(analyses);

  return {
    ok: true,
    byCreator,
    byStyle,
    byStatus,
    patterns
  };
}

function buildMasterStyleTemplate({ analyses = [], metrics = null, styleComparison = null }) {
  const dominantStyle = styleComparison?.byStyle?.sort((a, b) => b.count - a.count)[0]?.name || 'Estilo mixto';
  const dominantPattern = styleComparison?.patterns?.[0]?.label || 'Patrón mixto';

  return {
    templateName: `Plantilla base - ${dominantStyle}`,
    dominantStyle,
    dominantPattern,
    sourceAnalysisCount: analyses.length,
    structure: {
      opening: 'Iniciar con gancho claro en los primeros segundos.',
      visualRhythm: metrics?.cutCount?.average >= 30 ? 'Usar cortes frecuentes y cambios visuales constantes.' : 'Mantener cambios visuales moderados y bien ubicados.',
      audioRhythm: metrics?.silenceCount?.average >= 10 ? 'Usar pausas intencionales y limpiar silencios innecesarios.' : 'Mantener audio fluido con pausas breves.',
      development: 'Dividir el contenido en secciones claras con renovación de atención.',
      closing: 'Cerrar con conclusión directa, remate o llamada a la acción.'
    },
    sourceAnalysisIds: analyses.map((analysis) => analysis.local_id)
  };
}

module.exports = {
  compareStyles,
  buildMasterStyleTemplate,
  detectCommonPatterns
};
