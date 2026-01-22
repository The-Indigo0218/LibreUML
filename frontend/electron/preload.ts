import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: () => true,

  saveFile: (content: string, filePath?: string, defaultName?: string) =>
    ipcRenderer.invoke("dialog:saveFile", { content, filePath, defaultName }),

  openFile: () => ipcRenderer.invoke("dialog:openFile"),

  onAppRequestClose: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('app:request-close', subscription);
    return () => ipcRenderer.removeListener('app:request-close', subscription);
  },

  sendForceClose: () => ipcRenderer.send('app:force-close'),

  minimize: () => ipcRenderer.send('window-minimize'),
  toggleMaximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
readFile: (filePath: string) => ipcRenderer.invoke("file:read", filePath),
});
