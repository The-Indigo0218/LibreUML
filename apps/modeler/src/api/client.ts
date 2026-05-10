import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

const AUTH_REFRESH_PATH = '/auth/refresh';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

type QueueEntry = {
  resolve: () => void;
  reject: (reason: unknown) => void;
};

let isRefreshing = false;
let failedQueue: QueueEntry[] = [];

function flushQueue(error: unknown): void {
  for (const entry of failedQueue) {
    if (error !== null) {
      entry.reject(error);
    } else {
      entry.resolve();
    }
  }
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const config = error.config as RetryConfig | undefined;

    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      !config.url?.endsWith(AUTH_REFRESH_PATH)
    ) {
      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(config));
      }

      config._retry = true;
      isRefreshing = true;

      try {
        await apiClient.post(AUTH_REFRESH_PATH);
        flushQueue(null);
        return apiClient(config);
      } catch (refreshError: unknown) {
        flushQueue(refreshError);
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
