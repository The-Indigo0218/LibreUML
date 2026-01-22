import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import isDev from "electron-is-dev";

let mainWindow: BrowserWindow | null = null;
let isForceClose = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "LibreUML",
    backgroundColor: "#0f172a",
    frame: false,
    titleBarStyle: "hidden",
    // -----------------------------
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  ipcMain.on("window-minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.on("window-maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  mainWindow.on("close", (e) => {
    if (isForceClose) return;
    e.preventDefault();
    mainWindow?.webContents.send("app:request-close");
  });
}

ipcMain.on("app:force-close", () => {
  isForceClose = true;
  app.quit();
});

ipcMain.handle(
  "dialog:saveFile",
  async (_, { content, filePath, defaultName }) => {
    if (!filePath) {
      const defaultFileName = defaultName
        ? `${defaultName}.luml`
        : "diagrama-sin-titulo.luml";

      const { canceled, filePath: newPath } = await dialog.showSaveDialog({
        title: "Guardar Diagrama",
        defaultPath: defaultFileName,
        filters: [{ name: "LibreUML Files", extensions: ["luml", "json"] }],
      });

      if (canceled || !newPath) return { canceled: true };

      filePath = newPath;
    }

    try {
      fs.writeFileSync(filePath, content, "utf-8");
      return { canceled: false, filePath };
    } catch (error) {
      console.error("Error guardando:", error);
      throw error;
    }
  },
);

ipcMain.on("window-close", () => {
  mainWindow?.close();
});

ipcMain.handle("file:read", async (_, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
        return { success: false, error: "File not found" };
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return { success: true, content };
  } catch (error) {
    console.error("Error reading file:", error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("dialog:openFile", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "LibreUML Files", extensions: ["luml", "json"] }],
  });

  if (canceled || filePaths.length === 0) return { canceled: true };

  const filePath = filePaths[0];
  const content = fs.readFileSync(filePath, "utf-8");

  return { canceled: false, filePath, content };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
