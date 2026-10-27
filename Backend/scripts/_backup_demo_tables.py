"""
Export the current demo tables to CSV backup files before replacement.
Writes to Backend/data/backup_YYYYMMDD_HHMMSS/
Never prints credentials.
"""
import csv, sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.db import models

BACKUP_DIR = Path(__file__).resolve().parents[1] / "data" / f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

def export(db, model, filename: str, row_fn) -> int:
    rows = db.scalars(select(model)).all()
    path = BACKUP_DIR / filename
    if not rows:
        path.write_text("")
        return 0
    with open(path, "w", newline="", encoding="utf-8") as f:
        keys = list(row_fn(rows[0]).keys())
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in rows:
            w.writerow(row_fn(r))
    return len(rows)

db = SessionLocal()
try:
    n_fac = export(db, models.Facility, "facilities.csv", lambda r: {
        "id": str(r.id), "facility_code": r.facility_code, "name": r.name,
        "facility_type": r.facility_type, "district": r.district, "state": r.state, "is_active": r.is_active,
    })
    n_med = export(db, models.Medicine, "medicines.csv", lambda r: {
        "id": str(r.id), "medicine_code": r.medicine_code, "generic_name": r.generic_name,
        "strength": r.strength, "dosage_form": r.dosage_form, "base_unit": r.base_unit, "is_active": r.is_active,
    })
    n_plan = export(db, models.FacilityMedicinePlan, "facility_medicine_plans.csv", lambda r: {
        "id": str(r.id), "facility_id": str(r.facility_id), "medicine_id": str(r.medicine_id),
        "target_stock_units": r.target_stock_units, "minimum_reserve_units": r.minimum_reserve_units,
        "avg_daily_demand_units": r.avg_daily_demand_units, "priority_weight": r.priority_weight,
        "minimum_remaining_shelf_life_days": r.minimum_remaining_shelf_life_days,
    })
    n_batch = export(db, models.InventoryBatch, "inventory_batches.csv", lambda r: {
        "id": str(r.id), "batch_code": r.batch_code, "facility_id": str(r.facility_id),
        "medicine_id": str(r.medicine_id), "lot_number": r.lot_number,
        "expiry_date": str(r.expiry_date), "quantity_on_hand_units": r.quantity_on_hand_units,
        "quality_status": r.quality_status,
    })
    n_route = export(db, models.TransportRoute, "transport_routes.csv", lambda r: {
        "id": str(r.id), "route_code": r.route_code,
        "source_facility_id": str(r.source_facility_id), "destination_facility_id": str(r.destination_facility_id),
        "transit_days": r.transit_days, "cost_per_unit_minor_units": r.cost_per_unit_minor_units,
        "route_capacity_units": r.route_capacity_units, "currency_code": r.currency_code, "is_active": r.is_active,
    })
    print(f"Backup written to: {BACKUP_DIR}")
    print(f"  facilities:             {n_fac} rows")
    print(f"  medicines:              {n_med} rows")
    print(f"  facility_medicine_plans:{n_plan} rows")
    print(f"  inventory_batches:      {n_batch} rows")
    print(f"  transport_routes:       {n_route} rows")
finally:
    db.close()
