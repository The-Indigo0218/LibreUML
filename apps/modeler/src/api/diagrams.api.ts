import apiClient from './client';
import type {
  DiagramSummaryResponse,
  DiagramDetailResponse,
  CreateDiagramRequest,
  UpdateDiagramRequest,
  PagedResult,
} from './types';

export async function listDiagrams(page = 0, size = 20): Promise<PagedResult<DiagramSummaryResponse>> {
  const response = await apiClient.get<PagedResult<DiagramSummaryResponse>>('/diagrams', {
    params: { page, size },
  });
  return response.data;
}

export async function getDiagram(id: string): Promise<DiagramDetailResponse> {
  const response = await apiClient.get<DiagramDetailResponse>(`/diagrams/${id}`);
  return response.data;
}

export async function createDiagram(data: CreateDiagramRequest): Promise<DiagramDetailResponse> {
  const response = await apiClient.post<DiagramDetailResponse>('/diagrams', data);
  return response.data;
}

export async function updateDiagram(
  id: string,
  data: UpdateDiagramRequest,
): Promise<DiagramDetailResponse> {
  const response = await apiClient.patch<DiagramDetailResponse>(`/diagrams/${id}`, data);
  return response.data;
}

export async function deleteDiagram(id: string): Promise<void> {
  await apiClient.delete(`/diagrams/${id}`);
}
