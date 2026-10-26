from pydantic import BaseModel, Field
from datetime import date

class BatchCreate(BaseModel):
    medicine_code: str
    lot_number: str
    expiry_date: date
    quantity_on_hand_units: int = Field(ge=0)
    quality_status: str

class BatchPatch(BaseModel):
    quantity_on_hand_units: int | None = Field(None, ge=0)
    expiry_date: date | None = None
    quality_status: str | None = None