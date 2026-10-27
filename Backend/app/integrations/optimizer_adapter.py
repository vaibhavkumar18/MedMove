import hashlib
import json
import sys
import uuid
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models


class DuplicateRunError(Exception):
    pass


class OptimizerExecutionError(Exception):
    def __init__(self, run_id: uuid.UUID):
        super().__init__("Optimizer execution failed")
        self.run_id = run_id


def _optimizer_api():
    """Load the canonical source package, which is not installed as a wheel."""
    try:
        from medmove_optimizer import optimize
        from medmove_optimizer.schemas import OptimizationRequest
        return optimize, OptimizationRequest
    except ModuleNotFoundError as exc:
        if exc.name != "medmove_optimizer":
            raise
        optimizer_root = Path(__file__).resolve().parents[3] / "Optimizer"
        if str(optimizer_root) not in sys.path:
            sys.path.insert(0, str(optimizer_root))
        from medmove_optimizer import optimize
        from medmove_optimizer.schemas import OptimizationRequest
        return optimize, OptimizationRequest


def build_optimizer_request(
    db: Session,
    planning_date: date,
    budget_minor_units: int,
    objective_policy: str,
) -> tuple[object, str]:
    """Map the current database snapshot to the canonical optimizer request."""
    facilities = db.scalars(
        select(models.Facility).where(models.Facility.is_active.is_(True))
    ).all()
    medicines = db.scalars(
        select(models.Medicine).where(models.Medicine.is_active.is_(True))
    ).all()
    facility_codes = {facility.id: facility.facility_code for facility in facilities}
    medicine_codes = {medicine.id: medicine.medicine_code for medicine in medicines}
    batches = db.scalars(select(models.InventoryBatch)).all()
    plans = db.scalars(select(models.FacilityMedicinePlan)).all()
    routes = db.scalars(
        select(models.TransportRoute).where(models.TransportRoute.is_active.is_(True))
    ).all()

    run_id = f"run-{uuid.uuid4().hex}"
    request_data = {
        "schema_version": "1.0",
        "run_id": run_id,
        "planning_date": planning_date,
        "horizon_days": 30,
        "budget_minor_units": budget_minor_units,
        "currency_code": "INR",
        "objective_policy": objective_policy,
        "facilities": [
            {
                "id": facility.facility_code,
                "code": facility.facility_code,
                "name": facility.name,
                "is_active": True,
            }
            for facility in facilities
        ],
        "medicines": [
            {
                "id": medicine.medicine_code,
                "code": medicine.medicine_code,
                "name": medicine.generic_name,
                "base_unit": medicine.base_unit,
                "is_active": True,
            }
            for medicine in medicines
        ],
        "inventory_batches": [
            {
                "id": batch.batch_code,
                "facility_id": facility_codes[batch.facility_id],
                "medicine_id": medicine_codes[batch.medicine_id],
                "lot_number": batch.lot_number,
                "expiry_date": batch.expiry_date,
                "available_quantity_units": batch.quantity_on_hand_units,
                "quality_status": batch.quality_status,
            }
            for batch in batches
            if batch.facility_id in facility_codes
            and batch.medicine_id in medicine_codes
        ],
        "facility_medicine_policies": [
            {
                "facility_id": facility_codes[plan.facility_id],
                "medicine_id": medicine_codes[plan.medicine_id],
                "target_stock_units": plan.target_stock_units,
                "minimum_reserve_units": plan.minimum_reserve_units,
                "avg_daily_demand_units": plan.avg_daily_demand_units,
                "priority_weight": plan.priority_weight,
                "minimum_remaining_shelf_life_days": plan.minimum_remaining_shelf_life_days,
            }
            for plan in plans
            if plan.facility_id in facility_codes and plan.medicine_id in medicine_codes
        ],
        "routes": [
            {
                "id": route.route_code,
                "source_facility_id": facility_codes[route.source_facility_id],
                "destination_facility_id": facility_codes[route.destination_facility_id],
                "transit_days": route.transit_days,
                "cost_per_unit_minor_units": route.cost_per_unit_minor_units,
                "route_capacity_units": route.route_capacity_units,
                "currency_code": route.currency_code,
                "is_active": True,
            }
            for route in routes
            if route.source_facility_id in facility_codes
            and route.destination_facility_id in facility_codes
        ],
        "max_solve_seconds": 10,
    }
    _, request_type = _optimizer_api()
    request = request_type.model_validate(request_data)
    hash_data = request.model_dump(mode="json")
    hash_data.pop("run_id", None)
    snapshot_hash = hashlib.sha256(
        json.dumps(hash_data, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return request, snapshot_hash


def create_optimization_run(
    db: Session,
    initiated_by_user_id: uuid.UUID,
    planning_date: date,
    budget_minor_units: int,
    trigger_source: str,
    trigger_reason: str,
    objective_policy: str,
    input_snapshot_hash: str,
    input_summary_json: dict,
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
        started_at=datetime.utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def get_latest_run(db: Session) -> models.OptimizationRun | None:
    return db.scalar(
        select(models.OptimizationRun).order_by(
            models.OptimizationRun.created_at.desc()
        )
    )


def get_run_by_id(db: Session, run_id: uuid.UUID) -> models.OptimizationRun | None:
    return db.scalar(
        select(models.OptimizationRun).where(models.OptimizationRun.id == run_id)
    )


def mark_run_completed(
    db: Session,
    run_id: uuid.UUID,
    result_json: dict,
    solver_status_stage_1: str,
    solver_status_stage_2: str | None,
    total_recommended_units: int,
    total_cost_minor_units: int,
) -> None:
    run = get_run_by_id(db, run_id)
    if run is None:
        raise ValueError("Optimization run not found")
    run.status = "COMPLETED"
    run.result_json = result_json
    run.solver_status_stage_1 = solver_status_stage_1
    run.solver_status_stage_2 = solver_status_stage_2
    run.total_recommended_units = total_recommended_units
    run.total_cost_minor_units = total_cost_minor_units
    run.completed_at = datetime.utcnow()
    db.commit()


def mark_run_failed(db: Session, run_id: uuid.UUID, error_code: str) -> None:
    run = get_run_by_id(db, run_id)
    if run is None:
        raise ValueError("Optimization run not found")
    run.status = "FAILED"
    run.error_code = error_code
    run.completed_at = datetime.utcnow()
    db.commit()


def run_optimization_from_database(
    db: Session,
    *,
    initiated_by_user_id: uuid.UUID,
    planning_date: date,
    budget_minor_units: int,
    objective_policy: str,
    trigger_source: str = "MANUAL",
    trigger_reason: str = "COORDINATOR_MANUAL_RUN",
    request=None,
    snapshot_hash: str | None = None,
) -> tuple[models.OptimizationRun, object]:
    if request is None or snapshot_hash is None:
        request, snapshot_hash = build_optimizer_request(
            db, planning_date, budget_minor_units, objective_policy
        )
    optimize, _ = _optimizer_api()
    from medmove_optimizer.stock import calculate_shortages

    latest = get_latest_run(db)
    if latest and latest.status == "COMPLETED" and latest.input_snapshot_hash == snapshot_hash:
        raise DuplicateRunError("The current database snapshot was already optimized")

    run = create_optimization_run(
        db=db,
        initiated_by_user_id=initiated_by_user_id,
        planning_date=planning_date,
        budget_minor_units=budget_minor_units,
        trigger_source=trigger_source,
        trigger_reason=trigger_reason,
        objective_policy=objective_policy,
        input_snapshot_hash=snapshot_hash,
        input_summary_json={
            "facility_count": len(request.facilities),
            "medicine_count": len(request.medicines),
            "inventory_batch_count": len(request.inventory_batches),
            "policy_count": len(request.facility_medicine_policies),
            "route_count": len(request.routes),
            "initial_shortage_line_count": len(calculate_shortages(request)),
        },
    )
    try:
        result = optimize(request)
        if result.status.value != "COMPLETED":
            mark_run_failed(db, run.id, "OPTIMIZER_ERROR")
            raise OptimizerExecutionError(run.id)
        result_json = result.model_dump(mode="json")
        mark_run_completed(
            db,
            run.id,
            result_json,
            result.solver_status_stage_1.value,
            result.solver_status_stage_2.value
            if result.solver_status_stage_2
            else None,
            sum(item.quantity_units for item in result.recommendations),
            result.summary.estimated_cost_minor_units,
        )
        db.refresh(run)
        return run, result
    except Exception as exc:
        if run.status == "RUNNING":
            mark_run_failed(db, run.id, "OPTIMIZER_ERROR")
        if isinstance(exc, OptimizerExecutionError):
            raise
        raise OptimizerExecutionError(run.id) from exc
