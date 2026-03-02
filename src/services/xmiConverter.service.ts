import type {
  UmlClassNode,
  UmlEdge,
  UmlAttribute,
  UmlMethod,
} from "../features/diagram/types/diagram.types";

/**
 * Service responsible for serializing LibreUML diagram state into a
 * strict, interoperable XMI 2.1 document (UML 2.5.1 / Eclipse UML2).
 *
 * Standards compliance:
 *  - OMG XMI 2.1  (formal/2007-12-01)
 *  - OMG UML 2.5.1 (formal/2017-12-05)
 *
 * Tested round-trip against:
 *  Enterprise Architect (Sparx), MagicDraw / Cameo, Papyrus (Eclipse),
 *  Astah Professional, Visual Paradigm, StarUML 3+, ArgoUML.
 */
export class XmiConverterService {


  /**
   * Serializes the diagram into an XMI 2.1 string.
   * @param diagramId  Stable identifier for the diagram (used as Model xmi:id
   *                   to ensure deterministic, round-trip-safe documents).
   * @param diagramName Human-readable name of the model.
   * @param nodes      All diagram nodes (umlClass + umlNote).
   * @param edges      All diagram edges.
   */
  public static exportToXmi(
    diagramId: string,
    diagramName: string,
    nodes: UmlClassNode[],
    edges: UmlEdge[]
  ): string {
    const classNodes = nodes.filter((n) => n.type === "umlClass");
    const noteNodes  = nodes.filter((n) => n.type === "umlNote");

    const nodeIdSet = new Set(classNodes.map((n) => n.id));

    const classifiersXml = classNodes
      .map((node) => this.serializeClassifier(node, classNodes, edges, nodeIdSet))
      .join("\n");

    const rootRelationsXml = this.serializeRootRelations(edges, classNodes, nodeIdSet);

    const commentsXml = this.serializeNotes(noteNodes, edges, nodeIdSet);

      const primitivesXml = this.serializePrimitiveTypes();

    const modelId = `model_${diagramId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const modelName = this.escapeXml(diagramName || "LibreUML_Project");

    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<xmi:XMI xmi:version="2.1"`,
      `  xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"`,
      `  xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML">`,
      `  <xmi:Documentation exporter="LibreUML" exporterVersion="1.0"/>`,
      `  <uml:Model xmi:id="${modelId}" name="${modelName}">`,
      primitivesXml,
      classifiersXml,
      rootRelationsXml,
      commentsXml,
      `  </uml:Model>`,
      `</xmi:XMI>`,
    ]
      .filter(Boolean)
      .join("\n");
  }


  public static downloadXmi(
    diagramId: string,
    diagramName: string,
    nodes: UmlClassNode[],
    edges: UmlEdge[]
  ): void {
    const xmiContent = this.exportToXmi(diagramId, diagramName, nodes, edges);
    const blob = new Blob([xmiContent], { type: "application/xml;charset=UTF-8" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${diagramName || "diagram"}.xmi`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }


  private static escapeXml(raw: string | undefined | null): string {
    if (!raw) return "";
    return raw
      .replace(/&/g, "&amp;")   
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }


  private static mapVisibility(symbol: string): string {
    switch (symbol) {
      case "-": return "private";
      case "#": return "protected";
      case "~": return "package";
      case "+":
      default:  return "public";
    }
  }


  private static primitiveId(typeName: string): string | null {
    const t = typeName.replace(/\[\]$/, "").trim().toLowerCase();
    if (t === "string")                       return "PT_String";
    if (t === "int" || t === "integer")       return "PT_Integer";
    if (t === "boolean" || t === "bool")      return "PT_Boolean";
    if (t === "double" || t === "float" || t === "real") return "PT_Real";
    if (t === "char" || t === "character")    return "PT_Char";
    if (t === "byte")                         return "PT_Byte";
    if (t === "date")                         return "PT_Date";
    return null;
  }

  private static resolveTypeAttr(
    typeName: string,
    nodes: UmlClassNode[]
  ): { attr: string; resolved: boolean } {
    const clean = typeName.replace(/\[\]$/, "").trim();
    const pid = this.primitiveId(clean);
    if (pid) return { attr: ` type="${pid}"`, resolved: true };

    const classId = nodes.find((n) => n.data.label === clean)?.id;
    if (classId) return { attr: ` type="${classId}"`, resolved: true };

    return { attr: "", resolved: false };
  }


  private static serializePrimitiveTypes(): string {
    const primitives = [
      { id: "PT_String",  name: "String",  pathmap: "String"    },
      { id: "PT_Integer", name: "Integer", pathmap: "Integer"   },
      { id: "PT_Boolean", name: "Boolean", pathmap: "Boolean"   },
      { id: "PT_Real",    name: "Real",    pathmap: "Real"      },
      { id: "PT_Char",    name: "Char",    pathmap: "Char"      },
      { id: "PT_Byte",    name: "Byte",    pathmap: "Byte"      },
      { id: "PT_Date",    name: "Date",    pathmap: "Date"      },
    ];

    return primitives
      .map(
        (p) =>
          `    <packagedElement xmi:type="uml:PrimitiveType" xmi:id="${p.id}" name="${p.name}"/>`
      )
      .join("\n");
  }


  private static serializeClassifier(
    node: UmlClassNode,
    classNodes: UmlClassNode[],
    edges: UmlEdge[],
    nodeIdSet: Set<string>
  ): string {
    const { id, data } = node;
    const name = this.escapeXml(data.label);

    let umlType = "uml:Class";
    let extraAttrs = "";

    if (data.stereotype === "interface") {
      umlType = "uml:Interface";
      extraAttrs = ' isAbstract="true"';
    } else if (data.stereotype === "enum") {
      umlType = "uml:Enumeration";
    } else if (data.stereotype === "abstract") {
      umlType = "uml:Class";
      extraAttrs = ' isAbstract="true"';
    }

    const templateXml = data.generics
      ? this.serializeTemplateSignature(id, data.generics)
      : "";

    const attributesXml = this.serializeAttributes(
      data.attributes || [],
      classNodes,
      id,
      edges,
      data.stereotype === "enum"
    );

    const operationsXml = this.serializeOperations(
      data.methods || [],
      classNodes,
      data.stereotype === "interface" || data.stereotype === "abstract"
    );

    const innerRelationsXml = this.serializeInnerRelations(id, edges, nodeIdSet);

    const children = [templateXml, attributesXml, operationsXml, innerRelationsXml]
      .filter(Boolean)
      .join("\n");

    return children
      ? `    <packagedElement xmi:type="${umlType}" xmi:id="${id}" name="${name}"${extraAttrs}>\n${children}\n    </packagedElement>`
      : `    <packagedElement xmi:type="${umlType}" xmi:id="${id}" name="${name}"${extraAttrs}/>`;
  }


  private static serializeTemplateSignature(
    classId: string,
    genericsStr: string
  ): string {
    const sigId = `${classId}_tplSig`;
    const params = genericsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const paramXml = params
      .map((p, i) => {
        const paramName = this.escapeXml(p.split(/\s+/)[0]);
        const paramId   = `${classId}_tplParam_${i}`;
        const elemId    = `${classId}_tplElem_${i}`;
        return [
          `        <ownedParameter xmi:type="uml:ClassifierTemplateParameter" xmi:id="${paramId}">`,
          `          <parameteredElement xmi:type="uml:Class" xmi:id="${elemId}" name="${paramName}"/>`,
          `        </ownedParameter>`,
        ].join("\n");
      })
      .join("\n");

    return [
      `      <ownedTemplateSignature xmi:type="uml:RedefinableTemplateSignature" xmi:id="${sigId}" classifier="${classId}">`,
      paramXml,
      `      </ownedTemplateSignature>`,
    ].join("\n");
  }

  private static serializeAttributes(
    attributes: UmlAttribute[],
    classNodes: UmlClassNode[],
    currentNodeId: string,
    edges: UmlEdge[],
    isEnum: boolean
  ): string {
    if (!attributes.length) return "";

    if (isEnum) {
      return attributes
        .map((attr) => {
          const name = this.escapeXml(attr.name);
          return `      <ownedLiteral xmi:type="uml:EnumerationLiteral" xmi:id="${attr.id}" name="${name}" visibility="public"/>`;
        })
        .join("\n");
    }

    const associationTypes = new Set(["association", "aggregation", "composition"]);
    const outgoingAssocTargets = new Set(
      edges
        .filter(
          (e) =>
            e.source === currentNodeId &&
            associationTypes.has(e.data?.type || e.type || "")
        )
        .map((e) => e.target)
    );

    return attributes
      .map((attr) => {
        const visibility  = this.mapVisibility(attr.visibility);
        const name        = this.escapeXml(attr.name);
        const cleanType   = attr.type.replace(/\[\]$/, "").trim();
        const { attr: typeAttr } = this.resolveTypeAttr(cleanType, classNodes);

        const refClassId = classNodes.find((n) => n.data.label === cleanType)?.id;
        if (refClassId && outgoingAssocTargets.has(refClassId)) return "";

        const multiplicityXml = this.multiplicityXml(attr.id, attr.isArray);

        return multiplicityXml
          ? [
              `      <ownedAttribute xmi:type="uml:Property" xmi:id="${attr.id}" name="${name}" visibility="${visibility}"${typeAttr}>`,
              multiplicityXml,
              `      </ownedAttribute>`,
            ].join("\n")
          : `      <ownedAttribute xmi:type="uml:Property" xmi:id="${attr.id}" name="${name}" visibility="${visibility}"${typeAttr}/>`;
      })
      .filter(Boolean)
      .join("\n");
  }


  private static serializeOperations(
    methods: UmlMethod[],
    classNodes: UmlClassNode[],
    classifierIsAbstract: boolean
  ): string {
    if (!methods.length) return "";

    return methods
      .map((method) => {
        const visibility   = this.mapVisibility(method.visibility);
        const name         = this.escapeXml(method.name);
        const isStaticAttr = method.isStatic ? ' isStatic="true"' : "";
        const isAbstractAttr =
          classifierIsAbstract && method.visibility !== "-"
            ? ' isAbstract="true"'
            : "";

        const inputParams = (method.parameters || []).map((p, i) => {
          const pName            = this.escapeXml(p.name);
          const cleanType        = p.type.replace(/\[\]$/, "").trim();
          const { attr: typeAttr } = this.resolveTypeAttr(cleanType, classNodes);
          const paramId          = `${method.id}_in${i}`;
          const multiplicityXml  = this.multiplicityXml(paramId, p.isArray ?? false);

          return multiplicityXml
            ? [
                `          <ownedParameter xmi:type="uml:Parameter" xmi:id="${paramId}" name="${pName}" direction="in"${typeAttr}>`,
                multiplicityXml.replace(/^/gm, "  "), 
                `          </ownedParameter>`,
              ].join("\n")
            : `          <ownedParameter xmi:type="uml:Parameter" xmi:id="${paramId}" name="${pName}" direction="in"${typeAttr}/>`;
        });

        let returnParam = "";
        const rType = (method.returnType || "void").replace(/\[\]$/, "").trim();
        if (rType && rType !== "void") {
          const { attr: typeAttr }  = this.resolveTypeAttr(rType, classNodes);
          const retId               = `${method.id}_return`;
          const multiplicityXml     = this.multiplicityXml(retId, method.isReturnArray ?? false);
          returnParam = multiplicityXml
            ? [
                `          <ownedParameter xmi:type="uml:Parameter" xmi:id="${retId}" direction="return"${typeAttr}>`,
                multiplicityXml.replace(/^/gm, "  "),
                `          </ownedParameter>`,
              ].join("\n")
            : `          <ownedParameter xmi:type="uml:Parameter" xmi:id="${retId}" direction="return"${typeAttr}/>`;
        }

        const allParams = [...inputParams, returnParam].filter(Boolean).join("\n");

        return allParams
          ? [
              `      <ownedOperation xmi:type="uml:Operation" xmi:id="${method.id}" name="${name}" visibility="${visibility}"${isStaticAttr}${isAbstractAttr}>`,
              allParams,
              `      </ownedOperation>`,
            ].join("\n")
          : `      <ownedOperation xmi:type="uml:Operation" xmi:id="${method.id}" name="${name}" visibility="${visibility}"${isStaticAttr}${isAbstractAttr}/>`;
      })
      .join("\n");
  }

 
  private static serializeInnerRelations(
    nodeId: string,
    edges: UmlEdge[],
    nodeIdSet: Set<string>
  ): string {
    return edges
      .filter((e) => e.source === nodeId)
      .map((edge) => {
        const type = edge.data?.type || edge.type;
        if (!nodeIdSet.has(edge.target)) return "";

        if (type === "inheritance") {
          return `      <generalization xmi:type="uml:Generalization" xmi:id="${edge.id}" general="${edge.target}"/>`;
        }
        if (type === "implementation") {
          return [
            `      <interfaceRealization`,
            `        xmi:type="uml:InterfaceRealization"`,
            `        xmi:id="${edge.id}"`,
            `        client="${nodeId}"`,
            `        supplier="${edge.target}"`,
            `        contract="${edge.target}"/>`,
          ].join(" ");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  private static serializeRootRelations(
    edges: UmlEdge[],
    classNodes: UmlClassNode[],
    nodeIdSet: Set<string>
  ): string {
    return edges
      .map((edge) => {
        const type = edge.data?.type || edge.type;

        if (type === "inheritance" || type === "implementation") return "";

        if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) return "";

        if (type === "dependency") {
          return `    <packagedElement xmi:type="uml:Dependency" xmi:id="${edge.id}" client="${edge.source}" supplier="${edge.target}"/>`;
        }

        if (["association", "aggregation", "composition"].includes(type || "")) {
          return this.serializeAssociation(edge, classNodes, type!);
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }


  private static serializeAssociation(
    edge: UmlEdge,
    classNodes: UmlClassNode[],
    relationType: string
  ): string {
    const id         = edge.id;
    const sourceId   = edge.source;
    const targetId   = edge.target;
    const endSrcId   = `${id}_endSource`;
    const endTgtId   = `${id}_endTarget`;

    const sourceNode = classNodes.find((n) => n.id === sourceId);
    const targetNode = classNodes.find((n) => n.id === targetId);
    const sourceRole = this.escapeXml(
      sourceNode?.data.label.charAt(0).toLowerCase() +
      (sourceNode?.data.label.slice(1) || "source")
    );
    const targetRole = this.escapeXml(
      targetNode?.data.label.charAt(0).toLowerCase() +
      (targetNode?.data.label.slice(1) || "target")
    );

    const aggregationAttr =
      relationType === "composition"
        ? ' aggregation="composite"'
        : relationType === "aggregation"
        ? ' aggregation="shared"'
        : "";

    const [srcLower, srcUpper] = this.parseMultiplicityBounds(
      edge.data?.sourceMultiplicity ?? "1"
    );
    const [tgtLower, tgtUpper] = this.parseMultiplicityBounds(
      edge.data?.targetMultiplicity ?? "0..*"
    );

    return [
      `    <packagedElement xmi:type="uml:Association" xmi:id="${id}">`,
      `      <memberEnd xmi:idref="${endSrcId}"/>`,
      `      <memberEnd xmi:idref="${endTgtId}"/>`,
      `      <ownedEnd xmi:type="uml:Property" xmi:id="${endSrcId}" name="${sourceRole}" type="${sourceId}" association="${id}"${aggregationAttr}>`,
      `        <lowerValue xmi:type="uml:LiteralInteger"            xmi:id="${endSrcId}_lower" value="${srcLower}"/>`,
      `        <upperValue xmi:type="uml:LiteralUnlimitedNatural"   xmi:id="${endSrcId}_upper" value="${srcUpper}"/>`,
      `      </ownedEnd>`,
      `      <ownedEnd xmi:type="uml:Property" xmi:id="${endTgtId}" name="${targetRole}" type="${targetId}" association="${id}">`,
      `        <lowerValue xmi:type="uml:LiteralInteger"            xmi:id="${endTgtId}_lower" value="${tgtLower}"/>`,
      `        <upperValue xmi:type="uml:LiteralUnlimitedNatural"   xmi:id="${endTgtId}_upper" value="${tgtUpper}"/>`,
      `      </ownedEnd>`,
      `    </packagedElement>`,
    ].join("\n");
  }


  private static serializeNotes(
    noteNodes: UmlClassNode[],
    edges: UmlEdge[],
    nodeIdSet: Set<string>
  ): string {
    if (!noteNodes.length) return "";

    return noteNodes
      .map((note) => {
        const body = this.escapeXml(note.data.content || note.data.label || "");

        const annotated = edges
          .filter(
            (e) =>
              (e.data?.type === "note" || e.type === "note") &&
              (e.source === note.id || e.target === note.id)
          )
          .map((e) => (e.source === note.id ? e.target : e.source))
          .filter((id) => nodeIdSet.has(id));

        const annotatedAttr = annotated.length
          ? ` annotatedElement="${annotated.join(" ")}"`
          : "";

        return [
          `    <ownedComment xmi:type="uml:Comment" xmi:id="${note.id}"${annotatedAttr}>`,
          `      <body>${body}</body>`,
          `    </ownedComment>`,
        ].join("\n");
      })
      .join("\n");
  }

  private static multiplicityXml(
    ownerId: string,
    isArray: boolean
  ): string {
    if (!isArray) return ""; 

    return [
      `        <lowerValue xmi:type="uml:LiteralInteger"          xmi:id="${ownerId}_lower" value="0"/>`,
      `        <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="${ownerId}_upper" value="*"/>`,
    ].join("\n");
  }

  private static parseMultiplicityBounds(
    multiplicity: string
  ): [string, string] {
    if (!multiplicity) return ["1", "1"];

    if (multiplicity === "*" || multiplicity === "0..*") return ["0", "*"];
    if (multiplicity === "1..*") return ["1", "*"];

    if (multiplicity.includes("..")) {
      const [lo, hi] = multiplicity.split("..").map((s) => s.trim());
      return [lo, hi === "*" ? "*" : hi];
    }

    return [multiplicity, multiplicity];
  }
}