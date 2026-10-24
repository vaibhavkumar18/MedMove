from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class QualityStatus(str, Enum):
    ELIGIBLE = "ELIGIBLE"
    QUARANTINED = "QUARANTINED"
    RECALLED = "RECALLED"
    DAMAGED = "DAMAGED"
    EXPIRED = "EXPIRED"


class CurrencyCode(str, Enum):
    INR = "INR"


class ObjectivePolicy(str, Enum):
    PRIORITY_WEIGHTED_UNITS_THEN_COST = "PRIORITY_WEIGHTED_UNITS_THEN_COST"


class RunStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class SolverStatus(str, Enum):
    OPTIMAL = "OPTIMAL"
    FEASIBLE = "FEASIBLE"
    INFEASIBLE = "INFEASIBLE"
    UNKNOWN = "UNKNOWN"
    MODEL_INVALID = "MODEL_INVALID"


class SchemaModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


NonEmptyId = Field(min_length=1)
NonNegativeInt = Field(ge=0)


class FacilityInput(SchemaModel):
    id: str = NonEmptyId
    code: str = NonEmptyId
    name: str = NonEmptyId
    is_active: bool


class MedicineInput(SchemaModel):
    id: str = NonEmptyId
    code: str = NonEmptyId
    name: str = NonEmptyId
    base_unit: str = NonEmptyId
    is_active: bool


class InventoryBatchInput(SchemaModel):
    id: str = NonEmptyId
    facility_id: str = NonEmptyId
    medicine_id: str = NonEmptyId
    lot_number: str = NonEmptyId
    expiry_date: date
    available_quantity_units: int = NonNegativeInt
    quality_status: QualityStatus


class PolicyInput(SchemaModel):
    facility_id: str = NonEmptyId
    medicine_id: str = NonEmptyId
    target_stock_units: int = NonNegativeInt
    minimum_reserve_units: int = NonNegativeInt
    avg_daily_demand_units: Decimal = Field(ge=0)
    priority_weight: int = Field(ge=1, le=5)
    minimum_remaining_shelf_life_days: int = NonNegativeInt


class RouteInput(SchemaModel):
    id: str = NonEmptyId
    source_facility_id: str = NonEmptyId
    destination_facility_id: str = NonEmptyId
    transit_days: int = NonNegativeInt
    cost_per_unit_minor_units: int = NonNegativeInt
    route_capacity_units: int = NonNegativeInt
    currency_code: CurrencyCode
    is_active: bool


class OptimizationRequest(SchemaModel):
    schema_version: Literal["1.0"]
    run_id: str = NonEmptyId
    planning_date: date
    horizon_days: int = Field(ge=1, le=90)
    budget_minor_units: int = NonNegativeInt
    currency_code: CurrencyCode
    objective_policy: ObjectivePolicy
    facilities: list[FacilityInput]
    medicines: list[MedicineInput]
    inventory_batches: list[InventoryBatchInput]
    facility_medicine_policies: list[PolicyInput]
    routes: list[RouteInput]
    max_solve_seconds: int = Field(ge=1, le=60)

    @model_validator(mode="after")
    def validate_references(self) -> "OptimizationRequest":
        facility_ids = [facility.id for facility in self.facilities]
        medicine_ids = [medicine.id for medicine in self.medicines]
        batch_ids = [batch.id for batch in self.inventory_batches]
        route_ids = [route.id for route in self.routes]
        policy_pairs = [
            (policy.facility_id, policy.medicine_id)
            for policy in self.facility_medicine_policies
        ]

        if len(set(facility_ids)) != len(facility_ids):
            raise ValueError("facility IDs must be unique")
        if len(set(medicine_ids)) != len(medicine_ids):
            raise ValueError("medicine IDs must be unique")
        if len(set(batch_ids)) != len(batch_ids):
            raise ValueError("inventory batch IDs must be unique")
        if len(set(route_ids)) != len(route_ids):
            raise ValueError("route IDs must be unique")
        if len(set(policy_pairs)) != len(policy_pairs):
            raise ValueError("facility-medicine policy pairs must be unique")

        facility_id_set = set(facility_ids)
        medicine_id_set = set(medicine_ids)
        if any(
            batch.facility_id not in facility_id_set
            or batch.medicine_id not in medicine_id_set
            for batch in self.inventory_batches
        ):
            raise ValueError("inventory batch references an unknown facility or medicine")
        if any(
            policy.facility_id not in facility_id_set
            or policy.medicine_id not in medicine_id_set
            for policy in self.facility_medicine_policies
        ):
            raise ValueError("policy references an unknown facility or medicine")
        if any(
            route.source_facility_id not in facility_id_set
            or route.destination_facility_id not in facility_id_set
            for route in self.routes
        ):
            raise ValueError("route references an unknown source or destination facility")
        if any(route.currency_code != self.currency_code for route in self.routes):
            raise ValueError("route currency must match request currency")
        return self


