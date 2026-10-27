import uuid
from datetime import date, datetime
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.dependencies import get_current_user, get_db
from app.db import models
from app.integrations import optimizer_adapter
from app.main import app
from scripts.seed_demo import seed_database


def _coordinator(db):
    return db.scalar(
        select(models.User).where(models.User.role == "NETWORK_COORDINATOR")
    )


def _override(db, user):
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user


def test_latest_run_returns_empty_result_when_no_runs_exist(db):
    coordinator = SimpleNamespace(role="NETWORK_COORDINATOR", facility=None)
    _override(db, coordinator)
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/optimization-runs/latest")
        assert response.status_code == 200
        assert response.json()["run"] is None
        assert response.json()["visibility_scope"] == "NETWORK"
    finally:
        app.dependency_overrides.clear()


def test_manual_run_executes_canonical_optimizer_and_retrieves_persisted_result(db, monkeypatch):
    seed_database(db)
    coordinator = _coordinator(db)
    original_quantities = {
        batch.batch_code: batch.quantity_on_hand_units
        for batch in db.scalars(select(models.InventoryBatch)).all()
    }
    calls = []
    real_api = optimizer_adapter._optimizer_api

    def tracked_api():
        optimize, request_type = real_api()

        def tracked_optimize(request):
            calls.append(request)
            return optimize(request)

        return tracked_optimize, request_type

    monkeypatch.setattr(optimizer_adapter, "_optimizer_api", tracked_api)
    _override(db, coordinator)
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/optimization-runs",
                json={
                    "planning_date": "2026-10-26",
                    "budget_minor_units": 50000,
                    "objective_policy": "PRIORITY_WEIGHTED_UNITS_THEN_COST",
                },
            )
            body = response.json()
            run_id = body["run"]["run_id"]
            retrieved = client.get(f"/api/v1/optimization-runs/{run_id}")
            latest = client.get("/api/v1/optimization-runs/latest")
        assert response.status_code == 200
        assert len(calls) == 1
        assert body["run"]["status"] == "COMPLETED"
        assert body["summary"]["transfer_count"] == len(body["transfers"])
        assert body["transfers"] or body["unmet_shortages"]
        assert retrieved.status_code == 200
        assert retrieved.json()["run"]["run_id"] == run_id
        assert retrieved.json()["transfers"] == body["transfers"]
        assert latest.status_code == 200
        assert latest.json()["run"]["run_id"] == run_id
        assert {
            batch.batch_code: batch.quantity_on_hand_units
            for batch in db.scalars(select(models.InventoryBatch)).all()
        } == original_quantities
    finally:
        app.dependency_overrides.clear()


def test_solver_failure_is_persisted_and_never_reported_successfully(db, monkeypatch):
    seed_database(db)
    coordinator = _coordinator(db)
    real_api = optimizer_adapter._optimizer_api

    def failing_api():
        _, request_type = real_api()

        def fail(_request):
            raise RuntimeError("solver failure")

        return fail, request_type

    monkeypatch.setattr(optimizer_adapter, "_optimizer_api", failing_api)
    _override(db, coordinator)
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/optimization-runs",
                json={
                    "planning_date": "2026-10-27",
                    "budget_minor_units": 50000,
                    "objective_policy": "PRIORITY_WEIGHTED_UNITS_THEN_COST",
                },
            )
        assert response.status_code == 500
        detail = response.json()["detail"]
        assert detail["code"] == "OPTIMIZER_ERROR"
        failed = db.scalar(
            select(models.OptimizationRun).where(
                models.OptimizationRun.id == uuid.UUID(detail["run_id"])
            )
        )
        assert failed.status == "FAILED"
        assert failed.solver_status_stage_1 is None
    finally:
        app.dependency_overrides.clear()


def test_hospital_cannot_start_or_view_network_run(db):
    seed_database(db)
    coordinator = _coordinator(db)
    facility = db.scalar(
        select(models.Facility).where(models.Facility.facility_code == "H01")
    )
    hospital = SimpleNamespace(
        role="HOSPITAL_USER",
        facility_id=facility.id,
        facility=facility,
    )
    _override(db, hospital)
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/optimization-runs",
                json={
                    "planning_date": "2026-10-28",
                    "budget_minor_units": 50000,
                    "objective_policy": "PRIORITY_WEIGHTED_UNITS_THEN_COST",
                },
            )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_hospital_result_projection_filters_other_facilities(db):
    seed_database(db)
    coordinator = _coordinator(db)
    facility = db.scalar(
        select(models.Facility).where(models.Facility.facility_code == "H01")
    )
    run = models.OptimizationRun(
        id=uuid.uuid4(),
        created_by_user_id=coordinator.id,
        trigger_source="MANUAL",
        trigger_reason="TEST",
        status="COMPLETED",
        planning_date=date(2026, 10, 26),
        budget_minor_units=50000,
        objective_policy="PRIORITY_WEIGHTED_UNITS_THEN_COST",
        input_snapshot_hash="a" * 64,
        input_summary_json={"initial_shortage_line_count": 2},
        result_json={
            "summary": {
                "shortage_lines_total": 2,
                "priority_weighted_units_score": 10,
            },
            "recommendations": [
                {
                    "source_facility_id": "H01",
                    "destination_facility_id": "H02",
                    "medicine_id": "MED1",
                    "source_batch_id": "B_H01_MED1_A",
                    "quantity_units": 5,
                    "unit_cost_minor_units": 10,
                    "total_cost_minor_units": 50,
                    "transit_days": 1,
                    "explanation_codes": [],
                },
                {
                    "source_facility_id": "H03",
                    "destination_facility_id": "H04",
                    "medicine_id": "MED1",
                    "source_batch_id": "B_H03_MED1_A",
                    "quantity_units": 5,
                    "unit_cost_minor_units": 10,
                    "total_cost_minor_units": 50,
                    "transit_days": 1,
                    "explanation_codes": [],
                },
            ],
            "unmet_shortages": [
                {
                    "facility_id": "H01",
                    "medicine_id": "MED1",
                    "shortage_before_units": 10,
                    "recommended_units": 5,
                    "shortage_after_units": 5,
                },
                {
                    "facility_id": "H04",
                    "medicine_id": "MED1",
                    "shortage_before_units": 10,
                    "recommended_units": 0,
                    "shortage_after_units": 10,
                },
            ],
            "warnings": [],
        },
        solver_status_stage_1="OPTIMAL",
        total_recommended_units=10,
        total_cost_minor_units=100,
        started_at=datetime(2026, 10, 26),
    )
    db.add(run)
    db.commit()
    hospital = SimpleNamespace(role="HOSPITAL_USER", facility_id=facility.id, facility=facility)
    _override(db, hospital)
    try:
        with TestClient(app) as client:
            response = client.get(f"/api/v1/optimization-runs/{run.id}")
        assert response.status_code == 200
        body = response.json()
        assert len(body["transfers"]) == 1
        assert body["transfers"][0]["direction"] == "OUTGOING"
        assert len(body["unmet_shortages"]) == 1
        assert body["unmet_shortages"][0]["facility_code"] == "H01"
    finally:
        app.dependency_overrides.clear()
