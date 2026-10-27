# tests/test_replace_demo_data.py
"""
Regression tests for Backend/scripts/replace_demo_data.py.

These tests use the isolated in-memory SQLite fixture (no network, no Neon).
They directly invoke preview_and_apply() to exercise the delete-flush-insert
path for plans, batches, and routes.
"""
import uuid
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import select

from app.db import models
from scripts.replace_demo_data import preview_and_apply


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_facility(db, code: str, name: str) -> models.Facility:
    fac = models.Facility(
        id=uuid.uuid4(),
        facility_code=code,
        name=name,
        facility_type="DISTRICT",
        district="Test District",
        state="Test State",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(fac)
    db.flush()
    return fac


def _make_medicine(db, code: str) -> models.Medicine:
    med = models.Medicine(
        id=uuid.uuid4(),
        medicine_code=code,
        generic_name=f"Medicine {code}",
        strength="100mg",
        dosage_form="Tablet",
        base_unit="tab",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(med)
    db.flush()
    return med


# ---------------------------------------------------------------------------
# Regression test: duplicate plan key must not raise UniqueViolation
# ---------------------------------------------------------------------------

def test_replace_plans_does_not_raise_unique_violation(db, tmp_path):
    """
    Pre-populate the DB with plans for (H01, MED1) and (H01, MED2).
    Then run preview_and_apply with CSV files that insert the same
    (facility_code, medicine_code) pairs under the same facility UUIDs.

    Before the flush() fix, PostgreSQL would raise:
        UniqueViolation: duplicate key value violates unique constraint "uix_fac_med_plan"

    After the fix, the old plans must be deleted and flushed BEFORE the new
    plans are inserted, so no constraint violation occurs.
    """
    fac = _make_facility(db, "H01", "City General Hospital")
    med1 = _make_medicine(db, "MED1")
    med2 = _make_medicine(db, "MED2")

    # Seed two existing plans
    for med in (med1, med2):
        db.add(models.FacilityMedicinePlan(
            id=uuid.uuid4(),
            facility_id=fac.id,
            medicine_id=med.id,
            target_stock_units=100,
            minimum_reserve_units=20,
            avg_daily_demand_units=5,
            priority_weight=2,
            minimum_remaining_shelf_life_days=14,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ))
    db.flush()

    plans_before = db.scalars(select(models.FacilityMedicinePlan)).all()
    assert len(plans_before) == 2

    # Write minimal replacement CSVs to a temp directory
    (tmp_path / "facilities.csv").write_text(
        "facility_code,name,facility_type,district,state,is_active\n"
        "H01,City General Hospital,DISTRICT,Test District,Test State,true\n"
    )
    (tmp_path / "medicines.csv").write_text(
        "medicine_code,generic_name,strength,dosage_form,base_unit,is_active\n"
        "MED1,Medicine MED1,100mg,Tablet,tab,true\n"
        "MED2,Medicine MED2,100mg,Tablet,tab,true\n"
    )
    # Same (H01, MED1) and (H01, MED2) keys — these must replace, not collide
    (tmp_path / "facility_medicine_plans.csv").write_text(
        "facility_code,medicine_code,target_stock_units,minimum_reserve_units,"
        "avg_daily_demand_units,priority_weight,minimum_remaining_shelf_life_days\n"
        "H01,MED1,200,50,10,3,30\n"
        "H01,MED2,150,30,7,2,14\n"
    )
    (tmp_path / "inventory_batches.csv").write_text(
        "batch_code,facility_code,medicine_code,lot_number,expiry_date,"
        "quantity_on_hand_units,quality_status\n"
    )
    (tmp_path / "transport_routes.csv").write_text(
        "route_code,source_facility_code,destination_facility_code,transit_days,"
        "cost_per_unit_minor_units,route_capacity_units,currency_code,is_active\n"
    )

    # Monkeypatch get_data_dir to point at tmp_path
    import scripts.replace_demo_data as rdd
    original = rdd.get_data_dir
    rdd.get_data_dir = lambda: str(tmp_path)
    try:
        # This must not raise UniqueViolation
        stats = preview_and_apply(db, dry_run=False)
    finally:
        rdd.get_data_dir = original

    assert stats["plans_deleted"] == 2
    assert stats["plans_inserted"] == 2

    # Verify replacement values were written, not the originals
    plans_after = db.scalars(select(models.FacilityMedicinePlan)).all()
    assert len(plans_after) == 2
    targets = {p.target_stock_units for p in plans_after}
    assert targets == {200, 150}, f"Expected new target values {{200, 150}}, got {targets}"


def test_replace_batches_does_not_raise_unique_violation(db, tmp_path):
    """
    Pre-populate the DB with a batch for (H01, MED1, LOT-A).
    Run preview_and_apply with a CSV inserting a new batch for the same
    (facility_code, medicine_code, lot_number) combination.
    The old batch must be deleted and flushed before the new one is inserted.
    """
    fac = _make_facility(db, "H01", "City General Hospital")
    med = _make_medicine(db, "MED1")

    db.add(models.InventoryBatch(
        id=uuid.uuid4(),
        batch_code="B_H01_MED1_A",
        facility_id=fac.id,
        medicine_id=med.id,
        lot_number="LOT-A",
        expiry_date=date(2027, 6, 30),
        quantity_on_hand_units=100,
        quality_status="ELIGIBLE",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    ))
    db.flush()

    (tmp_path / "facilities.csv").write_text(
        "facility_code,name,facility_type,district,state,is_active\n"
        "H01,City General Hospital,DISTRICT,Test District,Test State,true\n"
    )
    (tmp_path / "medicines.csv").write_text(
        "medicine_code,generic_name,strength,dosage_form,base_unit,is_active\n"
        "MED1,Medicine MED1,100mg,Tablet,tab,true\n"
    )
    (tmp_path / "facility_medicine_plans.csv").write_text(
        "facility_code,medicine_code,target_stock_units,minimum_reserve_units,"
        "avg_daily_demand_units,priority_weight,minimum_remaining_shelf_life_days\n"
    )
    # Same batch_code AND same (facility, medicine, lot) triple — both unique constraints
    (tmp_path / "inventory_batches.csv").write_text(
        "batch_code,facility_code,medicine_code,lot_number,expiry_date,"
        "quantity_on_hand_units,quality_status\n"
        "B_H01_MED1_A,H01,MED1,LOT-A,2027-12-31,250,ELIGIBLE\n"
    )
    (tmp_path / "transport_routes.csv").write_text(
        "route_code,source_facility_code,destination_facility_code,transit_days,"
        "cost_per_unit_minor_units,route_capacity_units,currency_code,is_active\n"
    )

    import scripts.replace_demo_data as rdd
    original = rdd.get_data_dir
    rdd.get_data_dir = lambda: str(tmp_path)
    try:
        stats = preview_and_apply(db, dry_run=False)
    finally:
        rdd.get_data_dir = original

    assert stats["batches_deleted"] == 1
    assert stats["batches_inserted"] == 1

    batch = db.scalars(select(models.InventoryBatch)).one()
    assert batch.quantity_on_hand_units == 250, "Replacement batch should have qty=250"
    assert batch.expiry_date == date(2027, 12, 31)


def test_replace_routes_does_not_raise_unique_violation(db, tmp_path):
    """
    Pre-populate with a route H01→H02, then replace it with new values.
    The old route must be flushed before the new one is inserted to avoid
    the uix_source_dest unique constraint violation.
    """
    fac1 = _make_facility(db, "H01", "City General Hospital")
    fac2 = _make_facility(db, "H02", "Riverside District Hospital")

    db.add(models.TransportRoute(
        id=uuid.uuid4(),
        route_code="R_H01_H02",
        source_facility_id=fac1.id,
        destination_facility_id=fac2.id,
        transit_days=2,
        cost_per_unit_minor_units=200,
        route_capacity_units=100,
        currency_code="INR",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    ))
    db.flush()

    (tmp_path / "facilities.csv").write_text(
        "facility_code,name,facility_type,district,state,is_active\n"
        "H01,City General Hospital,DISTRICT,Test District,Test State,true\n"
        "H02,Riverside District Hospital,DISTRICT,Test District,Test State,true\n"
    )
    (tmp_path / "medicines.csv").write_text(
        "medicine_code,generic_name,strength,dosage_form,base_unit,is_active\n"
    )
    (tmp_path / "facility_medicine_plans.csv").write_text(
        "facility_code,medicine_code,target_stock_units,minimum_reserve_units,"
        "avg_daily_demand_units,priority_weight,minimum_remaining_shelf_life_days\n"
    )
    (tmp_path / "inventory_batches.csv").write_text(
        "batch_code,facility_code,medicine_code,lot_number,expiry_date,"
        "quantity_on_hand_units,quality_status\n"
    )
    # Same source/destination pair — uix_source_dest constraint
    (tmp_path / "transport_routes.csv").write_text(
        "route_code,source_facility_code,destination_facility_code,transit_days,"
        "cost_per_unit_minor_units,route_capacity_units,currency_code,is_active\n"
        "R_H01_H02,H01,H02,3,255,120,INR,true\n"
    )

    import scripts.replace_demo_data as rdd
    original = rdd.get_data_dir
    rdd.get_data_dir = lambda: str(tmp_path)
    try:
        stats = preview_and_apply(db, dry_run=False)
    finally:
        rdd.get_data_dir = original

    assert stats["routes_deleted"] == 1
    assert stats["routes_inserted"] == 1

    route = db.scalars(select(models.TransportRoute)).one()
    assert route.transit_days == 3, "Replacement route should have transit_days=3"
    assert route.cost_per_unit_minor_units == 255
