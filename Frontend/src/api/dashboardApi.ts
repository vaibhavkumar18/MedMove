// src/api/dashboardApi.ts

import { httpClient } from './httpClient';
import type { DashboardResponse } from '../types/contracts';

export const dashboardApi = {
  async getDashboard(): Promise<DashboardResponse> {
    const { data } = await httpClient.get<DashboardResponse>(
      '/dashboard',
    );

    return data;
  },
};