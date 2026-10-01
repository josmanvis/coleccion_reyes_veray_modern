"use strict";

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

/**
 * CRVMGMT — the desktop shell for the Colección Reyes-Veray inventory.
 *
 * It hosts the same Next.js admin the browser serves, and adds the three things
 * a browser cannot do: a real data directory, a link to FileMaker Pro, and
 * printing a certificate straight to a printer without a dialog.
 */

const PORT = process.env.CRVMGMT_PORT || "9182";
const BASE_URL = process.env.CRVMGMT_URL || `http://localhost:${PORT}`;
// Never the public site: the app opens on the inventory, which redirects to
// the sign-in screen when there is no session.
const START_URL = `${BASE_URL}/inventory`;
const isDev = !app.isPackaged;

let mainWindow = null;
let serverProcess = null;

function dataDirectory() {
  // Packaged builds keep the database beside the user's other app data;
  // in development it stays in the repo so both modes see the same records.
  const dir = isDev
    ? path.join(app.getAppPath(), "data")
    : path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: "CRVMGMT",
    backgroundColor: "#f5f5f5",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    // Centre the traffic lights in the 48px app bar the page draws.
    trafficLightPosition: process.platform === "darwin" ? { x: 14, y: 16 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(START_URL);

  // External links open in the real browser, never inside the app shell.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(BASE_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/** In a packaged build the Next server runs as a child of the app. */
function startServer() {
  if (isDev) return;
  const entry = path.join(process.resourcesPath, "app", "server.js");
  if (!fs.existsSync(entry)) return;
  serverProcess = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT,
      INVENTORY_DB_PATH: path.join(dataDirectory(), "inventory.db"),
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "inherit",
  });
}

app.whenReady().then(() => {
  app.setName("CRVMGMT");
  startServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  serverProcess?.kill();
});

// --- Capabilities the browser cannot offer ----------------------------------

ipcMain.handle("crvmgmt:info", () => ({
  version: app.getVersion(),
  platform: process.platform,
  dataDirectory: dataDirectory(),
}));

ipcMain.handle("crvmgmt:printers", async () => {
  if (!mainWindow) return [];
  const printers = await mainWindow.webContents.getPrintersAsync();
  return printers.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    isDefault: p.isDefault,
    status: p.status,
  }));
});

/**
 * Prints a PDF the app generated. The bytes are written to a temp file and
 * loaded into an offscreen window, which is what actually gets printed, so the
 * job goes to the printer without a dialog when a printer is named.
 */
ipcMain.handle("crvmgmt:print-pdf", async (_event, { bytes, deviceName, silent = true }) => {
  const file = path.join(app.getPath("temp"), `crvmgmt-${Date.now()}.pdf`);
  fs.writeFileSync(file, Buffer.from(bytes));

  const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: false } });
  await printWindow.loadURL(`file://${file}`);

  const result = await new Promise((resolve) => {
    printWindow.webContents.print(
      { silent, deviceName: deviceName || undefined, printBackground: true },
      (success, failureReason) => resolve({ success, failureReason })
    );
  });

  printWindow.destroy();
  fs.unlink(file, () => {});
  return result;
});

ipcMain.handle("crvmgmt:choose-file", async (_event, { filters } = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: filters ?? [{ name: "Hojas de cálculo", extensions: ["xlsx", "xlsm"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const file = result.filePaths[0];
  return { path: file, name: path.basename(file), bytes: fs.readFileSync(file).toJSON().data };
});

ipcMain.handle("crvmgmt:choose-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("crvmgmt:reveal", (_event, target) => {
  shell.showItemInFolder(target);
});
