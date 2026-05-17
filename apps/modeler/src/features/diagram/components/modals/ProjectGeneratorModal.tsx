import { useState, useEffect, useMemo } from "react";
import { Package, Download, Box, Hammer, Coffee } from "lucide-react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useModelStore } from "../../../../store/model.store";
import { useCodeGenerationStore } from "../../../../store/codeGeneration.store";
import { ProjectZipperService } from "../../../../services/project-zipper.service";
import { isDiagramView } from "../../hooks/useVFSCanvasController";
import type { VFSFile } from "../../../../core/domain/vfs/vfs.types";
import { useTranslation } from "react-i18next";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectGeneratorModal({ isOpen, onClose }: Props) {
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const globalModel = useModelStore((s) => s.model);
  const codeConfig = useCodeGenerationStore((s) => s.config);

  const { vfsFile, model } = useMemo(() => {
    if (!activeTabId || !project) return { vfsFile: null, model: null };
    const node = project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return { vfsFile: null, model: null };
    const file = node as VFSFile;
    return { vfsFile: file, model: file.localModel ?? globalModel };
  }, [activeTabId, project, globalModel]);

  const diagramName = useMemo(() => {
    if (!activeTabId || !project) return 'Untitled';
    return project.nodes[activeTabId]?.name ?? 'Untitled';
  }, [activeTabId, project]);

  const elementIds = useMemo(() => {
    if (!vfsFile || !isDiagramView(vfsFile.content) || !model) return [];
    return vfsFile.content.nodes
      .map((vn) => vn.elementId)
      .filter((id) => model.classes[id] || model.interfaces[id] || model.enums[id]);
  }, [vfsFile, model]);
  
  const { t } = useTranslation();
  
  // --- State  ---
  const [groupId, setGroupId] = useState("com.example");
  const [artifactId, setArtifactId] = useState(""); 
  const [javaVersion, setJavaVersion] = useState("17"); 
  const [buildTool, setBuildTool] = useState<"maven" | "gradle">("maven"); 
  
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cleanName = diagramName.toLowerCase().replace(/[^a-z0-9]/g, "");
      setArtifactId(cleanName || "myproject");
    }
  }, [isOpen, diagramName]);

  const packageName = `${groupId}.${artifactId}`.replace(/\.\./g, ".").toLowerCase();

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!model) return;
    setIsGenerating(true);
    try {
      await ProjectZipperService.generateAndDownloadZipFromModel({
        projectName: artifactId,
        groupId,
        artifactId,
        packageName,
        elementIds,
        model,
        codeConfig,
        javaVersion,
        buildTool,
      });
      onClose();
    } catch (error) {
      console.error(error);
      alert("Error generating project");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-137.5 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border bg-surface-secondary/50 flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-text-primary">{t("modals.projectGenerator.title")}</h3>
            <p className="text-xs text-text-muted">{t("modals.projectGenerator.subtitle")}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Stats Bar */}
          <div className="flex items-center justify-between p-3 bg-surface-secondary/30 rounded-lg border border-surface-border">
             <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Box className="w-4 h-4 text-purple-400" />
                <span className="font-mono">{elementIds.length} {t("modals.projectGenerator.statsClasses")}</span>
             </div>
             <div className="w-px h-4 bg-surface-border" />
             <div className="flex items-center gap-2 text-sm text-text-secondary">
                 <span className="text-xs text-text-muted">{t("modals.projectGenerator.statsPackage")}:</span>
                 <span className="font-mono text-purple-300">{packageName}</span>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             {/* Left Col: Identifiers */}
             <div className="space-y-4">
                 <div className="space-y-1">
                   <label className="text-xs font-bold text-text-secondary uppercase">{t("modals.projectGenerator.groupId")}</label>
                   <input 
                     className="w-full bg-surface-secondary border border-surface-border rounded p-2 text-sm font-mono text-text-primary focus:border-purple-500 outline-none transition-colors"
                     value={groupId}
                     onChange={e => setGroupId(e.target.value)}
                     placeholder="com.example"
                   />
                 </div>
                 
                 <div className="space-y-1">
                   <label className="text-xs font-bold text-text-secondary uppercase">{t("modals.projectGenerator.artifactId")}</label>
                   <input 
                     className="w-full bg-surface-secondary border border-surface-border rounded p-2 text-sm font-mono text-text-primary focus:border-purple-500 outline-none transition-colors"
                     value={artifactId}
                     onChange={e => setArtifactId(e.target.value)}
                     placeholder="myapp"
                   />
                 </div>
             </div>

             {/* Right Col: Tech Stack */}
             <div className="space-y-4">
                {/* Build Tool Selector */}
                <div className="space-y-1">
                   <label className="text-xs font-bold text-text-secondary uppercase flex items-center gap-1">
                      <Hammer className="w-3 h-3" /> {t("modals.projectGenerator.buildSystem")}
                   </label>
                   <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setBuildTool("maven")}
                        className={`text-xs py-2 rounded border transition-all ${buildTool === 'maven' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-surface-secondary border-surface-border text-text-muted hover:border-text-secondary'}`}
                      >
                        Maven
                      </button>
                      <button
                        onClick={() => setBuildTool("gradle")}
                        className={`text-xs py-2 rounded border transition-all ${buildTool === 'gradle' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-surface-secondary border-surface-border text-text-muted hover:border-text-secondary'}`}
                      >
                        Gradle
                      </button>
                   </div>
                </div>

                {/* Java Version Selector */}
                <div className="space-y-1">
                   <label className="text-xs font-bold text-text-secondary uppercase flex items-center gap-1">
                      <Coffee className="w-3 h-3" /> {t("modals.projectGenerator.javaVersion")}
                   </label>
                   <select
                     value={javaVersion}
                     onChange={(e) => setJavaVersion(e.target.value)}
                     className="w-full bg-surface-secondary border border-surface-border rounded p-2 text-sm font-mono text-text-primary focus:border-purple-500 outline-none"
                   >
                     <option value="21">{t('projectGenerator.javaVersions.java21')}</option>
                     <option value="17">{t('projectGenerator.javaVersions.java17')}</option>
                     <option value="11">{t('projectGenerator.javaVersions.java11')}</option>
                     <option value="8">{t('projectGenerator.javaVersions.java8')}</option>
                   </select>
                </div>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-border bg-surface-secondary/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
            {t("modals.common.cancel")}
          </button>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-500 font-medium shadow-md active:scale-95 transition-all disabled:opacity-50"
          >
            {isGenerating ? t("modals.projectGenerator.zipping") : (
               <>
                 <Download className="w-4 h-4" /> {t("modals.projectGenerator.download")}
               </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}