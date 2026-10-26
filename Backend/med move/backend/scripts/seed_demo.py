# scripts/seed_demo.py
import os
import csv
import uuid
import argparse
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import select
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

def seed_database(db: Session) -> None:
    """
    Idempotent seed function that loads CSVs into the provided database session.
    Preserves existing edited inventory quantities on reruns.
    """
    data_dir = get_data_dir()
    
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
    db.commit()

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
    db.commit()

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
                    priority_weight=float(row["priority_weight"]),
                    minimum_remaining_shelf_life_days=int(row["minimum_remaining_shelf_life_days"])
                ))
    db.commit()

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
    db.commit()

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
                    source_facility_id=src_id,
                    destination_facility_id=dst_id,
                    transit_days=int(row["transit_days"]),
                    cost_per_unit_minor_units=int(row["cost_per_unit_minor_units"]),
                    route_capacity_units=int(row["route_capacity_units"]),
                    currency_code=row["currency_code"].strip(),
                    is_active=row["is_active"].strip().lower() == "true"
                ))
    db.commit()

    # 6. Seed Coordinator User
    coord_email = getattr(settings, "DEMO_COORDINATOR_EMAIL", "coordinator@medmove.test")
    coord_password = getattr(settings, "DEMO_COORDINATOR_PASSWORD", "coordinator-password")
    
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
    parser.add_argument("--create-tables", action="store_true", help="Create tables before seeding.")
    args = parser.parse_args()

    from app.db.session import engine, SessionLocal
    from app.db.base import Base

    if args.create_tables:
        print("Creating database tables...")
        Base.metadata.create_all(bind=engine)

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
        print(f"Coordinator account ensured: {getattr(settings, 'DEMO_COORDINATOR_EMAIL', 'coordinator@medmove.test')}")

if __name__ == "__main__":
    main()