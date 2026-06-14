import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';
import type { BaseValidator } from './base-validator.types';
import type { ValidationResult } from '../registry/diagram-registry.types';
import type { LifelineNode } from '../domain/models/nodes/sequence-diagram.types';
import type {
  SemanticModel,
  IRMessage,
  IRClass,
  IRInterface,
  IRInteractionFragment,
  IRStateInvariant,
  IRInteractionUse,
  IRGate,
  IRGeneralOrdering,
  IRTimeConstraint,
} from '../domain/vfs/vfs.types';
import { MULTI_OPERAND_FRAGMENT_KINDS } from '../domain/vfs/vfs.types';

export class SequenceDiagramValidator implements BaseValidator {
  validateConnection(
    sourceNode: DomainNode,
    targetNode: DomainNode,
    edgeType: string,
    _existingEdges?: DomainEdge[],
    _allNodes?: Record<string, DomainNode>
  ): ValidationResult {
    if (sourceNode.type !== 'LIFELINE') {
      return { isValid: false, errors: ['Message source must be a Lifeline'] };
    }
    if (targetNode.type !== 'LIFELINE') {
      return { isValid: false, errors: ['Message target must be a Lifeline'] };
    }

    switch (edgeType) {
      case 'MESSAGE_SYNC':
      case 'MESSAGE_ASYNC':
      case 'MESSAGE_REPLY':
      case 'MESSAGE_CREATE':
      case 'MESSAGE_DESTROY':
        return { isValid: true };
      default:
        return {
          isValid: false,
          errors: [`Unknown edge type for Sequence Diagram: ${edgeType}`],
        };
    }
  }

