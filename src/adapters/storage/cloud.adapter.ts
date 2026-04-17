// src/adapters/storage/cloud.adapter.ts
//
// CloudStorageAdapter — implements the synchronous StorageAdapter interface
// (delegating all sync operations to the underlying local adapter so Zustand
// persist middleware continues to work unchanged) while also exposing the
// async cloud I/O methods that CloudSyncService uses.
//
// The local StorageAdapter is NEVER replaced. This adapter wraps it, adding
// the async cloud pathway as an adjacent layer.

import {
  type StorageAdapter,
  createStorageAdapter,
} from './storage.adapter';
import {
  createDiagram,
  updateDiagram,
  getDiagram,
  deleteDiagram,
} from '../../api/diagrams.api';
import type {
  CreateDiagramRequest,
  UpdateDiagramRequest,
  DiagramDetailResponse,
} from '../../api/types';
import type { DiagramType as ApiDiagramType } from '../../api/types';

// ── CloudStorageAdapter ───────────────────────────────────────────────────────

export class CloudStorageAdapter implements StorageAdapter {
  private readonly local: StorageAdapter;

  constructor(base?: StorageAdapter) {
    this.local = base ?? createStorageAdapter();
  }

  // ── Synchronous StorageAdapter implementation ─────────────────────────────
  // These delegate straight to the local adapter so Zustand persist continues
  // to work exactly as before.

  getItem(key: string): string | null {
    return this.local.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.local.setItem(key, value);
  }

  removeItem(key: string): void {
    this.local.removeItem(key);
  }

  clear(): void {
    this.local.clear?.();
  }

  getAllKeys(): string[] {
    return this.local.getAllKeys?.() ?? [];
  }

  // ── Async cloud operations ────────────────────────────────────────────────

  /**
   * Creates a new diagram record on the backend and returns the full response
   * (including the server-assigned `id` and initial `version`).
   */
  async createInCloud(
    title: string,
    type: ApiDiagramType,
    content: Record<string, unknown>,
  ): Promise<DiagramDetailResponse> {
    const req: CreateDiagramRequest = { title, type, content };
    return createDiagram(req);
  }

  /**
   * Sends a PATCH to update an existing diagram.
   * `version` must match the server's current version (optimistic lock).
   * Throws on 409 (conflict) or 422 (quota exceeded) — callers handle these.
   */
  async updateInCloud(
    id: string,
    version: number,
    content: Record<string, unknown>,
    title?: string,
  ): Promise<DiagramDetailResponse> {
    const req: UpdateDiagramRequest = { version, content, ...(title ? { title } : {}) };
    return updateDiagram(id, req);
  }

  /**
   * Fetches a diagram by ID. Used to reload the project after a conflict
   * resolution choice of "Keep Theirs".
   */
  async loadFromCloud(id: string): Promise<DiagramDetailResponse> {
    return getDiagram(id);
  }

  /**
   * Deletes a diagram from the backend. Frees quota.
   */
  async deleteFromCloud(id: string): Promise<void> {
    return deleteDiagram(id);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
// Created once and shared across CloudSyncService and any component that
// needs direct cloud I/O (e.g. UploadLocalProject).

export const cloudAdapter = new CloudStorageAdapter();
