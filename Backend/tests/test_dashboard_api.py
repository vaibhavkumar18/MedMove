"""Tests for the dashboard API with the new rich response contract."""
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.dependencies import get_current_user, get_db
from app.db import models
from app.main import app
from scripts.seed_demo import seed_database


def _override(db, user):
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user


def test_dashboard_requires_authentication(client: TestClient):
    """Unauthenticated requests must be rejected."""
    response = client.get("/api/v1/dashboard")
    assert response.status_code in [401, 403]


def test_dashboard_coordinator_returns_rich_response(db):
    """Coordinator dashboard returns the full DashboardResponse contract."""
    seed_database(db)
    coordinator = db.scalar(
        select(models.User).where(models.User.role == "NETWORK_COORDINATOR")
    )
    _override(db, coordinator)
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/dashboard")
        assert response.status_code == 200
        body = response.json()
        # Top-level keys required by contracts.ts DashboardResponse
        assert "viewer" in body
        assert "generated_at" in body
        assert "summary" in body
        assert "facilities" in body
        assert "shortages" in body
        assert "latest_run" in body or body.get("latest_run") is None
        # Viewer block
        assert body["viewer"]["role"] == "NETWORK_COORDINATOR"
        assert body["viewer"]["facility_code"] is None
        # Summary block
        summary = body["summary"]
        assert "facility_count" in summary
        assert "medicine_count" in summary
        assert "shortage_line_count" in summary
        assert "total_shortage_units" in summary
        assert "eligible_surplus_line_count" in summary
        assert "eligible_surplus_units" in summary
        assert "latest_run_status" in summary
        # Facilities list
        assert isinstance(body["facilities"], list)
        assert len(body["facilities"]) > 0
        fac = body["facilities"][0]
        assert "facility_code" in fac
        assert "facility_name" in fac
        assert "shortage_line_count" in fac
        assert "total_shortage_units" in fac
        assert "eligible_surplus_line_count" in fac
        assert "eligible_surplus_units" in fac
    finally:
        app.dependency_overrides.clear()


def test_dashboard_hospital_user_scoped_to_own_facility(db):
    """Hospital user receives data scoped to their own facility only."""
    seed_database(db)
    facility = db.scalar(
        select(models.Facility).where(models.Facility.facility_code == "H01")
    )
    hospital_user = SimpleNamespace(
        role="HOSPITAL_USER",
        facility_id=facility.id,
        facility=facility,
    )
    _override(db, hospital_user)
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/dashboard")
        assert response.status_code == 200
        body = response.json()
        assert body["viewer"]["role"] == "HOSPITAL_USER"
        assert body["viewer"]["facility_code"] == "H01"
        # Only the user's own facility should appear
        assert len(body["facilities"]) == 1
        assert body["facilities"][0]["facility_code"] == "H01"
    finally:
        app.dependency_overrides.clear()
