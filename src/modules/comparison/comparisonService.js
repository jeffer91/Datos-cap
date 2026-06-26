const crypto = require('crypto');

const {
  findAnalysisByLocalId,
  listAnalyses
} = require('../../database/repositories/analysisRepository');

const { writeJson } = require('../../services/fileService');
const { getStoragePaths } = require('../../services/pathService');
const { buildComparisonMetrics, classifyComparisonIntensity } = require('./comparisonMetrics');
const { compareStyles, buildMasterStyleTemplate } = require('./styleComparator');

function createComparisonLocalId() {
  const random = crypto.randomBytes(4).toString('hex');
  return `comparison_${Date.now()}_${random}`;
}

function resolveAnalyses(analysisIds = []) {
  const uniqueIds = [...new Set(analysisIds.filter(Boolean))];
  return uniqueIds.map((id) => findAnalysisByLocalId(id)).filter(Boolean);
}

function listComparableAnalyses(limit = 50) {
  const analyses = listAnalyses({});

  return {
    ok: true,
    total: analyses.length,
    analyses: analyses.slice(0, limit)
  };
}

function compareAnalyses(payload = {}) {
  const analysisIds = payload.analysisIds || [];
  const analyses = resolveAnalyses(analysisIds);

  if (analyses.length < 2) {
    return {
      ok: false,
      message: 'Debes seleccionar al menos dos análisis para comparar.',
      selected: analyses.length
    };
  }

  const comparisonLocalId = createComparisonLocalId();
  const metrics = buildComparisonMetrics(analyses);
  const intensity = classifyComparisonIntensity(metrics);
  const styleComparison = compareStyles(analyses);
  const masterTemplate = buildMasterStyleTemplate({ analyses, metrics, styleComparison });

  const result = {
    ok: true,
    comparisonLocalId,
    generatedAt: new Date().toISOString(),
    selectedAnalysisIds: analyses.map((analysis) => analysis.local_id),
    totalAnalyses: analyses.length,
    metrics,
    intensity,
    styleComparison,
    masterTemplate,
    summary: {
      label: intensity.label,
      description: intensity.description,
      dominantStyle: masterTemplate.dominantStyle,
      dominantPattern: masterTemplate.dominantPattern,
      sourceAnalysisCount: analyses.length
    }
  };

  const storagePaths = getStoragePaths();
  const outputPath = `${storagePaths.exports}/${comparisonLocalId}.comparison.json`;
  writeJson(outputPath, result);

  return {
    ...result,
    outputPath
  };
}

function getComparisonDiagnostic() {
  return {
    ok: true,
    module: 'comparison',
    status: 'ready',
    features: [
      'comparar métricas numéricas',
      'agrupar por creador',
      'agrupar por estilo',
      'detectar patrones comunes',
      'crear plantilla maestra base'
    ]
  };
}

module.exports = {
  listComparableAnalyses,
  compareAnalyses,
  getComparisonDiagnostic
};
