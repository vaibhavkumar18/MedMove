# scripts/seed_demo.py
import os
import csv
import uuid
import argparse
from datetime import datetime, date
from pathlib import Path
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session
from argon2 import PasswordHasher

from app.db import models
from app.core.config import settings

# Initialize Argon2 password hasher
ph = PasswordHasher()

def get_data_dir() -> str:
    """Get the absolute path to the data/sample directory."""
    # __file__ is backend/scripts/seed_demo.py
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    
    # Check if data is inside backend (backend/data/sample)
    data_in_backend = os.path.join(backend_dir, "data", "sample")
    if os.path.exists(data_in_backend):
        return data_in_backend
    
    # Otherwise, assume data is a sibling to backend (../data/sample)
    root_dir = os.path.dirname(backend_dir)
    return os.path.join(root_dir, "data", "sample")


def _read_csv(data_dir: str, filename: str) -> list[dict[str, str]]:
    path = Path(data_dir) / filename
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _validate_seed_data(data_dir: str) -> None:
    """Validate the canonical fictional dataset before opening a write transaction."""
    facilities = _read_csv(data_dir, "facilities.csv")
    medicines = _read_csv(data_dir, "medicines.csv")
    plans = _read_csv(data_dir, "facility_medicine_plans.csv")
    batches = _read_csv(data_dir, "inventory_batches.csv")
    routes = _read_csv(data_dir, "transport_routes.csv")

    facility_codes = {row["facility_code"].strip() for row in facilities}
    medicine_codes = {row["medicine_code"].strip() for row in medicines}
    if len(facility_codes) != len(facilities):
        raise ValueError("Duplicate facility_code in canonical facilities.csv")
    if len(medicine_codes) != len(medicines):
        raise ValueError("Duplicate medicine_code in canonical medicines.csv")
    if not facilities or not medicines:
        raise ValueError("Canonical facilities.csv and medicines.csv must not be empty")

    plan_keys: set[tuple[str, str]] = set()
    for row in plans:
        key = (row["facility_code"].strip(), row["medicine_code"].strip())
        if key in plan_keys:
            raise ValueError(f"Duplicate facility medicine plan: {key}")
        plan_keys.add(key)
        if key[0] not in facility_codes or key[1] not in medicine_codes:
            raise ValueError(f"Invalid reference in plan: {key}")
        numeric_values = (
            int(row["target_stock_units"]),
            int(row["minimum_reserve_units"]),
            int(row["avg_daily_demand_units"]),
            int(row["minimum_remaining_shelf_life_days"]),
        )
        if any(value < 0 for value in numeric_values):
            raise ValueError(f"Negative plan value for {key}")
        priority = int(row["priority_weight"])
        if priority < 1 or priority > 5:
            raise ValueError(f"Priority weight must be between 1 and 5 for {key}")

    batch_codes: set[str] = set()
    batch_keys: set[tuple[str, str, str]] = set()
    for row in batches:
        batch_code = row["batch_code"].strip()
        key = (
            row["facility_code"].strip(),
            row["medicine_code"].strip(),
            row["lot_number"].strip(),
        )
        if batch_code in batch_codes or key in batch_keys:
            raise ValueError(f"Duplicate inventory batch: {batch_code}")
        batch_codes.add(batch_code)
        batch_keys.add(key)
        if key[0] not in facility_codes or key[1] not in medicine_codes:
            raise ValueError(f"Invalid reference in batch: {batch_code}")
        expiry_date = date.fromisoformat(row["expiry_date"].strip())
        # Note: expired batches are allowed in the demo dataset to demonstrate
        # that the optimizer correctly excludes them from eligible stock.
        # The canonical eligibility rule (expiry_date >= planning_date) is
        # enforced by the optimizer, not by the seed script.
        if int(row["quantity_on_hand_units"]) < 0:
            raise ValueError(f"Negative quantity for batch: {batch_code}")
        if row["quality_status"].strip() not in {"ELIGIBLE", "QUARANTINED", "RECALLED", "DAMAGED"}:
            raise ValueError(f"Invalid quality status for batch: {batch_code}")

    route_codes: set[str] = set()
    route_pairs: set[tuple[str, str]] = set()
    for row in routes:
        route_code = row["route_code"].strip()
        pair = (row["source_facility_code"].strip(), row["destination_facility_code"].strip())
        if route_code in route_codes or pair in route_pairs:
            raise ValueError(f"Duplicate route: {route_code}")
        route_codes.add(route_code)
        route_pairs.add(pair)
        if pair[0] not in facility_codes or pair[1] not in facility_codes:
            raise ValueError(f"Invalid reference in route: {route_code}")
        if pair[0] == pair[1]:
            raise ValueError(f"Self-to-self route detected: {route_code}")
        if len(route_code) > 60:
            raise ValueError(f"Route code exceeds 60 characters: {route_code}")
        if any(int(row[field]) < 0 for field in ("transit_days", "cost_per_unit_minor_units", "route_capacity_units")):
            raise ValueError(f"Negative route value: {route_code}")
        if row["currency_code"].strip() != "INR":
            raise ValueError(f"Unsupported route currency: {route_code}")


