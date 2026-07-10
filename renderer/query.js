/* =========================================================
Nombre completo: query.js
Ruta o ubicación: /renderer/query.js
Función o funciones:
- Cargar opciones dinámicas de consulta desde la base local.
- Filtrar por tipo, periodo, carrera, docente, curso, estado y texto.
- Paginar resultados y mostrar el detalle agrupado por colección.
- Actualizar las consultas después de cada nuevo procesamiento.
========================================================= */

"use strict";

(function initializeQueryPanel(windowObject, documentObject) {
  const elements = {
    documentType: documentObject.getElementById("queryDocumentType"),
    period: documentObject.getElementById("queryPeriod"),
    state: documentObject.getElementById("queryState"),
    career: documentObject.getElementById("queryCareer"),
    teacher: documentObject.getElementById("queryTeacher"),
    course: documentObject.getElementById("queryCourse"),
    search: documentObject.getElementById("querySearch"),
    careerOptions: documentObject.getElementById("queryCareerOptions"),
    teacherOptions: documentObject.getElementById("queryTeacherOptions"),
    courseOptions: documentObject.getElementById("queryCourseOptions"),
    runButton: documentObject.getElementById("btnRunQuery"),
    clearButton: documentObject.getElementById("btnClearQuery"),
    status: documentObject.getElementById("queryStatus"),
    totalBadge: documentObject.getElementById("queryTotalBadge"),
    results: documentObject.getElementById("queryResults"),
    pagination: documentObject.getElementById("queryPagination"),
    detail: documentObject.getElementById("queryDetail"),
    processingResults: documentObject.getElementById("resultsContainer")
  };

  const state = {
    currentPage: 1,
    pageSize: 25,
    totalPages: 1,
    total: 0,
    loading: false,
    lastFilters: null,
    filterOptions: null,
    refreshTimer: null
  };

  function escapeHtml(value) {
    return String(value === null || typeof value === "undefined" ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function displayValue(value) {
    if (value === null || typeof value === "undefined" || value === "") return "—";
    if (typeof value === "boolean") return value ? "Sí" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("es-EC").format(Number(value || 0));
  }

  function formatDate(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return displayValue(value);
    return new Intl.DateTimeFormat("es-EC", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function setStatus(message, type = "info") {
    const allowed = new Set(["info", "success", "warning", "danger"]);
    const safeType = allowed.has(type) ? type : "info";
    elements.status.className = `status-box status-${safeType}`;
    elements.status.textContent = message;
  }

  function setLoading(loading) {
    state.loading = Boolean(loading);
    elements.runButton.disabled = state.loading;
    elements.clearButton.disabled = state.loading;
    elements.runButton.textContent = state.loading ? "Consultando..." : "Buscar en la base";
  }

  function optionMarkup(value, label) {
    return `<option value="${escapeHtml(value)}">${escapeHtml(label || value)}</option>`;
  }

  function populateSelect(select, values, placeholder, labels = {}) {
    const current = select.value;
    select.innerHTML = optionMarkup("", placeholder) + (values || [])
      .map((value) => optionMarkup(value, labels[value] || value))
      .join("");
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }

  function populateDatalist(datalist, values) {
    datalist.innerHTML = (values || [])
      .map((value) => `<option value="${escapeHtml(value)}"></option>`)
      .join("");
  }

  function readFilters(page = 1) {
    return {
      documentType: elements.documentType.value,
      period: elements.period.value,
      state: elements.state.value,
      career: elements.career.value.trim(),
      teacher: elements.teacher.value.trim(),
      course: elements.course.value.trim(),
      search: elements.search.value.trim(),
      page,
      pageSize: state.pageSize
    };
  }

  function statusBadge(item) {
    if (item.estado_version === "SUPERADO" || item.activo === false) {
      return '<span class="badge badge-error">Superado</span>';
    }
    if (String(item.requiere_revision || "").toUpperCase() === "SI" || String(item.estado_extraccion || "").toUpperCase() === "REVISAR") {
      return '<span class="badge badge-warning">Revisar</span>';
    }
    return '<span class="badge badge-ok">Activo</span>';
  }

  function renderResults(result) {
    const items = result && Array.isArray(result.items) ? result.items : [];
    const pagination = result && result.pagination ? result.pagination : {};
    state.currentPage = Number(pagination.page || 1);
    state.totalPages = Number(pagination.totalPages || 1);
    state.total = Number(pagination.total || 0);
    elements.totalBadge.textContent = `${formatNumber(state.total)} documento${state.total === 1 ? "" : "s"}`;

    if (!items.length) {
      elements.results.innerHTML = '<div class="empty">No se encontraron documentos con los filtros seleccionados.</div>';
      elements.pagination.innerHTML = "";
      elements.detail.innerHTML = "";
      setStatus("Consulta completada sin coincidencias.", "warning");
      return;
    }

    const rows = items.map((item) => `
      <tr>
        <td>
          <strong>${escapeHtml(item.nombre_tipo_documental || item.tipo_documental)}</strong>
          <div class="query-muted">${escapeHtml(item.nombre_archivo || "Sin nombre de archivo")}</div>
        </td>
        <td>${escapeHtml(item.codigo_documento || "—")}</td>
        <td>${escapeHtml(item.periodo || "—")}</td>
        <td>${escapeHtml(item.carreras || "—")}</td>
        <td>${escapeHtml(item.docentes || "—")}</td>
        <td>${escapeHtml(item.cursos || "—")}</td>
        <td>
          ${statusBadge(item)}
          <div class="query-muted">Versión ${escapeHtml(item.version_local || 1)}</div>
        </td>
        <td>${escapeHtml(formatNumber(item.total_filas))}</td>
        <td>
          <button class="btn btn-secondary query-detail-button" type="button" data-document-id="${escapeHtml(item.id_documento)}">
            Ver detalle
          </button>
        </td>
      </tr>
    `).join("");

    elements.results.innerHTML = `
      <div class="table-scroll query-results-table">
        <table>
          <thead>
            <tr>
              <th>Documento</th>
              <th>Código</th>
              <th>Periodo</th>
              <th>Carrera</th>
              <th>Docente o responsable</th>
              <th>Curso</th>
              <th>Estado</th>
              <th>Filas</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    elements.results.querySelectorAll("[data-document-id]").forEach((button) => {
      button.addEventListener("click", () => loadDocumentDetail(button.dataset.documentId));
    });

    renderPagination();
    setStatus(`Consulta completada: ${formatNumber(state.total)} documento(s) encontrado(s).`, "success");
  }

  function renderPagination() {
    if (state.totalPages <= 1) {
      elements.pagination.innerHTML = "";
      return;
    }

    elements.pagination.innerHTML = `
      <button class="btn btn-secondary" id="queryPreviousPage" type="button" ${state.currentPage <= 1 ? "disabled" : ""}>Anterior</button>
      <span>Página ${state.currentPage} de ${state.totalPages}</span>
      <button class="btn btn-secondary" id="queryNextPage" type="button" ${state.currentPage >= state.totalPages ? "disabled" : ""}>Siguiente</button>
    `;

    const previous = documentObject.getElementById("queryPreviousPage");
    const next = documentObject.getElementById("queryNextPage");
    if (previous) previous.addEventListener("click", () => runQuery(state.currentPage - 1));
    if (next) next.addEventListener("click", () => runQuery(state.currentPage + 1));
  }

  function getVisibleColumns(rows) {
    const preferred = [
      "numero", "numero_participante", "nombre_docente", "nombres_apellidos", "cedula_identidad",
      "carrera", "carrera_publico", "nombre_curso", "capacitacion", "objetivo", "indicador",
      "resultado_texto", "porcentaje", "estado", "requiere_revision"
    ];
    const discovered = [];
    (rows || []).slice(0, 30).forEach((row) => {
      Object.keys(row || {}).forEach((key) => {
        if (!key.startsWith("_") && !discovered.includes(key)) discovered.push(key);
      });
    });
    return [
      ...preferred.filter((key) => discovered.includes(key)),
      ...discovered.filter((key) => !preferred.includes(key))
    ].slice(0, 12);
  }

  function renderCollection(collection) {
    const rows = Array.isArray(collection.rows) ? collection.rows : [];
    const columns = getVisibleColumns(rows);
    if (!rows.length || !columns.length) {
      return `
        <details class="query-collection">
          <summary>${escapeHtml(collection.name)} <span>${formatNumber(collection.totalRows)} filas</span></summary>
          <div class="empty">Esta colección no contiene filas visibles.</div>
        </details>
      `;
    }

    const headers = columns.map((column) => `<th>${escapeHtml(column.replaceAll("_", " "))}</th>`).join("");
    const body = rows.map((row) => `
      <tr>${columns.map((column) => `<td title="${escapeHtml(displayValue(row[column]))}">${escapeHtml(displayValue(row[column]))}</td>`).join("")}</tr>
    `).join("");
    const truncation = collection.truncated
      ? `<div class="query-notice">Se muestran las primeras ${formatNumber(rows.length)} de ${formatNumber(collection.totalRows)} filas.</div>`
      : "";

    return `
      <details class="query-collection">
        <summary>${escapeHtml(collection.name)} <span>${formatNumber(collection.totalRows)} filas</span></summary>
        ${truncation}
        <div class="table-scroll query-detail-table">
          <table>
            <thead><tr>${headers}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </details>
    `;
  }

  function renderDocumentDetail(detail) {
    const document = detail.document || {};
    const summary = detail.summary || {};
    const metadataEntries = Object.entries(document)
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, value]) => `
        <div class="query-metadata-item">
          <span>${escapeHtml(key.replaceAll("_", " "))}</span>
          <strong>${escapeHtml(key.includes("fecha") ? formatDate(value) : displayValue(value))}</strong>
        </div>
      `).join("");

    const collections = (detail.collections || []).map(renderCollection).join("");
    elements.detail.innerHTML = `
      <div class="query-detail-header">
        <div>
          <h4>Detalle del documento</h4>
          <p>${escapeHtml(document.nombre_tipo_documental || document.tipo_documental)} · ${escapeHtml(document.codigo_documento || document.nombre_archivo || "Sin código")}</p>
        </div>
        <button class="btn btn-secondary" id="btnCloseQueryDetail" type="button">Cerrar detalle</button>
      </div>

      <div class="query-detail-summary">
        <span><strong>${formatNumber(summary.totalCollections)}</strong> colecciones</span>
        <span><strong>${formatNumber(summary.totalRows)}</strong> filas</span>
        <span><strong>${escapeHtml((summary.careers || []).join(" | ") || "—")}</strong> carrera(s)</span>
      </div>

      <div class="query-metadata-grid">${metadataEntries}</div>
      <div class="query-collections">${collections || '<div class="empty">El documento no tiene filas asociadas.</div>'}</div>
    `;

    documentObject.getElementById("btnCloseQueryDetail").addEventListener("click", () => {
      elements.detail.innerHTML = "";
    });
    elements.detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadFilterOptions() {
    if (!windowObject.documentAppAPI) return;
    try {
      const result = await windowObject.documentAppAPI.getDatabaseFilterOptions();
      if (!result || !result.ok) {
        setStatus(result && result.message ? result.message : "No se pudieron cargar los filtros.", "danger");
        return;
      }

      state.filterOptions = result;
      populateSelect(elements.documentType, result.documentTypes, "Todos los tipos", result.documentTypeLabels || {});
      populateSelect(elements.period, result.periods, "Todos los periodos");
      populateDatalist(elements.careerOptions, result.careers);
      populateDatalist(elements.teacherOptions, result.teachers);
      populateDatalist(elements.courseOptions, result.courses);
      elements.totalBadge.textContent = `${formatNumber(result.totalDocuments)} documento${result.totalDocuments === 1 ? "" : "s"}`;
      setStatus("Filtros listos. Puedes consultar toda la información guardada.", "success");
    } catch (error) {
      setStatus(`No se pudieron cargar los filtros: ${error.message}`, "danger");
    }
  }

  async function runQuery(page = 1) {
    if (!windowObject.documentAppAPI || state.loading) return;
    setLoading(true);
    setStatus("Buscando documentos y contenido relacionado...", "info");
    elements.detail.innerHTML = "";

    try {
      const filters = readFilters(page);
      state.lastFilters = filters;
      const result = await windowObject.documentAppAPI.queryDatabaseDocuments(filters);
      if (!result || !result.ok) {
        setStatus(result && result.message ? result.message : "La consulta no pudo completarse.", "danger");
        return;
      }
      renderResults(result);
    } catch (error) {
      setStatus(`Error durante la consulta: ${error.message}`, "danger");
    } finally {
      setLoading(false);
    }
  }

  async function loadDocumentDetail(documentId) {
    if (!windowObject.documentAppAPI || !documentId) return;
    setStatus("Cargando detalle y tablas del documento...", "info");

    try {
      const detail = await windowObject.documentAppAPI.getDatabaseDocumentDetail(documentId, {
        maxRowsPerCollection: 200
      });
      if (!detail || !detail.ok) {
        setStatus(detail && detail.message ? detail.message : "No se pudo cargar el detalle.", "danger");
        return;
      }
      renderDocumentDetail(detail);
      setStatus("Detalle documental cargado correctamente.", "success");
    } catch (error) {
      setStatus(`No se pudo cargar el detalle: ${error.message}`, "danger");
    }
  }

  function clearFilters() {
    elements.documentType.value = "";
    elements.period.value = "";
    elements.state.value = "";
    elements.career.value = "";
    elements.teacher.value = "";
    elements.course.value = "";
    elements.search.value = "";
    state.currentPage = 1;
    elements.detail.innerHTML = "";
    runQuery(1);
  }

  function scheduleDatabaseRefresh() {
    if (state.refreshTimer) windowObject.clearTimeout(state.refreshTimer);
    state.refreshTimer = windowObject.setTimeout(async () => {
      await loadFilterOptions();
      if (state.lastFilters) await runQuery(1);
    }, 650);
  }

  function bindEvents() {
    elements.runButton.addEventListener("click", () => runQuery(1));
    elements.clearButton.addEventListener("click", clearFilters);

    [elements.career, elements.teacher, elements.course, elements.search].forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          runQuery(1);
        }
      });
    });

    if (elements.processingResults && typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(() => {
        if (elements.processingResults.textContent.includes("Reporte generado correctamente")) scheduleDatabaseRefresh();
      });
      observer.observe(elements.processingResults, { childList: true, subtree: true, characterData: true });
    }
  }

  async function initialize() {
    bindEvents();
    await loadFilterOptions();
    await runQuery(1);
    windowObject.localQueryUI = Object.freeze({
      refreshOptions: loadFilterOptions,
      run: runQuery
    });
  }

  if (documentObject.readyState === "loading") {
    documentObject.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})(window, document);
