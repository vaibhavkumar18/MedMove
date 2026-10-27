# app/optimizer/schemas.py
from pydantic import BaseModel, Field
from datetime import date
from typing import List, Literal, Optional

# --- Enums / Literals ---
QualityStatus = Literal["ELIGIBLE", "QUARANTINED", "RECALLED", "DAMAGED"]
ObjectivePolicy = Literal["PRIORITY_WEIGHTED_UNITS_THEN_COST"]
CurrencyCode = Literal["INR"]
RunStatus = Literal["RUNNING", "COMPLETED", "FAILED"]
SolverStatus = Literal["OPTIMAL", "FEASIBLE", "INFEASIBLE", "NOT_SOLVED"]

# --- Request Inputs (Strict Contract) ---
class FacilityInput(BaseModel):
    id: str
    code: str
    name: str
    is_active: bool

class MedicineInput(BaseModel):
    id: str
    code: str
    name: str
    base_unit: str
    is_active: bool

class InventoryBatchInput(BaseModel):
    id: str
    facility_id: str
    medicine_id: str
    lot_number: str
    expiry_date: date
    available_quantity_units: int = Field(ge=0)
    quality_status: QualityStatus

class PolicyInput(BaseModel):
    facility_id: str
    medicine_id: str
    target_stock_units: int = Field(ge=0)
    minimum_reserve_units: int = Field(ge=0)
    avg_daily_demand_units: float = Field(ge=0)
    priority_weight: int = Field(ge=1, le=5)
    minimum_remaining_shelf_life_days: int = Field(ge=0)

class RouteInput(BaseModel):
    id: str
    source_facility_id: str
    destination_facility_id: str
    transit_days: int = Field(ge=0)
    cost_per_unit_minor_units: int = Field(ge=0)
    route_capacity_units: int = Field(ge=0)
    currency_code: CurrencyCode
    is_active: bool

class OptimizationRequest(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    run_id: str
    planning_date: date
    horizon_days: int = Field(ge=1, le=90, default=30)
    budget_minor_units: int = Field(ge=0)
    currency_code: CurrencyCode = "INR"
    objective_policy: ObjectivePolicy
    facilities: List[FacilityInput]
    medicines: List[MedicineInput]
    inventory_batches: List[InventoryBatchInput]
    facility_medicine_policies: List[PolicyInput]
    routes: List[RouteInput]
    max_solve_seconds: int = Field(ge=1, le=60, default=10)

# --- Result Outputs (Strict Contract) ---
class OptimizationSummary(BaseModel):
    estimated_cost_minor_units: int = Field(ge=0)
    budget_remaining_minor_units: int = Field(ge=0)
    transfer_line_count: int = Field(ge=0)
    shortage_lines_total: int = Field(ge=0)
    shortage_lines_with_any_fulfillment: int = Field(ge=0)
    priority_weighted_units_score: int = Field(ge=0)

class Recommendation(BaseModel):
    id: str
    source_facility_id: str
    destination_facility_id: str
    medicine_id: str
    source_batch_id: str
    route_id: str
    quantity_units: int = Field(gt=0)
    expected_arrival_date: date
    transit_days: int = Field(ge=0)
    unit_cost_minor_units: int = Field(ge=0)
    total_cost_minor_units: int = Field(ge=0)
    currency_code: CurrencyCode
    priority_weight: int = Field(ge=1, le=5)
    explanation_codes: List[str] = []

class UnmetShortage(BaseModel):
    facility_id: str
    medicine_id: str
    shortage_before_units: int = Field(ge=0)
    recommended_units: int = Field(ge=0)
    shortage_after_units: int = Field(ge=0)
    priority_weight: int = Field(ge=1, le=5)

class OptimizationResult(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    run_id: str
    status: RunStatus = "COMPLETED"
    objective_policy: ObjectivePolicy
    solver_status_stage_1: SolverStatus = "OPTIMAL"
    solver_status_stage_2: Optional[SolverStatus] = "OPTIMAL"
    optimality_proven: bool = True
    optimizer_version: str = "1.0"
    solve_time_ms: int = Field(ge=0, default=0)
    summary: OptimizationSummary
    recommendations: List[Recommendation] = []
    unmet_shortages: List[UnmetShortage] = []
    warnings: List[str] = []

# --- Helper models for pre-checks (Dashboard/Trigger) ---
# THESE ARE THE CLASSES THAT WERE MISSING IN YOUR FILE
class ShortageLine(BaseModel):
    facility_code: str
    medicine_code: str
    usable_stock_units: int
    target_stock_units: int
    shortage_units: int
    priority_weight: int

class SurplusLine(BaseModel):
    facility_code: str
    medicine_code: str
    usable_stock_units: int
    minimum_reserve_units: int
    surplus_units: int
    priority_weight: int