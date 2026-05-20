// src/features/cloud/services/vfsSnapshot.ts
//
// Shared serialiser used by both cloudSync.service and autoSaveQueue so the
// metadata payload sent on the first attempt matches the payload sent on
// retry. Strips `content`/`localModel` from VFSFile nodes (those travel in
// the diagrams table) and `semanticModel` from the top-level project (that
// travels in the model table).

import type { LibreUMLProject, VFSFile } from '../../../core/domain/vfs/vfs.types';

export function buildVfsSnapshot(project: LibreUMLProject): Record<string, unknown> {
  const nodes: Record<string, unknown> = {};
  for (const [id, node] of Object.entries(project.nodes)) {
    if (node.type === 'FILE') {
      const { content, localModel, ...meta } = node as VFSFile;
      void content;
      void localModel;
      nodes[id] = meta;
    } else {
      nodes[id] = node;
    }
  }
  const { nodes: _nodes, semanticModel: _model, ...projectMeta } = project;
  void _nodes;
  void _model;
  return { ...projectMeta, nodes };
}
