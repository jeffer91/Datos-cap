"use strict";

function cleanExtractionText(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0000\ufffe\uffff\ufffd]/g, "-")
    .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/-{2,}/g, "-")
    .trim();
}

function numericOcr(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[OQ]/g, "0")
    .replace(/[IL|]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/[^0-9]/g, "");
}

function canonicalCode(parts = {}) {
  const rgi = Number(numericOcr(parts.rgi));
  const sequence = Number(numericOcr(parts.sequence));
  const year = numericOcr(parts.year);
  const month = Number(numericOcr(parts.month));
  if (![1, 2].includes(rgi)) return "";
  if (!sequence || sequence > 999) return "";
  if (!/^20\d{2}$/.test(year)) return "";
  if (month < 1 || month > 12) return "";
  return `UGPA-RGI${rgi}-${String(sequence).padStart(2, "0")}-PRO-251-${year}-${String(month).padStart(2, "0")}`;
}

function isValidPlanCode(value) {
  return /^UGPA-RGI[12]-\d{2,3}-PRO-251-20\d{2}-(?:0[1-9]|1[0-2])$/i.test(String(value || "").trim())
    && !/-00-PRO-251-/i.test(String(value || ""));
}

function extractCodeCandidates(value) {
  const source = cleanExtractionText(value).toUpperCase();
  if (!source) return [];
  const variants = [
    source,
    source.replace(/\s+/g, " "),
    source.replace(/[^A-Z0-9]+/g, "-"),
    source.replace(/[^A-Z0-9]/g, "")
  ];
  const candidates = [];
  const seen = new Set();
  const add = (code, confidence, evidence) => {
    if (!code || !isValidPlanCode(code)) return;
    if (seen.has(code)) {
      const current = candidates.find((item) => item.value === code);
      if (current) {
        current.confidence = Math.max(current.confidence, confidence);
        current.evidence.push(evidence);
      }
      return;
    }
    seen.add(code);
    candidates.push({ value: code, confidence, evidence: [evidence] });
  };

  const direct = /U[G6]P[A4]\s*[- ]?\s*R[G6][I1L|]\s*([12])\s*[- ]?\s*([0-9OQIL|SB]{1,3})\s*[- ]?\s*PR[OQ0]\s*[- ]?\s*25[I1L|]\s*[- ]?\s*(20[0-9OQIL|SB]{2})\s*[- ]?\s*([0-9OQIL|SB]{1,2})(?=\D|$)/gi;
  let match;
  for (const variant of variants.slice(0, 3)) {
    direct.lastIndex = 0;
    while ((match = direct.exec(variant)) !== null) {
      add(canonicalCode({ rgi: match[1], sequence: match[2], year: match[3], month: match[4] }), 98, match[0]);
    }
  }

  const compact = variants[3];
  const compactPattern = /U[G6]P[A4]R[G6][I1L|]([12])([0-9OQIL|SB]{1,3})PR[OQ0]25[I1L|](20[0-9OQIL|SB]{2})([0-9OQIL|SB]{1,2})/g;
  while ((match = compactPattern.exec(compact)) !== null) {
    add(canonicalCode({ rgi: match[1], sequence: match[2], year: match[3], month: match[4] }), 94, match[0]);
  }

  const tolerant = /U[G6]P[A4][\s\S]{0,30}?R[G6][I1L|]\s*([12])[\s\S]{0,20}?([0-9OQIL|SB]{1,3})[\s\S]{0,25}?PR[OQ0][\s\S]{0,10}?25[I1L|][\s\S]{0,20}?(20[0-9OQIL|SB]{2})[\s\S]{0,12}?([0-9OQIL|SB]{1,2})(?=\D|$)/gi;
  tolerant.lastIndex = 0;
  while ((match = tolerant.exec(source)) !== null) {
    add(canonicalCode({ rgi: match[1], sequence: match[2], year: match[3], month: match[4] }), 88, match[0]);
  }

  return candidates.sort((left, right) => right.confidence - left.confidence);
}

function wordsInHeaderCorner(positionalPages) {
  const page = (Array.isArray(positionalPages) ? positionalPages : []).find((item) => Number(item.page) === 1);
  if (!page) return "";
  const width = Number(page.width || 0);
  const height = Number(page.height || 0);
  if (!width || !height) return "";
  const words = (page.words || [])
    .filter((word) => Number(word.centerX || 0) >= width * 0.68)
    .filter((word) => Number(word.centerY || 0) <= height * 0.23)
    .sort((left, right) => Number(left.centerY || 0) - Number(right.centerY || 0) || Number(left.left || 0) - Number(right.left || 0));
  return words.map((word) => word.text).join(" ");
}

function detectTemplate(text, positionalPages = []) {
  const source = cleanExtractionText(text);
  const normalized = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase();
  const headerCorner = wordsInHeaderCorner(positionalPages);
  const hasCodeLabel = /\bcodigo\b/i.test(normalized) || /\bc[oó]digo\b/i.test(source);
  const hasModernCode = extractCodeCandidates(`${source}\n${headerCorner}`).length > 0;
  const hasPlan = normalized.includes("plan individual") && normalized.includes("capacitacion docente");
  if (hasModernCode || hasCodeLabel) return "MODERNA";
  if (hasPlan) return "ANTIGUA";
  return "DESCONOCIDA";
}

function runHeaderCodeEngine(input = {}) {
  const sources = [
    { engine: "LINEAL", text: input.linearText || "", weight: 1 },
    { engine: "POSICIONAL", text: input.positionalText || "", weight: 2 },
    { engine: "REGION_CODIGO", text: input.codeRegionText || "", weight: 4 },
    { engine: "ESQUINA_ENCABEZADO", text: wordsInHeaderCorner(input.positionalPages), weight: 5 },
    { engine: "OCR", text: input.ocrText || "", weight: 3 }
  ];
  const scores = new Map();
  const evidence = new Map();
  sources.forEach((source) => {
    extractCodeCandidates(source.text).forEach((candidate) => {
      const points = source.weight * (candidate.confidence / 100);
      scores.set(candidate.value, (scores.get(candidate.value) || 0) + points);
      if (!evidence.has(candidate.value)) evidence.set(candidate.value, []);
      evidence.get(candidate.value).push({ engine: source.engine, confidence: candidate.confidence });
    });
  });
  const ranked = [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([value, score]) => ({
      value,
      score,
      confidence: Math.min(100, Math.round(55 + score * 8)),
      engines: evidence.get(value) || []
    }));
  const combinedText = sources.map((source) => source.text).filter(Boolean).join("\n");
  return {
    code: ranked[0]?.value || "",
    confidence: ranked[0]?.confidence || 0,
    candidates: ranked,
    period: ranked[0]?.value.match(/(20\d{2}-(?:0[1-9]|1[0-2]))$/)?.[1] || "",
    template: detectTemplate(combinedText, input.positionalPages)
  };
}

module.exports = {
  cleanExtractionText,
  numericOcr,
  canonicalCode,
  isValidPlanCode,
  extractCodeCandidates,
  wordsInHeaderCorner,
  detectTemplate,
  runHeaderCodeEngine
};