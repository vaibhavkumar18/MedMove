# app/features/dashboard/router.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.core.dependencies import get_db, get_current_user
from app.db import models

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("")
def get_dashboard(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Role-scoped dashboard summary."""
    
    # Safely get facility code (Hospital users have one, Coordinators do not)
    fac_code = user.facility.facility_code if user.facility else None
    scope = "FACILITY" if user.role == "HOSPITAL_USER" else "NETWORK"

    # Safe database counts (returns 0 if tables are empty)
    total_facilities = db.execute(select(func.count(models.Facility.id))).scalar() or 0
    total_batches = db.execute(select(func.count(models.InventoryBatch.id))).scalar() or 0
    total_medicines = db.execute(select(func.count(models.Medicine.id))).scalar() or 0
    total_runs = db.execute(select(func.count(models.OptimizationRun.id))).scalar() or 0

    return {
        "visibility_scope": scope,
        "facility_code": fac_code,
        "summary": {
            "total_facilities": total_facilities,
            "total_inventory_batches": total_batches,
            "total_medicines": total_medicines,
            "active_optimization_runs": total_runs
        }
    }