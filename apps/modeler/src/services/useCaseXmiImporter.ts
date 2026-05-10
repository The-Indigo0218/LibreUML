/**
 * Use Case Diagram XMI 2.1 / UML 2.5.1 importer.
 *
 * Handles XMI produced by LibreUML and by common tools (Papyrus, StarUML,
 * EA) that follow UML 2.5 conventions for use case diagrams.
 *
 * Elements supported:
 *  - uml:Actor           → IRActor
 *  - uml:UseCase         → IRUseCase  (extensionPoints, nested include/extend/generalization)
 *  - uml:Package         → IRSystemBoundary (use-case diagrams have no real packages)
 *  - uml:Association     → IRRelation  kind=ASSOCIATION
 *  - uml:Include         → IRRelation  kind=INCLUDE   (top-level or nested)
 *  - uml:Extend          → IRRelation  kind=EXTEND    (top-level or nested, with condition)
 *  - uml:Generalization  → IRRelation  kind=GENERALIZATION (nested in actor/UC)
 */

import type {
  IRActor,
  IRUseCase,
  IRSystemBoundary,
  IRRelation,
} from '../core/domain/vfs/vfs.types';

export interface ParsedUseCaseDiagram {
  actors: IRActor[];
  useCases: IRUseCase[];
  systemBoundaries: IRSystemBoundary[];
  relations: IRRelation[];
  /** Canvas positions keyed by element id (new UUID). */
  positions: Map<string, { x: number; y: number; width?: number; height?: number }>;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const ACTOR_X = 80;
const ACTOR_STEP_Y = 130;
const UC_START_X = 320;
const UC_STEP_X = 240;
const UC_STEP_Y = 130;
const UC_COLS = 3;
const SB_DEFAULT_W = 440;
const SB_DEFAULT_H = 340;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function attr(el: Element, name: string): string | null {
  return el.getAttribute(name);
}

function collectPackagedElements(xmlDoc: Document): Element[] {
  return Array.from(xmlDoc.getElementsByTagName('packagedElement'));
}

function conditionText(extendEl: Element): string | undefined {
  const body = extendEl.querySelector('condition specification body') ??
               extendEl.querySelector('condition > specification > body');
  return body?.textContent?.trim() || undefined;
}

// ─── Main class ───────────────────────────────────────────────────────────────

export class UseCaseXmiImporter {

  /** Fast check: does this XMI contain use-case elements? */
  public static isUseCaseDiagram(xmiContent: string): boolean {
    return xmiContent.includes('uml:Actor') || xmiContent.includes('uml:UseCase');
  }

  public static import(xmiContent: string): ParsedUseCaseDiagram {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmiContent, 'application/xml');
    if (xmlDoc.querySelector('parsererror')) {
      throw new Error('XMI parse error');
    }
    return this.parse(xmlDoc);
  }

