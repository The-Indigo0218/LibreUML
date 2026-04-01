import type { DomainNode } from "../core/domain/models/nodes";
import type { DomainEdge } from "../core/domain/models/edges";
import type {
  ClassAttribute,
  ClassMethod,
} from "../core/domain/models/nodes/class-diagram.types";

export class JavaGeneratorService {
  static generate(
    node: DomainNode,
    allNodes: DomainNode[] = [],
    edges: DomainEdge[] = []
  ): string {
    // Type guard: Only process class diagram nodes
    if (node.type === 'NOTE') {
      throw new Error('Cannot generate Java code from a Note node');
    }

    const isInterface = node.type === 'INTERFACE';
    const isEnum = node.type === 'ENUM';
    const className = 'name' in node ? node.name : '';

    const parts: string[] = [];

    // Access package from domain node
    const pkg = 'package' in node ? node.package : undefined;
    if (pkg) {
      parts.push(`package ${pkg};`);
      parts.push("");
    }

    parts.push(this.buildSignature(node, allNodes, edges));
    parts.push("{");

    if (isEnum) {
      // Enum body: literals first, then any explicitly-declared methods
      const literals = ('literals' in node) ? node.literals : [];
      parts.push(this.buildEnumLiterals(literals));

      const methods: ClassMethod[] = ('methods' in node) ? (node as any).methods as ClassMethod[] : [];
      if (methods.length > 0) {
        parts.push("");
        parts.push(this.buildMethods(methods, false, className));
      }
    } else {
      // Access attributes from domain node (CLASS and ABSTRACT_CLASS only)
      const attributes = ('attributes' in node) ? node.attributes : [];

      // Compute existing method names up-front for deduplication guards.
      const methods = ('methods' in node) ? node.methods : [];
      const existingMethodNames = new Set(methods.map((m) => m.name));

      if (!isInterface && attributes.length > 0) {
        parts.push(this.buildAttributes(attributes));
      }

      if (!isInterface && attributes.length > 0) {
        const ctorCode = this.buildConstructor(node, allNodes, edges, existingMethodNames);
        if (ctorCode !== null) {
          parts.push("");
          parts.push(ctorCode);
        }
      }

      if (!isInterface && attributes.length > 0) {
        const gsCode = this.buildGettersAndSetters(attributes, existingMethodNames);
        if (gsCode) {
          parts.push("");
          parts.push(gsCode);
        }
      }

      if (methods.length > 0) {
        if (!isInterface && attributes.length > 0) {
          parts.push("");
        }
        parts.push(this.buildMethods(methods, isInterface, className));
      }
    }

    parts.push("}");
    return parts.join("\n");
  }

  private static buildSignature(
    node: DomainNode,
    allNodes: DomainNode[],
    edges: DomainEdge[]
  ): string {
    const visibility = "public";
    let type = "class";

    if (node.type === 'INTERFACE') type = "interface";
    else if (node.type === 'ABSTRACT_CLASS') type = "abstract class";
    else if (node.type === 'ENUM') type = "enum";

    // Access name and generics from domain node
    const name = 'name' in node ? node.name : '';
    const genericPart = ('generics' in node && node.generics) ? `${node.generics}` : "";

    let extendsClause = "";
    let implementsClause = "";

    const outgoingEdges = edges.filter((e) => e.sourceNodeId === node.id);

    const inheritanceEdges = outgoingEdges.filter((e) => e.type === 'INHERITANCE');
    const implementationEdges = outgoingEdges.filter((e) => e.type === 'IMPLEMENTATION');

    const extendsNames = inheritanceEdges
      .map((e) => {
        const targetNode = allNodes.find((n) => n.id === e.targetNodeId);
        return targetNode && 'name' in targetNode ? targetNode.name : null;
      })
      .filter(Boolean);

    const implementsNames = implementationEdges
      .map((e) => {
        const targetNode = allNodes.find((n) => n.id === e.targetNodeId);
        return targetNode && 'name' in targetNode ? targetNode.name : null;
      })
      .filter(Boolean);

    if (extendsNames.length > 0) {
      extendsClause = ` extends ${extendsNames.join(", ")}`;
    }
    if (implementsNames.length > 0) {
      implementsClause = ` implements ${implementsNames.join(", ")}`;
    }

    return `${visibility} ${type} ${name}${genericPart}${extendsClause}${implementsClause}`;
  }

  private static buildAttributes(attributes: ClassAttribute[]): string {
    return attributes
      .map((attr) => {
        const vis = this.mapVisibility(attr.visibility);
        const staticPart = attr.isStatic ? "static " : "";
        const finalPart = attr.isReadOnly ? "final " : "";
        const rawType = this.formatType(attr.type);
        const type = rawType + (attr.isArray ? "[]" : "");

        let initialization = "";

        if (this.isCollectionType(rawType)) {
          initialization = ` = ${this.getCollectionInitializer(rawType)}`;
        } else if (rawType === "String" && !attr.isArray) {
          initialization = ' = ""';
        }

        const visPrefix = vis ? `${vis} ` : '';
        return `    ${visPrefix}${staticPart}${finalPart}${type} ${attr.name}${initialization};`;
      })
      .join("\n");
  }

