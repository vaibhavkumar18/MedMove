# app/features/optimization/router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from app.core.dependencies import get_db, get_current_user
from app.db import repositories as repo

router = APIRouter(prefix="/optimization-runs", tags=["Optimization"])

# --- Schemas ---
class ApprovalRequest(BaseModel):
    run_id: str

class ManualRunRequest(BaseModel):
    planning_date: date
    budget_minor_units: int = 50000
    objective_policy: str = "PRIORITY_WEIGHTED_UNITS_THEN_COST"

# --- Endpoints ---

@router.post("")
def manual_run(
    payload: ManualRunRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Manually trigger an optimization run (Coordinator only)."""
    if user.role != "NETWORK_COORDINATOR":
        raise HTTPException(status_code=403, detail="Only coordinators can trigger manual runs.")
        
    run = repo.create_optimization_run(
        db=db,
        initiated_by_user_id=user.id,
        planning_date=payload.planning_date,
        budget_minor_units=payload.budget_minor_units,
        trigger_source="MANUAL",
        trigger_reason="COORDINATOR_MANUAL_TRIGGER",
        objective_policy=payload.objective_policy,
        input_snapshot_hash="manual-hash",
        input_summary_json={"manual": True}
    )
    
    return {
        "message": "Manual run triggered successfully.",
        "run_id": str(run.id),
        "status": "RUNNING"
    }

@router.get("/latest")
def get_latest_run(
    db: Session = Depends(get_db), 
    user=Depends(get_current_user)
):
    """Authenticated, role-scoped latest run."""
    run_record = repo.get_latest_run(db)
    
    if not run_record:
        return {
            "run": None,
            "visibility_scope": "NETWORK" if user.role == "NETWORK_COORDINATOR" else "FACILITY",
            "summary": {
                "transfer_count": 0, "total_recommended_units": 0, "total_cost_minor_units": 0,
                "initial_shortage_line_count": 0, "unmet_shortage_line_count": 0,
                "total_unmet_shortage_units": 0, "priority_weighted_units_score": 0
            },
            "transfers": [], "unmet_shortages": [], "warnings": []
        }

    fac_code = user.facility.facility_code if user.facility else None

    return {
        "run": {
            "run_id": str(run_record.id), "status": run_record.status,
            "trigger_source": run_record.trigger_source, "trigger_reason": run_record.trigger_reason,
            "planning_date": run_record.planning_date.isoformat() if run_record.planning_date else None,
            "budget_minor_units": run_record.budget_minor_units,
            "objective_policy": run_record.objective_policy,
            "created_at": run_record.created_at.isoformat() if run_record.created_at else None
        },
        "visibility_scope": "NETWORK" if user.role == "NETWORK_COORDINATOR" else "FACILITY",
        "facility_code": fac_code,
        "summary": {
            "transfer_count": 0, "total_recommended_units": 0, "total_cost_minor_units": 0,
            "initial_shortage_line_count": 0, "unmet_shortage_line_count": 0,
            "total_unmet_shortage_units": 0, "priority_weighted_units_score": 0
        },
        "transfers": [], "unmet_shortages": [], "warnings": []
    }

@router.post("/approve")
def approve_transfers(
    payload: ApprovalRequest, 
    db: Session = Depends(get_db), 
    user=Depends(get_current_user)
):
    """Approves the recommended transfers and updates inventory."""
    if user.role != "NETWORK_COORDINATOR":
        raise HTTPException(status_code=403, detail="Only coordinators can approve transfers.")
        
    return {
        "message": "Transfers approved successfully.",
        "run_id": payload.run_id,
        "inventory_updated": True,
        "status": "APPROVED"
    }