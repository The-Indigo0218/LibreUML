import apiClient from './client';
import type {
  ProjectSummaryResponse,
  ProjectDetailResponse,
  ProjectFullResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
  ModelResponse,
  UpdateModelRequest,
  UpdateModelResponse,
  CloudDiagramResponse,
  CreateCloudDiagramRequest,
  CreateCloudDiagramResponse,
  UpdateCloudDiagramRequest,
  UpdateCloudDiagramResponse,
  PagedResult,
} from './types';

// ── Projects ──────────────────────────────────────────────────────────────────

export async function listProjects(
  page = 0,
  size = 20,
): Promise<PagedResult<ProjectSummaryResponse>> {
  const response = await apiClient.get<PagedResult<ProjectSummaryResponse>>('/projects', {
    params: { page, size },
  });
  return response.data;
}

export async function createProject(
  data: CreateProjectRequest,
): Promise<CreateProjectResponse> {
  const response = await apiClient.post<CreateProjectResponse>('/projects', data);
  return response.data;
}

export async function getProject(id: string): Promise<ProjectDetailResponse> {
  const response = await apiClient.get<ProjectDetailResponse>(`/projects/${id}`);
  return response.data;
}

export async function getProjectFull(id: string): Promise<ProjectFullResponse> {
  const response = await apiClient.get<ProjectFullResponse>(`/projects/${id}/full`);
  return response.data;
}

export async function updateProject(
  id: string,
  data: UpdateProjectRequest,
): Promise<UpdateProjectResponse> {
  const response = await apiClient.patch<UpdateProjectResponse>(`/projects/${id}`, data);
  return response.data;
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/projects/${id}`);
}

// ── Model ─────────────────────────────────────────────────────────────────────

export async function getProjectModel(projectId: string): Promise<ModelResponse> {
  const response = await apiClient.get<ModelResponse>(`/projects/${projectId}/model`);
  return response.data;
}

export async function updateProjectModel(
  projectId: string,
  data: UpdateModelRequest,
): Promise<UpdateModelResponse> {
  const response = await apiClient.patch<UpdateModelResponse>(
    `/projects/${projectId}/model`,
    data,
  );
  return response.data;
}

// ── Diagrams ──────────────────────────────────────────────────────────────────

export async function listProjectDiagrams(
  projectId: string,
): Promise<CloudDiagramResponse[]> {
  const response = await apiClient.get<CloudDiagramResponse[]>(
    `/projects/${projectId}/diagrams`,
  );
  return response.data;
}

export async function createProjectDiagram(
  projectId: string,
  data: CreateCloudDiagramRequest,
): Promise<CreateCloudDiagramResponse> {
  const response = await apiClient.post<CreateCloudDiagramResponse>(
    `/projects/${projectId}/diagrams`,
    data,
  );
  return response.data;
}

export async function getProjectDiagram(
  projectId: string,
  diagramId: string,
): Promise<CloudDiagramResponse> {
  const response = await apiClient.get<CloudDiagramResponse>(
    `/projects/${projectId}/diagrams/${diagramId}`,
  );
  return response.data;
}

export async function updateProjectDiagram(
  projectId: string,
  diagramId: string,
  data: UpdateCloudDiagramRequest,
): Promise<UpdateCloudDiagramResponse> {
  const response = await apiClient.patch<UpdateCloudDiagramResponse>(
    `/projects/${projectId}/diagrams/${diagramId}`,
    data,
  );
  return response.data;
}

export async function deleteProjectDiagram(
  projectId: string,
  diagramId: string,
): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/diagrams/${diagramId}`);
}
