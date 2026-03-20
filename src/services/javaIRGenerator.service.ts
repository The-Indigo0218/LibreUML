import type {
  SemanticModel,
  IRClass,
  IRInterface,
  IREnum,
  IRAttribute,
  IROperation,
  Visibility,
} from '../core/domain/vfs/vfs.types';
import type { CodeGenerationConfig } from '../store/codeGeneration.store';

export class JavaIRGeneratorService {
  static generate(
    elementId: string,
    config: CodeGenerationConfig,
    model: SemanticModel,
  ): string {
    const cls = model.classes[elementId];
    if (cls) return this.generateClass(cls, config, model);

    const iface = model.interfaces[elementId];
    if (iface) return this.generateInterface(iface, config, model);

    const enm = model.enums[elementId];
    if (enm) return this.generateEnum(enm, config);

    return `// Element '${elementId}' not found in semantic model`;
  }

  // ─── Class ──────────────────────────────────────────────────────────────────

  private static generateClass(
    cls: IRClass,
    config: CodeGenerationConfig,
    model: SemanticModel,
  ): string {
    const lines: string[] = [];

    if (config.includePackageDeclaration && cls.packageName) {
      lines.push(`package ${cls.packageName};`);
      lines.push('');
    }

    const parent = this.resolveParent(cls.id, model);
    lines.push(this.buildClassSignature(cls, parent, model));
    lines.push('{');

    const ownAttrs = cls.attributeIds
      .map((id) => model.attributes[id])
      .filter((a): a is IRAttribute => a != null);

    if (ownAttrs.length > 0) {
      lines.push('');
      for (const attr of ownAttrs) {
        lines.push(`    private ${this.formatType(attr.type)} ${attr.name};`);
      }
    }

    const parentAttrs = parent?.attributes ?? [];

    if (config.generateEmptyConstructors) {
      lines.push('');
      lines.push(`    public ${cls.name}() {}`);
    }

    if (ownAttrs.length > 0 || parentAttrs.length > 0) {
      lines.push('');
      lines.push(...this.buildParameterizedConstructor(cls.name, ownAttrs, parentAttrs));
    }

    if (config.generateGettersSetters && ownAttrs.length > 0) {
      lines.push('');
      lines.push(...this.buildGettersSetters(ownAttrs));
    }

    const ops = cls.operationIds
      .map((id) => model.operations[id])
      .filter((o): o is IROperation => o != null);

    if (ops.length > 0) {
      lines.push('');
      lines.push(...this.buildMethods(ops, false));
    }

    if (ownAttrs.length > 0) {
      lines.push('');
      lines.push(...this.buildToString(cls.name, ownAttrs));
    }

    lines.push('}');
    return lines.join('\n');
  }

  private static resolveParent(
    classId: string,
    model: SemanticModel,
  ): { name: string; attributes: IRAttribute[] } | null {
    const rel = Object.values(model.relations).find(
      (r) => r.kind === 'GENERALIZATION' && r.sourceId === classId,
    );
    if (!rel) return null;

    const parentCls = model.classes[rel.targetId];
    if (!parentCls) return null;

    return {
      name: parentCls.name,
      attributes: parentCls.attributeIds
        .map((id) => model.attributes[id])
        .filter((a): a is IRAttribute => a != null),
    };
  }

  private static buildClassSignature(
    cls: IRClass,
    parent: { name: string } | null,
    model: SemanticModel,
  ): string {
    const abstractMod = cls.isAbstract ? 'abstract ' : '';
    let sig = `public ${abstractMod}class ${cls.name}`;

    if (parent) sig += ` extends ${parent.name}`;

    const implementedNames = Object.values(model.relations)
      .filter((r) => r.kind === 'REALIZATION' && r.sourceId === cls.id)
      .map((r) => model.interfaces[r.targetId]?.name)
      .filter((n): n is string => n != null);

    if (implementedNames.length > 0) {
      sig += ` implements ${implementedNames.join(', ')}`;
    }

    return sig;
  }

  // ─── Constructors ────────────────────────────────────────────────────────────

  private static buildParameterizedConstructor(
    className: string,
    ownAttrs: IRAttribute[],
    parentAttrs: IRAttribute[],
  ): string[] {
    const allParams = [...parentAttrs, ...ownAttrs]
      .map((a) => `${this.formatType(a.type)} ${a.name}`)
      .join(', ');

    const lines: string[] = [`    public ${className}(${allParams}) {`];

    if (parentAttrs.length > 0) {
      lines.push(`        super(${parentAttrs.map((a) => a.name).join(', ')});`);
    }

    for (const attr of ownAttrs) {
      lines.push(`        this.${attr.name} = ${attr.name};`);
    }

    lines.push('    }');
    return lines;
  }

