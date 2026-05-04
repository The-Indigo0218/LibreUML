// src/adapters/storage/cloud.adapter.ts
//
// CloudStorageAdapter — wraps the synchronous local StorageAdapter (so Zustand
// persist continues to work unchanged) and exposes async cloud I/O methods for
// the three independent resources: project metadata, semantic model, and individual
// diagram views.

import {
  type StorageAdapter,
  createStorageAdapter,
} from './storage.adapter';
import {
  createProject,
  updateProject,
  getProjectFull,
  deleteProject,
  updateProjectModel,
  createProjectDiagram,
  updateProjectDiagram,
  deleteProjectDiagram,
} from '../../api/projects.api';
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
  ProjectFullResponse,
  UpdateModelRequest,
  UpdateModelResponse,
  CreateCloudDiagramRequest,
  CreateCloudDiagramResponse,
  UpdateCloudDiagramRequest,
  UpdateCloudDiagramResponse,
} from '../../api/types';

// ── CloudStorageAdapter ───────────────────────────────────────────────────────

export class CloudStorageAdapter implements StorageAdapter {
  private readonly local: StorageAdapter;

  constructor(base?: StorageAdapter) {
    this.local = base ?? createStorageAdapter();
  }

  // ── Synchronous StorageAdapter implementation ─────────────────────────────

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

  // ── Project metadata ──────────────────────────────────────────────────────

  async createProjectInCloud(
    req: CreateProjectRequest,
  ): Promise<CreateProjectResponse> {
    return createProject(req);
  }

  async updateProjectInCloud(
    id: string,
    req: UpdateProjectRequest,
  ): Promise<UpdateProjectResponse> {
    return updateProject(id, req);
  }

  async loadProjectFull(id: string): Promise<ProjectFullResponse> {
    return getProjectFull(id);
  }

  async deleteProjectFromCloud(id: string): Promise<void> {
    return deleteProject(id);
  }

  // ── Semantic model ────────────────────────────────────────────────────────

  async updateModelInCloud(
    projectId: string,
    req: UpdateModelRequest,
  ): Promise<UpdateModelResponse> {
    return updateProjectModel(projectId, req);
  }

  // ── Diagram view (canvas) ─────────────────────────────────────────────────

  async createDiagramInCloud(
    projectId: string,
    req: CreateCloudDiagramRequest,
  ): Promise<CreateCloudDiagramResponse> {
    return createProjectDiagram(projectId, req);
  }

  async updateDiagramInCloud(
    projectId: string,
    diagramId: string,
    req: UpdateCloudDiagramRequest,
  ): Promise<UpdateCloudDiagramResponse> {
    return updateProjectDiagram(projectId, diagramId, req);
  }

  async deleteDiagramFromCloud(
    projectId: string,
    diagramId: string,
  ): Promise<void> {
    return deleteProjectDiagram(projectId, diagramId);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const cloudAdapter = new CloudStorageAdapter();
