import type {
  UmlClassNode,
  UmlAttribute,
  UmlMethod,
  UmlEdge, 
} from "../features/diagram/types/diagram.types";

export class JavaGeneratorService {
  static generate(
    node: UmlClassNode,
    allNodes: UmlClassNode[] = [],
    edges: UmlEdge[] = []
  ): string {
    const data = node.data;
    const isInterface = data.stereotype === "interface";
    const isEnum = data.stereotype === "enum";

    const parts: string[] = [];

    if (data.package) {
      parts.push(`package ${data.package};`);
      parts.push("");
    }

    parts.push(this.buildSignature(node, allNodes, edges));
    parts.push("{");

    if (!isInterface && !isEnum && data.attributes && data.attributes.length > 0) {
      parts.push(this.buildAttributes(data.attributes));
    }

    if (!isInterface && !isEnum && data.attributes && data.attributes.length > 0) {
      parts.push("");
      parts.push(this.buildConstructor(node, allNodes, edges));
    }

    if (!isInterface && !isEnum && data.attributes && data.attributes.length > 0) {
      parts.push("");
      parts.push(this.buildGettersAndSetters(data.attributes));
    }

    if (data.methods && data.methods.length > 0) {
      if (!isInterface && data.attributes && data.attributes.length > 0) {
        parts.push("");
      }
      parts.push(this.buildMethods(data.methods, isInterface));
    }

    parts.push("}");
    return parts.join("\n");
  }

  private static buildSignature(
    node: UmlClassNode,
    allNodes: UmlClassNode[],
    edges: UmlEdge[]
  ): string {
    const data = node.data;
    const visibility = "public";
    let type = "class";

    if (data.stereotype === "interface") type = "interface";
    else if (data.stereotype === "abstract") type = "abstract class";
    else if (data.stereotype === "enum") type = "enum";

    const genericPart = data.generics ? `${data.generics}` : "";

    let extendsClause = "";
    let implementsClause = "";

    const outgoingEdges = edges.filter((e) => e.source === node.id);

    const inheritanceEdges = outgoingEdges.filter(
      (e) => (e.data?.type || e.type) === "inheritance"
    );
    const implementationEdges = outgoingEdges.filter(
      (e) => (e.data?.type || e.type) === "implementation"
    );

    const extendsNames = inheritanceEdges
      .map((e) => allNodes.find((n) => n.id === e.target)?.data.label)
      .filter(Boolean);

    const implementsNames = implementationEdges
      .map((e) => allNodes.find((n) => n.id === e.target)?.data.label)
      .filter(Boolean);

    if (extendsNames.length > 0) {
      extendsClause = ` extends ${extendsNames.join(", ")}`;
    }
    if (implementsNames.length > 0) {
      implementsClause = ` implements ${implementsNames.join(", ")}`;
    }

    return `${visibility} ${type} ${data.label}${genericPart}${extendsClause}${implementsClause}`;
  }

  private static buildAttributes(attributes: UmlAttribute[]): string {
    return attributes
      .map((attr) => {
        const vis = this.mapVisibility(attr.visibility);
        const rawType = this.formatType(attr.type);
        const type = rawType + (attr.isArray ? "[]" : "");
        
        let initialization = "";
        
        if (this.isCollectionType(rawType)) {
          initialization = ` = ${this.getCollectionInitializer(rawType)}`;
        } else if (rawType === "String" && !attr.isArray) {
          initialization = ' = ""';
        }
        
        return `    ${vis} ${type} ${attr.name}${initialization};`;
      })
      .join("\n");
  }

  private static isCollectionType(type: string): boolean {
    const collectionTypes = [
      'List', 'ArrayList', 'LinkedList',
      'Set', 'HashSet', 'TreeSet', 'LinkedHashSet',
      'Map', 'HashMap', 'TreeMap', 'LinkedHashMap',
      'Queue', 'Deque', 'ArrayDeque',
      'Vector', 'Stack'
    ];
    
    return collectionTypes.some(collType => type.startsWith(collType));
  }

  private static getCollectionInitializer(type: string): string {
    const genericMatch = type.match(/<(.+)>/);
    const generic = genericMatch ? `<${genericMatch[1]}>` : "<>";
    
    if (type.startsWith('List')) return `new ArrayList${generic}()`;
    if (type.startsWith('Set')) return `new HashSet${generic}()`;
    if (type.startsWith('Map')) return `new HashMap${generic}()`;
    if (type.startsWith('Queue')) return `new ArrayDeque${generic}()`;
    if (type.startsWith('Deque')) return `new ArrayDeque${generic}()`;
    
    if (type.startsWith('ArrayList')) return `new ArrayList${generic}()`;
    if (type.startsWith('LinkedList')) return `new LinkedList${generic}()`;
    if (type.startsWith('HashSet')) return `new HashSet${generic}()`;
    if (type.startsWith('TreeSet')) return `new TreeSet${generic}()`;
    if (type.startsWith('LinkedHashSet')) return `new LinkedHashSet${generic}()`;
    if (type.startsWith('HashMap')) return `new HashMap${generic}()`;
    if (type.startsWith('TreeMap')) return `new TreeMap${generic}()`;
    if (type.startsWith('LinkedHashMap')) return `new LinkedHashMap${generic}()`;
    if (type.startsWith('ArrayDeque')) return `new ArrayDeque${generic}()`;
    if (type.startsWith('Vector')) return `new Vector${generic}()`;
    if (type.startsWith('Stack')) return `new Stack${generic}()`;
    
    return `new ${type}()`;
  }

