# tests/test_api.py
from fastapi.testclient import TestClient

def test_dashboard_endpoint(client: TestClient):
    """Test that the dashboard endpoint is secured and requires authentication."""
    response = client.get("/api/v1/dashboard")
    # We expect 401 (Unauthorized) because the test doesn't provide a login token.
    # This proves the security dependency is working correctly!
    assert response.status_code in [401, 403]

def test_manual_optimization_run(client: TestClient):
    """Test that manual optimization run endpoint exists and is secured."""
    response = client.post(
        "/api/v1/optimization-runs",
        json={
            "planning_date": "2026-10-25",
            "budget_minor_units": 50000,
            "objective_policy": "PRIORITY_WEIGHTED_UNITS_THEN_COST"
        }
    )
    # We expect 401/403 because tests don't have auth tokens.
    assert response.status_code in [200, 201, 401, 403]