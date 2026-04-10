import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TargetLanguage = 'java' | 'csharp' | 'python' | 'typescript';

export interface CodeGenerationConfig {
  targetLanguage: TargetLanguage;
  generateGettersSetters: boolean;
  generateEmptyConstructors: boolean;
  includePackageDeclaration: boolean;
  generateDocStubs: boolean;
}

export interface LanguageOption {
  value: TargetLanguage;
  label: string;
  enabled: boolean;
  comingSoon?: boolean;
}

interface CodeGenerationState {
  config: CodeGenerationConfig;
  selectedClassIds: Set<string>;
  setTargetLanguage: (language: TargetLanguage) => void;
  setGenerateGettersSetters: (value: boolean) => void;
  setGenerateEmptyConstructors: (value: boolean) => void;
  setIncludePackageDeclaration: (value: boolean) => void;
  setGenerateDocStubs: (value: boolean) => void;
  
  toggleClassSelection: (classId: string) => void;
  selectAllClasses: (classIds: string[]) => void;
  deselectAllClasses: () => void;
  setSelectedClasses: (classIds: string[]) => void;
  
  resetToDefaults: () => void;
}

const DEFAULT_CONFIG: CodeGenerationConfig = {
  targetLanguage: 'java',
  generateGettersSetters: true,
  generateEmptyConstructors: true,
  includePackageDeclaration: true,
  generateDocStubs: false,
};

export const useCodeGenerationStore = create<CodeGenerationState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      selectedClassIds: new Set<string>(),

      setTargetLanguage: (language) =>
        set((state) => ({
          config: { ...state.config, targetLanguage: language },
        })),

      setGenerateGettersSetters: (value) =>
        set((state) => ({
          config: { ...state.config, generateGettersSetters: value },
        })),

      setGenerateEmptyConstructors: (value) =>
        set((state) => ({
          config: { ...state.config, generateEmptyConstructors: value },
        })),

      setIncludePackageDeclaration: (value) =>
        set((state) => ({
          config: { ...state.config, includePackageDeclaration: value },
        })),

      setGenerateDocStubs: (value) =>
        set((state) => ({
          config: { ...state.config, generateDocStubs: value },
        })),

      toggleClassSelection: (classId) =>
        set((state) => {
          const newSet = new Set(state.selectedClassIds);
          if (newSet.has(classId)) {
            newSet.delete(classId);
          } else {
            newSet.add(classId);
          }
          return { selectedClassIds: newSet };
        }),

      selectAllClasses: (classIds) =>
        set(() => ({
          selectedClassIds: new Set(classIds),
        })),

      deselectAllClasses: () =>
        set(() => ({
          selectedClassIds: new Set<string>(),
        })),

      setSelectedClasses: (classIds) =>
        set(() => ({
          selectedClassIds: new Set(classIds),
        })),

      resetToDefaults: () =>
        set(() => ({
          config: DEFAULT_CONFIG,
          selectedClassIds: new Set<string>(),
        })),
    }),
    {
      name: 'libreuml-code-generation',
      partialize: (state) => ({
        config: state.config,
        // Don't persist selectedClassIds as they're diagram-specific
      }),
    }
  )
);

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'java', label: 'Java', enabled: true },
  { value: 'csharp', label: 'C#', enabled: false, comingSoon: true },
  { value: 'python', label: 'Python', enabled: false, comingSoon: true },
  { value: 'typescript', label: 'TypeScript', enabled: false, comingSoon: true },
];
