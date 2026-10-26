from datetime import date
from app.core.config import settings
from app.db import repositories as repo
from app.optimizer.engine import calculate_shortages, optimize
from sqlalchemy.orm import Session

def get_current_planning_date() -> date:
    return date.fromisoformat(settings.DEFAULT_PLANNING_DATE)

def run_network_optimization(db: Session, actor_user, request, snapshot_hash: str, trigger_source: str, trigger_reason: str):
    run = repo.create_optimization_run(
        db, actor_user.id, trigger_source, trigger_reason, 
        request.planning_date, request.budget_minor_units, request.objective_policy, snapshot_hash
    )
    try:
        result = optimize(request)
        repo.mark_run_completed(db, run.id, result.model_dump(), {"snapshot_hash": snapshot_hash})
        return {
            "decision": "RAN", "reason": trigger_reason, "optimization_run_id": str(run.id), 
            "run_status": "COMPLETED", "message": "Network recommendations refreshed."
        }
    except Exception:
        repo.mark_run_failed(db, run.id, "OPTIMIZER_ERROR")
        return {
            "decision": "FAILED", "reason": "OPTIMIZER_ERROR", "optimization_run_id": str(run.id), 
            "run_status": "FAILED", "message": "Inventory saved, but optimization failed."
        }

def maybe_run_after_inventory_change(db: Session, actor_user, changed_fields: set):
    if not changed_fields:
        return {"decision": "SKIPPED_UNCHANGED", "message": "No values changed."}
    
    request, snapshot_hash = repo.build_optimizer_request(
        db, get_current_planning_date(), settings.DEFAULT_OPTIMIZATION_BUDGET_MINOR_UNITS, "PRIORITY_WEIGHTED_UNITS_THEN_COST"
    )
    
    shortages = calculate_shortages(request)
    if not any(s.shortage_units > 0 for s in shortages):
        return {"decision": "SKIPPED_NO_NETWORK_SHORTAGE", "message": "No network shortage detected."}
        
    latest = repo.get_latest_run(db)
    if latest and latest.status == "COMPLETED" and latest.input_snapshot_hash == snapshot_hash:
        return {"decision": "SKIPPED_SNAPSHOT_ALREADY_ANALYZED", "message": "Snapshot already optimized."}
        
    return run_network_optimization(db, actor_user, request, snapshot_hash, "INVENTORY_UPDATE", "NETWORK_SHORTAGE_AND_NEW_SNAPSHOT")