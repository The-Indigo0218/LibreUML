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

    const parts: string[] = [];

    // Add package declaration at the very top if it exists
    if (data.package) {
      parts.push(`package ${data.package};`);
      parts.push(""); // Empty line after package
    }

    parts.push(this.buildSignature(node, allNodes, edges));
    parts.push("{");

    if (!isInterface && data.attributes && data.attributes.length > 0) {
      parts.push(this.buildAttributes(data.attributes));
    }

    if (
      !isInterface &&
      data.attributes?.length > 0 &&
      data.methods?.length > 0
    ) {
      parts.push("");
    }

    if (data.methods && data.methods.length > 0) {
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
        const type = this.formatType(attr.type) + (attr.isArray ? "[]" : "");
        return `    ${vis} ${type} ${attr.name};`;
      })
      .join("\n");
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