import type {
  UmlAttribute,
  UmlMethod,
  visibility,
} from "../features/diagram/types/diagram.types";

export interface ParsedClass {
  name: string;
  stereotype: "class" | "abstract" | "interface" | "enum";
  parentClass: string | null;
  interfaces: string[];
  attributes: UmlAttribute[];
  methods: UmlMethod[];
  isMain?: boolean;
  generics?: string;
}

export class JavaParserService {
  /**
   * Main entry point: Parses a Java file content string into a structured object.
   */
  static parse(code: string): ParsedClass | null {
    //  Clean comments
    const cleanCode = JavaParserService.removeComments(code);

    //  Parse Class Declaration
    const classInfo = JavaParserService.parseClassDeclaration(cleanCode);
    if (!classInfo) return null;

    //  Extract Class Body
    const body = JavaParserService.extractClassBody(cleanCode);

    // Parse Members
    const attributes = JavaParserService.parseAttributes(body);
    const methods = JavaParserService.parseMethods(body);

    //  Detect Main Method (Entry Point)
    const isMain = methods.some(
      (m) =>
        m.name === "main" &&
        m.isStatic &&
        m.returnType === "void" &&
        m.parameters.length > 0 &&
        (m.parameters[0].type === "String[]" ||
          m.parameters[0].type === "String"),
    );

    return {
      ...classInfo,
      attributes,
      methods,
      isMain,
    };
  }

  private static removeComments(code: string): string {
    return code.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  }

  private static parseClassDeclaration(
    code: string,
  ): Omit<ParsedClass, "attributes" | "methods"> | null {
    const classRegex =
      /(?:public\s+)?(?:abstract\s+)?(?:final\s+)?(class|interface|enum)\s+(\w+)(<[\w\s,]+>)?(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?/;
    const match = code.match(classRegex);
    if (!match) return null;

    const [, typeStr, name, genericsStr, parentStr, interfacesStr] = match;

    let stereotype: ParsedClass["stereotype"] = "class";
    if (code.includes("abstract class")) stereotype = "abstract";
    else if (typeStr === "interface") stereotype = "interface";
    else if (typeStr === "enum") stereotype = "enum";

    const interfaces = interfacesStr
      ? interfacesStr.split(",").map((i) => i.trim())
      : [];

    return { name, stereotype, parentClass: parentStr || null, interfaces, generics: genericsStr ? genericsStr.trim() : undefined };
  }

  private static extractClassBody(code: string): string {
    const firstBrace = code.indexOf("{");
    const lastBrace = code.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return "";
    return code.substring(firstBrace + 1, lastBrace);
  }

  private static parseAttributes(body: string): UmlAttribute[] {
    const attributes: UmlAttribute[] = [];
    const attrRegex =
      /(private|protected|public)\s+(\w+(?:<.+>)?(?:\[\])?)\s+(\w+)\s*;/g;

    let match;
    while ((match = attrRegex.exec(body)) !== null) {
      const [, visibilityStr, type, name] = match;
      attributes.push({
        id: `attr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        type: type.replace("[]", ""),
        visibility: JavaParserService.mapVisibility(visibilityStr),
        isArray: type.includes("[]"),
      });
    }
    return attributes;
  }

  /**
   * Parses methods updated to handle 'static' modifier
   */
  private static parseMethods(body: string): UmlMethod[] {
    const methods: UmlMethod[] = [];
    const methodRegex =
      /(private|protected|public)\s+(?:static\s+)?(?:final\s+)?(\w+(?:<.+>)?(?:\[\])?)\s+(\w+)\s*\(([^)]*)\)(?:\s*\{|;)/g;

    let match;
    while ((match = methodRegex.exec(body)) !== null) {
      const fullMatch = match[0];
      const [, visibilityStr, returnType, name, paramsStr] = match;

      const isStatic = fullMatch.includes("static");

      const parameters = paramsStr.trim()
        ? paramsStr.split(",").map((p) => {
            const parts = p.trim().split(/\s+/);
            const paramName = parts[parts.length - 1];
            const paramType = parts.slice(0, -1).join(" ");
            return { name: paramName, type: paramType };
          })
        : [];

      methods.push({
        id: `meth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        returnType,
        visibility: JavaParserService.mapVisibility(visibilityStr),
        isStatic,
        parameters,
      });
    }
    return methods;
  }

  private static mapVisibility(javaVis: string): visibility {
    switch (javaVis) {
      case "public":
        return "+";
      case "private":
        return "-";
      case "protected":
        return "#";
      default:
        return "+";
    }
  }
}
