import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type {
  LatestRunResponse,
  RequestStatus,
  RunOptimizationPayload,
  RunOptimizationResponse,
  Transfer,
  UnmetShortage,
} from '../types/contracts';

interface OptimizationState {
  latest: LatestRunResponse | null;
  latestStatus: RequestStatus;
  manualRunStatus: RequestStatus;
  error: string | null;
  latestError: string | null;
  manualRunError: string | null;
}

const initialState: OptimizationState = {
  latest: null,
  latestStatus: 'idle',
  manualRunStatus: 'idle',
  error: null,
  latestError: null,
  manualRunError: null,
};

const DEMO_TRANSFERS: Transfer[] = [
  {
    source_facility_code: 'H01',
    destination_facility_code: 'H02',
    medicine_code: 'MED-001',
    source_batch_code: 'BATCH-A101',
    recommended_quantity_units: 120,
    estimated_cost_minor_units: 45000,
    transit_days: 2,
    reason: 'Illustrative surplus-to-shortage transfer',
    status: 'PENDING_REVIEW',
  },
  {
    source_facility_code: 'H03',
    destination_facility_code: 'H01',
    medicine_code: 'MED-002',
    source_batch_code: 'BATCH-B204',
    recommended_quantity_units: 80,
    estimated_cost_minor_units: 60000,
    transit_days: 1,
    reason: 'Illustrative shortage coverage',
    status: 'PENDING_REVIEW',
  },
  {
    source_facility_code: 'H01',
    destination_facility_code: 'H04',
    medicine_code: 'MED-003',
    source_batch_code: 'BATCH-C305',
    recommended_quantity_units: 50,
    estimated_cost_minor_units: 80000,
    transit_days: 3,
    reason: 'Illustrative network redistribution',
    status: 'PENDING_REVIEW',
  },
];

const DEMO_SHORTAGES: UnmetShortage[] = [
  {
    facility_code: 'H02',
    medicine_code: 'MED-004',
    shortage_before_units: 100,
    recommended_inbound_units: 60,
    shortage_after_units: 40,
    reason: 'Illustrative remaining shortage',
  },
  {
    facility_code: 'H04',
    medicine_code: 'MED-005',
    shortage_before_units: 75,
    recommended_inbound_units: 25,
    shortage_after_units: 50,
    reason: 'Illustrative remaining shortage',
  },
];

function createDemoLatestRun(
  planningDate = new Date().toISOString().slice(0, 10),
  budgetMinorUnits = 500000,
): LatestRunResponse {
  // These are illustrative demo records, not optimizer-generated results.
  const transfers = DEMO_TRANSFERS.filter(
    (transfer) =>
      transfer.estimated_cost_minor_units <= budgetMinorUnits,
  );

  const totalUnits = transfers.reduce(
    (total, transfer) => total + transfer.recommended_quantity_units,
    0,
  );

  const totalCost = transfers.reduce(
    (total, transfer) => total + transfer.estimated_cost_minor_units,
    0,
  );

  const runId = `DEMO-${Date.now()}`;

  return {
    run: {
      run_id: runId,
      status: 'DEMO',
      trigger_source: 'MANUAL',
      trigger_reason: 'Frontend demonstration only',
      planning_date: planningDate,
      budget_minor_units: budgetMinorUnits,
      objective_policy: 'PRIORITY_WEIGHTED_UNITS_THEN_COST',
      created_at: new Date().toISOString(),
      solver_status_stage_1: 'NOT_RUN_DEMO',
      solver_status_stage_2: 'NOT_RUN_DEMO',
    },
    visibility_scope: 'NETWORK',
    facility_code: null,
    summary: {
      transfer_count: transfers.length,
      recommended_units: totalUnits,
      estimated_cost_minor_units: totalCost,
      unmet_shortage_count: DEMO_SHORTAGES.length,
      unmet_shortage_units: DEMO_SHORTAGES.reduce(
        (total, shortage) => total + shortage.shortage_after_units,
        0,
      ),
    },
    transfers,
    unmet_shortages: DEMO_SHORTAGES,
  };
}

export const loadLatestRunThunk = createAsyncThunk<
  LatestRunResponse,
  void,
  { rejectValue: string }
>('optimization/latest', async () => {
  // Frontend-only mode: do not call the API.
  return createDemoLatestRun();
});

export const runOptimizationThunk = createAsyncThunk<
  RunOptimizationResponse,
  RunOptimizationPayload,
  { rejectValue: string }
>('optimization/run', async (payload) => {
  // Frontend-only simulation; no real optimization solver runs here.
  const latest = createDemoLatestRun(
    payload.planning_date,
    payload.budget_minor_units,
  );

  return {
    run: latest.run!,
    summary: {
      transfer_count: latest.summary.transfer_count,
      total_recommended_units: latest.summary.recommended_units,
      total_cost_minor_units: latest.summary.estimated_cost_minor_units,
      initial_shortage_line_count: DEMO_SHORTAGES.length,
     unmet_shortage_line_count: latest.summary.unmet_shortage_count,
      total_unmet_shortage_units: latest.summary.unmet_shortage_units,
      priority_weighted_units_score: 0,
    },
    transfers: latest.transfers,
    unmet_shortages: latest.unmet_shortages,
    warnings: [
      'Demo mode: these illustrative results were not produced by an optimization solver.',
    ],
  };
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
            recommended_units: action.payload.summary.total_recommended_units,
            estimated_cost_minor_units:
              action.payload.summary.total_cost_minor_units,
            unmet_shortage_count:
              action.payload.summary.unmet_shortage_line_count,
            unmet_shortage_units:
              action.payload.summary.total_unmet_shortage_units,
          },
          transfers: action.payload.transfers,
          unmet_shortages: action.payload.unmet_shortages,
        };
      })
      .addCase(runOptimizationThunk.rejected, (state, action) => {
        state.manualRunStatus = 'failed';
        state.manualRunError =
          action.payload ?? action.error.message ?? 'Demo run failed.';
        state.error = state.manualRunError;
      });
  },
});

export const { clearOptimization } = slice.actions;
export default slice.reducer;
