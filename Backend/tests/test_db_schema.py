# tests/test_db_schema.py
import pytest
from sqlalchemy.exc import IntegrityError
from app.db import models
import uuid
from datetime import date

# --- Helper to create valid dummy data ---
def create_dummy_facility(db, code="TEST_FAC"):
    facility = models.Facility(
        id=uuid.uuid4(), facility_code=code, name="Test Facility", 
        facility_type="HOSPITAL", district="Test District", state="Test State", is_active=True
    )
    db.add(facility)
    db.commit()
    return facility

def create_dummy_medicine(db, code="TEST_MED"):
    medicine = models.Medicine(
        id=uuid.uuid4(), medicine_code=code, generic_name="Test Med", 
        strength="500mg", dosage_form="Tablet", base_unit="tab", is_active=True
    )
    db.add(medicine)
    db.commit()
    return medicine

# --- 1. All seven tables exist (Sanity Check) ---
def test_all_tables_exist(db):
    """Verify that all 7 tables can be queried without error."""
    assert db.execute(db.query(models.Facility).statement).scalars().first() is not None or True
    assert db.execute(db.query(models.Medicine).statement).scalars().first() is not None or True
    assert db.execute(db.query(models.User).statement).scalars().first() is not None or True
    assert db.execute(db.query(models.InventoryBatch).statement).scalars().first() is not None or True
    assert db.execute(db.query(models.FacilityMedicinePlan).statement).scalars().first() is not None or True
    assert db.execute(db.query(models.TransportRoute).statement).scalars().first() is not None or True
    assert db.execute(db.query(models.OptimizationRun).statement).scalars().first() is not None or True

# --- 2. Unique Constraints ---
def test_unique_facility_code_rejected(db):
    """Test that duplicate facility codes are rejected."""
    create_dummy_facility(db, "UNIQUE_FAC")
    with pytest.raises(IntegrityError):
        db.add(models.Facility(
            id=uuid.uuid4(), facility_code="UNIQUE_FAC", name="Duplicate", 
            facility_type="HOSPITAL", district="X", state="Y", is_active=True
        ))
        db.commit()

def test_unique_medicine_code_rejected(db):
    """Test that duplicate medicine codes are rejected."""
    create_dummy_medicine(db, "UNIQUE_MED")
    with pytest.raises(IntegrityError):
        db.add(models.Medicine(
            id=uuid.uuid4(), medicine_code="UNIQUE_MED", generic_name="Duplicate", 
            strength="100mg", dosage_form="Capsule", base_unit="cap", is_active=True
        ))
        db.commit()

def test_unique_route_rejected(db):
    """Test that duplicate routes between the same facilities are rejected."""
    fac1 = create_dummy_facility(db, "ROUTE_FAC1")
    fac2 = create_dummy_facility(db, "ROUTE_FAC2")
    
    db.add(models.TransportRoute(
        id=uuid.uuid4(), route_code="ROUTE_FAC1_FAC2",
        source_facility_id=fac1.id, destination_facility_id=fac2.id,
        transit_days=1, cost_per_unit_minor_units=100, route_capacity_units=1000,
        currency_code="INR", is_active=True
    ))
    db.commit()
    
    with pytest.raises(IntegrityError):
        db.add(models.TransportRoute(
            id=uuid.uuid4(), route_code="ROUTE_FAC1_FAC2_DUPLICATE",
            source_facility_id=fac1.id, destination_facility_id=fac2.id,
            transit_days=2, cost_per_unit_minor_units=200, route_capacity_units=2000,
            currency_code="INR", is_active=True
        ))
        db.commit()

# --- 3. Check Constraints ---
def test_negative_inventory_rejected(db):
    """Test that the database rejects negative inventory quantities."""
    facility = create_dummy_facility(db, "NEG_FAC")
    medicine = create_dummy_medicine(db, "NEG_MED")
    
    with pytest.raises(IntegrityError):
        db.add(models.InventoryBatch(
            id=uuid.uuid4(), batch_code="NEG_BATCH", facility_id=facility.id,
            medicine_id=medicine.id, lot_number="LOT1", expiry_date=date.today(),
            quantity_on_hand_units=-5,  # Triggers CheckConstraint!
            quality_status="ELIGIBLE"
        ))
        db.commit()

def test_facility_medicine_plan_constraints(db):
    """Test that plan targets and reserves cannot be negative."""
    facility = create_dummy_facility(db, "PLAN_FAC")
    medicine = create_dummy_medicine(db, "PLAN_MED")
    
    with pytest.raises(IntegrityError):
        db.add(models.FacilityMedicinePlan(
            facility_id=facility.id, medicine_id=medicine.id,
            target_stock_units=-100,  # Triggers CheckConstraint!
            minimum_reserve_units=10, avg_daily_demand_units=5,
            priority_weight=1.0, minimum_remaining_shelf_life_days=30
        ))
        db.commit()

def test_route_no_self_to_self(db):
    """Test that a route cannot have the same source and destination."""
    facility = create_dummy_facility(db, "SELF_FAC")
    
    with pytest.raises(IntegrityError):
        db.add(models.TransportRoute(
            id=uuid.uuid4(),
            route_code="SELF_ROUTE",
            source_facility_id=facility.id,
            destination_facility_id=facility.id,  # Triggers CheckConstraint!
            transit_days=1, cost_per_unit_minor_units=100,
            route_capacity_units=1000, currency_code="INR", is_active=True
        ))
        db.commit()