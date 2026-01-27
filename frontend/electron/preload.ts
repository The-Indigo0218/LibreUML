import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: () => true,

  saveFile: (
    content: string,
    filePath?: string,
    defaultName?: string,
    extensions?: string[],
    isBinary?: boolean,
  ) =>
    ipcRenderer.invoke("dialog:saveFile", {
      content,
      filePath,
      defaultName,
      extensions,
      isBinary,
    }),

  openFile: () => ipcRenderer.invoke("dialog:openFile"),

  readFile: (filePath: string) => ipcRenderer.invoke("file:read", filePath),

  minimize: () => ipcRenderer.send("window-minimize"),
  toggleMaximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),

  onAppRequestClose: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const subscription = (_: IpcRendererEvent) => callback();
    ipcRenderer.on("app:request-close", subscription);
    return () => ipcRenderer.removeListener("app:request-close", subscription);
  },

  sendForceClose: () => ipcRenderer.send("app:force-close"),

  associateFiles: () => ipcRenderer.invoke("app:associate-files"),

  saveImage: (dataUrl: string, fileName: string, format: string) =>
    ipcRenderer.invoke("dialog:saveImage", { dataUrl, fileName, format }),

  onOpenFileFromOS: (callback: (filePath: string) => void) => {
    const subscription = (_: IpcRendererEvent, filePath: string) =>
      callback(filePath);
    ipcRenderer.on("app:open-file-from-os", subscription);
    return () =>
      ipcRenderer.removeListener("app:open-file-from-os", subscription);
  },
});
