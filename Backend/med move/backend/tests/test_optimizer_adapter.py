# tests/test_optimizer_adapter.py
import pytest
from app.db import models
from app.integrations.optimizer_adapter import (
    build_optimizer_request,
    create_optimization_run,
    mark_run_completed,
    mark_run_failed,
    get_latest_run,
    get_run_by_id
)
from datetime import date
import uuid
import json

def test_build_optimizer_request_uses_business_codes(db):
    """Test that the adapter maps UUIDs to business codes, not UUIDs."""
    # First, ensure DB is seeded so we have data
    from scripts.seed_demo import seed_database
    seed_database(db)
    
    request, snapshot_hash = build_optimizer_request(
        db=db,
        planning_date=date.today(),
        budget_minor_units=50000,
        objective_policy="PRIORITY_WEIGHTED_UNITS_THEN_COST"
    )
    
    # Verify business codes are used, not raw UUIDs
        # Verify business codes are used, not raw UUIDs
    assert len(request.facilities) > 0
    
    # Check that at least one seeded facility is present and has a valid business code
    h0_facilities = [f for f in request.facilities if f.code.startswith("H0")]
    assert len(h0_facilities) > 0, "Expected at least one facility with code starting with 'H0'"
    
    med_facilities = [m for m in request.medicines if m.code.startswith("MED")]
    assert len(med_facilities) > 0, "Expected at least one medicine with code starting with 'MED'"
    
    # Verify hash is a valid 64-character hex string (SHA-256)
    assert len(snapshot_hash) == 64
    assert all(c in "0123456789abcdef" for c in snapshot_hash)  

def test_build_optimizer_request_deterministic_hash(db):
    """Test that the same snapshot yields the exact same hash."""
    from scripts.seed_demo import seed_database
    seed_database(db)
    
    request1, hash1 = build_optimizer_request(
        db=db, planning_date=date.today(), budget_minor_units=50000, objective_policy="PRIORITY_WEIGHTED_UNITS_THEN_COST"
    )
    request2, hash2 = build_optimizer_request(
        db=db, planning_date=date.today(), budget_minor_units=50000, objective_policy="PRIORITY_WEIGHTED_UNITS_THEN_COST"
    )
    
    assert hash1 == hash2, "Same data should produce the exact same snapshot hash"

def test_optimizer_run_persistence_lifecycle(db):
    """Test creating, completing, and failing an optimization run."""
    user = models.User(
        id=uuid.uuid4(), full_name="Test User", email="test@test.com",
        password_hash="hash", role="NETWORK_COORDINATOR", is_active=True
    )
    db.add(user)
    db.commit()
    
    # 1. Create Run
    run = create_optimization_run(
        db=db,
        initiated_by_user_id=user.id,
        planning_date=date.today(),
        budget_minor_units=100000,
        trigger_source="MANUAL",
        trigger_reason="TEST",
        objective_policy="PRIORITY_WEIGHTED_UNITS_THEN_COST",
        input_snapshot_hash="test-hash-123",
        input_summary_json={"test": True}
    )
    
    assert run.status == "RUNNING"
    assert run.input_snapshot_hash == "test-hash-123"
    
    # 2. Get Run by ID and Latest
    fetched_run = get_run_by_id(db, run.id)
    assert fetched_run.id == run.id
    
    latest_run = get_latest_run(db)
    assert latest_run.id == run.id
    
    # 3. Mark Completed
    result_json = {"transfers": [], "unmet_shortages": []}
    mark_run_completed(
        db=db,
        run_id=run.id,
        result_json=result_json,
        solver_status_stage_1="OPTIMAL",
        solver_status_stage_2=None,
        total_recommended_units=500,
        total_cost_minor_units=25000
    )
    
    db.refresh(run)
    assert run.status == "COMPLETED"
    assert run.total_recommended_units == 500
    assert run.result_json == result_json
    
    # 4. Test Failed Run (Create a new one to test failure path)
    run2 = create_optimization_run(
        db=db, initiated_by_user_id=user.id, planning_date=date.today(),
        budget_minor_units=100000, trigger_source="MANUAL", trigger_reason="TEST_FAIL",
        objective_policy="PRIORITY_WEIGHTED_UNITS_THEN_COST", input_snapshot_hash="fail-hash",
        input_summary_json={}
    )
    
    mark_run_failed(db=db, run_id=run2.id, error_code="SOLVER_TIMEOUT")
    db.refresh(run2)
    assert run2.status == "FAILED"
    assert run2.error_code == "SOLVER_TIMEOUT"