#!/usr/bin/env python
"""
Replace the demo dataset in the MedMove database.

This script updates facilities (by code), replaces all plans, batches, and
routes from the CSV files in Backend/data/sample/, and preserves users,
optimization_runs, and alembic_version.

Usage:
    python scripts/replace_demo_data.py            # Apply changes
    python scripts/replace_demo_data.py --dry-run   # Preview changes only

Safety:
    - Users and optimization_runs are never touched.
    - Facilities are updated in place (same UUID) so user FKs remain valid.
    - Medicines are updated in place (same UUID) so batch/plan FKs remain valid.
    - Plans, batches, and routes are deleted and re-inserted (no inbound FKs).
    - The entire operation runs in a single transaction with rollback on failure.
    - A dry-run lists every insert/update/delete without touching the database.
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import date
from pathlib import Path

# Allow running from the Backend directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import uuid
from sqlalchemy import inspect as sa_inspect, select, text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db import models


def get_data_dir() -> str:
    """Return the path to the sample data directory."""
    here = Path(__file__).resolve().parent
    return str(here.parent / "data" / "sample")


def _read_csv(data_dir: str, filename: str) -> list[dict[str, str]]:
    path = os.path.join(data_dir, filename)
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def preview_and_apply(db: Session, dry_run: bool) -> dict:
    """
    Replace demo data. Returns a summary dict with counts.
    If dry_run is True, no changes are committed.
    """
    data_dir = get_data_dir()
    stats = {"facilities_updated": 0, "medicines_updated": 0,
             "plans_deleted": 0, "plans_inserted": 0,
             "batches_deleted": 0, "batches_inserted": 0,
             "routes_deleted": 0, "routes_inserted": 0}

    # --- 1. Update facilities (keep UUIDs, update name/type/district/state) ---
    fac_rows = _read_csv(data_dir, "facilities.csv")
    fac_map = {}  # facility_code -> Facility object

    existing_facilities = db.scalars(select(models.Facility)).all()
    existing_by_code = {f.facility_code: f for f in existing_facilities}

    for row in fac_rows:
        code = row["facility_code"].strip()
        name = row["name"].strip()
        ftype = row["facility_type"].strip()
        district = row["district"].strip()
        state = row["state"].strip()
        is_active = row["is_active"].strip().lower() == "true"

        if code in existing_by_code:
            fac = existing_by_code[code]
            changed = (fac.name != name or fac.facility_type != ftype
                       or fac.district != district or fac.state != state
                       or fac.is_active != is_active)
            if changed:
                if dry_run:
                    print(f"  UPDATE facility {code}: name '{fac.name}' -> '{name}'")
                fac.name = name
                fac.facility_type = ftype
                fac.district = district
                fac.state = state
                fac.is_active = is_active
                stats["facilities_updated"] += 1
            fac_map[code] = fac
        else:
            fac = models.Facility(
                id=uuid.uuid4(), facility_code=code, name=name,
                facility_type=ftype, district=district, state=state,
                is_active=is_active,
            )
            db.add(fac)
            db.flush()
            if dry_run:
                print(f"  INSERT facility {code}: {name}")
            fac_map[code] = fac
            stats["facilities_updated"] += 1

    # --- 2. Update medicines (keep UUIDs, update name/strength/form/unit) ---
    med_rows = _read_csv(data_dir, "medicines.csv")
    med_map = {}  # medicine_code -> Medicine object

    existing_medicines = db.scalars(select(models.Medicine)).all()
    existing_med_by_code = {m.medicine_code: m for m in existing_medicines}

    for row in med_rows:
        code = row["medicine_code"].strip()
        name = row["generic_name"].strip()
        strength = row["strength"].strip()
        form = row["dosage_form"].strip()
        base_unit = row["base_unit"].strip()
        is_active = row["is_active"].strip().lower() == "true"

        if code in existing_med_by_code:
            med = existing_med_by_code[code]
            changed = (med.generic_name != name or med.strength != strength
                       or med.dosage_form != form or med.base_unit != base_unit
                       or med.is_active != is_active)
            if changed:
                if dry_run:
                    print(f"  UPDATE medicine {code}: name '{med.generic_name}' -> '{name}'")
                med.generic_name = name
                med.strength = strength
                med.dosage_form = form
                med.base_unit = base_unit
                med.is_active = is_active
                stats["medicines_updated"] += 1
            med_map[code] = med
        else:
            med = models.Medicine(
                id=uuid.uuid4(), medicine_code=code, generic_name=name,
                strength=strength, dosage_form=form, base_unit=base_unit,
                is_active=is_active,
            )
            db.add(med)
            db.flush()
            if dry_run:
                print(f"  INSERT medicine {code}: {name}")
            med_map[code] = med
            stats["medicines_updated"] += 1

    # --- 3. Replace all facility_medicine_plans ---
    old_plans = db.scalars(select(models.FacilityMedicinePlan)).all()
    stats["plans_deleted"] = len(old_plans)
    if dry_run and old_plans:
        print(f"  DELETE {len(old_plans)} existing facility_medicine_plans rows")
    for p in old_plans:
        db.delete(p)
    db.flush()  # send DELETEs before INSERTs to avoid unique constraint violations

    plan_rows = _read_csv(data_dir, "facility_medicine_plans.csv")
    for row in plan_rows:
        fac_code = row["facility_code"].strip()
        med_code = row["medicine_code"].strip()
        fac = fac_map.get(fac_code)
        med = med_map.get(med_code)
        if not fac or not med:
            raise ValueError(f"Plan references unknown facility {fac_code} or medicine {med_code}")
        plan = models.FacilityMedicinePlan(
            id=uuid.uuid4(),
            facility_id=fac.id, medicine_id=med.id,
            target_stock_units=int(row["target_stock_units"]),
            minimum_reserve_units=int(row["minimum_reserve_units"]),
            avg_daily_demand_units=int(row["avg_daily_demand_units"]),
            priority_weight=int(row["priority_weight"]),
            minimum_remaining_shelf_life_days=int(row["minimum_remaining_shelf_life_days"]),
        )
        db.add(plan)
        stats["plans_inserted"] += 1
    if dry_run:
        print(f"  INSERT {len(plan_rows)} new facility_medicine_plans rows")

    # --- 4. Replace all inventory_batches ---
    old_batches = db.scalars(select(models.InventoryBatch)).all()
    stats["batches_deleted"] = len(old_batches)
    if dry_run and old_batches:
        print(f"  DELETE {len(old_batches)} existing inventory_batches rows")
    for b in old_batches:
        db.delete(b)
    db.flush()  # send DELETEs before INSERTs to avoid unique constraint violations

    batch_rows = _read_csv(data_dir, "inventory_batches.csv")
    for row in batch_rows:
        batch_code = row["batch_code"].strip()
        fac_code = row["facility_code"].strip()
        med_code = row["medicine_code"].strip()
        fac = fac_map.get(fac_code)
        med = med_map.get(med_code)
        if not fac or not med:
            raise ValueError(f"Batch references unknown facility {fac_code} or medicine {med_code}")
        batch = models.InventoryBatch(
            id=uuid.uuid4(), batch_code=batch_code,
            facility_id=fac.id, medicine_id=med.id,
            lot_number=row["lot_number"].strip(),
            expiry_date=date.fromisoformat(row["expiry_date"].strip()),
            quantity_on_hand_units=int(row["quantity_on_hand_units"]),
            quality_status=row["quality_status"].strip(),
        )
        db.add(batch)
        stats["batches_inserted"] += 1
    if dry_run:
        print(f"  INSERT {len(batch_rows)} new inventory_batches rows")

    # --- 5. Replace all transport_routes ---
    old_routes = db.scalars(select(models.TransportRoute)).all()
    stats["routes_deleted"] = len(old_routes)
    if dry_run and old_routes:
        print(f"  DELETE {len(old_routes)} existing transport_routes rows")
    for r in old_routes:
        db.delete(r)
    db.flush()  # send DELETEs before INSERTs to avoid unique constraint violations

    route_rows = _read_csv(data_dir, "transport_routes.csv")
    for row in route_rows:
        src_code = row["source_facility_code"].strip()
        dst_code = row["destination_facility_code"].strip()
        src = fac_map.get(src_code)
        dst = fac_map.get(dst_code)
        if not src or not dst:
            raise ValueError(f"Route references unknown facility {src_code} or {dst_code}")
        if src.id == dst.id:
            raise ValueError(f"Self-route detected for facility {src_code}")
        route = models.TransportRoute(
            id=uuid.uuid4(), route_code=row["route_code"].strip(),
            source_facility_id=src.id, destination_facility_id=dst.id,
            transit_days=int(row["transit_days"]),
            cost_per_unit_minor_units=int(row["cost_per_unit_minor_units"]),
            route_capacity_units=int(row["route_capacity_units"]),
            currency_code=row["currency_code"].strip(),
            is_active=row["is_active"].strip().lower() == "true",
        )
        db.add(route)
        stats["routes_inserted"] += 1
    if dry_run:
        print(f"  INSERT {len(route_rows)} new transport_routes rows")

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Replace the MedMove demo dataset. Preserves users and optimization history."
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview all changes without writing to the database.",
    )
    args = parser.parse_args()

    print()
    print("=" * 60)
    if args.dry_run:
        print("  DRY RUN — no database changes will be made")
    else:
        print("  REPLACE DEMO DATA — database will be updated")
    print("=" * 60)
    print()

    db = SessionLocal()
    try:
        # Verify schema
        bind = db.get_bind()
        if bind.dialect.name == "postgresql":
            if "alembic_version" not in sa_inspect(bind).get_table_names():
                raise RuntimeError("alembic_version table is missing")
            revision = db.execute(text("SELECT version_num FROM alembic_version")).scalar_one_or_none()
            if revision != "196ffc20a50f":
                raise RuntimeError(f"Expected Alembic revision 196ffc20a50f, found {revision!r}")

        # Count current state
        current_facilities = db.scalars(select(models.Facility)).all()
        current_batches = db.scalars(select(models.InventoryBatch)).all()
        current_users = db.scalars(select(models.User)).all()
        current_runs = db.scalars(select(models.OptimizationRun)).all()
        print(f"  Current state: {len(current_facilities)} facilities, "
              f"{len(current_batches)} batches, "
              f"{len(current_users)} users, "
              f"{len(current_runs)} optimization runs")
        print()

        stats = preview_and_apply(db, args.dry_run)

        print()
        print("-" * 60)
        print("  Summary of changes:")
        print(f"    Facilities updated/inserted : {stats['facilities_updated']}")
        print(f"    Medicines updated/inserted  : {stats['medicines_updated']}")
        print(f"    Plans deleted               : {stats['plans_deleted']}")
        print(f"    Plans inserted              : {stats['plans_inserted']}")
        print(f"    Batches deleted             : {stats['batches_deleted']}")
        print(f"    Batches inserted            : {stats['batches_inserted']}")
        print(f"    Routes deleted              : {stats['routes_deleted']}")
        print(f"    Routes inserted             : {stats['routes_inserted']}")
        print("-" * 60)

        if args.dry_run:
            print()
            print("  Dry run complete. No changes were committed.")
            print("  Run without --dry-run to apply these changes.")
            # Rollback the session to discard pending changes
            db.rollback()
        else:
            db.commit()
            print()
            print("  ✓ Dataset replacement committed successfully.")
            print(f"  ✓ Users preserved: {len(current_users)}")
            print(f"  ✓ Optimization runs preserved: {len(current_runs)}")

    except Exception as exc:
        db.rollback()
        print(f"\n  ✗ Error: {exc}")
        print("  Transaction rolled back. No changes were made.")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
