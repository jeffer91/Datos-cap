/* =========================================================
Nombre completo: firebase-sync.js
Ruta o ubicación: /renderer/base/firebase-sync.js
Función o funciones:
- Mostrar un estado discreto de Firebase en la pantalla Base.
- Permitir configurar una cuenta de Firebase Authentication una sola vez.
- Mantener la sincronización automática sin botones manuales de subida o descarga.
========================================================= */
"use strict";

(function initializeFirebaseSyncUi(windowObject, documentObject) {
  const api = windowObject.documentAppAPI;
  const button = documentObject.getElementById("btnFirebaseSetup");
  const backdrop = documentObject.getElementById("firebaseModal");
  const closeButton = documentObject.getElementById("btnCloseFirebase");
  const saveButton = documentObject.getElementById("btnSaveFirebase");
  const disconnectButton = documentObject.getElementById("btnDisconnectFirebase");
  const emailInput = documentObject.getElementById("firebaseEmail");
  const passwordInput = documentObject.getElementById("firebasePassword");
  const stateBox = documentObject.getElementById("firebaseState");
  const stateText = documentObject.getElementById("firebaseStateText");
  const messageBox = documentObject.getElementById("firebaseMessage");
  let busy = false;
  let currentStatus = null;

  function cssState(status) {
    const value = String(status?.state || "").toUpperCase();
    if (["READY"].includes(value)) return "ready";
    if (["CONNECTING", "SYNCING", "WAITING"].includes(value)) return "syncing";
    if (value === "ERROR") return "error";
    return "";
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("es-EC", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function setMessage(message, type = "") {
    messageBox.textContent = message || "";
    messageBox.className = `firebase-message${type ? ` ${type}` : ""}`;
  }

  function render(status = {}) {
    currentStatus = status;
    const stateClass = cssState(status);
    button.className = `btn-secondary firebase-button${stateClass ? ` ${stateClass}` : ""}`;
    button.textContent = status.configured ? "Nube" : "Nube";
    button.title = status.message || "Configurar Firebase";
    stateBox.className = `firebase-state${stateClass ? ` ${stateClass}` : ""}`;

    const lastSync = formatDate(status.lastSyncAt);
    if (status.state === "READY") {
      stateText.textContent = lastSync ? `Sincronizado · ${lastSync}` : "Conectado";
    } else if (status.state === "ERROR") {
      stateText.textContent = status.message || "Error de conexión";
    } else if (status.configured) {
      stateText.textContent = status.message || "Configurado";
    } else {
      stateText.textContent = "Sin configurar";
    }

    if (!backdrop.classList.contains("open")) return;
    if (status.email && !emailInput.value) emailInput.value = status.email;
    disconnectButton.disabled = busy || !status.configured;
  }

  async function refresh() {
    try { render(await api.getFirebaseStatus()); }
    catch (_error) { render({ state: "ERROR", message: "No se pudo consultar Firebase." }); }
  }

  function openModal() {
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
    emailInput.value = currentStatus?.email || "";
    passwordInput.value = "";
    setMessage("");
    disconnectButton.disabled = busy || !currentStatus?.configured;
    windowObject.setTimeout(() => emailInput.focus(), 30);
  }

  function closeModal() {
    if (busy) return;
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    passwordInput.value = "";
    setMessage("");
  }

  function setBusy(value) {
    busy = Boolean(value);
    saveButton.disabled = busy;
    closeButton.disabled = busy;
    disconnectButton.disabled = busy || !currentStatus?.configured;
    emailInput.disabled = busy;
    passwordInput.disabled = busy;
  }

  async function save() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    setBusy(true);
    setMessage("Conectando...");
    try {
      const result = await api.configureFirebase({ email, password });
      render(result.status || result);
      passwordInput.value = "";
      setMessage("Conectado.", "success");
    } catch (error) {
      setMessage(error.message || "No se pudo conectar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setMessage("Desconectando...");
    try {
      const result = await api.disconnectFirebase();
      render(result.status || result);
      emailInput.value = "";
      passwordInput.value = "";
      setMessage("Desconectado.", "success");
    } catch (error) {
      setMessage(error.message || "No se pudo desconectar.", "error");
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    button.addEventListener("click", openModal);
    closeButton.addEventListener("click", closeModal);
    saveButton.addEventListener("click", save);
    disconnectButton.addEventListener("click", disconnect);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal();
    });
    passwordInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !busy) save();
    });
    api.onFirebaseStatus((status) => render(status));
  }

  function initialize() {
    bindEvents();
    refresh();
  }

  if (documentObject.readyState === "loading") {
    documentObject.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})(window, document);
