from datetime import date

from sqlalchemy import create_engine, func, select

from backend.db.models import (
    Base,
    Facility,
    FacilityMedicinePlan,
    InventoryBatch,
    Medicine,
    OptimizationRun,
    TransferRecommendationRow,
    UnmetShortageRow,
    User,
    UserRole,
)
from backend.db.session import create_session_factory
from backend.integrations.optimizer_adapter import (
    DuplicateRunError,
    run_optimization_from_database,
)
from scripts.seed_demo import seed_demo


def test_seed_is_repeatable_and_database_workflow_does_not_mutate_inventory(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'seed.db'}"
    seed_demo(database_url)
    seed_demo(database_url)
    engine = create_engine(database_url)
    factory = create_session_factory(engine)
    with factory() as session:
        counts = {
            model.__name__: session.scalar(select(func.count()).select_from(model))
            for model in (Facility, Medicine, InventoryBatch, FacilityMedicinePlan)
        }
        assert counts == {
            "Facility": 10,
            "Medicine": 4,
            "InventoryBatch": 41,
            "FacilityMedicinePlan": 40,
        }
        user = User(
            full_name="Coordinator",
            email="coordinator@example.test",
            password_hash="controlled-setup-hash",
            role=UserRole.NETWORK_COORDINATOR,
        )
        session.add(user)
        session.commit()
        before = {
            row.batch_code: row.quantity_on_hand_units
            for row in session.scalars(select(InventoryBatch))
        }
        result = run_optimization_from_database(
            session,
            initiated_by_user_id=user.id,
            planning_date=date(2026, 10, 24),
            budget_minor_units=18_000,
            run_code="integration-test-run",
        )
        after = {
            row.batch_code: row.quantity_on_hand_units
            for row in session.scalars(select(InventoryBatch))
        }
        assert result.status.value == "COMPLETED"
        assert result.summary.transfer_line_count == 3
        assert result.summary.estimated_cost_minor_units == 17_875
        assert before == after
        run = session.scalar(
            select(OptimizationRun).where(OptimizationRun.run_code == "integration-test-run")
        )
        assert run is not None
        assert run.result_json["run_id"] == "integration-test-run"
        assert session.scalar(select(TransferRecommendationRow)) is not None
        assert session.scalar(select(UnmetShortageRow)) is not None

        try:
            run_optimization_from_database(
                session,
                initiated_by_user_id=user.id,
                planning_date=date(2026, 10, 24),
                budget_minor_units=18_000,
                run_code="second-run",
            )
        except DuplicateRunError:
            pass
        else:
            raise AssertionError("identical completed snapshot should be rejected")
