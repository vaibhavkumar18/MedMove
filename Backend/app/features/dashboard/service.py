"""
Dashboard summary service.

Shortages and surpluses are computed using the canonical optimizer helpers
(calculate_shortages, calculate_surpluses) so the dashboard figures are
consistent with what the optimizer actually considers.

The dashboard endpoint is read-only.  It never triggers optimization or
mutates any database record.
"""
from __future__ import annotations

import sys
import uuid
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models
from app.db.repositories import get_latest_run


# ---------------------------------------------------------------------------
# Optimizer API loader (mirrors the pattern in optimizer_adapter.py)
# ---------------------------------------------------------------------------

def _load_optimizer_helpers():
    """Return (calculate_shortages, calculate_surpluses) from the canonical package."""
    try:
        from medmove_optimizer.stock import calculate_shortages, calculate_surpluses
        return calculate_shortages, calculate_surpluses
    except ModuleNotFoundError as exc:
        if exc.name != "medmove_optimizer":
            raise
        optimizer_root = Path(__file__).resolve().parents[4] / "Optimizer"
        if str(optimizer_root) not in sys.path:
            sys.path.insert(0, str(optimizer_root))
        from medmove_optimizer.stock import calculate_shortages, calculate_surpluses
        return calculate_shortages, calculate_surpluses


# ---------------------------------------------------------------------------
# Request builder (scoped version — no routes, no budget, read-only snapshot)
# ---------------------------------------------------------------------------

def _build_scoped_request(
    db: Session,
    facility_ids: set[uuid.UUID] | None,
    planning_date: date,
):
    """
    Build a minimal OptimizationRequest for the given facility scope.
    Routes and budget are not needed for shortage/surplus calculation.
    Returns (request, facility_code_map, medicine_code_map).
    """
    from app.integrations.optimizer_adapter import _optimizer_api  # type: ignore[import]

    _, request_type = _optimizer_api()

    facilities_q = select(models.Facility).where(models.Facility.is_active.is_(True))
    if facility_ids is not None:
        facilities_q = facilities_q.where(models.Facility.id.in_(facility_ids))
    facilities = db.scalars(facilities_q).all()

    medicines = db.scalars(
        select(models.Medicine).where(models.Medicine.is_active.is_(True))
    ).all()

    fac_ids_present = {f.id for f in facilities}
    med_ids_present = {m.id for m in medicines}

    facility_code_map = {f.id: f.facility_code for f in facilities}
    medicine_code_map = {m.id: m.medicine_code for m in medicines}

    batches = db.scalars(
        select(models.InventoryBatch).where(
            models.InventoryBatch.facility_id.in_(fac_ids_present)
        )
    ).all()

    plans = db.scalars(
        select(models.FacilityMedicinePlan).where(
            models.FacilityMedicinePlan.facility_id.in_(fac_ids_present)
        )
    ).all()

    import uuid as _uuid
    run_id = f"dashboard-{_uuid.uuid4().hex}"

    request_data = {
        "schema_version": "1.0",
        "run_id": run_id,
        "planning_date": planning_date,
        "horizon_days": 30,
        "budget_minor_units": 0,
        "currency_code": "INR",
        "objective_policy": "PRIORITY_WEIGHTED_UNITS_THEN_COST",
        "facilities": [
            {"id": f.facility_code, "code": f.facility_code, "name": f.name, "is_active": True}
            for f in facilities
        ],
        "medicines": [
            {"id": m.medicine_code, "code": m.medicine_code, "name": m.generic_name,
             "base_unit": m.base_unit, "is_active": True}
            for m in medicines
        ],
        "inventory_batches": [
            {
                "id": b.batch_code,
                "facility_id": facility_code_map[b.facility_id],
                "medicine_id": medicine_code_map[b.medicine_id],
                "lot_number": b.lot_number,
                "expiry_date": b.expiry_date,
                "available_quantity_units": b.quantity_on_hand_units,
                "quality_status": b.quality_status,
            }
            for b in batches
            if b.facility_id in fac_ids_present and b.medicine_id in med_ids_present
        ],
        "facility_medicine_policies": [
            {
                "facility_id": facility_code_map[p.facility_id],
                "medicine_id": medicine_code_map[p.medicine_id],
                "target_stock_units": p.target_stock_units,
                "minimum_reserve_units": p.minimum_reserve_units,
                "avg_daily_demand_units": p.avg_daily_demand_units,
                "priority_weight": p.priority_weight,
                "minimum_remaining_shelf_life_days": p.minimum_remaining_shelf_life_days,
            }
            for p in plans
            if p.facility_id in fac_ids_present and p.medicine_id in med_ids_present
        ],
        # Routes are not needed for shortage/surplus; supply empty list.
        "routes": [],
        "max_solve_seconds": 10,
    }

    request = request_type.model_validate(request_data)
    return request, facility_code_map, medicine_code_map


