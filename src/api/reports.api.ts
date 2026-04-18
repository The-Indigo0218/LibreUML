import apiClient from './client';
import type { CreateReportRequest, ReportResponse, PagedResult } from './types';

export async function submitReport(data: CreateReportRequest): Promise<ReportResponse> {
  const response = await apiClient.post<ReportResponse>('/reports', data);
  return response.data;
}

export async function listMyReports(page = 0, size = 20): Promise<PagedResult<ReportResponse>> {
  const response = await apiClient.get<PagedResult<ReportResponse>>('/reports/my', {
    params: { page, size },
  });
  return response.data;
}

export async function getReport(id: string): Promise<ReportResponse> {
  const response = await apiClient.get<ReportResponse>(`/reports/${id}`);
  return response.data;
}
