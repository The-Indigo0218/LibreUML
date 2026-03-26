import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, FolderPlus, ExternalLink, X, Info } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import {
  injectXmiIntoVFS,
  injectDiagramIntoVFS,
  openLumlFile,
  type OpenMode,
} from '../../../../services/openFileService';
import {
  parseLumlFile,
  loadParsedProject,
  ProjectImportError,
} from '../../../../services/projectIO.service';

export function OpenFileModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const closeModals = useUiStore((s) => s.closeModals);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingMode = useRef<OpenMode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (activeModal !== 'open-file') return null;

  const handleClose = () => {
    if (isProcessing) return;
    setError(null);
    closeModals();
  };

  const handleModeSelect = (mode: OpenMode) => {
    pendingMode.current = mode;
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingMode.current) {
      e.target.value = '';
      return;
    }

    const mode = pendingMode.current;
    const nameLower = file.name.toLowerCase();

    setIsProcessing(true);
    setError(null);

    try {
      if (nameLower.endsWith('.luml.zip')) {
        // ── Full workspace project archive ─────────────────────────────────
        // Validate that the content really is a project, not a misnamed file.
        const result = await parseLumlFile(file);
        if (result.exportType !== 'project') {
          setError(
            'This file is a diagram (.luml), not a workspace project. ' +
            'Open it with a .luml extension instead.',
          );
          return;
        }
        loadParsedProject(result.project, result.model);
        closeModals();

      } else if (nameLower.endsWith('.luml')) {
        // ── Single diagram file ────────────────────────────────────────────
        // Validate that the content is a diagram, not a project archive.
        const result = await parseLumlFile(file);
        if (result.exportType === 'project') {
          setError(
            'This file is a full workspace project. ' +
            'Projects are saved as .luml.zip — rename this file or open it from the Welcome Screen.',
          );
          return;
        }
        await injectDiagramIntoVFS(result.view, result.partialModel, result.name, mode);
        closeModals();

      } else if (
        nameLower.endsWith('.xmi') ||
        nameLower.endsWith('.xml') ||
        nameLower.endsWith('.xmin')
      ) {
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            try {
              const content = ev.target?.result as string;
              const baseName = file.name.replace(/\.[^/.]+$/, '');
              await injectXmiIntoVFS(content, baseName, mode);
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file.'));
          reader.readAsText(file);
        });
        closeModals();

      } else {
        setError(
          'Unsupported file type. Supported formats: ' +
          '.luml (diagram), .luml.zip (project), .xmi',
        );
      }
    } catch (err) {
      const msg =
        err instanceof ProjectImportError || err instanceof Error
          ? err.message
          : 'An unexpected error occurred while opening the file.';
      setError(msg);
    } finally {
      e.target.value = '';
      setIsProcessing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 animate-in fade-in zoom-in-95 duration-150">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 shrink-0">
              <FolderOpen className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Open File
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                <span className="font-mono text-indigo-400">.luml</span>{' '}
                diagram ·{' '}
                <span className="font-mono text-indigo-400">.luml.zip</span>{' '}
                project ·{' '}
                <span className="font-mono text-indigo-400">.xmi</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Choice question ───────────────────────────────────────────── */}
        <p className="text-sm text-text-secondary mb-4">
          How would you like to open this file?
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Add to Project */}
          <button
            onClick={() => handleModeSelect('project')}
            disabled={isProcessing}
            className="group flex flex-col items-start gap-2.5 p-4 rounded-lg border border-surface-border bg-surface-secondary hover:bg-surface-hover hover:border-emerald-500/40 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/15 transition-colors">
              <FolderPlus className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary leading-tight">
                Add to Project
              </p>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Nest inside the current project workspace
              </p>
            </div>
          </button>

          {/* Open Standalone */}
          <button
            onClick={() => handleModeSelect('standalone')}
            disabled={isProcessing}
            className="group flex flex-col items-start gap-2.5 p-4 rounded-lg border border-surface-border bg-surface-secondary hover:bg-surface-hover hover:border-blue-500/40 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/15 transition-colors">
              <ExternalLink className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary leading-tight">
                Open Standalone
              </p>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Open as a separate external file
              </p>
            </div>
          </button>
        </div>

        {/* ── format note ──────────────────────────────────────────────── */}
        <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-text-muted leading-relaxed">
            <span className="font-mono text-amber-400">.luml</span>{' '}
            {t('openFileModal.lumlFileNote')}{' '}
            <span className="font-mono text-amber-400">.luml.zip</span>{' '}
            {t('openFileModal.lumlZipNote')}
          </p>
        </div>

        {/* ── Error ────────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 leading-relaxed">
            {error}
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-secondary hover:bg-surface-border rounded-lg transition-colors disabled:opacity-50"
          >
            {isProcessing ? 'Opening…' : 'Cancel'}
          </button>
        </div>

        {/* ── Hidden unified file input ─────────────────────────────────── */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelected}
          accept=".luml,.luml.zip,.xmi,.xml,.xmin"
          className="hidden"
          aria-hidden="true"
        />
      </div>
    </div>,
    document.body,
  );
}
