import type {
  UmlClassNode,
  UmlEdge,
  UmlAttribute,
  UmlMethod,
} from "../features/diagram/types/diagram.types";

/**
 * Service responsible for parsing XMI 2.1 / XMI 2.5 documents
 * and transforming them into LibreUML state (Nodes and Edges).
 *
 * Standards compliance:
 *  - OMG XMI 2.1  (formal/2007-12-01)
 *  - OMG XMI 2.5.1 (formal/2015-06-07)
 *  - OMG UML 2.5.1 (formal/2017-12-05)
 *
 * Tested against exports from:
 *  Enterprise Architect (Sparx), MagicDraw / Cameo, Papyrus (Eclipse),
 *  Astah, Visual Paradigm, StarUML 3+, ArgoUML.
 */
export class XmiImporterService {

  /**
   * Parses an XMI string and returns LibreUML nodes and edges.
   * @throws {Error} if the XML is malformed.
   */
  public static import(xmiContent: string): {
    nodes: UmlClassNode[];
    edges: UmlEdge[];
  } {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmiContent, "application/xml");

    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
      throw new Error(`XMI parse error: ${parseError.textContent}`);
    }

    const nodes = this.parseNodes(xmlDoc);
    const edges = this.parseEdges(xmlDoc, nodes);

    return { nodes, edges };
  }

  private static findById(xmlDoc: Document, id: string): Element | null {
    try {
      return xmlDoc.querySelector(`[xmi\\:id="${id}"]`);
    } catch {
      return (
        Array.from(xmlDoc.getElementsByTagName("*")).find(
          (el) => el.getAttribute("xmi:id") === id
        ) ?? null
      );
    }
  }


  private static resolveType(element: Element, xmlDoc: Document): string {
    const typeAttr = element.getAttribute("type");
    if (typeAttr) {
      const referenced = this.findById(xmlDoc, typeAttr);
      if (referenced) return referenced.getAttribute("name") || "Object";
      return this.normalizePrimitiveType(typeAttr);
    }

    const typeChild = element.querySelector(":scope > type");
    if (typeChild) {
      const href = typeChild.getAttribute("href");
      if (href) {
        const fragment = href.split("#").pop() ?? href;
        return this.normalizePrimitiveType(fragment);
      }
      const idref = typeChild.getAttribute("xmi:idref");
      if (idref) {
        const referenced = this.findById(xmlDoc, idref);
        if (referenced) return referenced.getAttribute("name") || "Object";
        return this.normalizePrimitiveType(idref);
      }
    }

    return "void";
  }


  private static normalizePrimitiveType(raw: string): string {
    const id = raw.toLowerCase();
    if (id.includes("string") || id === "str") return "String";
    if (id.includes("integer") || id === "int" || id === "long") return "int";
    if (id.includes("boolean") || id === "bool") return "boolean";
    if (id.includes("real") || id.includes("double") || id.includes("float")) return "double";
    if (id.includes("char")) return "char";
    if (id.includes("byte")) return "byte";
    if (id.includes("date")) return "Date";
    if (id.includes("void")) return "void";
    if (id.includes("object") || id === "any") return "Object";
    return raw;
  }


  private static parseVisibility(
    raw: string | null
  ): "+" | "-" | "#" | "~" {
    switch (raw) {
      case "private":   return "-";
      case "protected": return "#";
      case "package":   return "~";
      case "public":
      default:          return "+";
    }
  }

  private static isArray(element: Element): boolean {
    const upper = element.querySelector(":scope > upperValue");
    if (!upper) return false;
    const value = upper.getAttribute("value");
    if (!value) return false;
    if (value === "*" || value === "-1") return true;
    const n = parseInt(value, 10);
    return !isNaN(n) && n > 1;
  }


  private static parseMultiplicity(end: Element): string | undefined {
    const lowerEl = end.querySelector(":scope > lowerValue");
    const upperEl = end.querySelector(":scope > upperValue");

    if (!lowerEl && !upperEl) return undefined;

    const lower = lowerEl?.getAttribute("value") ?? "1";
    const upper = upperEl?.getAttribute("value");

    if (!upper || upper === lower) return lower === "1" ? "1" : lower;
    const upperLabel = upper === "-1" ? "*" : upper;
    return `${lower}..${upperLabel}`;
  }

  private static collectAllElements(xmlDoc: Document): Element[] {

    return [
      ...Array.from(xmlDoc.getElementsByTagName("packagedElement")),
      ...Array.from(xmlDoc.getElementsByTagName("nestedClassifier")),
    ];
  }


  private static parseNodes(xmlDoc: Document): UmlClassNode[] {
    const nodes: UmlClassNode[] = [];

    const CLASS_LIKE_TYPES = new Set([
      "uml:Class",
      "uml:Interface",
      "uml:Enumeration",
      "uml:DataType",
    ]);

    const classLikeElements = this.collectAllElements(xmlDoc).filter((el) =>
      CLASS_LIKE_TYPES.has(el.getAttribute("xmi:type") ?? "")
    );

    classLikeElements.forEach((el, index) => {
      const id         = el.getAttribute("xmi:id") || crypto.randomUUID();
      const name       = el.getAttribute("name") || "Unnamed";
      const xmiType    = el.getAttribute("xmi:type");
      const isAbstract = el.getAttribute("isAbstract") === "true";

      let stereotype: "class" | "interface" | "abstract" | "enum" = "class";
      if (xmiType === "uml:Interface")   stereotype = "interface";
      else if (xmiType === "uml:Enumeration") stereotype = "enum";
      else if (isAbstract)               stereotype = "abstract";


      const attributes: UmlAttribute[] = Array.from(
        el.querySelectorAll(":scope > ownedAttribute")
      )
        .filter((a) => !a.getAttribute("association"))
        .map((attrEl) => ({
          id:         attrEl.getAttribute("xmi:id") || crypto.randomUUID(),
          name:       attrEl.getAttribute("name") || "attr",
          visibility: this.parseVisibility(attrEl.getAttribute("visibility")),
          type:       this.resolveType(attrEl, xmlDoc),
          isArray:    this.isArray(attrEl),
        }));

      if (xmiType === "uml:Enumeration") {
        Array.from(el.querySelectorAll(":scope > ownedLiteral")).forEach(
          (lit) => {
            attributes.push({
              id:         lit.getAttribute("xmi:id") || crypto.randomUUID(),
              name:       lit.getAttribute("name") || "LITERAL",
              visibility: "+",
              type:       "",
              isArray:    false,
            });
          }
        );
      }

      const methods: UmlMethod[] = Array.from(
        el.querySelectorAll(":scope > ownedOperation")
      ).map((opEl) => {
        const params = Array.from(opEl.querySelectorAll(":scope > ownedParameter"));
        const inputParams  = params.filter((p) => p.getAttribute("direction") !== "return");
        const returnParam  = params.find((p) => p.getAttribute("direction") === "return");

        return {
          id:            opEl.getAttribute("xmi:id") || crypto.randomUUID(),
          name:          opEl.getAttribute("name") || "method",
          visibility:    this.parseVisibility(opEl.getAttribute("visibility")),
          isStatic:      opEl.getAttribute("isStatic") === "true",
          returnType:    returnParam ? this.resolveType(returnParam, xmlDoc) : "void",
          isReturnArray: returnParam ? this.isArray(returnParam) : false,
          parameters:    inputParams.map((p) => ({
            name:    p.getAttribute("name") || "param",
            type:    this.resolveType(p, xmlDoc),
            isArray: this.isArray(p),
          })),
        };
      });


      const COLS = 3;
      const position = {
        x: 80 + (index % COLS) * 320,
        y: 80 + Math.floor(index / COLS) * 280,
      };

      nodes.push({
        id,
        type: "umlClass",
        position,
        data: { label: name, stereotype, attributes, methods },
      });
    });

    return nodes;
  }


  private static parseEdges(
    xmlDoc: Document,
    nodes: UmlClassNode[]
  ): UmlEdge[] {
    const edges: UmlEdge[] = [];
    const knownIds = new Set(nodes.map((n) => n.id));

    const isValid = (src: string, tgt: string) =>
      !!src && !!tgt && knownIds.has(src) && knownIds.has(tgt);

    const allElements = this.collectAllElements(xmlDoc);

    allElements
      .filter((el) => {
        const t = el.getAttribute("xmi:type");
        return t === "uml:Class" || t === "uml:Interface";
      })
      .forEach((classEl) => {
        const sourceId = classEl.getAttribute("xmi:id");
        if (!sourceId) return;

        Array.from(classEl.querySelectorAll(":scope > generalization")).forEach(
          (gen) => {
            const target = gen.getAttribute("general") ?? "";
            if (isValid(sourceId, target)) {
              edges.push(this.makeEdge(
                gen.getAttribute("xmi:id"),
                sourceId,
                target,
                "inheritance"
              ));
            }
          }
        );
      });


    allElements
      .filter((el) => {
        const t = el.getAttribute("xmi:type");
        return t === "uml:Class" || t === "uml:Interface";
      })
      .forEach((classEl) => {
        const sourceId = classEl.getAttribute("xmi:id");
        if (!sourceId) return;

        Array.from(
          classEl.querySelectorAll(":scope > interfaceRealization")
        ).forEach((real) => {
          const target =
            real.getAttribute("contract") ??
            real.getAttribute("supplier") ??
            "";
          if (isValid(sourceId, target)) {
            edges.push(this.makeEdge(
              real.getAttribute("xmi:id"),
              sourceId,
              target,
              "implementation"
            ));
          }
        });
      });

    allElements
      .filter((el) => el.getAttribute("xmi:type") === "uml:Realization")
      .forEach((real) => {
        this.resolveMultiRefEdge(
          real, "client", "supplier", "implementation", isValid, edges
        );
      });


    allElements
      .filter((el) => el.getAttribute("xmi:type") === "uml:Association")
      .forEach((assoc) => {
        const assocId = assoc.getAttribute("xmi:id");

        const ownedEnds = Array.from(assoc.querySelectorAll(":scope > ownedEnd"));
        if (ownedEnds.length >= 2) {
          const edge = this.buildAssociationFromOwnedEnds(
            assocId,
            ownedEnds[0],
            ownedEnds[1],
            isValid
          );
          if (edge) { edges.push(edge); return; }
        }

        const memberRefs = Array.from(
          assoc.querySelectorAll(":scope > memberEnd")
        )
          .map((me) => me.getAttribute("xmi:idref"))
          .filter(Boolean) as string[];

        if (memberRefs.length >= 2) {
          const end1El = this.findById(xmlDoc, memberRefs[0]);
          const end2El = this.findById(xmlDoc, memberRefs[1]);
          if (end1El && end2El) {
            const edge = this.buildAssociationFromMemberEnds(
              assocId,
              end1El,
              end2El,
              isValid
            );
            if (edge) edges.push(edge);
          }
        }
      });

    const DEPENDENCY_TYPES = new Set([
      "uml:Dependency",
      "uml:Usage",
      "uml:Abstraction",
    ]);

    allElements
      .filter((el) => DEPENDENCY_TYPES.has(el.getAttribute("xmi:type") ?? ""))
      .forEach((dep) => {
        this.resolveMultiRefEdge(
          dep, "client", "supplier", "dependency", isValid, edges
        );
      });

    return edges;
  }

  private static buildAssociationFromOwnedEnds(
    assocId: string | null,
    end1: Element,
    end2: Element,
    isValid: (src: string, tgt: string) => boolean
  ): UmlEdge | null {
    const agg1 = end1.getAttribute("aggregation");
    const agg2 = end2.getAttribute("aggregation");

    let relationType = "association";
    let sourceEnd = end1;
    let targetEnd = end2;

    if (agg2 === "composite") {
      relationType = "composition";
      [sourceEnd, targetEnd] = [end2, end1];
    } else if (agg1 === "composite") {
      relationType = "composition";
    } else if (agg2 === "shared") {
      relationType = "aggregation";
      [sourceEnd, targetEnd] = [end2, end1];
    } else if (agg1 === "shared") {
      relationType = "aggregation";
    }

    const source = sourceEnd.getAttribute("type") ?? "";
    const target = targetEnd.getAttribute("type") ?? "";
    if (!isValid(source, target)) return null;

    return {
      id:     assocId || `edge_${crypto.randomUUID()}`,
      source,
      target,
      type:   relationType,
      data: {
        type:               relationType,
        sourceMultiplicity: this.parseMultiplicity(sourceEnd),
        targetMultiplicity: this.parseMultiplicity(targetEnd),
      },
    } as unknown as UmlEdge;
  }


  private static buildAssociationFromMemberEnds(
    assocId: string | null,
    end1El: Element,
    end2El: Element,
    isValid: (src: string, tgt: string) => boolean
  ): UmlEdge | null {
    const owner1 = end1El.parentElement?.getAttribute("xmi:id") ?? "";
    const owner2 = end2El.parentElement?.getAttribute("xmi:id") ?? "";

    const agg1 = end1El.getAttribute("aggregation");
    const agg2 = end2El.getAttribute("aggregation");

    let relationType = "association";
    let source = owner1;
    let target = owner2;

    if (agg1 === "composite") {
      relationType = "composition";
    } else if (agg2 === "composite") {
      relationType = "composition";
      [source, target] = [owner2, owner1];
    } else if (agg1 === "shared") {
      relationType = "aggregation";
    } else if (agg2 === "shared") {
      relationType = "aggregation";
      [source, target] = [owner2, owner1];
    }

    if (!isValid(source, target)) return null;

    return {
      id: assocId || `edge_${crypto.randomUUID()}`,
      source,
      target,
      type: relationType,
      data: {
        type:               relationType,
        sourceMultiplicity: this.parseMultiplicity(end1El),
        targetMultiplicity: this.parseMultiplicity(end2El),
      },
    } as unknown as UmlEdge;
  }


  private static resolveMultiRefEdge(
    element: Element,
    sourceAttr: string,
    targetAttr: string,
    relationType: string,
    isValid: (src: string, tgt: string) => boolean,
    edges: UmlEdge[]
  ): void {
    const sources = (element.getAttribute(sourceAttr) ?? "")
      .split(/\s+/)
      .filter(Boolean);
    const targets = (element.getAttribute(targetAttr) ?? "")
      .split(/\s+/)
      .filter(Boolean);

    sources.forEach((src) => {
      targets.forEach((tgt) => {
        if (isValid(src, tgt)) {
          edges.push(
            this.makeEdge(
              element.getAttribute("xmi:id"),
              src,
              tgt,
              relationType
            )
          );
        }
      });
    });
  }

  private static makeEdge(
    id: string | null,
    source: string,
    target: string,
    relationType: string
  ): UmlEdge {
    return {
      id:     id || `edge_${crypto.randomUUID()}`,
      source,
      target,
      type:   relationType,
      data:   { type: relationType },
    } as unknown as UmlEdge;
  }
}