  /**
   * Generates the comma-separated enum constant list.
   * e.g.:  "    ACTIVE, INACTIVE, PENDING;"
   * When no literals are defined, emits an empty block comment placeholder.
   */
  private static buildEnumLiterals(
    literals: Array<{ id: string; name: string; value?: string | number }>
  ): string {
    if (literals.length === 0) {
      return "    // TODO: Add enum constants";
    }
    return "    " + literals.map((lit) => lit.name).join(", ") + ";";
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
    node: DomainNode,
    allNodes: DomainNode[],
    edges: DomainEdge[],
    existingMethodNames: Set<string> = new Set()
  ): string | null {
    const className = 'name' in node ? node.name : '';
    // Skip auto-generating if the user already modelled a constructor.
    if (existingMethodNames.has(className)) return null;
    const attributes = ('attributes' in node) ? node.attributes : [];

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
    node: DomainNode,
    allNodes: DomainNode[],
    edges: DomainEdge[]
  ): ClassAttribute[] {
    const inheritanceEdge = edges.find(
      (e) => e.sourceNodeId === node.id && e.type === 'INHERITANCE'
    );

    if (!inheritanceEdge) return [];

    const parentNode = allNodes.find((n) => n.id === inheritanceEdge.targetNodeId);
    return (parentNode && 'attributes' in parentNode) ? parentNode.attributes : [];
  }

  private static buildConstructorParameters(
    parentAttributes: ClassAttribute[],
    ownAttributes: ClassAttribute[]
  ): string[] {
    const formatParam = (attr: ClassAttribute) => {
      const type = this.formatType(attr.type) + (attr.isArray ? "[]" : "");
      return `${type} ${attr.name}`;
    };

    return [
      ...parentAttributes.map(formatParam),
      ...ownAttributes.map(formatParam)
    ];
  }

  private static buildGettersAndSetters(
    attributes: ClassAttribute[],
    existingMethodNames: Set<string> = new Set()
  ): string {
    const methods: string[] = [];

    attributes.forEach(attr => {
      const type = this.formatType(attr.type) + (attr.isArray ? "[]" : "");
      const capitalizedName = attr.name.charAt(0).toUpperCase() + attr.name.slice(1);
      const getterName = `get${capitalizedName}`;
      const setterName = `set${capitalizedName}`;

      if (!existingMethodNames.has(getterName)) {
        methods.push(`    public ${type} ${getterName}() {`);
        methods.push(`        return this${attr.name};`);
        methods.push("    }");
        methods.push("");
      }

      if (!existingMethodNames.has(setterName)) {
        methods.push(`    public void ${setterName}(${type} ${attr.name}) {`);
        methods.push(`        this.${attr.name} = ${attr.name};`);
        methods.push("    }");
      }
    });

    // Trim trailing blank line if the last entry is an empty string.
    while (methods.length > 0 && methods[methods.length - 1] === "") {
      methods.pop();
    }

    return methods.join("\n");
  }

  private static buildMethods(
    methods: ClassMethod[],
    isInterface: boolean,
    className?: string
  ): string {
    return methods
      .map((method) => {
        const vis = this.mapVisibility(method.visibility);
        const visPrefix = vis ? `${vis} ` : '';
        const isAbstract = method.isAbstract || isInterface;
        const staticPart = method.isStatic ? "static " : "";
        const abstractPart = (method.isAbstract && !isInterface) ? "abstract " : "";

        const params = (method.parameters || [])
          .map((p) => {
            const paramType = this.formatType(p.type);
            return `${paramType} ${p.name}`;
          })
          .join(", ");

        // A constructor has no return type in Java.
        const isConstructor =
          method.isConstructor === true ||
          (!!className && method.name === className);

        if (isConstructor) {
          const signature = `    ${visPrefix}${method.name}(${params})`;
          if (isInterface) return `${signature};`;
          return `${signature} {\n        // TODO: Implement constructor\n    }`;
        }

        const returnType =
          this.formatType(method.returnType);

        const signature = `    ${visPrefix}${staticPart}${abstractPart}${returnType} ${method.name}(${params})`;

        if (isInterface) {
          return `${signature};`;
        }

        let body = "";
        const formattedReturnType = this.formatType(method.returnType);

        if (formattedReturnType === "void") {
          body = "// TODO: Implement logic";
        } else if (
          ["int", "double", "float", "long", "short", "byte"].includes(formattedReturnType)
        ) {
          body = "return 0;";
        } else if (formattedReturnType === "boolean") {
          body = "return false;";
        } else {
          body = "return null;";
        }

        if (isAbstract) {
          return `${signature};`; // Los abstractos no llevan cuerpo
        }

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
      case "+": return "public";
      case "-": return "private";
      case "#": return "protected";
      case "~": return "";        // package-private: no keyword in Java
      default: return "public";
    }
  }
}
