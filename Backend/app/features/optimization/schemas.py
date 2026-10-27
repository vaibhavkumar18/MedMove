from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ObjectivePolicy = Literal["PRIORITY_WEIGHTED_UNITS_THEN_COST"]


class ManualRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    planning_date: date
    budget_minor_units: int = Field(ge=0)
    objective_policy: ObjectivePolicy


class OptimizationRunResponse(BaseModel):
    run_id: str
    status: str
    trigger_source: str
    trigger_reason: str
    planning_date: date
    budget_minor_units: int
    objective_policy: str
    input_snapshot_hash: str
    created_at: datetime
    solver_status_stage_1: str | None = None
    solver_status_stage_2: str | None = None


class TransferResponse(BaseModel):
    source_facility_code: str
    source_facility_name: str | None = None
    destination_facility_code: str
    destination_facility_name: str | None = None
    medicine_code: str
    medicine_name: str | None = None
    source_batch_code: str
    recommended_quantity_units: int
    cost_per_unit_minor_units: int
    estimated_cost_minor_units: int
    transit_days: int
    reason: str | None = None
    status: Literal["PENDING_REVIEW"] = "PENDING_REVIEW"
    direction: Literal["OUTGOING", "INCOMING"] | None = None


class UnmetShortageResponse(BaseModel):
    facility_code: str
    medicine_code: str
    shortage_before_units: int
    recommended_inbound_units: int
    shortage_after_units: int
    reason: str | None = None


class OptimizationSummaryResponse(BaseModel):
    transfer_count: int
    total_recommended_units: int
    total_cost_minor_units: int
    initial_shortage_line_count: int
    unmet_shortage_line_count: int
    total_unmet_shortage_units: int
    priority_weighted_units_score: int


class OptimizationRunResponseBody(BaseModel):
    run: OptimizationRunResponse
    summary: OptimizationSummaryResponse
    transfers: list[TransferResponse]
    unmet_shortages: list[UnmetShortageResponse]
    warnings: list[str]


class LatestRunResponse(OptimizationRunResponseBody):
    run: OptimizationRunResponse | None
    visibility_scope: Literal["FACILITY", "NETWORK"]
    facility_code: str | None
