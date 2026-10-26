# app/features/inventory/router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import date
from app.core.dependencies import get_db, get_current_user
from app.db import repositories as repo
from app.features.optimization.service import maybe_run_after_inventory_change

router = APIRouter(prefix="/inventory", tags=["Inventory"])

class BatchPatch(BaseModel):
    quantity_on_hand_units: int | None = Field(None, ge=0)
    expiry_date: date | None = None
    quality_status: str | None = None

@router.get("")
def get_inventory(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Gets inventory. Hospital users only see their own facility."""
    # If user is a hospital user, force filter by their facility
    facility_id = user.facility_id if user.role == "HOSPITAL_USER" else None
    
    batches = repo.get_inventory_batches(db, facility_id=facility_id)
    
    return {
        "inventory_batches": [
            {
                "batch_code": b.batch_code,
                "facility_code": b.facility.facility_code,
                "medicine_code": b.medicine.medicine_code,
                "lot_number": b.lot_number,
                "expiry_date": b.expiry_date.isoformat(),
                "quantity_on_hand_units": b.quantity_on_hand_units,
                "quality_status": b.quality_status
            }
            for b in batches
        ]
    }

@router.patch("/batches/{batch_code}")
def patch_batch(
    batch_code: str, 
    payload: BatchPatch, 
    db: Session = Depends(get_db), 
    user=Depends(get_current_user)
):
    """Updates a batch and triggers optimization if needed."""
    if user.role != "HOSPITAL_USER" or not user.facility_id:
        raise HTTPException(status_code=403, detail="Only hospital users can update inventory.")

    patch_data = payload.model_dump(exclude_unset=True)
    if not patch_data:
        raise HTTPException(status_code=422, detail="No fields provided to update.")

    batch, changed_fields = repo.update_inventory_batch(db, user.facility_id, batch_code, patch_data)
    
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found for this facility.")

    trigger = maybe_run_after_inventory_change(db, user, changed_fields)

    return {
        "inventory_batch": {
            "batch_code": batch.batch_code,
            "facility_code": batch.facility.facility_code,
            "medicine_code": batch.medicine.medicine_code,
            "expiry_date": batch.expiry_date.isoformat(),
            "quantity_on_hand_units": batch.quantity_on_hand_units,
            "quality_status": batch.quality_status
        },
        "trigger": trigger
    }