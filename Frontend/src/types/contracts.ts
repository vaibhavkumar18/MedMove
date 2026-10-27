export type UserRole = 'HOSPITAL_USER' | 'NETWORK_COORDINATOR';
export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';
export type QualityStatus = 'ELIGIBLE' | 'QUARANTINED' | 'RECALLED' | 'DAMAGED';
export type TriggerDecision =
  | 'RAN'
  | 'SKIPPED_UNCHANGED'
  | 'SKIPPED_NO_NETWORK_SHORTAGE'
  | 'SKIPPED_SNAPSHOT_ALREADY_ANALYZED'
  | 'FAILED';

export interface UserProfile {
  user_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  facility_code: string | null;
  facility_name: string | null;
}

export interface AuthResponse {
  access_token?: string | null;
  token_type?: 'bearer' | string;
  user: UserProfile;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: Record<string, string> };
  detail?: string | Array<{ loc?: Array<string | number>; msg?: string; type?: string }>;
}

export interface DashboardFacility {
  facility_code: string;
  facility_name: string;
  shortage_line_count: number;
  total_shortage_units: number;
  eligible_surplus_line_count: number;
  eligible_surplus_units: number;
}

export interface DashboardShortage {
  facility_code: string;
  medicine_code: string;
  usable_stock_units?: number;
  target_stock_units?: number;
  shortage_units?: number;
  priority_weight?: number;
}

export interface DashboardResponse {
  viewer: { role: UserRole; facility_code: string | null; facility_name: string | null };
  generated_at: string;
  summary: {
    facility_count: number;
    medicine_count: number;
    shortage_line_count: number;
    total_shortage_units: number;
    eligible_surplus_line_count: number;
    eligible_surplus_units: number;
    latest_run_status: string | null;
  };
  facilities: DashboardFacility[];
  shortages: DashboardShortage[];
  latest_run: { run_id: string; status: string; trigger_source: string; created_at: string } | null;
}

export interface MedicineOption {
  medicine_code: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  base_unit: string;
}

export interface InventoryBatch {
  batch_code: string;
  facility_code: string;
  facility_name?: string;
  medicine_code: string;
  generic_name: string;
  strength?: string;
  lot_number: string;
  expiry_date: string;
  quantity_on_hand_units: number;
  quality_status: QualityStatus;
  updated_at: string;
}

export interface InventoryResponse {
  batches: InventoryBatch[];
}

export interface CreateBatchPayload {
  medicine_code: string;
  lot_number: string;
  expiry_date: string;
  quantity_on_hand_units: number;
  quality_status: QualityStatus;
}

export interface UpdateBatchPayload {
  quantity_on_hand_units?: number;
  expiry_date?: string;
  quality_status?: QualityStatus;
}

export interface TriggerOutcome {
  decision: TriggerDecision;
  reason?: string;
  optimization_run_id: string | null;
  run_status: string | null;
  message: string;
}

export interface InventoryMutationResponse {
  inventory_batch: Partial<InventoryBatch>;
  trigger: TriggerOutcome;
}

export interface Transfer {
  source_facility_code: string;
  source_facility_name?: string;
  destination_facility_code: string;
  destination_facility_name?: string;
  medicine_code: string;
  medicine_name?: string;
  source_batch_code: string;
  recommended_quantity_units: number;
  estimated_cost_minor_units: number;
  transit_days: number;
  reason?: string;
  status: 'PENDING_REVIEW' | string;
  direction?: 'OUTGOING' | 'INCOMING';
}

export interface UnmetShortage {
  facility_code: string;
  medicine_code: string;
  shortage_before_units: number;
  recommended_inbound_units: number;
  shortage_after_units: number;
  reason?: string;
}

export interface OptimizationRun {
  run_id: string;
  status: string;
  trigger_source: string;
  trigger_reason?: string;
  planning_date: string;
  budget_minor_units: number;
  objective_policy: string;
  created_at: string;
  solver_status_stage_1?: string;
  solver_status_stage_2?: string;
}

export interface LatestRunResponse {
  run: OptimizationRun | null;
  visibility_scope: 'FACILITY' | 'NETWORK';
  facility_code: string | null;
  summary: {
    transfer_count: number;
    total_recommended_units: number;
    total_cost_minor_units: number;
    initial_shortage_line_count: number;
    unmet_shortage_line_count: number;
    total_unmet_shortage_units: number;
    priority_weighted_units_score: number;
  };
  transfers: Transfer[];
  unmet_shortages: UnmetShortage[];
}

export interface RunOptimizationPayload {
  planning_date: string;
  budget_minor_units: number;
  objective_policy: 'PRIORITY_WEIGHTED_UNITS_THEN_COST';
}

export interface RunOptimizationResponse {
  run: OptimizationRun;
  summary: {
    transfer_count: number;
    total_recommended_units: number;
    total_cost_minor_units: number;
    initial_shortage_line_count: number;
    unmet_shortage_line_count: number;
    total_unmet_shortage_units: number;
    priority_weighted_units_score: number;
  };
  transfers: Transfer[];
  unmet_shortages: UnmetShortage[];
  warnings: string[];
}