  private static buildConstructor(
    node: UmlClassNode,
    allNodes: UmlClassNode[],
    edges: UmlEdge[]
  ): string {
    const className = node.data.label;
    const attributes = node.data.attributes || [];
    
    const parentAttributes = this.getParentAttributes(node, allNodes, edges);
    const allParams = this.buildConstructorParameters(parentAttributes, attributes);
    const lines: string[] = [];
    
    lines.push(`    public ${className}(${allParams.join(", ")}) {`);
    
    if (parentAttributes.length > 0) {
      const superParams = parentAttributes.map(attr => attr.name).join(", ");
      lines.push(`        super(${superParams});`);
    }
    
    attributes.forEach(attr => {
      lines.push(`        this.${attr.name} = ${attr.name};`);
    });
    
    lines.push("    }");
    
    return lines.join("\n");
  }

  private static getParentAttributes(
    node: UmlClassNode,
    allNodes: UmlClassNode[],
    edges: UmlEdge[]
  ): UmlAttribute[] {
    const inheritanceEdge = edges.find(
      (e) => e.source === node.id && (e.data?.type === "inheritance" || e.type === "inheritance")
    );
    
    if (!inheritanceEdge) return [];
    
    const parentNode = allNodes.find((n) => n.id === inheritanceEdge.target);
    return parentNode?.data.attributes || [];
  }

  private static buildConstructorParameters(
    parentAttributes: UmlAttribute[],
    ownAttributes: UmlAttribute[]
  ): string[] {
    const formatParam = (attr: UmlAttribute) => {
      const type = this.formatType(attr.type) + (attr.isArray ? "[]" : "");
      return `${type} ${attr.name}`;
    };

    return [
      ...parentAttributes.map(formatParam),
      ...ownAttributes.map(formatParam)
    ];
  }

  private static buildGettersAndSetters(attributes: UmlAttribute[]): string {
    const methods: string[] = [];
    
    attributes.forEach(attr => {
      const type = this.formatType(attr.type) + (attr.isArray ? "[]" : "");
      const capitalizedName = attr.name.charAt(0).toUpperCase() + attr.name.slice(1);
      
      methods.push(`    public ${type} get${capitalizedName}() {`);
      methods.push(`        return this.${attr.name};`);
      methods.push("    }");
      
      methods.push("");
      
      methods.push(`    public void set${capitalizedName}(${type} ${attr.name}) {`);
      methods.push(`        this.${attr.name} = ${attr.name};`);
      methods.push("    }");
    });
    
    return methods.join("\n");
  }

  private static buildMethods(
    methods: UmlMethod[],
    isInterface: boolean
  ): string {
    return methods
      .map((method) => {
        const vis = this.mapVisibility(method.visibility);
        const returnType =
          this.formatType(method.returnType) +
          (method.isReturnArray ? "[]" : "");
        const params = (method.parameters || [])
          .map((p) => {
            const paramType = this.formatType(p.type) + (p.isArray ? "[]" : "");
            return `${paramType} ${p.name}`;
          })
          .join(", ");

        const signature = `    ${vis} ${returnType} ${method.name}(${params})`;

        if (isInterface) {
          return `${signature};`;
        }

        let body = "";
        if (returnType === "void") body = "// TODO: Implement logic";
        else if (
          ["int", "double", "float", "long", "short", "byte"].includes(
            this.formatType(method.returnType) 
          ) && !method.isReturnArray 
        )
          body = "return 0;";
        else if (this.formatType(method.returnType) === "boolean" && !method.isReturnArray)
          body = "return false;";
        else body = "return null;";

        return `${signature} {\n        ${body}\n    }`;
      })
      .join("\n\n");
  }

  private static formatType(rawType: string): string {
    if (!rawType) return "void";
    const t = rawType.trim();

    if (t.toLowerCase() === "string") return "String";
    if (t.toLowerCase() === "date") return "java.util.Date";
    if (t.toLowerCase() === "boolean") return "boolean";
    if (t.toLowerCase() === "int") return "int";
    if (t.toLowerCase() === "integer") return "Integer";

    return t;
  }

  private static mapVisibility(symbol: string): string {
    switch (symbol) {
      case "+":
        return "public";
      case "-":
        return "private";
      case "#":
        return "protected";
      case "~":
        return "";
      default:
        return "public";
    }
  }
}