  private static parse(xmlDoc: Document): ParsedUseCaseDiagram {
    const actors: IRActor[] = [];
    const useCases: IRUseCase[] = [];
    const systemBoundaries: IRSystemBoundary[] = [];
    const relations: IRRelation[] = [];
    const positions = new Map<string, { x: number; y: number; width?: number; height?: number }>();

    // xmi:id → new UUID
    const idMap = new Map<string, string>();
    let actorIdx = 0, ucIdx = 0, sbIdx = 0;

    const elements = collectPackagedElements(xmlDoc);

    // ── Pass 1: nodes ────────────────────────────────────────────────────────

    for (const el of elements) {
      const xmiType = attr(el, 'xmi:type');
      const xmiId   = attr(el, 'xmi:id');
      const name    = attr(el, 'name') ?? '';
      if (!xmiId) continue;

      const newId = crypto.randomUUID();
      idMap.set(xmiId, newId);

      if (xmiType === 'uml:Actor') {
        actors.push({
          id: newId,
          kind: 'ACTOR',
          name,
          visibility: 'public',
          isAbstract: attr(el, 'isAbstract') === 'true',
        });
        positions.set(newId, {
          x: ACTOR_X,
          y: 80 + actorIdx * ACTOR_STEP_Y,
        });
        actorIdx++;

      } else if (xmiType === 'uml:UseCase') {
        const eps = Array.from(el.querySelectorAll(':scope > extensionPoint'))
          .map(ep => attr(ep, 'name') ?? '')
          .filter(Boolean);

        useCases.push({
          id: newId,
          kind: 'USECASE',
          name,
          visibility: 'public',
          extensionPoints: eps.length > 0 ? eps : undefined,
        });
        const col = ucIdx % UC_COLS;
        const row = Math.floor(ucIdx / UC_COLS);
        positions.set(newId, {
          x: UC_START_X + col * UC_STEP_X,
          y: 80 + row * UC_STEP_Y,
        });
        ucIdx++;

      } else if (xmiType === 'uml:Package') {
        systemBoundaries.push({
          id: newId,
          kind: 'SYSTEM_BOUNDARY',
          name,
          visibility: 'public',
        });
        positions.set(newId, {
          x: UC_START_X - 20 + sbIdx * 30,
          y: 50 + sbIdx * 20,
          width: SB_DEFAULT_W,
          height: SB_DEFAULT_H,
        });
        sbIdx++;
      }
    }

    // ── Pass 2: relations ────────────────────────────────────────────────────

    const resolve = (xmiId: string): string | null => idMap.get(xmiId) ?? null;

    for (const el of elements) {
      const xmiType = attr(el, 'xmi:type');
      const xmiId   = attr(el, 'xmi:id');
      if (!xmiId) continue;

      // Top-level Association
      if (xmiType === 'uml:Association') {
        const ends = Array.from(el.querySelectorAll(':scope > ownedEnd'));
        if (ends.length >= 2) {
          const src = attr(ends[0], 'type');
          const tgt = attr(ends[1], 'type');
          if (src && tgt) {
            const srcId = resolve(src);
            const tgtId = resolve(tgt);
            if (srcId && tgtId) {
              relations.push({ id: crypto.randomUUID(), kind: 'ASSOCIATION', sourceId: srcId, targetId: tgtId });
            }
          }
        }
        continue;
      }

      // Top-level Include (some tools emit them at model level)
      if (xmiType === 'uml:Include') {
        const including = attr(el, 'includingCase');
        const addition  = attr(el, 'addition');
        if (including && addition) {
          const srcId = resolve(including);
          const tgtId = resolve(addition);
          if (srcId && tgtId) {
            relations.push({ id: crypto.randomUUID(), kind: 'INCLUDE', sourceId: srcId, targetId: tgtId });
          }
        }
        continue;
      }

      // Top-level Extend
      if (xmiType === 'uml:Extend') {
        const extendedCase = attr(el, 'extendedCase');
        const extension    = attr(el, 'extension');
        if (extendedCase && extension) {
          const srcId = resolve(extension);   // extending UC
          const tgtId = resolve(extendedCase); // base UC
          if (srcId && tgtId) {
            relations.push({
              id: crypto.randomUUID(),
              kind: 'EXTEND',
              sourceId: srcId,
              targetId: tgtId,
              condition: conditionText(el),
            });
          }
        }
        continue;
      }

      // Nested relations inside Actor / UseCase
      const ownerNewId = resolve(xmiId);
      if (!ownerNewId) continue;

      if (xmiType === 'uml:Actor' || xmiType === 'uml:UseCase') {
        // Generalizations
        for (const gen of Array.from(el.querySelectorAll(':scope > generalization'))) {
          const general = attr(gen, 'general');
          if (general) {
            const tgtId = resolve(general);
            if (tgtId) {
              relations.push({ id: crypto.randomUUID(), kind: 'GENERALIZATION', sourceId: ownerNewId, targetId: tgtId });
            }
          }
        }
      }

      if (xmiType === 'uml:UseCase') {
        // Nested include
        for (const inc of Array.from(el.querySelectorAll(':scope > include'))) {
          const addition = attr(inc, 'addition');
          if (addition) {
            const tgtId = resolve(addition);
            if (tgtId) {
              relations.push({ id: crypto.randomUUID(), kind: 'INCLUDE', sourceId: ownerNewId, targetId: tgtId });
            }
          }
        }

        // Nested extend
        for (const ext of Array.from(el.querySelectorAll(':scope > extend'))) {
          const extendedCase = attr(ext, 'extendedCase');
          if (extendedCase) {
            const tgtId = resolve(extendedCase);
            if (tgtId) {
              relations.push({
                id: crypto.randomUUID(),
                kind: 'EXTEND',
                sourceId: ownerNewId,
                targetId: tgtId,
                condition: conditionText(ext),
              });
            }
          }
        }
      }
    }

    return { actors, useCases, systemBoundaries, relations, positions };
  }
}
