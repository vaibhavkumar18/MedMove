# app/features/inventory/router.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.db import repositories as repo
from app.features.optimization.service import maybe_run_after_inventory_change
from app.features.inventory.schemas import (
    BatchCreate,
    BatchPatch,
    InventoryBatchResponse,
    InventoryMutationResponse,
    InventoryResponse,
)

router = APIRouter(prefix="/inventory", tags=["Inventory"])

def _batch_response(batch) -> InventoryBatchResponse:
    return InventoryBatchResponse(
        batch_code=batch.batch_code,
        facility_code=batch.facility.facility_code,
        facility_name=batch.facility.name,
        medicine_code=batch.medicine.medicine_code,
        generic_name=batch.medicine.generic_name,
        lot_number=batch.lot_number,
        expiry_date=batch.expiry_date,
        quantity_on_hand_units=batch.quantity_on_hand_units,
        quality_status=batch.quality_status,
        updated_at=batch.updated_at,
    )


@router.get("", response_model=InventoryResponse)
def get_inventory(
    facility_code: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> InventoryResponse:
    """Gets inventory. Hospital users only see their own facility."""
    if user.role == "HOSPITAL_USER":
        facility_id = user.facility_id
    elif facility_code:
        facility = repo.get_facility_by_code(db, facility_code)
        if not facility:
            raise HTTPException(status_code=404, detail={"code": "FACILITY_NOT_FOUND", "message": "Facility not found"})
        facility_id = facility.id
    else:
        facility_id = None

    batches = repo.get_inventory_batches(db, facility_id=facility_id)
    return InventoryResponse(batches=[_batch_response(batch) for batch in batches])


@router.post("/batches", response_model=InventoryMutationResponse, status_code=201)
def create_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> InventoryMutationResponse:
    if user.role != "HOSPITAL_USER" or not user.facility_id:
        raise HTTPException(status_code=403, detail={"code": "HOSPITAL_USER_REQUIRED", "message": "Access denied"})
    try:
        batch, changed_fields = repo.create_inventory_batch(
            db=db,
            facility_id=user.facility_id,
            medicine_code=payload.medicine_code,
            lot_number=payload.lot_number,
            expiry_date=payload.expiry_date,
            quantity_on_hand_units=payload.quantity_on_hand_units,
            quality_status=payload.quality_status,
        )
    except ValueError as exc:
        message = str(exc)
        code = "DUPLICATE_LOT" if "Lot already exists" in message else "INVALID_BATCH"
        raise HTTPException(status_code=409 if code == "DUPLICATE_LOT" else 422, detail={"code": code, "message": message})
    trigger = maybe_run_after_inventory_change(db, user, changed_fields)
    return InventoryMutationResponse(inventory_batch=_batch_response(batch), trigger=trigger)

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

    try:
        batch, changed_fields = repo.update_inventory_batch(db, user.facility_id, batch_code, patch_data)
    except ValueError:
        raise HTTPException(status_code=404, detail={"code": "BATCH_NOT_FOUND", "message": "Batch not found"})

    trigger = maybe_run_after_inventory_change(db, user, changed_fields)

    return InventoryMutationResponse(inventory_batch=_batch_response(batch), trigger=trigger)