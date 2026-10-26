# app/db/repositories.py
import uuid
import json
import hashlib
from datetime import datetime,date
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import models

# ==========================================
# AUTHENTICATION REPOSITORIES
# ==========================================

def get_user_by_id(db: Session, user_id: uuid.UUID) -> models.User | None:
    return db.execute(select(models.User).where(models.User.id == user_id)).scalar_one_or_none()

def get_user_by_email(db: Session, email: str) -> models.User | None:
    return db.execute(select(models.User).where(models.User.email == email.lower())).scalar_one_or_none()

def create_hospital_user(db: Session, full_name: str, email: str, password_hash: str, facility_code: str) -> models.User:
    facility = db.execute(select(models.Facility).where(models.Facility.facility_code == facility_code)).scalar_one_or_none()
    if not facility or not facility.is_active:
        raise ValueError("Invalid facility")
    
    user = models.User(
        id=uuid.uuid4(),
        full_name=full_name,
        email=email.lower(),
        password_hash=password_hash,
        role="HOSPITAL_USER",
        facility_id=facility.id,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def list_active_signup_facilities(db: Session) -> list[models.Facility]:
    return db.execute(select(models.Facility).where(models.Facility.is_active == True)).scalars().all()

# ==========================================
# INVENTORY REPOSITORIES
# ==========================================

def get_inventory_batches(db: Session, facility_id: uuid.UUID | None = None) -> list[models.InventoryBatch]:
    query = select(models.InventoryBatch)
    if facility_id:
        query = query.where(models.InventoryBatch.facility_id == facility_id)
    return db.execute(query).scalars().all()

def update_inventory_batch(
    db: Session, 
    facility_id: uuid.UUID, 
    batch_code: str, 
    patch: dict
) -> tuple[models.InventoryBatch, set]:
    """
    Updates an inventory batch. 
    Returns the updated batch and a set of changed field names.
    Raises ValueError if not found or not owned by the facility.
    """
    # 1. Fetch the batch and enforce ownership
    batch = db.execute(
        select(models.InventoryBatch).where(
            models.InventoryBatch.batch_code == batch_code,
            models.InventoryBatch.facility_id == facility_id
        )
    ).scalar_one_or_none()
    
    if not batch:
        raise ValueError(f"Batch {batch_code} not found or not owned by facility {facility_id}")

    changed_fields = set()
    
    # 2. Only allow patching specific fields
    allowed_fields = {"quantity_on_hand_units", "expiry_date", "quality_status"}
    
    for field, new_value in patch.items():
        if field not in allowed_fields:
            continue # Ignore identity fields or invalid fields
            
        old_value = getattr(batch, field)
        
        # Handle date comparison properly
        if field == "expiry_date" and isinstance(new_value, str):
            from datetime import date
            new_value = date.fromisoformat(new_value)
            
        if old_value != new_value:
            setattr(batch, field, new_value)
            changed_fields.add(field)

    # 3. Commit the mutation before returning
    db.commit()
    db.refresh(batch)
    
    return batch, changed_fields
def create_inventory_batch(
    db: Session, 
    facility_id: uuid.UUID, 
    medicine_code: str, 
    lot_number: str, 
    expiry_date: date, 
    quantity_on_hand_units: int, 
    quality_status: str
) -> tuple[models.InventoryBatch, set]:
    """Creates a new inventory batch for a specific facility."""
    if quantity_on_hand_units < 0:
        raise ValueError("Quantity cannot be negative")
        
    medicine = db.execute(select(models.Medicine).where(models.Medicine.medicine_code == medicine_code)).scalar_one_or_none()
    if not medicine or not medicine.is_active:
        raise ValueError(f"Medicine code {medicine_code} not found or inactive")
        
    # Validate that a facility_medicine_plan exists for this pair
    plan = db.execute(
        select(models.FacilityMedicinePlan).where(
            models.FacilityMedicinePlan.facility_id == facility_id,
            models.FacilityMedicinePlan.medicine_id == medicine.id
        )
    ).scalar_one_or_none()
    
    if not plan:
        raise ValueError(f"No active plan exists for facility and medicine {medicine_code}")

    batch_code = f"BATCH_{facility_id.hex[:8]}_{medicine_code}_{lot_number}"
    
    new_batch = models.InventoryBatch(
        id=uuid.uuid4(),
        batch_code=batch_code,
        facility_id=facility_id,
        medicine_id=medicine.id,
        lot_number=lot_number,
        expiry_date=expiry_date,
        quantity_on_hand_units=quantity_on_hand_units,
        quality_status=quality_status
    )
    
    db.add(new_batch)
    db.commit()
    db.refresh(new_batch)
    
    return new_batch, {"created"}

def get_medicines_for_user(db: Session, role: str, facility_id: uuid.UUID | None) -> list[dict]:
    """Returns distinct medicines available to the user based on their role."""
    query = select(models.Medicine).where(models.Medicine.is_active == True)
    
    if role == "HOSPITAL_USER" and facility_id:
        # Hospital users only see medicines they have a plan for
        query = query.join(
            models.FacilityMedicinePlan, 
            models.Medicine.id == models.FacilityMedicinePlan.medicine_id
        ).where(
            models.FacilityMedicinePlan.facility_id == facility_id
        ).distinct()
        
    medicines = db.execute(query).scalars().all()
    
    return [
        {
            "medicine_id": str(m.id),
            "medicine_code": m.medicine_code,
            "generic_name": m.generic_name,
            "base_unit": m.base_unit
        }
        for m in medicines
    ]

# ==========================================
# OPTIMIZATION REPOSITORIES
# ==========================================

def get_latest_run(db: Session) -> models.OptimizationRun | None:
    return db.execute(select(models.OptimizationRun).order_by(models.OptimizationRun.created_at.desc())).scalar_one_or_none()

def create_optimization_run(
    db: Session, 
    initiated_by_user_id: uuid.UUID, 
    planning_date, 
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

def mark_run_completed(
    db: Session, 
    run_id: uuid.UUID, 
    result_json: dict, 
    solver_status_stage_1: str, 
    solver_status_stage_2: str | None, 
    total_recommended_units: int, 
    total_cost_minor_units: int
):
    run = db.execute(select(models.OptimizationRun).where(models.OptimizationRun.id == run_id)).scalar_one_or_none()
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
    run = db.execute(select(models.OptimizationRun).where(models.OptimizationRun.id == run_id)).scalar_one_or_none()
    if run:
        run.status = "FAILED"
        run.error_code = error_code
        run.completed_at = datetime.utcnow()
        db.commit()

def build_optimizer_request(db: Session, planning_date, budget_minor_units: int, objective_policy: str):
    """Builds the optimizer request from database state."""
    from datetime import date as date_type
    from app.optimizer.schemas import (
        OptimizationRequest, FacilityInput, MedicineInput, 
        InventoryBatchInput, PolicyInput, RouteInput
    )
    
    # Fetch all data from DB
    facilities = db.execute(select(models.Facility).where(models.Facility.is_active == True)).scalars().all()
    medicines = db.execute(select(models.Medicine).where(models.Medicine.is_active == True)).scalars().all()
    batches = db.execute(select(models.InventoryBatch)).scalars().all()
    policies = db.execute(select(models.FacilityMedicinePlan)).scalars().all()
    routes = db.execute(select(models.TransportRoute).where(models.TransportRoute.is_active == True)).scalars().all()
    
    # Map to UUIDs for lookups
    fac_map = {f.facility_code: f for f in facilities}
    med_map = {m.medicine_code: m for m in medicines}
    
    # Build request
    request = OptimizationRequest(
        run_id=str(uuid.uuid4()),
        planning_date=planning_date if isinstance(planning_date, date_type) else date_type.fromisoformat(planning_date),
        horizon_days=30,
        budget_minor_units=budget_minor_units,
        objective_policy=objective_policy,
        facilities=[FacilityInput(id=str(f.id), code=f.facility_code, name=f.name, is_active=f.is_active) for f in facilities],
        medicines=[MedicineInput(id=str(m.id), code=m.medicine_code, name=m.generic_name, base_unit=m.base_unit, is_active=m.is_active) for m in medicines],
        inventory_batches=[
            InventoryBatchInput(
                id=str(b.id), facility_id=str(b.facility_id), medicine_id=str(b.medicine_id),
                lot_number=b.lot_number, expiry_date=b.expiry_date,
                available_quantity_units=b.quantity_on_hand_units if b.quality_status == "ELIGIBLE" else 0,
                quality_status=b.quality_status
            ) for b in batches
        ],
        facility_medicine_policies=[
            PolicyInput(
                facility_id=str(p.facility_id), medicine_id=str(p.medicine_id),
                target_stock_units=p.target_stock_units, minimum_reserve_units=p.minimum_reserve_units,
                avg_daily_demand_units=p.avg_daily_demand_units, priority_weight=p.priority_weight,
                minimum_remaining_shelf_life_days=p.minimum_remaining_shelf_life_days
            ) for p in policies
        ],
        routes=[
            RouteInput(
                id=str(r.id), source_facility_id=str(r.source_facility_id),
                destination_facility_id=str(r.destination_facility_id),
                transit_days=r.transit_days, cost_per_unit_minor_units=r.cost_per_unit_minor_units,
                route_capacity_units=r.route_capacity_units, currency_code=r.currency_code,
                is_active=r.is_active
            ) for r in routes
        ],
        max_solve_seconds=10
    )
    
    # Create a snapshot hash
    import hashlib
    snapshot_str = f"{len(facilities)}-{len(medicines)}-{len(batches)}-{planning_date}"
    snapshot_hash = hashlib.sha256(snapshot_str.encode()).hexdigest()
    
    return request, snapshot_hash