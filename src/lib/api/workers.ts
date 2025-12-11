/**
 * Workers API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { Worker } from '@/lib/types';

export const workersAPI = {
  /**
   * GET /api/v1/workers
   * List all registered workers
   */
  list: (): Promise<Worker[]> => {
    return apiClient.get<Worker[]>(API_ENDPOINTS.WORKERS.LIST);
  },

  /**
   * GET /api/v1/workers/{id}
   * Get worker details by ID
   */
  get: (id: string): Promise<Worker> => {
    return apiClient.get<Worker>(API_ENDPOINTS.WORKERS.GET(id));
  },

  /**
   * DELETE /api/v1/workers/{id}
   * Deregister a worker
   */
  deregister: (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.WORKERS.DEREGISTER(id));
  },
};