def _verify_schema_revision(db: Session) -> None:
    """Require the canonical Alembic schema when running against PostgreSQL."""
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return
    if "alembic_version" not in inspect(bind).get_table_names():
        raise RuntimeError("Refusing to seed: alembic_version table is missing")
    revision = db.execute(text("SELECT version_num FROM alembic_version")).scalar_one_or_none()
    if revision != "196ffc20a50f":
        raise RuntimeError(
            f"Refusing to seed: expected Alembic revision 196ffc20a50f, found {revision!r}"
        )


def seed_database(db: Session) -> None:
    """
    Idempotent seed function that loads CSVs into the provided database session.
    Preserves existing edited inventory quantities on reruns.
    """
    data_dir = get_data_dir()
    _verify_schema_revision(db)
    _validate_seed_data(data_dir)
    
    # 1. Seed Facilities
    with open(os.path.join(data_dir, "facilities.csv"), "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row["facility_code"].strip()
            existing = db.execute(select(models.Facility).where(models.Facility.facility_code == code)).scalar_one_or_none()
            if not existing:
                db.add(models.Facility(
                    id=uuid.uuid4(),
                    facility_code=code,
                    name=row["name"].strip(),
                    facility_type=row["facility_type"].strip(),
                    district=row["district"].strip(),
                    state=row["state"].strip(),
                    is_active=row["is_active"].strip().lower() == "true"
                ))
    # 2. Seed Medicines
    with open(os.path.join(data_dir, "medicines.csv"), "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row["medicine_code"].strip()
            existing = db.execute(select(models.Medicine).where(models.Medicine.medicine_code == code)).scalar_one_or_none()
            if not existing:
                db.add(models.Medicine(
                    id=uuid.uuid4(),
                    medicine_code=code,
                    generic_name=row["generic_name"].strip(),
                    strength=row["strength"].strip(),
                    dosage_form=row["dosage_form"].strip(),
                    base_unit=row["base_unit"].strip(),
                    is_active=row["is_active"].strip().lower() == "true"
                ))
    db.flush()

    # Pre-fetch maps for foreign keys
    fac_map = {f.facility_code: f.id for f in db.execute(select(models.Facility)).scalars()}
    med_map = {m.medicine_code: m.id for m in db.execute(select(models.Medicine)).scalars()}

    # 3. Seed Facility Medicine Plans
    with open(os.path.join(data_dir, "facility_medicine_plans.csv"), "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fac_code = row["facility_code"].strip()
            med_code = row["medicine_code"].strip()
            fac_id = fac_map.get(fac_code)
            med_id = med_map.get(med_code)
            
            if not fac_id or not med_id:
                raise ValueError(f"Invalid reference in plans: Facility {fac_code} or Medicine {med_code} not found.")
            
            existing = db.execute(
                select(models.FacilityMedicinePlan).where(
                    models.FacilityMedicinePlan.facility_id == fac_id,
                    models.FacilityMedicinePlan.medicine_id == med_id
                )
            ).scalar_one_or_none()
            
            if not existing:
                db.add(models.FacilityMedicinePlan(
                    id=uuid.uuid4(),
                    facility_id=fac_id,
                    medicine_id=med_id,
                    target_stock_units=int(row["target_stock_units"]),
                    minimum_reserve_units=int(row["minimum_reserve_units"]),
                    avg_daily_demand_units=int(row["avg_daily_demand_units"]),
                    priority_weight=int(row["priority_weight"]),
                    minimum_remaining_shelf_life_days=int(row["minimum_remaining_shelf_life_days"])
                ))
    # 4. Seed Inventory Batches (IDEMPOTENT: Does NOT overwrite quantity_on_hand_units if it exists)
    with open(os.path.join(data_dir, "inventory_batches.csv"), "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            batch_code = row["batch_code"].strip()
            fac_code = row["facility_code"].strip()
            med_code = row["medicine_code"].strip()
            fac_id = fac_map.get(fac_code)
            med_id = med_map.get(med_code)
            
            if not fac_id or not med_id:
                raise ValueError(f"Invalid reference in batches: Facility {fac_code} or Medicine {med_code} not found.")
            
            existing = db.execute(
                select(models.InventoryBatch).where(models.InventoryBatch.batch_code == batch_code)
            ).scalar_one_or_none()
            
            if not existing:
                # Only insert if it doesn't exist. This preserves any user-edited quantities on reruns!
                db.add(models.InventoryBatch(
                    id=uuid.uuid4(),
                    batch_code=batch_code,
                    facility_id=fac_id,
                    medicine_id=med_id,
                    lot_number=row["lot_number"].strip(),
                    expiry_date=date.fromisoformat(row["expiry_date"].strip()),
                    quantity_on_hand_units=int(row["quantity_on_hand_units"]),
                    quality_status=row["quality_status"].strip()
                ))
    # 5. Seed Transport Routes
    with open(os.path.join(data_dir, "transport_routes.csv"), "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            src_code = row["source_facility_code"].strip()
            dst_code = row["destination_facility_code"].strip()
            src_id = fac_map.get(src_code)
            dst_id = fac_map.get(dst_code)
            
            if not src_id or not dst_id:
                raise ValueError(f"Invalid reference in routes: Source {src_code} or Destination {dst_code} not found.")
            
            if src_id == dst_id:
                raise ValueError(f"Self-to-self route detected for facility {src_code}.")
            
            existing = db.execute(
                select(models.TransportRoute).where(
                    models.TransportRoute.source_facility_id == src_id,
                    models.TransportRoute.destination_facility_id == dst_id
                )
            ).scalar_one_or_none()
            
            if not existing:
                db.add(models.TransportRoute(
                    id=uuid.uuid4(),
                    route_code=row["route_code"].strip(),
                    source_facility_id=src_id,
                    destination_facility_id=dst_id,
                    transit_days=int(row["transit_days"]),
                    cost_per_unit_minor_units=int(row["cost_per_unit_minor_units"]),
                    route_capacity_units=int(row["route_capacity_units"]),
                    currency_code=row["currency_code"].strip(),
                    is_active=row["is_active"].strip().lower() == "true"
                ))
    # 6. Seed Coordinator User
    coord_email = settings.COORDINATOR_EMAIL
    coord_password = settings.COORDINATOR_PASSWORD
    
    existing_coord = db.execute(
        select(models.User).where(models.User.email == coord_email.lower())
    ).scalar_one_or_none()
    
    if not existing_coord:
        db.add(models.User(
            id=uuid.uuid4(),
            full_name="Network Coordinator",
            email=coord_email.lower(),
            password_hash=ph.hash(coord_password),
            role="NETWORK_COORDINATOR",
            facility_id=None,
            is_active=True
        ))
    db.commit()

def main():
    """CLI entry point for seeding the database."""
    parser = argparse.ArgumentParser(description="Seed the database with demo data.")
    args = parser.parse_args()

    from app.db.session import SessionLocal

    print("Seeding database...")
    with SessionLocal() as db:
        seed_database(db)
        
    # Print safe counts
    with SessionLocal() as db:
        fac_count = db.execute(select(models.Facility)).scalars().all().__len__()
        med_count = db.execute(select(models.Medicine)).scalars().all().__len__()
        batch_count = db.execute(select(models.InventoryBatch)).scalars().all().__len__()
        route_count = db.execute(select(models.TransportRoute)).scalars().all().__len__()
        print(f"Seed complete. Facilities: {fac_count}, Medicines: {med_count}, Batches: {batch_count}, Routes: {route_count}")
        print(f"Coordinator account ensured: {settings.COORDINATOR_EMAIL}")

if __name__ == "__main__":
    main()