class Recommendation(SchemaModel):
    id: str = NonEmptyId
    source_facility_id: str = NonEmptyId
    destination_facility_id: str = NonEmptyId
    medicine_id: str = NonEmptyId
    source_batch_id: str = NonEmptyId
    route_id: str = NonEmptyId
    quantity_units: int = Field(gt=0)
    expected_arrival_date: date
    transit_days: int = NonNegativeInt
    unit_cost_minor_units: int = NonNegativeInt
    total_cost_minor_units: int = NonNegativeInt
    currency_code: CurrencyCode
    priority_weight: int = Field(ge=1, le=5)
    explanation_codes: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_total_cost(self) -> "Recommendation":
        expected_cost = self.quantity_units * self.unit_cost_minor_units
        if self.total_cost_minor_units != expected_cost:
            raise ValueError("total_cost_minor_units must equal quantity_units * unit_cost_minor_units")
        return self


TransferRecommendation = Recommendation


class UnmetShortage(SchemaModel):
    facility_id: str = NonEmptyId
    medicine_id: str = NonEmptyId
    shortage_before_units: int = NonNegativeInt
    recommended_units: int = NonNegativeInt
    shortage_after_units: int = NonNegativeInt
    priority_weight: int = Field(ge=1, le=5)

    @model_validator(mode="after")
    def validate_shortage_arithmetic(self) -> "UnmetShortage":
        if self.recommended_units > self.shortage_before_units:
            raise ValueError("recommended_units cannot exceed shortage_before_units")
        if self.shortage_after_units != self.shortage_before_units - self.recommended_units:
            raise ValueError(
                "shortage_after_units must equal shortage_before_units - recommended_units"
            )
        return self


class OptimizationSummary(SchemaModel):
    estimated_cost_minor_units: int = NonNegativeInt
    budget_remaining_minor_units: int = NonNegativeInt
    transfer_line_count: int = NonNegativeInt
    shortage_lines_total: int = NonNegativeInt
    shortage_lines_with_any_fulfillment: int = NonNegativeInt
    priority_weighted_units_score: int = NonNegativeInt


class OptimizationResult(SchemaModel):
    schema_version: Literal["1.0"]
    run_id: str = NonEmptyId
    status: RunStatus
    objective_policy: ObjectivePolicy
    solver_status_stage_1: SolverStatus
    solver_status_stage_2: SolverStatus | None
    optimality_proven: bool
    optimizer_version: str = NonEmptyId
    solve_time_ms: int = NonNegativeInt
    summary: OptimizationSummary
    recommendations: list[Recommendation] = Field(default_factory=list)
    unmet_shortages: list[UnmetShortage] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_summary_totals(self) -> "OptimizationResult":
        recommendation_cost = sum(
            recommendation.total_cost_minor_units for recommendation in self.recommendations
        )
        recommendation_score = sum(
            recommendation.quantity_units * recommendation.priority_weight
            for recommendation in self.recommendations
        )
        if self.summary.transfer_line_count != len(self.recommendations):
            raise ValueError("transfer_line_count must equal the number of recommendations")
        if self.summary.estimated_cost_minor_units != recommendation_cost:
            raise ValueError("estimated_cost_minor_units must equal recommendation costs")
        if (
            self.summary.shortage_lines_with_any_fulfillment
            > self.summary.shortage_lines_total
        ):
            raise ValueError(
                "shortage_lines_with_any_fulfillment cannot exceed shortage_lines_total"
            )
        if self.summary.priority_weighted_units_score != recommendation_score:
            raise ValueError(
                "priority_weighted_units_score must equal recommendation priority score"
            )
        return self


__all__ = [
    "CurrencyCode",
    "FacilityInput",
    "InventoryBatchInput",
    "MedicineInput",
    "ObjectivePolicy",
    "OptimizationRequest",
    "OptimizationResult",
    "OptimizationSummary",
    "PolicyInput",
    "QualityStatus",
    "Recommendation",
    "RouteInput",
    "RunStatus",
    "SolverStatus",
    "TransferRecommendation",
    "UnmetShortage",
]