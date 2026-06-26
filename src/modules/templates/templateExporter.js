const path = require('path');
const { writeJson, writeText } = require('../../services/fileService');

function buildTemplateText(template) {
  const lines = [];

  lines.push('VIDEO_AUDITOR_MASTER_TEMPLATE');
  lines.push('');
  lines.push(`template_name: ${template.templateName}`);
  lines.push(`style_name: ${template.styleName}`);
  lines.push(`source_creator: ${template.sourceCreator}`);
  lines.push(`source_analysis_count: ${template.sourceAnalysisCount}`);
  lines.push(`created_at: ${template.createdAt}`);
  lines.push('');

  lines.push('[PACING_PROFILE]');
  lines.push(`level: ${template.pacingProfile.level}`);
  lines.push(`label: ${template.pacingProfile.label}`);
  lines.push(`recommendation: ${template.pacingProfile.recommendation}`);
  lines.push('');

  lines.push('[STRUCTURE]');
  Object.entries(template.structure || {}).forEach(([key, value]) => {
    lines.push('');
    lines.push(`## ${key}`);
    Object.entries(value || {}).forEach(([field, fieldValue]) => {
      if (Array.isArray(fieldValue)) {
        lines.push(`${field}: ${fieldValue.join(', ')}`);
      } else {
        lines.push(`${field}: ${fieldValue}`);
      }
    });
  });

  lines.push('');
  lines.push('[CHECKLIST]');
  (template.productionChecklist || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${item}`);
  });

  return lines.join('\n');
}

function exportTemplateFiles({ template, outputFolder, localId }) {
  const jsonPath = path.join(outputFolder, `${localId}.template.json`);
  const txtPath = path.join(outputFolder, `${localId}.template.txt`);

  writeJson(jsonPath, template);
  writeText(txtPath, buildTemplateText(template));

  return {
    ok: true,
    jsonPath,
    txtPath
  };
}

module.exports = {
  exportTemplateFiles,
  buildTemplateText
};