  validateNode(node: DomainNode): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (node.type) {
      case 'LIFELINE':
        this.validateLifelineNode(node as LifelineNode, errors, warnings);
        break;
      case 'NOTE':
        // Notes have no domain-level validation rules.
        break;
      default:
        errors.push(`Unknown node type for Sequence Diagram: ${node.type}`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private validateLifelineNode(node: LifelineNode, errors: string[], warnings: string[]): void {
    if (node.participantKind === 'ANONYMOUS') {
      if (!node.alias || node.alias.trim() === '') {
        errors.push('Anonymous lifeline must have an alias');
      }
    } else if (!node.represents) {
      errors.push(
        `Lifeline of kind ${node.participantKind} must reference an existing element (represents)`,
      );
    }

    if (!node.name || node.name.trim() === '') {
      warnings.push('Lifeline has no display name');
    }
  }

  validateEdge(
    _edge: DomainEdge,
    _sourceNode: DomainNode,
    _targetNode: DomainNode,
  ): ValidationResult {
    // BaseValidator-compatible stub. Sequence-specific edge checks live in
    // validateMessage(), which needs the full SemanticModel (the BaseValidator
    // signature only exposes the two endpoint DomainNodes).
    return { isValid: true };
  }

  /**
   * Sequence-diagram-specific message validation. Reasons this can't live in
   * validateEdge: resolving `operationId` requires walking from the target
   * lifeline's `represents` to its IRClass/IRInterface and inspecting
   * `operationIds`, which the BaseValidator interface doesn't pass in.
   *
   * Returns warnings (never errors) — these are linter-level hints, never
   * block the UI from creating the message.
   */
  validateMessage(message: IRMessage, model: SemanticModel): ValidationResult {
    const warnings: string[] = [];

    const tgtLifeline = model.lifelines?.[message.targetLifelineId];
    if (!tgtLifeline) {
      // Caller should have already rejected dangling refs; nothing to validate.
      return { isValid: true };
    }

    if (message.operationId) {
      const opOwner = resolveOperationOwner(model, tgtLifeline.represents);
      if (!opOwner) {
        warnings.push(
          `Message references operationId "${message.operationId}" but the target lifeline has no resolvable classifier`,
        );
      } else if (!opOwner.operationIds.includes(message.operationId)) {
        warnings.push(
          `Operation "${message.operationId}" is not declared on the target classifier "${opOwner.name}"`,
        );
      }
    }

    if (message.messageKind === 'REPLY' && !message.inReplyTo) {
      warnings.push('REPLY message has no inReplyTo set — no SYNC will be closed by it');
    }

    // Fragment containment: if the message claims a fragment, the fragment must
    // cover both source and target lifelines, otherwise the visual containment
    // is meaningless.
    if (message.fragmentId) {
      const frag = model.interactionFragments?.[message.fragmentId];
      if (!frag) {
        warnings.push(`Message references missing fragment "${message.fragmentId}"`);
      } else {
        const covered = new Set(frag.coveredLifelineIds);
        if (!covered.has(message.sourceLifelineId) || !covered.has(message.targetLifelineId)) {
          warnings.push(
            `Message claims fragment "${frag.name || frag.id}" but the fragment doesn't cover both endpoints`,
          );
        }
      }
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Sequence-diagram-specific fragment validation.
   * Errors for structural problems (no covered lifelines, missing references).
   * Warnings for UX-level hints (LOOP without a guard).
   */
  validateFragment(fragment: IRInteractionFragment, model: SemanticModel): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!fragment.coveredLifelineIds || fragment.coveredLifelineIds.length === 0) {
      errors.push('Fragment must cover at least one lifeline');
    } else {
      const orphans = fragment.coveredLifelineIds.filter((id) => !model.lifelines?.[id]);
      if (orphans.length > 0) {
        errors.push(
          `Fragment references missing lifelines: ${orphans.join(', ')}`,
        );
      }
    }

    // Operand-count sanity per kind (UML 2.5 §17.6): opt/loop/break/critical/
    // neg/assert/ignore/consider take exactly one operand; alt/par/seq/strict
    // may carry many (one is legal).
    if (
      !MULTI_OPERAND_FRAGMENT_KINDS.has(fragment.fragmentKind) &&
      fragment.operands.length !== 1
    ) {
      warnings.push(`${fragment.fragmentKind} fragment should have exactly one operand`);
    }

    if (fragment.fragmentKind === 'LOOP') {
      const op = fragment.operands[0];
      if (!op || !op.guard || op.guard.trim() === '') {
        warnings.push('LOOP fragment without a guard will be ambiguous (defaults to true)');
      }
    }

    if (fragment.parentFragmentId) {
      const parent = model.interactionFragments?.[fragment.parentFragmentId];
      if (!parent) {
        warnings.push(
          `parentFragmentId "${fragment.parentFragmentId}" does not resolve to a fragment`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Sequence-diagram-specific state-invariant validation (UML 2.5 §17.4).
   * Error when the constrained lifeline is missing; warning when the constraint
   * text is empty (renders as an empty `{}` symbol).
   */
  validateStateInvariant(invariant: IRStateInvariant, model: SemanticModel): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!model.lifelines?.[invariant.lifelineId]) {
      errors.push(
        `State invariant references missing lifeline "${invariant.lifelineId}"`,
      );
    }

    if (!invariant.constraint || invariant.constraint.trim() === '') {
      warnings.push('State invariant has no constraint text');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Sequence-diagram-specific interaction-use (`ref`) validation (UML 2.5 §17.6).
   * Error when it covers no lifeline or references missing ones; warning when no
   * target interaction is set.
   */
  validateInteractionUse(use: IRInteractionUse, model: SemanticModel): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!use.coveredLifelineIds || use.coveredLifelineIds.length === 0) {
      errors.push('Interaction use must cover at least one lifeline');
    } else {
      const orphans = use.coveredLifelineIds.filter((id) => !model.lifelines?.[id]);
      if (orphans.length > 0) {
        errors.push(`Interaction use references missing lifelines: ${orphans.join(', ')}`);
      }
    }

    if (!use.referencedDiagramId && !use.referencedName) {
      warnings.push('Interaction use does not reference any interaction');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Sequence-diagram-specific gate validation (UML 2.5 §17.4). Error when the
   * owner fragment is missing; warning when the gate has no name.
   */
  validateGate(gate: IRGate, model: SemanticModel): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!gate.ownerFragmentId || !model.interactionFragments?.[gate.ownerFragmentId]) {
      errors.push('Gate must belong to an existing combined fragment');
    }
    if (!gate.name || gate.name.trim() === '') {
      warnings.push('Gate has no name');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Sequence-diagram-specific general-ordering validation (UML 2.5 §17.2). Error
   * when either endpoint message is missing or the two endpoints coincide
   * (a self-ordering is meaningless).
   */
  validateGeneralOrdering(ordering: IRGeneralOrdering, model: SemanticModel): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!model.messages?.[ordering.beforeMessageId]) {
      errors.push(`General ordering references missing message "${ordering.beforeMessageId}"`);
    }
    if (!model.messages?.[ordering.afterMessageId]) {
      errors.push(`General ordering references missing message "${ordering.afterMessageId}"`);
    }
    if (
      ordering.beforeMessageId === ordering.afterMessageId &&
      ordering.beforeEnd === ordering.afterEnd
    ) {
      warnings.push('General ordering relates a message occurrence to itself');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Sequence-diagram-specific timing-constraint validation (UML 2.5 §17.2).
   * Error when an anchor message is missing or a DURATION lacks its second
   * anchor; warning when the expression is empty.
   */
  validateTimeConstraint(tc: IRTimeConstraint, model: SemanticModel): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!model.messages?.[tc.fromMessageId]) {
      errors.push(`Time constraint references missing message "${tc.fromMessageId}"`);
    }
    if (tc.constraintKind === 'DURATION') {
      if (!tc.toMessageId || !tc.toEnd) {
        errors.push('Duration constraint needs a second occurrence anchor');
      } else if (!model.messages?.[tc.toMessageId]) {
        errors.push(`Duration constraint references missing message "${tc.toMessageId}"`);
      }
    }
    if (!tc.expression || tc.expression.trim() === '') {
      warnings.push('Timing constraint has no expression');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}

/**
 * Returns the IRClass / IRInterface that owns the operations for a given
 * `represents` id, or null if the target is not a classifier (e.g. ACTOR).
 */
function resolveOperationOwner(
  model: SemanticModel,
  representsId: string | undefined,
): IRClass | IRInterface | null {
  if (!representsId) return null;
  if (model.classes[representsId]) return model.classes[representsId];
  if (model.interfaces[representsId]) return model.interfaces[representsId];
  return null;
}

export const sequenceDiagramValidator = new SequenceDiagramValidator();
