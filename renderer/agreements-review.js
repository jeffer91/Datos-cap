"use strict";

function selectedTrainingName(select) {
  const label = select.selectedOptions?.[0]?.textContent?.trim() || "";
  const parts = label.split(" · ").map((item) => item.trim()).filter(Boolean);
  if (parts.length < 2) return "";
  if (/^\d{4}-\d{2}$/.test(parts[parts.length - 1])) parts.pop();
  parts.shift();
  return parts.join(" · ");
}

function financingInputs() {
  return {
    total: document.querySelector('[data-check="financiamiento_total"]'),
    partial: document.querySelector('[data-check="financiamiento_parcial"]'),
    percentage: document.querySelector('[data-field="patrocinio.porcentaje_financiado"]')
  };
}

function enhanceAgreementForm() {
  const { partial, percentage } = financingInputs();
  if (!percentage) return;
  percentage.min = "1";
  percentage.max = "100";
  percentage.step = "0.01";
  percentage.disabled = !partial?.checked;
  if (!partial?.checked) percentage.value = "";
}

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.matches('[data-field="capacitacion.id_plan"]')) {
    const nameInput = document.querySelector('[data-field="capacitacion.nombre"]');
    const name = selectedTrainingName(target);
    if (target.value && name && nameInput instanceof HTMLInputElement) nameInput.value = name;
    return;
  }

  const { total, partial, percentage } = financingInputs();
  if (target === total && total.checked) {
    if (partial) partial.checked = false;
    if (percentage) percentage.value = "";
  }
  if (target === partial && partial.checked && total) total.checked = false;
  enhanceAgreementForm();
});

const observer = new MutationObserver(enhanceAgreementForm);
window.addEventListener("DOMContentLoaded", () => {
  observer.observe(document.body, { childList: true, subtree: true });
  enhanceAgreementForm();
}, { once: true });
