import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Code2, ChevronDown, AlertTriangle, CheckSquare, Square, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import { useCodeGenerationStore, LANGUAGE_OPTIONS, type TargetLanguage } from '../../../../store/codeGeneration.store';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/vfs.store';
import { useModelValidation } from '../../hooks/useModelValidation';
import { useToastStore } from '../../../../store/toast.store';
import { JavaIRGeneratorService } from '../../../../services/javaIRGenerator.service';
import type { VFSFile } from '../../../../core/domain/vfs/vfs.types';

interface CodeExportConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Helper: Check if current diagram is a Class Diagram ─────────────────────

function useCurrentDiagramType(): { isClassDiagram: boolean; diagramType: string } {
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);

  const diagramType = useMemo(() => {
    if (!activeTabId || !project) return 'UNKNOWN';
    const node = project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return 'UNKNOWN';
    return (node as VFSFile).diagramType || 'UNKNOWN';
  }, [activeTabId, project]);

  return {
    isClassDiagram: diagramType === 'CLASS_DIAGRAM',
    diagramType,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CodeExportConfigModal({ isOpen, onClose }: CodeExportConfigModalProps) {
  const { t } = useTranslation();
  const model = useModelStore((s) => s.model);
  const showToast = useToastStore((s) => s.show);
  const { errorCount, errors } = useModelValidation();

  const {
    config,
    selectedClassIds,
    setTargetLanguage,
    setGenerateGettersSetters,
    setGenerateEmptyConstructors,
    setIncludePackageDeclaration,
    setGenerateDocStubs,
    toggleClassSelection,
    selectAllClasses,
    deselectAllClasses,
  } = useCodeGenerationStore();

  const { isClassDiagram, diagramType } = useCurrentDiagramType();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ── Extract non-external classes from the semantic model ─────────────────

  const availableClasses = useMemo(() => {
    if (!model) return [];

    const classes = Object.values(model.classes)
      .filter((cls) => !cls.isExternal)
      .map((cls) => ({
        id: cls.id,
        name: cls.name,
        isAbstract: cls.isAbstract || false,
        type: 'CLASS' as const,
      }));

    const interfaces = Object.values(model.interfaces)
      .filter((iface) => !iface.isExternal)
      .map((iface) => ({
        id: iface.id,
        name: iface.name,
        isAbstract: false,
        type: 'INTERFACE' as const,
      }));

    const enums = Object.values(model.enums)
      .filter((en) => !en.isExternal)
      .map((en) => ({
        id: en.id,
        name: en.name,
        isAbstract: false,
        type: 'ENUM' as const,
      }));

    return [...classes, ...interfaces, ...enums];
  }, [model]);

  const allClassIds = useMemo(() => availableClasses.map((c) => c.id), [availableClasses]);

  // ── Auto-select all classes when modal opens ─────────────────────────────

  useEffect(() => {
    if (isOpen && availableClasses.length > 0 && selectedClassIds.size === 0) {
      selectAllClasses(allClassIds);
    }
  }, [isOpen, availableClasses.length, selectedClassIds.size, allClassIds, selectAllClasses]);

  // ── Close dropdown when clicking outside ─────────────────────────────────

  useEffect(() => {
    const handleClickOutside = () => setShowLanguageDropdown(false);
    if (showLanguageDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showLanguageDropdown]);

  if (!isOpen) return null;

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasValidationErrors = errorCount > 0;
  const selectedLanguage = LANGUAGE_OPTIONS.find((opt) => opt.value === config.targetLanguage);
  const allSelected = selectedClassIds.size === allClassIds.length && allClassIds.length > 0;
  const canExport = isClassDiagram && selectedClassIds.size > 0 && !hasValidationErrors && !isExporting;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectAll = () => {
    if (selectedClassIds.size === allClassIds.length) {
      deselectAllClasses();
    } else {
      selectAllClasses(allClassIds);
    }
  };

  const handleExport = async () => {
    if (!model || !canExport) return;

    setIsExporting(true);

    try {
      const zip = new JSZip();

      const elementsToExport = [
        ...Object.values(model.classes).filter((c) => !c.isExternal && selectedClassIds.has(c.id)),
        ...Object.values(model.interfaces).filter((i) => !i.isExternal && selectedClassIds.has(i.id)),
        ...Object.values(model.enums).filter((e) => !e.isExternal && selectedClassIds.has(e.id)),
      ];

      for (const element of elementsToExport) {
        const code = JavaIRGeneratorService.generate(element.id, config, model);
        const fileName = `${element.name}.java`;

        if (config.includePackageDeclaration && element.packageName) {
          const folderPath = element.packageName.replace(/\./g, '/');
          zip.file(`${folderPath}/${fileName}`, code);
        } else {
          zip.file(fileName, code);
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'LibreUML_Project.zip';
      anchor.click();
      URL.revokeObjectURL(url);

      showToast(t('codeExportModal.exportSuccess', 'Project exported successfully!'));
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Code2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                {t('codeExportModal.title')}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {t('codeExportModal.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Compatibility Warning ──────────────────────────────────── */}
        {!isClassDiagram && (
          <div className="mx-6 mt-4 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400 mb-1">
                {t('codeExportModal.compatibility.warning')}
              </p>
              <p className="text-xs text-text-muted">
                {t('codeExportModal.compatibility.currentDiagram', { type: diagramType })}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {t('codeExportModal.compatibility.switchToClassDiagram')}
              </p>
            </div>
          </div>
        )}

        {/* ── Validation Error Banner ────────────────────────────────── */}
        {hasValidationErrors && isClassDiagram && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400 mb-1">
                {t('codeExportModal.validationError.title', 'Cannot export: Please resolve diagram errors first.')}
              </p>
              <ul className="space-y-0.5">
                {errors.map((err, i) => (
                  <li key={i} className="text-xs text-text-muted">
                    &bull; {err}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── Content ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Language Selector */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
              {t('codeExportModal.targetLanguage')}
            </label>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLanguageDropdown(!showLanguageDropdown);
                }}
                disabled={!isClassDiagram}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface-secondary border border-surface-border rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-sm font-medium text-text-primary">
                  {selectedLanguage?.label}
                </span>
                <ChevronDown className="w-4 h-4 text-text-muted" />
              </button>

              {showLanguageDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface-secondary border border-surface-border rounded-lg shadow-xl py-1 z-50">
                  {LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        if (option.enabled) {
                          setTargetLanguage(option.value as TargetLanguage);
                          setShowLanguageDropdown(false);
                        }
                      }}
                      disabled={!option.enabled}
                      className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                        option.enabled
                          ? 'hover:bg-surface-hover text-text-primary'
                          : 'text-text-muted cursor-not-allowed'
                      } ${config.targetLanguage === option.value ? 'bg-surface-hover' : ''}`}
                    >
                      <span>{option.label}</span>
                      {option.comingSoon && (
                        <span className="text-xs text-text-muted bg-surface-primary px-2 py-0.5 rounded">
                          {t('codeExportModal.comingSoon')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Class Selector */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                {t('codeExportModal.classSelector.title')}
              </label>
              <button
                onClick={handleSelectAll}
                disabled={!isClassDiagram || availableClasses.length === 0}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {allSelected
                  ? t('codeExportModal.classSelector.deselectAll')
                  : t('codeExportModal.classSelector.selectAll')}
              </button>
            </div>

            <div className="bg-surface-secondary border border-surface-border rounded-lg p-4 max-h-64 overflow-y-auto custom-scrollbar">
              {availableClasses.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">
                  {t('codeExportModal.classSelector.noClasses')}
                </p>
              ) : (
                <div className="space-y-2">
                  {availableClasses.map((cls) => {
                    const isSelected = selectedClassIds.has(cls.id);
                    return (
                      <label
                        key={cls.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors group"
                      >
                        <div className="shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4 text-text-muted group-hover:text-text-secondary" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleClassSelection(cls.id)}
                          disabled={!isClassDiagram}
                          className="sr-only"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary">
                              {cls.name}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                cls.type === 'CLASS'
                                  ? cls.isAbstract
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'bg-blue-500/20 text-blue-400'
                                  : cls.type === 'INTERFACE'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {cls.type === 'CLASS' && cls.isAbstract ? 'Abstract' : cls.type}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedClassIds.size > 0 && (
              <p className="text-xs text-text-muted mt-2">
                {t('codeExportModal.classSelector.selectedCount', { count: selectedClassIds.size })}
              </p>
            )}
          </div>

          {/* Generation Options */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
              {t('codeExportModal.options.title')}
            </label>
            <div className="space-y-3">

              <ToggleOption
                label={t('codeExportModal.options.generateGettersSetters')}
                description={t('codeExportModal.options.generateGettersSettersDesc')}
                checked={config.generateGettersSetters}
                onChange={setGenerateGettersSetters}
                disabled={!isClassDiagram}
              />

              <ToggleOption
                label={t('codeExportModal.options.generateEmptyConstructors')}
                description={t('codeExportModal.options.generateEmptyConstructorsDesc')}
                checked={config.generateEmptyConstructors}
                onChange={setGenerateEmptyConstructors}
                disabled={!isClassDiagram}
              />

              <ToggleOption
                label={t('codeExportModal.options.includePackageDeclaration')}
                description={t('codeExportModal.options.includePackageDeclarationDesc')}
                checked={config.includePackageDeclaration}
                onChange={setIncludePackageDeclaration}
                disabled={!isClassDiagram}
              />

              <ToggleOption
                label={t('codeExportModal.options.generateDocStubs')}
                description={t('codeExportModal.options.generateDocStubsDesc')}
                checked={config.generateDocStubs}
                onChange={setGenerateDocStubs}
                disabled={!isClassDiagram}
              />

            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-surface-border flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
          >
            {t('codeExportModal.actions.cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={!canExport}
            title={
              hasValidationErrors
                ? t('codeExportModal.validationError.title', 'Cannot export: Please resolve diagram errors first.')
                : !canExport
                ? t('codeExportModal.actions.exportDisabled')
                : undefined
            }
            className="px-6 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Code2 className="w-4 h-4" />
            )}
            {isExporting
              ? t('codeExportModal.actions.exporting', 'Exporting...')
              : t('codeExportModal.actions.export')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Toggle Option Component ──────────────────────────────────────────────────

interface ToggleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

function ToggleOption({ label, description, checked, onChange, disabled }: ToggleOptionProps) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors group">
      <div className="shrink-0 pt-0.5">
        <button
          type="button"
          onClick={() => !disabled && onChange(!checked)}
          disabled={disabled}
          className={`w-11 h-6 rounded-full transition-colors relative ${
            checked ? 'bg-blue-600' : 'bg-surface-border'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div
            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary mb-0.5">{label}</div>
        <div className="text-xs text-text-muted leading-relaxed">{description}</div>
      </div>
    </label>
  );
}
