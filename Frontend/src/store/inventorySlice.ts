import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { inventoryApi } from '../api/inventoryApi';
import { getErrorMessage } from '../utils/errors';
import type { CreateBatchPayload, InventoryBatch, InventoryMutationResponse, MedicineOption, RequestStatus, UpdateBatchPayload } from '../types/contracts';

interface InventoryState {
  batches: InventoryBatch[]; medicines: MedicineOption[]; status: RequestStatus;
  mutationStatus: RequestStatus; error: string | null; trigger: InventoryMutationResponse['trigger'] | null;
}
const initialState: InventoryState = { batches: [], medicines: [], status: 'idle', mutationStatus: 'idle', error: null, trigger: null };

export const loadInventoryThunk = createAsyncThunk<InventoryBatch[], string | undefined, { rejectValue: string }>(
  'inventory/load', async (facilityCode, { rejectWithValue }) => {
    try { const result = await inventoryApi.getInventory(facilityCode); return result.batches; } catch (error) { return rejectWithValue(getErrorMessage(error)); }
  },
);
export const loadMedicinesThunk = createAsyncThunk<MedicineOption[], void, { rejectValue: string }>(
  'inventory/medicines', async (_, { rejectWithValue }) => {
    try { const result = await inventoryApi.getMedicines(); return result.medicines; } catch (error) { return rejectWithValue(getErrorMessage(error)); }
  },
);
export const createBatchThunk = createAsyncThunk<InventoryMutationResponse, CreateBatchPayload, { rejectValue: string }>(
  'inventory/createBatch', async (payload, { rejectWithValue }) => {
    try { return await inventoryApi.createBatch(payload); } catch (error) { return rejectWithValue(getErrorMessage(error)); }
  },
);
export const updateBatchThunk = createAsyncThunk<InventoryMutationResponse, { batchCode: string; patch: UpdateBatchPayload }, { rejectValue: string }>(
  'inventory/updateBatch', async ({ batchCode, patch }, { rejectWithValue }) => {
    try { return await inventoryApi.updateBatch(batchCode, patch); } catch (error) { return rejectWithValue(getErrorMessage(error)); }
  },
);

const slice = createSlice({
  name: 'inventory', initialState,
  reducers: { clearInventory(state) { state.batches = []; state.status = 'idle'; state.error = null; state.trigger = null; } },
  extraReducers: (builder) => builder
    .addCase(loadInventoryThunk.pending, (state) => { state.status = 'loading'; state.error = null; })
    .addCase(loadInventoryThunk.fulfilled, (state, action) => { state.status = 'succeeded'; state.batches = action.payload; })
    .addCase(loadInventoryThunk.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload ?? 'Unable to load inventory.'; })
    .addCase(loadMedicinesThunk.fulfilled, (state, action) => { state.medicines = action.payload; })
    .addCase(createBatchThunk.pending, (state) => { state.mutationStatus = 'loading'; state.error = null; state.trigger = null; })
    .addCase(createBatchThunk.fulfilled, (state, action) => { state.mutationStatus = 'succeeded'; state.trigger = action.payload.trigger; })
    .addCase(createBatchThunk.rejected, (state, action) => { state.mutationStatus = 'failed'; state.error = action.payload ?? 'Unable to save inventory.'; })
    .addCase(updateBatchThunk.pending, (state) => { state.mutationStatus = 'loading'; state.error = null; state.trigger = null; })
    .addCase(updateBatchThunk.fulfilled, (state, action) => { state.mutationStatus = 'succeeded'; state.trigger = action.payload.trigger; })
    .addCase(updateBatchThunk.rejected, (state, action) => { state.mutationStatus = 'failed'; state.error = action.payload ?? 'Unable to update inventory.'; }),
});
export const { clearInventory } = slice.actions;
export default slice.reducer;
