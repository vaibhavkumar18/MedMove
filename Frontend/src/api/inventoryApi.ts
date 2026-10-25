// src/api/inventoryApi.ts

import { httpClient } from './httpClient';
import type {
  CreateBatchPayload,
  InventoryMutationResponse,
  InventoryResponse,
  MedicineOption,
  UpdateBatchPayload,
} from '../types/contracts';

export const inventoryApi = {
  async getInventory(
    facilityCode?: string,
  ): Promise<InventoryResponse> {
    const { data } = await httpClient.get<InventoryResponse>(
      '/inventory',
      {
        params: facilityCode
          ? { facility_code: facilityCode }
          : undefined,
      },
    );

    return data;
  },

  async getMedicines(): Promise<{ medicines: MedicineOption[] }> {
    const { data } = await httpClient.get<{
      medicines: MedicineOption[];
    }>('/catalog/medicines');

    return data;
  },

  async createBatch(
    payload: CreateBatchPayload,
  ): Promise<InventoryMutationResponse> {
    const { data } =
      await httpClient.post<InventoryMutationResponse>(
        '/inventory/batches',
        payload,
      );

    return data;
  },

  async updateBatch(
    batchCode: string,
    patch: UpdateBatchPayload,
  ): Promise<InventoryMutationResponse> {
    const encodedBatchCode = encodeURIComponent(batchCode);

    const { data } =
      await httpClient.patch<InventoryMutationResponse>(
        `/inventory/batches/${encodedBatchCode}`,
        patch,
      );

    return data;
  },
};