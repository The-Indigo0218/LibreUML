import apiClient from './client';
import type { QuotaResponse } from './types';

export async function getQuota(): Promise<QuotaResponse> {
  const response = await apiClient.get<QuotaResponse>('/users/me/quota');
  return response.data;
}
