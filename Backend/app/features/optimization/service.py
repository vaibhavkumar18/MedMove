from datetime import date

from sqlalchemy.orm import Session

from app.core.config import settings
from app.integrations.optimizer_adapter import (
    DuplicateRunError,
    OptimizerExecutionError,
    _optimizer_api,
    build_optimizer_request,
    get_latest_run,
    run_optimization_from_database,
)


def get_current_planning_date() -> date:
    return date.fromisoformat(settings.DEFAULT_PLANNING_DATE)


def _calculate_shortages(request):
    _optimizer_api()
    from medmove_optimizer.stock import calculate_shortages

    return calculate_shortages(request)


def run_network_optimization(
    db: Session,
    actor_user,
    *,
    planning_date: date,
    budget_minor_units: int,
    objective_policy: str,
    trigger_source: str,
    trigger_reason: str,
    request=None,
    snapshot_hash: str | None = None,
):
    """Run the canonical optimizer for either manual or automatic execution."""
    return run_optimization_from_database(
        db,
        initiated_by_user_id=actor_user.id,
        planning_date=planning_date,
        budget_minor_units=budget_minor_units,
        objective_policy=objective_policy,
        trigger_source=trigger_source,
        trigger_reason=trigger_reason,
        request=request,
        snapshot_hash=snapshot_hash,
    )


def maybe_run_after_inventory_change(db: Session, actor_user, changed_fields: set) -> dict:
    if not changed_fields:
        return {
            "decision": "SKIPPED_UNCHANGED",
            "reason": None,
            "optimization_run_id": None,
            "run_status": None,
            "message": "No values changed.",
        }

    try:
        planning_date = get_current_planning_date()
        budget = settings.DEFAULT_OPTIMIZATION_BUDGET_MINOR_UNITS
        objective_policy = "PRIORITY_WEIGHTED_UNITS_THEN_COST"
        request, snapshot_hash = build_optimizer_request(
            db, planning_date, budget, objective_policy
        )
        shortages = _calculate_shortages(request)
        if not any(shortage.shortage_units > 0 for shortage in shortages):
            return {
                "decision": "SKIPPED_NO_NETWORK_SHORTAGE",
                "reason": None,
                "optimization_run_id": None,
                "run_status": None,
                "message": "No network shortage detected.",
            }

        latest = get_latest_run(db)
        if (
            latest
            and latest.status == "COMPLETED"
            and latest.input_snapshot_hash == snapshot_hash
        ):
            return {
                "decision": "SKIPPED_SNAPSHOT_ALREADY_ANALYZED",
                "reason": None,
                "optimization_run_id": str(latest.id),
                "run_status": latest.status,
                "message": "Snapshot already optimized.",
            }

        run, _ = run_network_optimization(
            db,
            actor_user,
            planning_date=planning_date,
            budget_minor_units=budget,
            objective_policy=objective_policy,
            trigger_source="INVENTORY_UPDATE",
            trigger_reason="NETWORK_SHORTAGE_AND_NEW_SNAPSHOT",
            request=request,
            snapshot_hash=snapshot_hash,
        )
        return {
            "decision": "RAN",
            "reason": "NETWORK_SHORTAGE_AND_NEW_SNAPSHOT",
            "optimization_run_id": str(run.id),
            "run_status": run.status,
            "message": "Inventory saved and network recommendations refreshed.",
        }
    except DuplicateRunError as exc:
        return {
            "decision": "SKIPPED_SNAPSHOT_ALREADY_ANALYZED",
            "reason": None,
            "optimization_run_id": None,
            "run_status": "COMPLETED",
            "message": str(exc),
        }
    except OptimizerExecutionError as exc:
        return {
            "decision": "FAILED",
            "reason": "OPTIMIZER_ERROR",
            "optimization_run_id": str(exc.run_id),
            "run_status": "FAILED",
            "message": "Inventory saved, but optimization failed. Retry from the Network Coordinator dashboard.",
        }
    except Exception:
        return {
            "decision": "FAILED",
            "reason": "OPTIMIZER_ERROR",
            "optimization_run_id": None,
            "run_status": "FAILED",
            "message": "Inventory saved, but optimization failed. Retry from the Network Coordinator dashboard.",
        }
