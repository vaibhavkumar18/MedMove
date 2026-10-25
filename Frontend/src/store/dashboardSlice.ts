import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { dashboardApi } from '../api/dashboardApi';
import { getErrorMessage } from '../utils/errors';
import type { DashboardResponse, RequestStatus } from '../types/contracts';

interface DashboardState { data: DashboardResponse | null; status: RequestStatus; error: string | null; }
const initialState: DashboardState = { data: null, status: 'idle', error: null };

export const loadDashboardThunk = createAsyncThunk<DashboardResponse, void, { rejectValue: string }>(
  'dashboard/load', async (_, { rejectWithValue }) => {
    try { return await dashboardApi.getDashboard(); } catch (error) { return rejectWithValue(getErrorMessage(error)); }
  },
);
const slice = createSlice({
  name: 'dashboard', initialState, reducers: { clearDashboard(state) { state.data = null; state.status = 'idle'; state.error = null; } },
  extraReducers: (builder) => builder
    .addCase(loadDashboardThunk.pending, (state) => { state.status = 'loading'; state.error = null; })
    .addCase(loadDashboardThunk.fulfilled, (state, action) => { state.status = 'succeeded'; state.data = action.payload; })
    .addCase(loadDashboardThunk.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload ?? 'Unable to load dashboard.'; }),
});
export const { clearDashboard } = slice.actions;
export default slice.reducer;
