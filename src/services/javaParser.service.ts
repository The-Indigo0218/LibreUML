import type {
  ClassAttribute,
  ClassMethod,
} from "../core/domain/models/nodes/class-diagram.types";
import type { Visibility } from "../core/domain/models/nodes/base.types";

export interface ParsedClass {
  name: string;
  stereotype: "class" | "abstract" | "interface" | "enum";
  parentClass: string | null;
  interfaces: string[];
  attributes: ClassAttribute[];
  methods: ClassMethod[];
  literals?: Array<{ name: string }>;
  isMain?: boolean;
  generics?: string;
  package?: string;
}

export class JavaParserService {
  /**
   * Main entry point: Parses a Java file content string into a structured object.
   */
  static parse(code: string): ParsedClass | null {
    //  Clean comments
    const cleanCode = JavaParserService.removeComments(code);

    //  Parse Package Declaration
    const packageName = JavaParserService.parsePackageDeclaration(cleanCode);

    //  Parse Class Declaration
    const classInfo = JavaParserService.parseClassDeclaration(cleanCode);
    if (!classInfo) return null;

    //  Extract Class Body
    const body = JavaParserService.extractClassBody(cleanCode);

    // Parse Members
    const attributes = JavaParserService.parseAttributes(body);
    const constructors = JavaParserService.parseConstructors(body, classInfo.name);
    const regularMethods = JavaParserService.parseMethods(body);
    const methods = [...constructors, ...regularMethods];

    const literals =
      classInfo.stereotype === "enum"
        ? JavaParserService.parseEnumLiterals(body)
        : undefined;

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
      literals,
      isMain,
      package: packageName,
    };
  }

  private static removeComments(code: string): string {
    return code.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  }

  /**
   * Extracts package declaration from Java code.
   * Handles various formats: with/without semicolon, extra spaces, etc.
   * @returns Package name or undefined if not found
   */
  private static parsePackageDeclaration(code: string): string | undefined {
    // Match: package [package.name]; or package [package.name] (without semicolon)
    // Handles extra whitespace and optional semicolon
    const packageRegex = /^\s*package\s+([\w.]+)\s*;?/m;
    const match = code.match(packageRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return undefined;
  }

  private static parseClassDeclaration(
    code: string,
  ): Omit<ParsedClass, "attributes" | "methods" | "package"> | null {
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

  private static parseAttributes(body: string): ClassAttribute[] {
    const attributes: ClassAttribute[] = [];
    // Visibility is optional — package-private fields have no modifier.
    // static/final modifiers are consumed as non-capturing groups so they
    // don't shift the type/name capture indices.
    const attrRegex =
      /(public|private|protected)?\s+(?:static\s+)?(?:final\s+)?(\w+(?:<.+>)?(?:\[\])?)\s+(\w+)\s*(?:=\s*[^;]+)?\s*;/g;

    let match;
    while ((match = attrRegex.exec(body)) !== null) {
      const [, visibilityStr, type, name] = match;
      // Skip if type or name look like Java keywords (guards against false
      // positives from matching inside method bodies).
      if (!type || !name || /^(return|if|else|while|for|new|throw|this|super|class|interface|enum)$/.test(name)) {
        continue;
      }
      attributes.push({
        id: `attr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        type: type.replace("[]", ""),
        visibility: JavaParserService.mapVisibility(visibilityStr ?? ""),
        isArray: type.includes("[]"),
      });
    }
    return attributes;
  }

  /**
   * Parses methods, handling optional visibility (package-private), static,
   * abstract, and final modifiers.
   */
  private static parseMethods(body: string): ClassMethod[] {
    const methods: ClassMethod[] = [];
    // Visibility is optional. abstract/static/final are consumed as
    // non-capturing groups so the return-type and name indices stay fixed.
    const methodRegex =
      /(public|private|protected)?\s+(?:static\s+)?(?:abstract\s+)?(?:final\s+)?(?:synchronized\s+)?(\w+(?:<.+>)?(?:\[\])?)\s+(\w+)\s*\(([^)]*)\)(?:\s*(?:throws\s+[\w,\s]+)?\s*[\{;])/g;

    let match;
    while ((match = methodRegex.exec(body)) !== null) {
      const fullMatch = match[0];
      const [, visibilityStr, returnType, name, paramsStr] = match;

      const isStatic = fullMatch.includes("static");
      const isAbstract = fullMatch.includes("abstract");

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
        visibility: JavaParserService.mapVisibility(visibilityStr ?? ""),
        isStatic,
        isAbstract,
        parameters,
      });
    }
    return methods;
  }

  /**
   * Parses enum literal constants from the enum body.
   * Enum constants appear before the first semicolon, comma-separated.
   * e.g. "ACTIVE, INACTIVE, PENDING;" → [{ name: "ACTIVE" }, ...]
   */
  private static parseEnumLiterals(body: string): Array<{ name: string }> {
    const semiIndex = body.indexOf(";");
    const constantsBlock =
      semiIndex !== -1 ? body.substring(0, semiIndex) : body;

    return constantsBlock
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((token) => ({ name: token.replace(/\s*\(.*$/, "").trim() }))
      .filter((lit) => /^\w+$/.test(lit.name));
  }

  /**
   * Parses constructors: methods with no return type whose name matches the class.
   * e.g. "public Persona(String name) {" → ClassMethod with isConstructor: true
   */
  private static parseConstructors(
    body: string,
    className: string,
  ): ClassMethod[] {
    const constructors: ClassMethod[] = [];
    const ctorRegex = new RegExp(
      `(public|private|protected)?\\s+${className}\\s*\\(([^)]*)\\)\\s*\\{`,
      "g",
    );

    let match;
    while ((match = ctorRegex.exec(body)) !== null) {
      const [, visibilityStr, paramsStr] = match;
      const parameters = paramsStr.trim()
        ? paramsStr.split(",").map((p) => {
            const parts = p.trim().split(/\s+/);
            const name = parts[parts.length - 1];
            const type = parts.slice(0, -1).join(" ");
            return { name, type };
          })
        : [];

      constructors.push({
        id: `ctor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: className,
        returnType: "",
        isReturnArray: false,
        visibility: JavaParserService.mapVisibility(visibilityStr ?? ""),
        isStatic: false,
        isConstructor: true,
        parameters,
      });
    }
    return constructors;
  }

  private static mapVisibility(javaVis: string): Visibility {
    switch (javaVis) {
      case "public":
        return "+";
      case "private":
        return "-";
      case "protected":
        return "#";
      default:
        return "~";
    }
  }
}
