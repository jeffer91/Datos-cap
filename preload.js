"use strict";

const { contextBridge, ipcRenderer, clipboard } = require("electron");

function subscribe(channel, callback) {
  if (typeof callback !== "function") return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

function addScreenNavigation() {
  if (!document.querySelector('link[href="./agreements.css"]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "./agreements.css";
    document.head.appendChild(stylesheet);
  }

  const topbar = document.querySelector(".topbar");
  if (!topbar || topbar.querySelector(".screen-nav")) return;
  const nav = document.createElement("nav");
  nav.className = "screen-nav";
  nav.setAttribute("aria-label", "Pantallas");

  const current = window.location.pathname.toLowerCase();
  [
    { label: "Planes", href: "./index.html", active: !current.includes("agreements") },
    { label: "Acuerdos", href: "./agreements.html", active: current.includes("agreements") }
  ].forEach((item) => {
    const link = document.createElement("a");
    link.href = item.href;
    link.textContent = item.label;
    if (item.active) link.classList.add("active");
    nav.appendChild(link);
  });

  const actions = topbar.querySelector(":scope > .top-actions");
  if (actions) topbar.insertBefore(nav, actions);
  else topbar.appendChild(nav);
}

window.addEventListener("DOMContentLoaded", addScreenNavigation, { once: true });

contextBridge.exposeInMainWorld("plansAPI", {
  selectFiles: () => ipcRenderer.invoke("plans:select-files"),
  selectFolder: () => ipcRenderer.invoke("plans:select-folder"),
  process: (filePaths) => ipcRenderer.invoke("plans:process", { filePaths }),
  importTable: (tableText) => ipcRenderer.invoke("plans:import-table", { tableText }),
  copyText: (text) => {
    clipboard.writeText(String(text || ""));
    return true;
  },
  list: () => ipcRenderer.invoke("plans:list"),
  update: (record) => ipcRenderer.invoke("plans:update", record),
  export: (format) => ipcRenderer.invoke("plans:export", { format }),
  openDataFolder: () => ipcRenderer.invoke("plans:open-data-folder"),
  openFile: (filePath) => ipcRenderer.invoke("plans:open-file", filePath),
  clear: () => ipcRenderer.invoke("plans:clear"),
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  onProgress: (callback) => subscribe("plans:progress", callback)
});

contextBridge.exposeInMainWorld("agreementsAPI", {
  selectFiles: () => ipcRenderer.invoke("agreements:select-files"),
  selectFolder: () => ipcRenderer.invoke("agreements:select-folder"),
  process: (filePaths) => ipcRenderer.invoke("agreements:process", { filePaths }),
  list: () => ipcRenderer.invoke("agreements:list"),
  update: (record) => ipcRenderer.invoke("agreements:update", record),
  export: (format) => ipcRenderer.invoke("agreements:export", { format }),
  openFile: (filePath) => ipcRenderer.invoke("agreements:open-file", filePath),
  clear: () => ipcRenderer.invoke("agreements:clear"),
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  onProgress: (callback) => subscribe("plans:progress", callback)
});
