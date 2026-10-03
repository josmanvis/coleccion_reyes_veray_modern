import { app, BrowserWindow, Menu, ShareMenu, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

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

/** Shared by the main window and any "open in a new window" from the app. */
function windowOptions() {
  return {
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
      preload: path.join(import.meta.dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  };
}

/**
 * Every window gets the same treatment: app links open as another CRVMGMT
 * window (with the bridge, so it keeps its menus and printing), external
 * links go to the real browser, and right-clicks the page leaves alone get
 * the native edit menu.
 */
function prepare(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(BASE_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow", overrideBrowserWindowOptions: windowOptions() };
  });
  win.webContents.on("did-create-window", prepare);
  win.webContents.on("context-menu", (_event, params) => showEditMenu(win, params));
}

/**
 * The page draws its own menus for records and lists; what reaches here is a
 * text field, selected text, or Shift + right-click. Electron shows nothing by
 * default, so build what a Mac app would.
 */
function showEditMenu(win, params) {
  const { editFlags, isEditable, selectionText, dictionarySuggestions, misspelledWord } = params;
  const template = [];

  if (isEditable && misspelledWord) {
    for (const suggestion of dictionarySuggestions.slice(0, 5)) {
      template.push({ label: suggestion, click: () => win.webContents.replaceMisspelling(suggestion) });
    }
    if (dictionarySuggestions.length === 0) template.push({ label: "Sin sugerencias", enabled: false });
    template.push({
      label: "Añadir al diccionario",
      click: () => win.webContents.session.addWordToSpellCheckerDictionary(misspelledWord),
    });
    template.push({ type: "separator" });
  }

  if (isEditable) {
    template.push(
      { role: "undo", label: "Deshacer", enabled: editFlags.canUndo },
      { role: "redo", label: "Rehacer", enabled: editFlags.canRedo },
      { type: "separator" },
      { role: "cut", label: "Cortar", enabled: editFlags.canCut },
      { role: "copy", label: "Copiar", enabled: editFlags.canCopy },
      { role: "paste", label: "Pegar", enabled: editFlags.canPaste },
      { role: "selectAll", label: "Seleccionar todo", enabled: editFlags.canSelectAll }
    );
  } else if (selectionText.trim()) {
    template.push({ role: "copy", label: "Copiar" });
  } else {
    template.push(
      { label: "Atrás", enabled: win.webContents.navigationHistory.canGoBack(), click: () => win.webContents.navigationHistory.goBack() },
      { label: "Adelante", enabled: win.webContents.navigationHistory.canGoForward(), click: () => win.webContents.navigationHistory.goForward() },
      { label: "Recargar", click: () => win.webContents.reload() }
    );
  }

  if (isDev) {
    template.push(
      { type: "separator" },
      { label: "Inspeccionar elemento", click: () => win.webContents.inspectElement(params.x, params.y) }
    );
  }

  Menu.buildFromTemplate(template).popup({ window: win });
}

function createWindow() {
  mainWindow = new BrowserWindow(windowOptions());
  prepare(mainWindow);
  mainWindow.loadURL(START_URL);

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

/**
 * Shows the page's own context menu natively. The page sends plain items
 * (label, enabled, checked, separators) and gets back the id of the one
 * chosen, or null when the menu closes without a choice; the action itself
 * stays in the page.
 */
ipcMain.handle("crvmgmt:context-menu", (event, items) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return new Promise((resolve) => {
    let chosen = null;
    const template = (Array.isArray(items) ? items : []).map((item) =>
      item.type === "separator"
        ? { type: "separator" }
        : {
            label: String(item.label ?? ""),
            enabled: item.enabled !== false,
            type: typeof item.checked === "boolean" ? "checkbox" : "normal",
            checked: Boolean(item.checked),
            click: () => {
              chosen = item.id;
            },
          }
    );
    // The click handler runs before the close callback, so `chosen` is set by then.
    Menu.buildFromTemplate(template).popup({ window: win ?? undefined, callback: () => resolve(chosen) });
  });
});

/**
 * The macOS share menu — AirDrop, Messages, Mail, Notes — for one link.
 * Resolves false where there is no such menu (Windows, Linux).
 */
ipcMain.handle("crvmgmt:share-url", (event, { url } = {}) => {
  if (process.platform !== "darwin" || typeof url !== "string" || !/^https?:\/\//.test(url)) return false;
  const win = BrowserWindow.fromWebContents(event.sender);
  new ShareMenu({ urls: [url] }).popup({ window: win ?? undefined });
  return true;
});

ipcMain.handle("crvmgmt:reveal", (_event, target) => {
  shell.showItemInFolder(target);
});
