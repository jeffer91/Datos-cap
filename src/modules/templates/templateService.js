const crypto = require('crypto');

const { getStoragePaths } = require('../../services/pathService');
const { ensureDir } = require('../../services/fileService');
const { findAnalysisByLocalId } = require('../../database/repositories/analysisRepository');
const { createTemplate, listTemplates, findTemplateByLocalId } = require('../../database/repositories/templateRepository');
const { buildMasterTemplate } = require('./templateBuilder');
const { exportTemplateFiles } = require('./templateExporter');

function createTemplateLocalId() {
  const random = crypto.randomBytes(4).toString('hex');
  return `template_${Date.now()}_${random}`;
}

function resolveAnalyses(analysisIds = []) {
  return [...new Set(analysisIds.filter(Boolean))]
    .map((id) => findAnalysisByLocalId(id))
    .filter(Boolean);
}

function createMasterTemplate(payload = {}) {
  const analyses = resolveAnalyses(payload.analysisIds || []);

  if (!analyses.length) {
    return {
      ok: false,
      message: 'Debes seleccionar al menos un análisis para crear una plantilla.'
    };
  }

  const localId = createTemplateLocalId();
  const storagePaths = getStoragePaths();
  ensureDir(storagePaths.templates);

  const template = buildMasterTemplate({
    analyses,
    comparison: payload.comparison || null,
    name: payload.name || null
  });

  const files = exportTemplateFiles({
    template,
    outputFolder: storagePaths.templates,
    localId
  });

  const created = createTemplate({
    local_id: localId,
    template_name: template.templateName,
    style_name: template.styleName,
    description: template.notes,
    source_creator_names: [...new Set(analyses.map((analysis) => analysis.creator_name || 'Sin creador'))],
    source_video_ids: analyses.map((analysis) => analysis.video_local_id),
    source_analysis_ids: analyses.map((analysis) => analysis.local_id),
    template_json_path: files.jsonPath,
    template_txt_path: files.txtPath,
    pdf_report_path: null,
    status: 'active'
  });

  return {
    ok: true,
    message: 'Plantilla maestra creada correctamente.',
    template: created,
    templateData: template,
    files
  };
}

function listMasterTemplates(filters = {}) {
  const templates = listTemplates(filters);
  return {
    ok: true,
    total: templates.length,
    templates
  };
}

function getMasterTemplate(localId) {
  const template = findTemplateByLocalId(localId);

  if (!template) {
    return {
      ok: false,
      message: 'No se encontró la plantilla solicitada.'
    };
  }

  return {
    ok: true,
    template
  };
}

function getTemplateDiagnostic() {
  return {
    ok: true,
    module: 'templates',
    status: 'ready',
    features: [
      'crear plantilla maestra desde análisis',
      'exportar plantilla JSON',
      'exportar plantilla TXT',
      'guardar registro en SQLite'
    ]
  };
}

module.exports = {
  createMasterTemplate,
  listMasterTemplates,
  getMasterTemplate,
  getTemplateDiagnostic
};
