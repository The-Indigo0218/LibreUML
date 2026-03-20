import type { DiagramType } from '../domain/workspace/diagram-file.types';

/**
 * Tool definition for sidebar/toolbar
 */
export interface ToolDefinition {
  id: string;
  type: 'NODE' | 'EDGE' | 'ACTION';
  label: string;
  icon?: string;
  category?: string;
  
  // For node tools
  nodeType?: string;
  
  // For edge tools
  edgeType?: string;
  
  // For action tools
  action?: () => void;
  
  // Metadata
  tooltip?: string;
  shortcut?: string;
  color?: string;
}

/**
 * Tool registry for a diagram type
 */
export interface ToolRegistry {
  diagramType: DiagramType;
  tools: ToolDefinition[];
}
