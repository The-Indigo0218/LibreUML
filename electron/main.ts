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

  ipcMain.on("window-minimize", () => mainWindow?.minimize());

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

ipcMain.handle("dialog:saveFile", async (_, { content, filePath, defaultName, extensions, isBinary }) => {
  const validExtensions = extensions || ['txt'];
  const extName = validExtensions[0].toUpperCase();
    const writeData = (path: string) => {
    try {
      const data = isBinary ? Buffer.from(content, 'base64') : content;
      const options = isBinary ? undefined : 'utf-8';
      
      fs.writeFileSync(path, data, options);
      return { canceled: false, filePath: path };
    } catch (e) {
      return { canceled: true, error: String(e) };
    }
  };

  if (filePath) {
    return writeData(filePath);
  }

  const { canceled, filePath: savePath } = await dialog.showSaveDialog(mainWindow!, {
    title: 'Guardar Archivo',
    defaultPath: defaultName || `untitled.${validExtensions[0]}`,
    filters: [
      { name: `${extName} File`, extensions: validExtensions }
    ]
  });

  if (canceled || !savePath) return { canceled: true };

  return writeData(savePath);
});

ipcMain.handle("dialog:openFile", async () => {
  if (!mainWindow) return { canceled: true };

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "LibreUML Files", extensions: ["luml", "json"] }],
  });

  if (canceled || filePaths.length === 0) return { canceled: true };

  const filePath = filePaths[0];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return { canceled: false, filePath, content };
  } catch (error) {
    console.error("Error leyendo archivo:", error);
    return { canceled: true, error: String(error) };
  }
});

ipcMain.handle("dialog:saveImage", async (_, { dataUrl, fileName, format }) => {
  if (!mainWindow) return { canceled: true };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: `Exportar ${format.toUpperCase()}`,
    defaultPath: `${fileName}.${format}`,
    filters: [{ name: format.toUpperCase(), extensions: [format] }],
  });

  if (canceled || !filePath) return { canceled: true };

  try {
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");

    if (format === "png") {
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(filePath, buffer);
    } else {
      if (dataUrl.includes("base64,")) {
        const buffer = Buffer.from(base64Data, "base64");
        fs.writeFileSync(filePath, buffer);
      } else {
        const svgContent = decodeURIComponent(
          dataUrl.replace(/^data:image\/svg\+xml;charset=utf-8,/, ""),
        );
        fs.writeFileSync(filePath, svgContent, "utf-8");
      }
    }

    return { canceled: false, filePath };
  } catch (error) {
    console.error("Error guardando imagen:", error);
    return { canceled: true, error: String(error) };
  }
});

ipcMain.on("window-close", () => mainWindow?.close());

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

ipcMain.handle("app:associate-files", () => {
  try {
    app.setAsDefaultProtocolClient("libreuml");
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
