"use strict";

const { contextBridge, ipcRenderer } = require("electron");

/**
 * The only bridge between the page and the machine. Context isolation stays on
 * and Node stays out of the renderer; the page gets these named calls and
 * nothing else. `window.crvmgmt` being defined is also how the app knows it is
 * running on the desktop rather than in a browser.
 */
contextBridge.exposeInMainWorld("crvmgmt", {
  isDesktop: true,
  info: () => ipcRenderer.invoke("crvmgmt:info"),
  listPrinters: () => ipcRenderer.invoke("crvmgmt:printers"),
  printPdf: (bytes, options = {}) =>
    ipcRenderer.invoke("crvmgmt:print-pdf", { bytes: Array.from(bytes), ...options }),
  chooseFile: (filters) => ipcRenderer.invoke("crvmgmt:choose-file", { filters }),
  chooseFolder: () => ipcRenderer.invoke("crvmgmt:choose-folder"),
  reveal: (target) => ipcRenderer.invoke("crvmgmt:reveal", target),
  showContextMenu: (items) => ipcRenderer.invoke("crvmgmt:context-menu", items),
  // Only macOS has a share menu; elsewhere the page falls back to Web Share.
  ...(process.platform === "darwin"
    ? { shareUrl: (payload) => ipcRenderer.invoke("crvmgmt:share-url", payload) }
    : {}),
});
