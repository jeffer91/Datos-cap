"use strict";

(() => {
  const api = window.plansAPI;
  if (!api || typeof api.list !== "function") return;

  let records = [];
  let refreshing = false;
  let scheduled = null;

  const labels = {
    COMPLETO: "Completo",
    COMPLETO_CON_ADVERTENCIAS: "Completo con avisos",
    PLANTILLA_ANTIGUA: "Plantilla antigua",
    REVISAR_LECTURA: "Revisar lectura",
    REVISAR_CONTENIDO: "Revisar contenido",
    NO_ES_PLAN: "No es plan",
    ERROR: "Error"
  };

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function recordKey(record) {
    return [record?.docente?.nombre, record?.docente?.codigo_documento || record?.archivo?.nombre]
      .map(normalize)
      .filter(Boolean)
      .join("|");
  }

  function rowKey(row) {
    const teacher = row.querySelector(".teacher-cell strong")?.textContent || "";
    const code = row.querySelector(".teacher-cell span")?.textContent?.replace(/\s*·\s*Corregido\s*$/i, "") || "";
    return [teacher, code].map(normalize).filter(Boolean).join("|");
  }

  function statusClass(record) {
    if (record?.estado === "COMPLETO") return "complete";
    if (record?.estado === "REVISAR") return "review";
    return "error";
  }

  function enhanceRows() {
    const byKey = new Map(records.map((record) => [recordKey(record), record]));
    document.querySelectorAll("#resultsBody tr").forEach((row) => {
      const record = byKey.get(rowKey(row));
      if (!record) return;
      const pill = row.querySelector(".status-pill");
      if (pill) {
        const label = labels[record.estado_detallado] || labels[record.estado] || record.estado || "Revisar";
        const className = statusClass(record);
        if (pill.textContent !== label) pill.textContent = label;
        if (!pill.classList.contains(className) || pill.classList.length !== 2) {
          pill.classList.remove("complete", "review", "error");
          pill.classList.add(className);
        }
        const title = record.estado_detallado || record.estado || "";
        if (pill.title !== title) pill.title = title;
      }

      const actionCell = row.lastElementChild;
      if (!actionCell) return;
      const warnings = Object.keys(record.advertencias_campos || {}).length;
      let badge = actionCell.querySelector(".validation-warning-count");
      if (!warnings) {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "validation-warning-count";
        actionCell.insertBefore(badge, actionCell.firstChild);
      }
      const text = `⚠ ${warnings}`;
      const title = `${warnings} advertencia${warnings === 1 ? "" : "s"} que no bloquean el plan`;
      if (badge.textContent !== text) badge.textContent = text;
      if (badge.title !== title) badge.title = title;
    });
  }

  function findDrawerRecord() {
    const title = normalize(document.getElementById("drawerTitle")?.textContent);
    if (!title) return null;
    return records.find((record) => normalize(record?.docente?.nombre) === title)
      || records.find((record) => normalize(record?.archivo?.nombre) === title)
      || null;
  }

  function summarySignature(record) {
    return JSON.stringify({
      id: record?.id,
      estado: record?.estado,
      detallado: record?.estado_detallado,
      motores: (record?.motores || []).map((engine) => engine.nombre),
      validaciones: record?.validaciones || {},
      advertencias: record?.advertencias_campos || {}
    });
  }

  function enhanceDrawer() {
    const drawer = document.getElementById("drawerContent");
    if (!drawer || !drawer.children.length) return;
    const record = findDrawerRecord();
    let summary = drawer.querySelector(".multivalidation-summary");
    if (!record) {
      if (summary) summary.remove();
      return;
    }

    const signature = summarySignature(record);
    if (summary?.dataset.signature === signature) return;
    const engines = (record.motores || []).map((engine) => engine.nombre).filter(Boolean);
    const layers = Object.entries(record.validaciones || {});
    const warnings = Object.values(record.advertencias_campos || {});
    if (!summary) {
      summary = document.createElement("section");
      summary.className = "multivalidation-summary";
      drawer.insertBefore(summary, drawer.firstChild);
    }

    const layerHtml = layers.length
      ? `<div class="multivalidation-layers">${layers.map(([name, result]) => {
        const ok = Boolean(result?.ok);
        return `<span class="multivalidation-layer ${ok ? "ok" : "review"}">${escapeHtml(name)}: ${ok ? "correcto" : "revisar"}</span>`;
      }).join("")}</div>`
      : "";

    summary.innerHTML = `
      <strong>Validación multimotor</strong>
      <span class="multivalidation-state">${escapeHtml(labels[record.estado_detallado] || record.estado || "")}</span>
      ${engines.length ? `<p class="multivalidation-engines"><b>Motores:</b> ${engines.map(escapeHtml).join(" · ")}</p>` : ""}
      ${layerHtml}
      ${warnings.length ? `<p class="multivalidation-warnings">${warnings.map((item) => escapeHtml(item.message)).join(" · ")}</p>` : ""}
    `;
    summary.dataset.signature = signature;
  }

  function enhance() {
    enhanceRows();
    enhanceDrawer();
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const result = await api.list();
      records = Array.isArray(result?.records) ? result.records : [];
      enhance();
    } catch (_error) {
      // La interfaz principal seguirá funcionando aunque no se pueda enriquecer el estado.
    } finally {
      refreshing = false;
    }
  }

  function scheduleRefresh() {
    window.clearTimeout(scheduled);
    scheduled = window.setTimeout(refresh, 120);
  }

  window.addEventListener("DOMContentLoaded", refresh, { once: true });
  const observer = new MutationObserver(scheduleRefresh);
  const startObserver = () => {
    const body = document.getElementById("resultsBody");
    const drawer = document.getElementById("drawerContent");
    if (body) observer.observe(body, { childList: true, subtree: true });
    if (drawer) observer.observe(drawer, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  else startObserver();
})();