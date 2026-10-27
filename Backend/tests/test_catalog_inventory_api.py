from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.dependencies import get_current_user, get_db
from app.db import models
from app.main import app
from scripts.seed_demo import seed_database


def _client_for_user(db, user):
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app)


def test_catalog_is_registered_and_hospital_scoped(db):
    seed_database(db)
    facility = db.scalar(select(models.Facility).where(models.Facility.facility_code == "H01"))
    user = SimpleNamespace(role="HOSPITAL_USER", facility_id=facility.id)

    try:
        with _client_for_user(db, user) as client:
            response = client.get("/api/v1/catalog/medicines")
        assert response.status_code == 200
        assert len(response.json()["medicines"]) == 4
        assert {"medicine_code", "generic_name", "strength", "dosage_form", "base_unit"} <= set(
            response.json()["medicines"][0]
        )
    finally:
        app.dependency_overrides.clear()


def test_inventory_shape_and_hospital_scope_ignore_facility_query(db):
    seed_database(db)
    facility = db.scalar(select(models.Facility).where(models.Facility.facility_code == "H01"))
    user = SimpleNamespace(role="HOSPITAL_USER", facility_id=facility.id)

    try:
        with _client_for_user(db, user) as client:
            response = client.get("/api/v1/inventory", params={"facility_code": "H02"})
        assert response.status_code == 200
        batches = response.json()["batches"]
        assert len(batches) == 5
        assert {batch["facility_code"] for batch in batches} == {"H01"}
        assert {
            "facility_name",
            "generic_name",
            "updated_at",
            "quantity_on_hand_units",
        } <= set(batches[0])
    finally:
        app.dependency_overrides.clear()


def test_coordinator_can_filter_network_inventory(db):
    seed_database(db)
    user = SimpleNamespace(role="NETWORK_COORDINATOR", facility_id=None)

    try:
        with _client_for_user(db, user) as client:
            all_inventory = client.get("/api/v1/inventory")
            filtered = client.get("/api/v1/inventory", params={"facility_code": "H02"})
        assert all_inventory.status_code == 200
        assert len(all_inventory.json()["batches"]) == 41
        assert filtered.status_code == 200
        assert {batch["facility_code"] for batch in filtered.json()["batches"]} == {"H02"}
    finally:
        app.dependency_overrides.clear()


def test_create_batch_uses_authenticated_facility_and_reports_optimizer_failure(db):
    seed_database(db)
    facility = db.scalar(select(models.Facility).where(models.Facility.facility_code == "H01"))
    user = SimpleNamespace(role="HOSPITAL_USER", facility_id=facility.id)

    try:
        with _client_for_user(db, user) as client:
            response = client.post(
                "/api/v1/inventory/batches",
                json={
                    "medicine_code": "MED1",
                    "lot_number": "LOT-API-01",
                    "expiry_date": "2027-12-31",
                    "quantity_on_hand_units": 60,
                    "quality_status": "ELIGIBLE",
                },
            )
        assert response.status_code == 201
        body = response.json()
        assert body["inventory_batch"]["facility_code"] == "H01"
        assert body["trigger"]["decision"] == "FAILED"
        assert body["trigger"]["reason"] == "OPTIMIZER_ERROR"
        assert body["trigger"]["message"].startswith("Inventory saved, but optimization failed.")
        assert db.scalar(
            select(models.InventoryBatch).where(
                models.InventoryBatch.lot_number == "LOT-API-01"
            )
        ) is not None
    finally:
        app.dependency_overrides.clear()


def test_patch_rejects_unknown_fields_and_hides_other_facilities(db):
    seed_database(db)
    facility = db.scalar(select(models.Facility).where(models.Facility.facility_code == "H01"))
    other_batch = db.scalar(
        select(models.InventoryBatch).where(models.InventoryBatch.batch_code == "B_H02_MED1_A")
    )
    user = SimpleNamespace(role="HOSPITAL_USER", facility_id=facility.id)

    try:
        with _client_for_user(db, user) as client:
            invalid = client.patch(
                "/api/v1/inventory/batches/B_H01_MED1_A",
                json={"facility_id": "forbidden"},
            )
            unauthorized = client.patch(
                f"/api/v1/inventory/batches/{other_batch.batch_code}",
                json={"quantity_on_hand_units": 1},
            )
        assert invalid.status_code == 422
        assert unauthorized.status_code == 404
    finally:
        app.dependency_overrides.clear()
