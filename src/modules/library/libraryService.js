const {
  listVideos,
  findVideoByLocalId,
  countVideos
} = require('../../database/repositories/videoRepository');

const {
  listAnalyses,
  findAnalysisByLocalId,
  listSections,
  listTechnicalEvents,
  countAnalyses
} = require('../../database/repositories/analysisRepository');

const { countTemplates } = require('../../database/repositories/templateRepository');
const { buildAnalysisFilters, buildVideoFilters } = require('./libraryFilters');

function getLibrarySummary() {
  return {
    ok: true,
    counts: {
      videos: countVideos(),
      analyses: countAnalyses(),
      templates: countTemplates()
    },
    generatedAt: new Date().toISOString()
  };
}

function listLibraryAnalyses(payload = {}) {
  const filters = buildAnalysisFilters(payload);
  const analyses = listAnalyses(filters);
  return { ok: true, total: analyses.length, filters, analyses };
}

function listLibraryVideos(payload = {}) {
  const filters = buildVideoFilters(payload);
  const videos = listVideos(filters);
  return { ok: true, total: videos.length, filters, videos };
}

function getAnalysisDetails(analysisLocalId) {
  if (!analysisLocalId) return { ok: false, message: 'No se recibió el ID del análisis.' };

  const analysis = findAnalysisByLocalId(analysisLocalId);
  if (!analysis) return { ok: false, message: 'No se encontró el análisis solicitado.' };

  const video = findVideoByLocalId(analysis.video_local_id);
  const sections = listSections(analysis.local_id);
  const technicalEvents = listTechnicalEvents(analysis.local_id);

  return {
    ok: true,
    analysis,
    video,
    sections,
    technicalEvents,
    totals: {
      sections: sections.length,
      technicalEvents: technicalEvents.length
    }
  };
}

function getRecentLibraryActivity(limit = 8) {
  const analyses = listAnalyses({});
  const videos = listVideos({});
  return {
    ok: true,
    recentAnalyses: analyses.slice(0, limit),
    recentVideos: videos.slice(0, limit)
  };
}

module.exports = {
  getLibrarySummary,
  listLibraryAnalyses,
  listLibraryVideos,
  getAnalysisDetails,
  getRecentLibraryActivity
};
