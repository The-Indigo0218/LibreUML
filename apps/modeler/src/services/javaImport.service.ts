import { JavaParserService } from "./javaParser.service";
import { useModelStore } from "../store/model.store";
import { useProjectStore } from "../store/project.store";
import { useWorkspaceStore } from "../store/workspace.store";
import { useVFSStore } from "../store/project-vfs.store";
import type { DomainNode } from "../core/domain/models/nodes";
import type { IRAttribute, IROperation, DiagramView, ViewNode, VFSFile } from "../core/domain/vfs/vfs.types";
import { isDiagramView } from "../features/diagram/hooks/useVFSCanvasController";

export type JavaImportTarget = 'model' | 'canvas' | 'both';

interface JavaImportOptions {
  code: string;
  target: JavaImportTarget;
  position?: { x: number; y: number };
}

interface JavaImportResult {
  success: boolean;
  error?: string;
  nodeId?: string;
  elementId?: string;
}

export class JavaImportService {
  /**
   * Import Java code to the specified target (model, canvas, or both)
   */
  static import(options: JavaImportOptions): JavaImportResult {
    const { code, target, position } = options;

    try {
      const parsed = JavaParserService.parse(code);
      if (!parsed) {
        return { success: false, error: "Failed to parse Java code. Check syntax." };
      }

      const symToVis = (sym: string): 'public' | 'private' | 'protected' | 'package' => {
        switch (sym) {
          case '+': return 'public';
          case '-': return 'private';
          case '#': return 'protected';
          default:  return 'package';
        }
      };

      let elementId: string | undefined;
      let nodeId: string | undefined;

      // Import to model (SSOT)
      if (target === 'model' || target === 'both') {
        const modelStore = useModelStore.getState();
        
        if (modelStore.model) {
          if (parsed.stereotype === 'enum') {
            elementId = modelStore.createEnum({
              name: parsed.name,
              literals: (parsed.literals ?? []).map((l) => ({ name: l.name })),
              packageName: parsed.package,
            });
          } else if (parsed.stereotype === 'interface') {
            const ifaceId = modelStore.createInterface({
              name: parsed.name,
              operationIds: [],
              packageName: parsed.package,
            });
            const ops: IROperation[] = parsed.methods.map((m) => ({
              id: m.id,
              name: m.name,
              kind: 'OPERATION' as const,
              visibility: symToVis(m.visibility),
              isStatic: m.isStatic,
              isAbstract: m.isAbstract,
              returnType: m.returnType || 'void',
              parameters: (m.parameters || []).map((p) => ({ name: p.name, type: p.type })),
            }));
            modelStore.setElementMembers(ifaceId, [], ops);
            elementId = ifaceId;
          } else {
            const classId =
              parsed.stereotype === 'abstract'
                ? modelStore.createAbstractClass({ 
                    name: parsed.name, 
                    attributeIds: [], 
                    operationIds: [], 
                    packageName: parsed.package 
                  })
                : modelStore.createClass({ 
                    name: parsed.name, 
                    attributeIds: [], 
                    operationIds: [], 
                    packageName: parsed.package 
                  });

            const attrs: IRAttribute[] = parsed.attributes.map((a) => ({
              id: a.id,
              name: a.name,
              kind: 'ATTRIBUTE' as const,
              visibility: symToVis(a.visibility),
              isStatic: a.isStatic,
              type: a.type,
              multiplicity: a.isArray ? '0..*' : undefined,
              defaultValue: a.defaultValue,
            }));
            const ops: IROperation[] = parsed.methods.map((m) => ({
              id: m.id,
              name: m.name,
              kind: 'OPERATION' as const,
              visibility: symToVis(m.visibility),
              isStatic: m.isStatic,
              isAbstract: m.isAbstract,
              returnType: m.returnType || 'void',
              parameters: (m.parameters || []).map((p) => ({ name: p.name, type: p.type })),
            }));
            modelStore.setElementMembers(classId, attrs, ops);
            elementId = classId;
          }
        }
      }

      // Import to canvas (legacy project store for backward compatibility)
      if (target === 'canvas' || target === 'both') {
        const now = Date.now();
        nodeId = crypto.randomUUID();
        const addProjectNode = useProjectStore.getState().addNode;

        let domainNode: DomainNode;
        if (parsed.stereotype === 'enum') {
          domainNode = {
            id: nodeId,
            type: 'ENUM',
            name: parsed.name,
            literals: (parsed.literals ?? []).map((l, i) => ({ id: `lit-${i}`, name: l.name })),
            package: parsed.package,
            createdAt: now,
            updatedAt: now,
          } as DomainNode;
        } else if (parsed.stereotype === 'interface') {
          domainNode = {
            id: nodeId,
            type: 'INTERFACE',
            name: parsed.name,
            methods: parsed.methods,
            generics: parsed.generics,
            package: parsed.package,
            createdAt: now,
            updatedAt: now,
          } as DomainNode;
        } else {
          domainNode = {
            id: nodeId,
            type: parsed.stereotype === 'abstract' ? 'ABSTRACT_CLASS' : 'CLASS',
            name: parsed.name,
            attributes: parsed.attributes,
            methods: parsed.methods,
            generics: parsed.generics,
            package: parsed.package,
            isMain: parsed.isMain,
            createdAt: now,
            updatedAt: now,
          } as DomainNode;
        }
        addProjectNode(domainNode);

        // Add to active file if available
        const getActiveFile = useWorkspaceStore.getState().getActiveFile;
        const addNodeToFile = useWorkspaceStore.getState().addNodeToFile;
        const updateFile = useWorkspaceStore.getState().updateFile;
        
        const activeFile = getActiveFile();
        if (activeFile) {
          addNodeToFile(activeFile.id, nodeId);
          const existingPositionMap =
            (activeFile.metadata as Record<string, unknown> | undefined)?.positionMap as
              | Record<string, { x: number; y: number }>
              | undefined ?? {};
          
          const finalPosition = position || { 
            x: 100 + Math.random() * 50, 
            y: 100 + Math.random() * 50 
          };
          
          updateFile(activeFile.id, {
            metadata: {
              ...activeFile.metadata,
              positionMap: {
                ...existingPositionMap,
                [nodeId]: finalPosition,
              },
            } as typeof activeFile.metadata,
          });
        }
      }

      // If importing to both and we have an elementId, also add ViewNode to canvas
      if (target === 'both' && elementId) {
        this.addViewNodeToCanvas(elementId, position);
      }

      return { 
        success: true, 
        nodeId, 
        elementId 
      };
    } catch (err) {
      console.error('[JavaImportService] Import failed:', err);
      return { 
        success: false, 
        error: "Failed to parse Java code. Check syntax." 
      };
    }
  }

  /**
   * Add a ViewNode to the current canvas (VFS)
   */
  private static addViewNodeToCanvas(elementId: string, position?: { x: number; y: number }): void {
    const activeTabId = useWorkspaceStore.getState().activeTabId;
    if (!activeTabId) return;

    const updateFileContent = useVFSStore.getState().updateFileContent;
    const freshProject = useVFSStore.getState().project;
    if (!freshProject) return;

    const freshFileNode = freshProject.nodes[activeTabId];
    if (!freshFileNode || freshFileNode.type !== 'FILE') return;

    const freshContent = (freshFileNode as VFSFile).content;
    if (!isDiagramView(freshContent)) return;

    const freshView = freshContent as DiagramView;

    const finalPosition = position || { 
      x: 100 + Math.random() * 50, 
      y: 100 + Math.random() * 50 
    };

    const viewNode: ViewNode = {
      id: crypto.randomUUID(),
      elementId: elementId,
      x: finalPosition.x,
      y: finalPosition.y,
    };

    const updatedView: DiagramView = {
      ...freshView,
      nodes: [...freshView.nodes, viewNode],
    };

    updateFileContent(activeTabId, updatedView);
  }
}
