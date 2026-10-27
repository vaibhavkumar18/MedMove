// src/api/optimizationApi.ts

import { httpClient } from './httpClient';
import type {
  LatestRunResponse,
  RunOptimizationPayload,
  RunOptimizationResponse,
} from '../types/contracts';

const OPTIMIZATION_TIMEOUT_MS = 120_000;

export const optimizationApi = {
  async runOptimization(
    payload: RunOptimizationPayload,
  ): Promise<RunOptimizationResponse> {
    const { data } =
      await httpClient.post<RunOptimizationResponse>(
        '/optimization-runs',
        payload,
        {
          timeout: OPTIMIZATION_TIMEOUT_MS,
        },
      );

    return data;
  },

  async getLatestRun(): Promise<LatestRunResponse> {
    const { data } =
      await httpClient.get<LatestRunResponse>(
        '/optimization-runs/latest',
      );

    return data;
  },

  async getRun(runId: string): Promise<LatestRunResponse> {
    const encodedRunId = encodeURIComponent(runId);

    const { data } =
      await httpClient.get<LatestRunResponse>(
        `/optimization-runs/${encodedRunId}`,
      );

    return data;
  },
};