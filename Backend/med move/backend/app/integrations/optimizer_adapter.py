# app/integrations/optimizer_adapter.py
import hashlib
import json
import uuid
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db import models
from app.optimizer.schemas import (
    OptimizationRequest, FacilityInput, MedicineInput, 
    InventoryBatchInput, PolicyInput, RouteInput
)

class DuplicateRunError(Exception):
    pass

# ==========================================
# 1. BUILD OPTIMIZER REQUEST (The Bridge)
# ==========================================

def build_optimizer_request(
    db: Session, 
    planning_date: date, 
    budget_minor_units: int, 
    objective_policy: str
) -> tuple[OptimizationRequest, str]:
    """
    Queries the DB, maps UUIDs to business codes, builds the Pydantic request, 
    and calculates a deterministic SHA-256 snapshot hash.
    """
    # 1. Fetch all relevant data in one go
    facilities = db.execute(select(models.Facility).where(models.Facility.is_active == True)).scalars().all()
    medicines = db.execute(select(models.Medicine).where(models.Medicine.is_active == True)).scalars().all()
    batches = db.execute(select(models.InventoryBatch)).scalars().all()
    plans = db.execute(select(models.FacilityMedicinePlan)).scalars().all()
    routes = db.execute(select(models.TransportRoute)).scalars().all()

    # 2. Map to Pydantic Schemas
    fac_inputs = [
        FacilityInput(id=str(f.id), code=f.facility_code, name=f.name, is_active=f.is_active) 
        for f in facilities
    ]
    
    med_inputs = [
        MedicineInput(id=str(m.id), code=m.medicine_code, name=m.generic_name, base_unit=m.base_unit, is_active=m.is_active) 
        for m in medicines
    ]

    batch_inputs = [
        InventoryBatchInput(
            id=str(b.id), 
            facility_id=str(b.facility_id), 
            medicine_id=str(b.medicine_id),
            lot_number=b.lot_number, 
            expiry_date=b.expiry_date,
            available_quantity_units=b.quantity_on_hand_units if b.quality_status == "ELIGIBLE" else 0,
            quality_status=b.quality_status
        ) 
        for b in batches
    ]

    policy_inputs = [
        PolicyInput(
            facility_id=str(p.facility_id), 
            medicine_id=str(p.medicine_id),
            target_stock_units=p.target_stock_units, 
            minimum_reserve_units=p.minimum_reserve_units,
            avg_daily_demand_units=p.avg_daily_demand_units, 
            priority_weight=p.priority_weight,
            minimum_remaining_shelf_life_days=p.minimum_remaining_shelf_life_days
        ) 
        for p in plans
    ]

    route_inputs = [
        RouteInput(
            id=str(r.id), 
            source_facility_id=str(r.source_facility_id),
            destination_facility_id=str(r.destination_facility_id),
            transit_days=r.transit_days, 
            cost_per_unit_minor_units=r.cost_per_unit_minor_units,
            route_capacity_units=r.route_capacity_units, 
            currency_code=r.currency_code,
            is_active=r.is_active
        ) 
        for r in routes
    ]

    # 3. Build the final Request object
    request = OptimizationRequest(
        run_id=str(uuid.uuid4()),
        planning_date=planning_date,
        horizon_days=30,
        budget_minor_units=budget_minor_units,
        objective_policy=objective_policy,
        facilities=fac_inputs,
        medicines=med_inputs,
        inventory_batches=batch_inputs,
        facility_medicine_policies=policy_inputs,
        routes=route_inputs,
        max_solve_seconds=10
    )

    # 4. Calculate Deterministic SHA-256 Hash
    # We explicitly remove 'run_id' before hashing so the snapshot hash is 
    # 100% deterministic based ONLY on the database state and input parameters.
    request_dict = request.model_dump()
    request_dict.pop("run_id", None) 
    
    request_json = json.dumps(request_dict, sort_keys=True, default=str)
    snapshot_hash = hashlib.sha256(request_json.encode('utf-8')).hexdigest()

    return request, snapshot_hash


# ==========================================
# 2. PERSISTENCE HELPERS
# ==========================================

def create_optimization_run(
    db: Session, 
    initiated_by_user_id: uuid.UUID, 
    planning_date: date, 
    budget_minor_units: int, 
    trigger_source: str, 
    trigger_reason: str, 
    objective_policy: str, 
    input_snapshot_hash: str, 
    input_summary_json: dict
) -> models.OptimizationRun:
    run = models.OptimizationRun(
        id=uuid.uuid4(),
        created_by_user_id=initiated_by_user_id,
        trigger_source=trigger_source,
        trigger_reason=trigger_reason,
        status="RUNNING",
        planning_date=planning_date,
        budget_minor_units=budget_minor_units,
        objective_policy=objective_policy,
        input_snapshot_hash=input_snapshot_hash,
        input_summary_json=input_summary_json,
        started_at=datetime.utcnow()
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run

def get_latest_run(db: Session) -> models.OptimizationRun | None:
    return db.execute(select(models.OptimizationRun).order_by(models.OptimizationRun.created_at.desc())).scalar_one_or_none()

def get_run_by_id(db: Session, run_id: uuid.UUID) -> models.OptimizationRun | None:
    return db.execute(select(models.OptimizationRun).where(models.OptimizationRun.id == run_id)).scalar_one_or_none()

def mark_run_completed(
    db: Session, 
    run_id: uuid.UUID, 
    result_json: dict, 
    solver_status_stage_1: str, 
    solver_status_stage_2: str | None, 
    total_recommended_units: int, 
    total_cost_minor_units: int
):
    run = get_run_by_id(db, run_id)
    if run:
        run.status = "COMPLETED"
        run.result_json = result_json
        run.solver_status_stage_1 = solver_status_stage_1
        run.solver_status_stage_2 = solver_status_stage_2
        run.total_recommended_units = total_recommended_units
        run.total_cost_minor_units = total_cost_minor_units
        run.completed_at = datetime.utcnow()
        db.commit()

def mark_run_failed(db: Session, run_id: uuid.UUID, error_code: str):
    run = get_run_by_id(db, run_id)
    if run:
        run.status = "FAILED"
        run.error_code = error_code
        run.completed_at = datetime.utcnow()
        db.commit()

def optimize(request: "OptimizationRequest") -> dict:
    """Dummy optimizer solve function for testing/mocking."""
    return {
        "status": "OPTIMAL",
        "transfers": [],
        "unmet_shortages": [],
        "solver_status_stage_1": "OPTIMAL",
        "solver_status_stage_2": None,
        "total_recommended_units": 0,
        "total_cost_minor_units": 0
    }