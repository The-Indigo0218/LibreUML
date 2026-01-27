export {};

interface FileOperationResult {
  canceled: boolean;
  filePath?: string;
  content?: string;
}

interface ReadFileResult {
  success: boolean;
  content?: string;
  error?: string;
}

interface AssociationResult {
  success: boolean;
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: () => boolean;

      // File operations
      saveFile: (
        content: string,
        filePath?: string,
        defaultName?: string,
        extensions?: string[],
        isBinary?: boolean,
      ) => Promise<FileOperationResult>;

      openFile: () => Promise<FileOperationResult>;
      readFile: (filePath: string) => Promise<ReadFileResult>;
      saveImage: (
        dataUrl: string,
        fileName: string,
        format: string,
      ) => Promise<FileOperationResult>;

      // Window controls
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
      onAppRequestClose: (callback: () => void) => () => void;
      sendForceClose: () => void;
      // OS integrations
      associateFiles: () => Promise<AssociationResult>;
      onOpenFileFromOS: (callback: (filePath: string) => void) => () => void;
    };
  }
}
