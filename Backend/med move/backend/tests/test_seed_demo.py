# tests/test_seed_demo.py
import pytest
from sqlalchemy import select, func
from app.db import models

# We will import the seed function from your script. 
# If it doesn't exist yet, we will create it in the next step.
from scripts.seed_demo import seed_database 

def test_seed_database_loads_correct_counts(db):
    """Test that seeding produces the expected counts from the sample CSVs."""
    # Run the seed logic against the test database
    seed_database(db)
    
    # Check counts
    facilities_count = db.execute(select(func.count(models.Facility.id))).scalar()
    medicines_count = db.execute(select(func.count(models.Medicine.id))).scalar()
    plans_count = db.execute(select(func.count(models.FacilityMedicinePlan.id))).scalar()
    batches_count = db.execute(select(func.count(models.InventoryBatch.id))).scalar()
    routes_count = db.execute(select(func.count(models.TransportRoute.id))).scalar()
    users_count = db.execute(select(func.count(models.User.id))).scalar()
    
    assert facilities_count == 10, f"Expected 10 facilities, got {facilities_count}"
    assert medicines_count == 4, f"Expected 4 medicines, got {medicines_count}"
    assert plans_count == 40, f"Expected 40 plans, got {plans_count}"
    assert batches_count == 41, f"Expected 41 batches, got {batches_count}"
    assert routes_count == 36, f"Expected 36 routes, got {routes_count}"
    assert users_count >= 1, "Expected at least 1 user (Coordinator)"

def test_seed_database_is_idempotent(db):
    """Test that running the seed script twice does not create duplicates."""
    # Run once
    seed_database(db)
    batches_count_1 = db.execute(select(func.count(models.InventoryBatch.id))).scalar()
    
    # Edit a batch quantity to prove it's not reset by the second run
    first_batch = db.execute(select(models.InventoryBatch)).scalar()
    if first_batch:
        original_qty = first_batch.quantity_on_hand_units
        first_batch.quantity_on_hand_units = 999
        db.commit()
    
    # Run again
    seed_database(db)
    
    # Counts should remain the same (no duplicates)
    batches_count_2 = db.execute(select(func.count(models.InventoryBatch.id))).scalar()
    assert batches_count_1 == batches_count_2, "Seed script created duplicates!"
    
    # Edited quantity should be preserved (upsert logic)
    db.refresh(first_batch)
    assert first_batch.quantity_on_hand_units == 999, "Seed script reset edited quantity!"

def test_coordinator_user_exists_with_hash(db):
    """Test that the Coordinator user is created with a hashed password."""
    seed_database(db)
    
    coordinator = db.execute(
        select(models.User).where(models.User.email == "coordinator@medmove.test")
    ).scalar_one_or_none()
    
    assert coordinator is not None, "Coordinator user not found"
    assert coordinator.role == "NETWORK_COORDINATOR"
    assert coordinator.facility_id is None
    # Check that it's an Argon2 hash (starts with $argon2) and not plaintext
    assert coordinator.password_hash.startswith("$argon2"), "Password should be hashed with argon2"
    assert len(coordinator.password_hash) > 50, "Password hash is too short, might be plaintext"