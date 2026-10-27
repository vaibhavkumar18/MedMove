from types import SimpleNamespace

from app.features.optimization import service


def _request():
    return SimpleNamespace()


def test_unchanged_inventory_skips():
    result = service.maybe_run_after_inventory_change(
        object(), SimpleNamespace(id="user"), set()
    )

    assert result["decision"] == "SKIPPED_UNCHANGED"


def test_no_shortage_skips(monkeypatch):
    monkeypatch.setattr(
        service, "build_optimizer_request", lambda *args: (_request(), "hash")
    )
    monkeypatch.setattr(service, "_calculate_shortages", lambda request: [])

    result = service.maybe_run_after_inventory_change(
        object(), SimpleNamespace(id="user"), {"quantity_on_hand_units"}
    )

    assert result["decision"] == "SKIPPED_NO_NETWORK_SHORTAGE"


def test_new_shortage_runs_shared_orchestration_once(monkeypatch):
    shortage = SimpleNamespace(shortage_units=2)
    calls = []
    monkeypatch.setattr(
        service, "build_optimizer_request", lambda *args: (_request(), "new-hash")
    )
    monkeypatch.setattr(service, "_calculate_shortages", lambda request: [shortage])
    monkeypatch.setattr(service, "get_latest_run", lambda db: None)

    def run(*args, **kwargs):
        calls.append(kwargs)
        return SimpleNamespace(id="run-1", status="COMPLETED"), object()

    monkeypatch.setattr(service, "run_network_optimization", run)

    result = service.maybe_run_after_inventory_change(
        object(), SimpleNamespace(id="user"), {"quantity_on_hand_units"}
    )

    assert result["decision"] == "RAN"
    assert result["optimization_run_id"] == "run-1"
    assert len(calls) == 1
    assert calls[0]["trigger_source"] == "INVENTORY_UPDATE"
    assert calls[0]["trigger_reason"] == "NETWORK_SHORTAGE_AND_NEW_SNAPSHOT"


def test_analyzed_snapshot_skips(monkeypatch):
    latest = SimpleNamespace(
        status="COMPLETED", input_snapshot_hash="same-hash", id="run-1"
    )
    monkeypatch.setattr(
        service, "build_optimizer_request", lambda *args: (_request(), "same-hash")
    )
    monkeypatch.setattr(
        service,
        "_calculate_shortages",
        lambda request: [SimpleNamespace(shortage_units=1)],
    )
    monkeypatch.setattr(service, "get_latest_run", lambda db: latest)

    result = service.maybe_run_after_inventory_change(
        object(), SimpleNamespace(id="user"), {"quality_status"}
    )

    assert result["decision"] == "SKIPPED_SNAPSHOT_ALREADY_ANALYZED"
    assert result["optimization_run_id"] == "run-1"
