// src/features/cloud/services/reconstructProject.ts
//
// Pure reconstruction of a LibreUMLProject from the cloud `/full` payload.
// Extracted from CloudDiagramPicker so the cloud round-trip (vfsSnapshot upload
// → diagram viewData → reconstruction, including `_localModel` extraction for
// standalone diagrams) can be unit-tested without rendering the modal.

import type { ProjectFullResponse, ProjectDiagramType } from '../../../api/types';
import type { LibreUMLProject, SemanticModel, VFSFile, DiagramType } from '../../../core/domain/vfs/vfs.types';

export function fromApiDiagramType(apiType: ProjectDiagramType): DiagramType {
  const map: Record<ProjectDiagramType, DiagramType> = {
    CLASS:      'CLASS_DIAGRAM',
    USE_CASE:   'USE_CASE_DIAGRAM',
    DOMAIN:     'DOMAIN_MODEL_DIAGRAM',
    SEQUENCE:   'SEQUENCE_DIAGRAM',
    ACTIVITY:   'ACTIVITY_DIAGRAM',
    STATE:      'STATE_MACHINE_DIAGRAM',
    COMPONENT:  'COMPONENT_DIAGRAM',
    DEPLOYMENT: 'DEPLOYMENT_DIAGRAM',
    PACKAGE:    'PACKAGE_DIAGRAM',
    OBJECT:     'OBJECT_DIAGRAM',
    ER:         'ER_DIAGRAM',
    UNSPECIFIED:'UNSPECIFIED',
  };
  return map[apiType] ?? 'UNSPECIFIED';
}

/** Rebuild the local project tree from the cloud `/full` response. */
export function reconstructProject(full: ProjectFullResponse): LibreUMLProject | null {
  const { project, diagrams } = full;

  // Use vfsSnapshot if the backend provides it (preferred)
  if (project.vfsSnapshot) {
    const snapshotProject = project.vfsSnapshot as Partial<LibreUMLProject>;

    // Merge viewData from each diagram into the corresponding VFSFile.content
    const nodes: Record<string, LibreUMLProject['nodes'][string]> = {
      ...(snapshotProject.nodes as Record<string, LibreUMLProject['nodes'][string]> ?? {}),
    };
    for (const diag of diagrams) {
      if (diag.path && nodes[diag.path]?.type === 'FILE') {
        const file = nodes[diag.path] as VFSFile;
        const { _localModel, ...diagramContent } = (diag.viewData ?? {}) as Record<string, unknown>;
        nodes[diag.path] = {
          ...file,
          content: diagramContent,
          ...(file.standalone && _localModel ? { localModel: _localModel as SemanticModel } : {}),
        };
      }
    }

    return {
      id:            project.id,
      projectName:   project.name,
      description:   project.description,
      author:        project.author,
      version:       project.projectVersion,
      targetLanguage: project.targetLanguage,
      basePackage:   project.basePackage,
      domainModelId: (snapshotProject.domainModelId as string | undefined) ?? project.id,
      nodes,
      createdAt:     new Date(project.createdAt).getTime(),
      updatedAt:     new Date(project.updatedAt).getTime(),
    };
  }

  // Fallback: build a flat VFS structure from diagram list (no folder nesting)
  const nodes: Record<string, LibreUMLProject['nodes'][string]> = {};
  for (const diag of diagrams) {
    const vfsId = diag.path || diag.id;
    nodes[vfsId] = {
      id:          vfsId,
      name:        diag.name,
      type:        'FILE',
      parentId:    null,
      diagramType: fromApiDiagramType(diag.diagramType),
      extension:   '.luml',
      isExternal:  false,
      content:     diag.viewData,
      createdAt:   new Date(diag.createdAt).getTime(),
      updatedAt:   new Date(diag.updatedAt).getTime(),
    } satisfies VFSFile;
  }

  return {
    id:            project.id,
    projectName:   project.name,
    description:   project.description,
    author:        project.author,
    version:       project.projectVersion,
    targetLanguage: project.targetLanguage,
    basePackage:   project.basePackage,
    domainModelId: project.id,
    nodes,
    createdAt:     new Date(project.createdAt).getTime(),
    updatedAt:     new Date(project.updatedAt).getTime(),
  };
}
