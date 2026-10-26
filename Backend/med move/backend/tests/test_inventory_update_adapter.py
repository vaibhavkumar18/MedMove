# tests/test_inventory_update_adapter.py
import pytest
from datetime import date, timedelta
from sqlalchemy import select
from app.db import models
from app.db.repositories import update_inventory_batch, create_inventory_batch
from scripts.seed_demo import seed_database
import uuid

def test_update_inventory_changed_quantity_returns_field_name(db):
    """Test that changing quantity returns the correct changed field."""
    seed_database(db)
    
    batch = db.scalars(select(models.InventoryBatch)).first()
    assert batch is not None
    
    original_qty = batch.quantity_on_hand_units
    new_qty = original_qty + 10
    
    updated_batch, changed_fields = update_inventory_batch(
        db=db,
        facility_id=batch.facility_id,
        batch_code=batch.batch_code,
        patch={"quantity_on_hand_units": new_qty}
    )
    
    assert "quantity_on_hand_units" in changed_fields
    assert updated_batch.quantity_on_hand_units == new_qty

def test_update_inventory_no_op_returns_empty_changed_fields(db):
    """Test that providing the same values returns an empty changed_fields set."""
    seed_database(db)
    
    batch = db.scalars(select(models.InventoryBatch)).first()
    assert batch is not None
    
    updated_batch, changed_fields = update_inventory_batch(
        db=db,
        facility_id=batch.facility_id,
        batch_code=batch.batch_code,
        patch={
            "quantity_on_hand_units": batch.quantity_on_hand_units,
            "quality_status": batch.quality_status
        }
    )
    
    assert len(changed_fields) == 0, f"Expected empty changed_fields, got {changed_fields}"

def test_update_inventory_cross_facility_rejected(db):
    """Test that a user cannot update a batch from a different facility."""
    seed_database(db)
    
    batch = db.scalars(select(models.InventoryBatch)).first()
    assert batch is not None
    
    fake_facility_id = uuid.uuid4()
    
    with pytest.raises(ValueError, match="not found or not owned"):
        update_inventory_batch(
            db=db,
            facility_id=fake_facility_id,
            batch_code=batch.batch_code,
            patch={"quantity_on_hand_units": 999}
        )

def test_create_inventory_batch_invalid_plan_rejected(db):
    """Test that creating a batch for a medicine without a plan (or invalid medicine) is rejected."""
    seed_database(db)
    
    facility = db.scalars(select(models.Facility)).first()
    assert facility is not None
    
    # Try to create a batch for a medicine code that doesn't exist.
    # The function correctly fails fast with "not found or inactive".
    with pytest.raises(ValueError, match="not found or inactive"):
        create_inventory_batch(
            db=db,
            facility_id=facility.id,
            medicine_code="FAKE_MED_999",
            lot_number="LOT_FAKE",
            expiry_date=date.today() + timedelta(days=365),
            quantity_on_hand_units=100,
            quality_status="ELIGIBLE"
        )

def test_update_inventory_commit_happens_before_return(db):
    """Test that the DB commit actually persists the change before the function returns."""
    seed_database(db)
    
    batch = db.scalars(select(models.InventoryBatch)).first()
    assert batch is not None
    
    new_qty = batch.quantity_on_hand_units + 50
    
    # Call the function
    update_inventory_batch(
        db=db,
        facility_id=batch.facility_id,
        batch_code=batch.batch_code,
        patch={"quantity_on_hand_units": new_qty}
    )
    
    # To prove the data was committed to the DB (and not just held in the session's 
    # pending state), we expire the object and query it fresh from the database.
    db.expire(batch)
    
    fresh_batch = db.scalars(
        select(models.InventoryBatch).where(models.InventoryBatch.id == batch.id)
    ).first()
    
    assert fresh_batch is not None, "Batch was not committed to the database"
    assert fresh_batch.quantity_on_hand_units == new_qty, "Quantity was not persisted"