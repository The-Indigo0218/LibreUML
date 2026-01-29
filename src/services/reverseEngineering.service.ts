import type { 
  UmlClassNode, 
  UmlEdge, 
  UmlRelationType
} from "../features/diagram/types/diagram.types";
import { JavaParserService } from "./javaParser.service";
import { edgeConfig } from "../config/theme.config"; 
import { MarkerType } from "reactflow";

interface ReverseEngineeringResult {
  nodes: UmlClassNode[];
  edges: UmlEdge[];
}

export class ReverseEngineeringService {

  static process(
    code: string, 
    existingNodes: UmlClassNode[], 
    existingEdges: UmlEdge[]
  ): ReverseEngineeringResult {
    
    const parsed = JavaParserService.parse(code);
    if (!parsed) {
      console.warn("No se pudo parsear el código Java.");
      return { nodes: existingNodes, edges: existingEdges };
    }

    const nodesMap = new Map<string, UmlClassNode>();
    existingNodes.forEach(n => nodesMap.set(n.id, n));
    
    const edgesMap = new Map<string, UmlEdge>();
    existingEdges.forEach(e => edgesMap.set(e.id, e));

    const classGenerics = parsed.generics 
      ? parsed.generics.replace(/[<>]/g, '').split(',').map(g => g.trim()) 
      : [];

    const mainNodeId = this.generateNodeId(parsed.name);
    const existingNode = nodesMap.get(mainNodeId);

    const position = existingNode ? existingNode.position : { 
      x: 100 + Math.random() * 50, 
      y: 100 + Math.random() * 50 
    };

    const mainNode: UmlClassNode = {
      id: mainNodeId,
      type: 'umlClass',
      position,
      width: existingNode?.width,
      height: existingNode?.height,
      data: {
        label: parsed.name,
        generics: parsed.generics,
        stereotype: parsed.stereotype,
        attributes: parsed.attributes,
        methods: parsed.methods,
        isMain: parsed.isMain
      }
    };
    nodesMap.set(mainNodeId, mainNode);

    
    // inheritance
    if (parsed.parentClass) {
      this.handleRelation(parsed.name, parsed.parentClass, 'inheritance', nodesMap, edgesMap);
    }

    //  Implementation
    if (parsed.interfaces.length > 0) {
      parsed.interfaces.forEach(interfaceName => {
        this.handleRelation(parsed.name, interfaceName, 'implementation', nodesMap, edgesMap, true);
      });
    }

    //  association
    parsed.attributes.forEach(attr => {
      if (!this.isPrimitive(attr.type)) {
        const targetName = this.extractBaseType(attr.type);
        if (classGenerics.includes(targetName)) {
           return; 
        }
        if (targetName !== parsed.name && targetName !== 'void') {
            this.handleRelation(parsed.name, targetName, 'association', nodesMap, edgesMap);
        }
      }
    });

    return {
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values())
    };
  }

  // --- Helpers ---

  private static handleRelation(
    sourceName: string,
    targetName: string,
    relationType: UmlRelationType,
    nodesMap: Map<string, UmlClassNode>,
    edgesMap: Map<string, UmlEdge>,
    isTargetInterface: boolean = false
  ) {
    const sourceId = this.generateNodeId(sourceName);
    const targetId = this.generateNodeId(targetName);

    //  Ghost Node
    if (!nodesMap.has(targetId)) {
      nodesMap.set(targetId, {
        id: targetId,
        type: 'umlClass',
        position: { x: 400 + Math.random() * 50, y: 100 + Math.random() * 50 },
        data: {
          label: targetName,
          stereotype: isTargetInterface ? 'interface' : 'class',
          attributes: [],
          methods: []
        }
      });
    }

    const edgeId = `edge-${sourceName}-${targetName}-${relationType}`.toLowerCase();
    
    if (!edgesMap.has(edgeId)) {
      const visualConfig = edgeConfig.types[relationType] || edgeConfig.types.association;
      
      let markerEnd = undefined;
      
      if (relationType === 'association' || relationType === 'dependency') {
         markerEnd = {
            type: MarkerType.Arrow,
            width: visualConfig.marker?.width || 20,
            height: visualConfig.marker?.height || 20,
            color: visualConfig.style.stroke,
         };
      }

      edgesMap.set(edgeId, {
        id: edgeId,
        source: sourceId,
        target: targetId,
        type: 'umlEdge', 
        data: {
          type: relationType,
        },
        style: {
            ...edgeConfig.base.style,
            ...visualConfig.style
        },
        markerEnd: markerEnd
      });
    }
  }

  private static generateNodeId(name: string): string {
    return `node-${name.toLowerCase()}`;
  }

  private static isPrimitive(type: string): boolean {
    const primitives = new Set([
      'String', 'int', 'Integer', 'boolean', 'Boolean', 
      'double', 'Double', 'float', 'Float', 'long', 'Long',
      'char', 'Character', 'byte', 'Byte', 'short', 'Short',
      'void', 'Object', 'Date', 'LocalDate', 'LocalDateTime', 'List', 'ArrayList'
    ]);
    const base = this.extractBaseType(type);
    return primitives.has(base);
  }

  private static extractBaseType(type: string): string {
    let clean = type.trim();
    clean = clean.replace(/\[\]/g, '');
    const genericMatch = clean.match(/<(.+)>/);
    if (genericMatch) {
      return genericMatch[1]; 
    }
    return clean;
  }
}
