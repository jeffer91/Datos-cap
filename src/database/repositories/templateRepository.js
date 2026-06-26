const { getDatabase } = require('../sqliteConnection');

function nowIso() {
  return new Date().toISOString();
}

function createTemplate(templateData) {
  const db = getDatabase();
  const payload = {
    local_id: templateData.local_id,
    template_name: templateData.template_name,
    style_name: templateData.style_name,
    description: templateData.description || null,
    source_creator_names: Array.isArray(templateData.source_creator_names)
      ? JSON.stringify(templateData.source_creator_names)
      : templateData.source_creator_names || null,
    source_video_ids: Array.isArray(templateData.source_video_ids)
      ? JSON.stringify(templateData.source_video_ids)
      : templateData.source_video_ids || null,
    source_analysis_ids: Array.isArray(templateData.source_analysis_ids)
      ? JSON.stringify(templateData.source_analysis_ids)
      : templateData.source_analysis_ids || null,
    template_json_path: templateData.template_json_path || null,
    template_txt_path: templateData.template_txt_path || null,
    pdf_report_path: templateData.pdf_report_path || null,
    status: templateData.status || 'active',
    created_at: nowIso(),
    updated_at: nowIso()
  };

  db.prepare('INSERT INTO templates (local_id, template_name, style_name, description, source_creator_names, source_video_ids, source_analysis_ids, template_json_path, template_txt_path, pdf_report_path, status, created_at, updated_at) VALUES (@local_id, @template_name, @style_name, @description, @source_creator_names, @source_video_ids, @source_analysis_ids, @template_json_path, @template_txt_path, @pdf_report_path, @status, @created_at, @updated_at)').run(payload);

  return findTemplateByLocalId(payload.local_id);
}

function updateTemplate(localId, changes = {}) {
  const existing = findTemplateByLocalId(localId);
  if (!existing) throw new Error(`No existe la plantilla con local_id: ${localId}`);
  const payload = { ...existing, ...changes, local_id: localId, updated_at: nowIso() };
  getDatabase().prepare('UPDATE templates SET template_name=@template_name, style_name=@style_name, description=@description, source_creator_names=@source_creator_names, source_video_ids=@source_video_ids, source_analysis_ids=@source_analysis_ids, template_json_path=@template_json_path, template_txt_path=@template_txt_path, pdf_report_path=@pdf_report_path, status=@status, updated_at=@updated_at WHERE local_id=@local_id').run(payload);
  return findTemplateByLocalId(localId);
}

function findTemplateByLocalId(localId) {
  return getDatabase().prepare('SELECT * FROM templates WHERE local_id = ? LIMIT 1').get(localId);
}

function listTemplates(filters = {}) {
  const conditions = [];
  const params = {};

  if (filters.style_name) {
    conditions.push('style_name = @style_name');
    params.style_name = filters.style_name;
  }

  if (filters.status) {
    conditions.push('status = @status');
    params.status = filters.status;
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return getDatabase().prepare(`SELECT * FROM templates ${whereSql} ORDER BY created_at DESC`).all(params);
}

function deleteTemplate(localId) {
  const result = getDatabase().prepare('DELETE FROM templates WHERE local_id = ?').run(localId);
  return { ok: result.changes > 0, deleted: result.changes };
}

function countTemplates() {
  return getDatabase().prepare('SELECT COUNT(*) AS total FROM templates').get().total;
}

module.exports = {
  createTemplate,
  updateTemplate,
  findTemplateByLocalId,
  listTemplates,
  deleteTemplate,
  countTemplates
};