  // ─── Accessors ───────────────────────────────────────────────────────────────

  private static buildGettersSetters(attrs: IRAttribute[]): string[] {
    const lines: string[] = [];

    for (const attr of attrs) {
      const type = this.formatType(attr.type);
      const cap = attr.name.charAt(0).toUpperCase() + attr.name.slice(1);

      lines.push(`    public ${type} get${cap}() {`);
      lines.push(`        return this.${attr.name};`);
      lines.push('    }');
      lines.push('');
      lines.push(`    public void set${cap}(${type} ${attr.name}) {`);
      lines.push(`        this.${attr.name} = ${attr.name};`);
      lines.push('    }');
      lines.push('');
    }

    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  // ─── Methods ─────────────────────────────────────────────────────────────────

  private static buildMethods(ops: IROperation[], isInterface: boolean): string[] {
    const lines: string[] = [];

    for (const op of ops) {
      const vis = this.mapVisibility(op.visibility);
      const staticMod = op.isStatic ? 'static ' : '';
      const abstractMod = !isInterface && op.isAbstract ? 'abstract ' : '';
      const returnType = this.formatType(op.returnType ?? 'void');
      const params = op.parameters
        .map((p) => `${this.formatType(p.type)} ${p.name}`)
        .join(', ');

      const sig = `    ${vis} ${abstractMod}${staticMod}${returnType} ${op.name}(${params})`;

      if (isInterface || op.isAbstract) {
        lines.push(`${sig};`);
      } else {
        const baseReturn = returnType.split('<')[0];
        let body: string;
        if (baseReturn === 'void') body = '// TODO: implement';
        else if (['int', 'long', 'double', 'float', 'short', 'byte'].includes(baseReturn)) body = 'return 0;';
        else if (baseReturn === 'boolean') body = 'return false;';
        else body = 'return null;';

        lines.push(`${sig} {`);
        lines.push(`        ${body}`);
        lines.push('    }');
      }

      lines.push('');
    }

    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  // ─── toString ────────────────────────────────────────────────────────────────

  private static buildToString(className: string, attrs: IRAttribute[]): string[] {
    const lines: string[] = ['    @Override', '    public String toString() {'];

    lines.push(`        return "${className}{" +`);

    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      const prefix = i === 0 ? '' : ', ';
      const isStringType = this.formatType(attr.type) === 'String';

      if (isStringType) {
        lines.push(`                "${prefix}${attr.name}='" + ${attr.name} + "'" +`);
      } else {
        lines.push(`                "${prefix}${attr.name}=" + ${attr.name} +`);
      }
    }

    lines.push('                "}";');
    lines.push('    }');
    return lines;
  }

  // ─── Interface ───────────────────────────────────────────────────────────────

  private static generateInterface(
    iface: IRInterface,
    config: CodeGenerationConfig,
    model: SemanticModel,
  ): string {
    const lines: string[] = [];

    if (config.includePackageDeclaration && iface.packageName) {
      lines.push(`package ${iface.packageName};`);
      lines.push('');
    }

    const superNames = Object.values(model.relations)
      .filter((r) => r.kind === 'GENERALIZATION' && r.sourceId === iface.id)
      .map((r) => model.interfaces[r.targetId]?.name)
      .filter((n): n is string => n != null);

    const extClause = superNames.length > 0 ? ` extends ${superNames.join(', ')}` : '';
    lines.push(`public interface ${iface.name}${extClause} {`);

    const ops = iface.operationIds
      .map((id) => model.operations[id])
      .filter((o): o is IROperation => o != null);

    if (ops.length > 0) {
      lines.push('');
      lines.push(...this.buildMethods(ops, true));
    }

    lines.push('}');
    return lines.join('\n');
  }

  // ─── Enum ────────────────────────────────────────────────────────────────────

  private static generateEnum(enm: IREnum, config: CodeGenerationConfig): string {
    const lines: string[] = [];

    if (config.includePackageDeclaration && enm.packageName) {
      lines.push(`package ${enm.packageName};`);
      lines.push('');
    }

    lines.push(`public enum ${enm.name} {`);

    if (enm.literals.length > 0) {
      lines.push(`    ${enm.literals.map((l) => l.name).join(', ')}`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  private static formatType(rawType: string | undefined): string {
    if (!rawType?.trim()) return 'void';
    const t = rawType.trim();
    if (t.toLowerCase() === 'string') return 'String';
    if (t.toLowerCase() === 'integer') return 'Integer';
    return t;
  }

  private static mapVisibility(vis: Visibility | undefined): string {
    if (vis === 'private') return 'private';
    if (vis === 'protected') return 'protected';
    if (vis === 'package') return '';
    return 'public';
  }
}
