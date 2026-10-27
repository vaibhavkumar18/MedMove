from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

QualityStatus = Literal["ELIGIBLE", "QUARANTINED", "RECALLED", "DAMAGED"]


class BatchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    medicine_code: str
    lot_number: str
    expiry_date: date
    quantity_on_hand_units: int = Field(ge=0)
    quality_status: QualityStatus

    @field_validator("expiry_date")
    @classmethod
    def expiry_must_not_be_in_past(cls, value: date) -> date:
        if value < date.today():
            raise ValueError("expiry_date must not be in the past")
        return value


class BatchPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quantity_on_hand_units: int | None = Field(None, ge=0)
    expiry_date: date | None = None
    quality_status: QualityStatus | None = None

    @field_validator("expiry_date")
    @classmethod
    def expiry_must_not_be_in_past(cls, value: date | None) -> date | None:
        if value is not None and value < date.today():
            raise ValueError("expiry_date must not be in the past")
        return value


class InventoryBatchResponse(BaseModel):
    batch_code: str
    facility_code: str
    facility_name: str
    medicine_code: str
    generic_name: str
    lot_number: str
    expiry_date: date
    quantity_on_hand_units: int
    quality_status: QualityStatus
    updated_at: datetime


class TriggerOutcome(BaseModel):
    decision: Literal[
        "RAN",
        "SKIPPED_UNCHANGED",
        "SKIPPED_NO_NETWORK_SHORTAGE",
        "SKIPPED_SNAPSHOT_ALREADY_ANALYZED",
        "FAILED",
    ]
    reason: str | None = None
    optimization_run_id: str | None = None
    run_status: str | None = None
    message: str


class InventoryResponse(BaseModel):
    batches: list[InventoryBatchResponse]


class InventoryMutationResponse(BaseModel):
    inventory_batch: InventoryBatchResponse
    trigger: TriggerOutcome