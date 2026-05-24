import type { BaseDomainEdge, Labelable } from './base.types';

export type SequenceDiagramEdgeType =
  | 'MESSAGE_SYNC'
  | 'MESSAGE_ASYNC'
  | 'MESSAGE_REPLY';

export interface SyncMessageEdge extends BaseDomainEdge, Labelable {
  type: 'MESSAGE_SYNC';
  sequenceNumber?: number;
  operationId?: string;
  arguments?: string;
}

export interface AsyncMessageEdge extends BaseDomainEdge, Labelable {
  type: 'MESSAGE_ASYNC';
  sequenceNumber?: number;
  operationId?: string;
  arguments?: string;
}

export interface ReplyMessageEdge extends BaseDomainEdge, Labelable {
  type: 'MESSAGE_REPLY';
  sequenceNumber?: number;
  inReplyTo?: string;
}

export type SequenceDiagramEdge =
  | SyncMessageEdge
  | AsyncMessageEdge
  | ReplyMessageEdge;
