import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.db import models, repositories as repo
from app.features.optimization.schemas import (
    LatestRunResponse,
    ManualRunRequest,
    OptimizationRunResponse,
    OptimizationRunResponseBody,
    OptimizationSummaryResponse,
    TransferResponse,
    UnmetShortageResponse,
)
from app.integrations.optimizer_adapter import (
    DuplicateRunError,
    OptimizerExecutionError,
    run_optimization_from_database,
)
from app.features.optimization.service import run_network_optimization

router = APIRouter(prefix="/optimization-runs", tags=["Optimization"])


def _run_metadata(run) -> OptimizationRunResponse:
    return OptimizationRunResponse(
        run_id=str(run.id),
        status=run.status,
        trigger_source=run.trigger_source,
        trigger_reason=run.trigger_reason,
        planning_date=run.planning_date,
        budget_minor_units=run.budget_minor_units,
        objective_policy=run.objective_policy,
        input_snapshot_hash=run.input_snapshot_hash,
        created_at=run.created_at,
        solver_status_stage_1=run.solver_status_stage_1,
        solver_status_stage_2=run.solver_status_stage_2,
    )


def _project_result(run, user, result_json: dict, db: Session) -> dict:
    recommendations = result_json.get("recommendations", [])
    unmet = result_json.get("unmet_shortages", [])
    facility_code = user.facility.facility_code if user.facility else None
    is_coordinator = user.role == "NETWORK_COORDINATOR"

    # Build name lookup maps once from the live catalogue — O(n) over small tables.
    # These names are not stored in result_json; we resolve them at read time.
    facility_name_map: dict[str, str] = {
        f.facility_code: f.name
        for f in db.scalars(select(models.Facility)).all()
    }
    medicine_detail_map: dict[str, str] = {
        m.medicine_code: f"{m.generic_name} · {m.strength} {m.dosage_form}".strip(" ·")
        for m in db.scalars(select(models.Medicine)).all()
    }

    transfers: list[TransferResponse] = []
    for item in recommendations:
        source = item["source_facility_id"]
        destination = item["destination_facility_id"]
        if not is_coordinator and facility_code not in {source, destination}:
            continue
        direction = None if is_coordinator else (
            "OUTGOING" if source == facility_code else "INCOMING"
        )
        transfers.append(
            TransferResponse(
                source_facility_code=source,
                source_facility_name=facility_name_map.get(source),
                destination_facility_code=destination,
                destination_facility_name=facility_name_map.get(destination),
                medicine_code=item["medicine_id"],
                medicine_name=medicine_detail_map.get(item["medicine_id"]),
                source_batch_code=item["source_batch_id"],
                recommended_quantity_units=item["quantity_units"],
                cost_per_unit_minor_units=item["unit_cost_minor_units"],
                estimated_cost_minor_units=item["total_cost_minor_units"],
                transit_days=item["transit_days"],
                reason=";".join(item.get("explanation_codes", [])) or None,
                direction=direction,
            )
        )
    unmet_shortages: list[UnmetShortageResponse] = []
    for item in unmet:
        if not is_coordinator and item["facility_id"] != facility_code:
            continue
        unmet_shortages.append(
            UnmetShortageResponse(
                facility_code=item["facility_id"],
                medicine_code=item["medicine_id"],
                shortage_before_units=item["shortage_before_units"],
                recommended_inbound_units=item["recommended_units"],
                shortage_after_units=item["shortage_after_units"],
                reason="SHORTAGE_REMAINS_UNMET",
            )
        )
    summary = result_json["summary"]
    return {
        "run": _run_metadata(run),
        "summary": OptimizationSummaryResponse(
            transfer_count=len(transfers),
            total_recommended_units=sum(item.recommended_quantity_units for item in transfers),
            total_cost_minor_units=sum(item.estimated_cost_minor_units for item in transfers),
            initial_shortage_line_count=run.input_summary_json.get(
                "initial_shortage_line_count", summary["shortage_lines_total"]
            ),
            unmet_shortage_line_count=len(unmet_shortages),
            total_unmet_shortage_units=sum(
                item.shortage_after_units for item in unmet_shortages
            ),
            priority_weighted_units_score=summary["priority_weighted_units_score"],
        ),
        "transfers": transfers,
        "unmet_shortages": unmet_shortages,
        "warnings": result_json.get("warnings", []),
    }


def _empty_result(user) -> dict:
    return {
        "run": None,
        "visibility_scope": "NETWORK" if user.role == "NETWORK_COORDINATOR" else "FACILITY",
        "facility_code": user.facility.facility_code if user.facility else None,
        "summary": {
            "transfer_count": 0,
            "total_recommended_units": 0,
            "total_cost_minor_units": 0,
            "initial_shortage_line_count": 0,
            "unmet_shortage_line_count": 0,
            "total_unmet_shortage_units": 0,
            "priority_weighted_units_score": 0,
        },
        "transfers": [],
        "unmet_shortages": [],
        "warnings": [],
    }


@router.post("", response_model=OptimizationRunResponseBody)
def manual_run(
    payload: ManualRunRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if user.role != "NETWORK_COORDINATOR":
        raise HTTPException(
            status_code=403,
            detail={"code": "COORDINATOR_REQUIRED", "message": "Access denied"},
        )
    try:
        run, result = run_network_optimization(
            db,
            actor_user=user,
            planning_date=payload.planning_date,
            budget_minor_units=payload.budget_minor_units,
            objective_policy=payload.objective_policy,
            trigger_source="MANUAL",
            trigger_reason="COORDINATOR_MANUAL_RUN",
        )
    except DuplicateRunError as exc:
        raise HTTPException(
            status_code=409,
            detail={"code": "DUPLICATE_RUN", "message": str(exc)},
        )
    except OptimizerExecutionError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "OPTIMIZER_ERROR",
                "message": "Optimization failed.",
                "run_id": str(exc.run_id),
            },
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_REQUEST", "message": str(exc)},
        )
    return OptimizationRunResponseBody(
        **_project_result(run, user, result.model_dump(mode="json"), db)
    )


def _get_run(db: Session, run_id: uuid.UUID | None = None):
    return repo.get_run_by_id(db, run_id) if run_id else repo.get_latest_run(db)


def _completed_or_error(run):
    if run.status != "COMPLETED" or not run.result_json:
        raise HTTPException(
            status_code=409,
            detail={"code": "RUN_NOT_COMPLETED", "message": "Optimization run is not completed"},
        )


@router.get("/latest", response_model=LatestRunResponse)
def get_latest_run(db: Session = Depends(get_db), user=Depends(get_current_user)):
    run = _get_run(db)
    if run is None:
        return LatestRunResponse(**_empty_result(user))
    _completed_or_error(run)
    result = _project_result(run, user, run.result_json, db)
    return LatestRunResponse(
        **result,
        visibility_scope="NETWORK" if user.role == "NETWORK_COORDINATOR" else "FACILITY",
        facility_code=user.facility.facility_code if user.facility else None,
    )


@router.get("/{run_id}", response_model=OptimizationRunResponseBody)
def get_run(run_id: uuid.UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    run = _get_run(db, run_id)
    if run is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "RUN_NOT_FOUND", "message": "Optimization run not found"},
        )
    _completed_or_error(run)
    return OptimizationRunResponseBody(**_project_result(run, user, run.result_json, db))
