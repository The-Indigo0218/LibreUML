import type { BaseDomainNode, Documentable } from './base.types';
import type { LifelineParticipantKind, MessageKind } from '../../vfs/vfs.types';

export type SequenceDiagramNodeType =
  | 'LIFELINE'
  | 'ACTIVATION'
  | 'FRAGMENT'
  | 'STATE_INVARIANT'
  | 'INTERACTION_USE'
  | 'GATE'
  | 'NOTE';

export interface LifelineNode extends BaseDomainNode, Documentable {
  type: 'LIFELINE';
  name: string;
  participantKind: LifelineParticipantKind;
  represents?: string;
  alias?: string;
}

export interface ActivationNode extends BaseDomainNode {
  type: 'ACTIVATION';
  lifelineId: string;
  startMessageId: string;
  endMessageId?: string;
}

export interface FragmentNode extends BaseDomainNode, Documentable {
  type: 'FRAGMENT';
  fragmentKind:
    | 'ALT' | 'OPT' | 'LOOP' | 'PAR' | 'SEQ' | 'STRICT' | 'BREAK' | 'CRITICAL'
    | 'NEG' | 'ASSERT' | 'IGNORE' | 'CONSIDER';
  coveredLifelineIds: string[];
}

export interface StateInvariantNode extends BaseDomainNode {
  type: 'STATE_INVARIANT';
  lifelineId: string;
  constraint: string;
  afterSequenceNumber: number;
}

export interface InteractionUseNode extends BaseDomainNode {
  type: 'INTERACTION_USE';
  coveredLifelineIds: string[];
  referencedDiagramId?: string;
  referencedName?: string;
  afterSequenceNumber: number;
}

export interface GateNode extends BaseDomainNode {
  type: 'GATE';
  ownerFragmentId: string;
  side: 'LEFT' | 'RIGHT';
  afterSequenceNumber: number;
}

export type SequenceDiagramNode =
  | LifelineNode
  | ActivationNode
  | FragmentNode
  | StateInvariantNode
  | InteractionUseNode
  | GateNode;

export type { MessageKind };
