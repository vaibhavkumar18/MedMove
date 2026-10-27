import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { optimizationApi } from '../api/optimizationApi';
import { getApiErrorMessage, getApiErrorCode } from '../api/httpClient';

import type {
  LatestRunResponse,
  RequestStatus,
  RunOptimizationPayload,
  RunOptimizationResponse,
} from '../types/contracts';

interface OptimizationState {
  latest: LatestRunResponse | null;
  latestStatus: RequestStatus;
  manualRunStatus: RequestStatus;
  error: string | null;
  latestError: string | null;
  manualRunError: string | null;
}

interface RunOptimizationError {
  message: string;
  code?: string;
}

const initialState: OptimizationState = {
  latest: null,
  latestStatus: 'idle',
  manualRunStatus: 'idle',
  error: null,
  latestError: null,
  manualRunError: null,
};

export const loadLatestRunThunk = createAsyncThunk<
  LatestRunResponse,
  void,
  { rejectValue: string }
>('optimization/latest', async (_, { rejectWithValue }) => {
  try {
    return await optimizationApi.getLatestRun();
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load optimization results.'));
  }
});

export const runOptimizationThunk = createAsyncThunk<
  RunOptimizationResponse,
  RunOptimizationPayload,
  { rejectValue: RunOptimizationError }
>('optimization/run', async (payload, { rejectWithValue }) => {
  try {
    return await optimizationApi.runOptimization(payload);
  } catch (error) {
    return rejectWithValue({
      message: getApiErrorMessage(error, 'Unable to run optimization.'),
      code: getApiErrorCode(error),
    });
  }
});

const slice = createSlice({
  name: 'optimization',
  initialState,
  reducers: {
    clearOptimization(state) {
      state.latest = null;
      state.latestStatus = 'idle';
      state.manualRunStatus = 'idle';
      state.error = null;
      state.latestError = null;
      state.manualRunError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadLatestRunThunk.pending, (state) => {
        state.latestStatus = 'loading';
        state.latestError = null;
        state.error = null;
      })
      .addCase(loadLatestRunThunk.fulfilled, (state, action) => {
        state.latestStatus = 'succeeded';
        state.latest = action.payload;
        state.latestError = null;
        state.error = null;
      })
      .addCase(loadLatestRunThunk.rejected, (state, action) => {
        state.latestStatus = 'failed';
        state.latestError =
          action.payload ?? action.error.message ?? 'Unable to load demo recommendations.';
        state.error = state.latestError;
      })
      .addCase(runOptimizationThunk.pending, (state) => {
        state.manualRunStatus = 'loading';
        state.manualRunError = null;
        state.error = null;
      })
      .addCase(runOptimizationThunk.fulfilled, (state, action) => {
        state.manualRunStatus = 'succeeded';
        state.manualRunError = null;
        state.latestError = null;
        state.error = null;

        state.latest = {
          run: action.payload.run,
          visibility_scope: 'NETWORK',
          facility_code: null,
          summary: {
            transfer_count: action.payload.summary.transfer_count,
            total_recommended_units: action.payload.summary.total_recommended_units,
            total_cost_minor_units:
              action.payload.summary.total_cost_minor_units,
            initial_shortage_line_count:
              action.payload.summary.initial_shortage_line_count,
            unmet_shortage_line_count:
              action.payload.summary.unmet_shortage_line_count,
            total_unmet_shortage_units:
              action.payload.summary.total_unmet_shortage_units,
            priority_weighted_units_score:
              action.payload.summary.priority_weighted_units_score,
          },
          transfers: action.payload.transfers,
          unmet_shortages: action.payload.unmet_shortages,
        };
      })
      .addCase(runOptimizationThunk.rejected, (state, action) => {
        const failure = action.payload;
        state.manualRunStatus = 'failed';
        state.manualRunError = failure?.message ?? 'Unable to run optimization.';
        // DUPLICATE_RUN is an expected condition, not an error. Suppress
        // the red error banner so the page can show an informational message.
        state.error = failure?.code === 'DUPLICATE_RUN' ? null : state.manualRunError;
      });
  },
});

export const { clearOptimization } = slice.actions;
export default slice.reducer;
