/// <reference types="vite/client" />

interface ElectronAPI {
  isElectron: () => boolean;
  saveFile: (content: string, filePath?: string, defaultName?: string) => Promise<{ canceled: boolean; filePath?: string }>;
  openFile: () => Promise<{ canceled: boolean; filePath?: string; content?: string }>;
  onAppRequestClose: (callback: () => void) => () => void;
  sendForceClose: () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}