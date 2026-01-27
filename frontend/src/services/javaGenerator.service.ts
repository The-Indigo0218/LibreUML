import type { UmlClassNode, UmlClassData, UmlAttribute, UmlMethod } from "../features/diagram/types/diagram.types";

export class JavaGeneratorService {
  
  static generate(node: UmlClassNode): string {
    const data = node.data;
    const isInterface = data.stereotype === 'interface';
    
    const parts: string[] = [];

    // 1. Signature
    parts.push(this.buildSignature(data));
    parts.push("{");

    // 2. Attributes
    if (!isInterface && data.attributes && data.attributes.length > 0) {
      parts.push(this.buildAttributes(data.attributes));
    }

    if (!isInterface && data.attributes?.length > 0 && data.methods?.length > 0) {
        parts.push("");
    }

    // 3. Methods
    if (data.methods && data.methods.length > 0) {
      parts.push(this.buildMethods(data.methods, isInterface));
    }

    parts.push("}");
    return parts.join("\n");
  }

  private static buildSignature(data: UmlClassData): string {
    const visibility = "public"; 
    let type = "class";
    
    if (data.stereotype === 'interface') type = "interface";
    else if (data.stereotype === 'abstract') type = "abstract class";
    
    return `${visibility} ${type} ${data.label}`;
  }

  private static buildAttributes(attributes: UmlAttribute[]): string {
    return attributes.map(attr => {
      const vis = this.mapVisibility(attr.visibility);
      // AQUI EL CAMBIO: Usamos formatType
      const type = this.formatType(attr.type) + (attr.isArray ? "[]" : "");
      return `    ${vis} ${type} ${attr.name};`;
    }).join("\n");
  }

  private static buildMethods(methods: UmlMethod[], isInterface: boolean): string {
    return methods.map(method => {
      const vis = this.mapVisibility(method.visibility);
      // AQUI EL CAMBIO: Usamos formatType en retorno y parámetros
      const returnType = this.formatType(method.returnType);
      
      const params = (method.parameters || [])
        .map(p => `${this.formatType(p.type)} ${p.name}`)
        .join(", ");
        
      const signature = `    ${vis} ${returnType} ${method.name}(${params})`;
      
      if (isInterface) {
         return `${signature};`;
      }
      
      // Cuerpos por defecto inteligentes
      let body = "";
      if (returnType === "void") body = "// TODO: Implement logic";
      else if (["int", "double", "float", "long", "short", "byte"].includes(returnType)) body = "return 0;";
      else if (returnType === "boolean") body = "return false;";
      else body = "return null;";
      
      return `${signature} {\n        ${body}\n    }`;
    }).join("\n\n");
  }

  private static formatType(rawType: string): string {
    if (!rawType) return "void";
    const t = rawType.trim();
    
    if (t.toLowerCase() === 'string') return 'String';
    if (t.toLowerCase() === 'date') return 'java.util.Date'; 
    if (t.toLowerCase() === 'boolean') return 'boolean';
    if (t.toLowerCase() === 'int') return 'int';
    if (t.toLowerCase() === 'integer') return 'Integer';
    
    return t; 
  }

  private static mapVisibility(symbol: string): string {
    switch (symbol) {
      case "+": return "public";
      case "-": return "private";
      case "#": return "protected";
      case "~": return ""; 
      default: return "public";
    }
  }
}