# ---------------------------------------------------------------------------
# Main service entry point
# ---------------------------------------------------------------------------

def get_dashboard_data(db: Session, user) -> dict:
    """
    Return a DashboardResponse-compatible dict for the authenticated user.

    Hospital users see only their own facility.
    Coordinators see the full active network.

    Shortage/surplus figures use the canonical optimizer helpers
    (calculate_shortages / calculate_surpluses) so they are consistent with
    the optimizer's own eligibility rules (ELIGIBLE + not expired).
    """
    calculate_shortages, calculate_surpluses = _load_optimizer_helpers()

    planning_date = date.today()

    # Determine the facility scope for this user
    if user.role == "HOSPITAL_USER":
        if user.facility_id is None:
            scoped_facility_ids: set[uuid.UUID] | None = set()
        else:
            scoped_facility_ids = {user.facility_id}
    else:
        scoped_facility_ids = None  # None = all active facilities

    request, facility_code_map, medicine_code_map = _build_scoped_request(
        db, scoped_facility_ids, planning_date
    )

    # Run canonical shortage/surplus calculations (read-only, no solver)
    shortage_lines = calculate_shortages(request)
    surplus_lines = calculate_surpluses(request)

    # Aggregate per facility_code
    fac_shortage_units: dict[str, int] = defaultdict(int)
    fac_shortage_count: dict[str, int] = defaultdict(int)
    for line in shortage_lines:
        fac_shortage_units[line.facility_id] += line.shortage_units
        fac_shortage_count[line.facility_id] += 1

    fac_surplus_units: dict[str, int] = defaultdict(int)
    fac_surplus_count: dict[str, int] = defaultdict(int)
    for line in surplus_lines:
        fac_surplus_units[line.facility_id] += line.transferable_units
        fac_surplus_count[line.facility_id] += 1

    # Get the facility display objects in the same scope
    fac_code_to_name: dict[str, str] = {
        f.facility_code: f.name
        for f in db.scalars(
            select(models.Facility).where(
                models.Facility.is_active.is_(True),
                *(
                    [models.Facility.id.in_(scoped_facility_ids)]
                    if scoped_facility_ids is not None
                    else []
                ),
            )
        ).all()
    }

    # The request already contains only the scoped active facilities
    all_facility_codes = [f.id for f in request.facilities]

    fac_summaries = [
        {
            "facility_code": code,
            "facility_name": fac_code_to_name.get(code, code),
            "shortage_line_count": fac_shortage_count.get(code, 0),
            "total_shortage_units": fac_shortage_units.get(code, 0),
            "eligible_surplus_line_count": fac_surplus_count.get(code, 0),
            "eligible_surplus_units": fac_surplus_units.get(code, 0),
        }
        for code in all_facility_codes
    ]

    total_shortage_units = sum(fac_shortage_units.values())
    total_surplus_units = sum(fac_surplus_units.values())
    total_shortage_line_count = sum(fac_shortage_count.values())
    total_surplus_line_count = sum(fac_surplus_count.values())

    medicine_count = len({p.medicine_id for p in request.facility_medicine_policies})
    facility_count = len(all_facility_codes)

    latest_run = get_latest_run(db)

    return {
        "viewer": {
            "role": user.role,
            "facility_code": user.facility.facility_code if user.facility else None,
            "facility_name": user.facility.name if user.facility else None,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "facility_count": facility_count,
            "medicine_count": medicine_count,
            "shortage_line_count": total_shortage_line_count,
            "total_shortage_units": total_shortage_units,
            "eligible_surplus_line_count": total_surplus_line_count,
            "eligible_surplus_units": total_surplus_units,
            "latest_run_status": latest_run.status if latest_run else None,
        },
        "facilities": fac_summaries,
        "shortages": [],
        "latest_run": {
            "run_id": str(latest_run.id),
            "status": latest_run.status,
            "trigger_source": latest_run.trigger_source,
            "created_at": latest_run.created_at.isoformat(),
        } if latest_run else None,
    }
