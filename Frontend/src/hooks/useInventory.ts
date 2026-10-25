import { useCallback } from 'react';
import { createBatchThunk, loadInventoryThunk, loadMedicinesThunk, updateBatchThunk } from '../store/inventorySlice';
import { useAppDispatch } from './useAppDispatch';
import { useAppSelector } from './useAppSelector';

export function useInventory() {
  const dispatch = useAppDispatch();
  const inventory = useAppSelector((state) => state.inventory);
  return {
    ...inventory,
    loadInventory: useCallback((facilityCode?: string) => dispatch(loadInventoryThunk(facilityCode)), [dispatch]),
    loadMedicines: useCallback(() => dispatch(loadMedicinesThunk()), [dispatch]),
    saveBatch: useCallback((payload: Parameters<typeof createBatchThunk>[0]) => dispatch(createBatchThunk(payload)).unwrap(), [dispatch]),
    updateBatch: useCallback((batchCode: string, patch: Parameters<typeof updateBatchThunk>[0]['patch']) => dispatch(updateBatchThunk({ batchCode, patch })).unwrap(), [dispatch]),
  };
}
