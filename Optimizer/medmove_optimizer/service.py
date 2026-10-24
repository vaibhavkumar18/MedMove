from datetime import timedelta
from time import monotonic

from .candidates import generate_candidates
from .model import solve_candidates
from .schemas import (
    ObjectivePolicy,
    OptimizationRequest,
    OptimizationResult,
    OptimizationSummary,
    Recommendation,
    RunStatus,
    SolverStatus,
    UnmetShortage,
)
from .stock import calculate_shortages
from .validation import validate_result


def optimize(request: OptimizationRequest) -> OptimizationResult:
    started = monotonic()
    shortages = calculate_shortages(request)
    candidates = generate_candidates(request)
    solved = solve_candidates(
        candidates,
        request.budget_minor_units,
        request.max_solve_seconds,
    )
    recommendations = [
        Recommendation(
            id=f"REC-{index:04d}-{decision.candidate.route_id}-{decision.candidate.batch_id}",
            source_facility_id=decision.candidate.source_facility_id,
            destination_facility_id=decision.candidate.destination_facility_id,
            medicine_id=decision.candidate.medicine_id,
            source_batch_id=decision.candidate.batch_id,
            route_id=decision.candidate.route_id,
            quantity_units=decision.quantity_units,
            expected_arrival_date=request.planning_date
            + timedelta(days=decision.candidate.transit_days),
            transit_days=decision.candidate.transit_days,
            unit_cost_minor_units=decision.candidate.unit_cost_minor_units,
            total_cost_minor_units=decision.quantity_units
            * decision.candidate.unit_cost_minor_units,
            currency_code=request.currency_code,
            priority_weight=decision.candidate.priority_weight,
            explanation_codes=["PRIORITY_WEIGHTED_SHORTAGE_REDUCTION"],
        )
        for index, decision in enumerate(solved.decisions, 1)
    ]
    inbound = {}
    for recommendation in recommendations:
        key = (recommendation.destination_facility_id, recommendation.medicine_id)
        inbound[key] = inbound.get(key, 0) + recommendation.quantity_units
    unmet = []
    for line in shortages:
        recommended_units = min(
            line.shortage_units,
            inbound.get((line.facility_id, line.medicine_id), 0),
        )
        shortage_after_units = line.shortage_units - recommended_units
        if shortage_after_units > 0:
            unmet.append(
                UnmetShortage(
                    facility_id=line.facility_id,
                    medicine_id=line.medicine_id,
                    shortage_before_units=line.shortage_units,
                    recommended_units=recommended_units,
                    shortage_after_units=shortage_after_units,
                    priority_weight=line.priority_weight,
                )
            )
    estimated_cost = sum(r.total_cost_minor_units for r in recommendations)
    status = (
        RunStatus.FAILED
        if solved.stage_1_status in {SolverStatus.UNKNOWN, SolverStatus.MODEL_INVALID}
        or solved.stage_2_status in {SolverStatus.UNKNOWN, SolverStatus.MODEL_INVALID}
        else RunStatus.COMPLETED
    )
    warnings: list[str] = []
    if not candidates:
        warnings.append("No feasible transfer candidates were found.")
    if any(line.shortage_after_units > 0 for line in unmet):
        warnings.append(
            "Some shortages remain unmet within current eligible stock, route, "
            "expiry, shelf-life, capacity, and budget constraints."
        )
    if status is RunStatus.FAILED:
        warnings.append("The optimizer solver did not return a valid solution.")
    result = OptimizationResult(
        schema_version=request.schema_version,
        run_id=request.run_id,
        status=status,
        objective_policy=ObjectivePolicy.PRIORITY_WEIGHTED_UNITS_THEN_COST,
        solver_status_stage_1=solved.stage_1_status,
        solver_status_stage_2=solved.stage_2_status,
        optimality_proven=solved.optimality_proven,
        optimizer_version="1.0",
        solve_time_ms=round((monotonic() - started) * 1000),
        summary=OptimizationSummary(
            estimated_cost_minor_units=estimated_cost,
            budget_remaining_minor_units=request.budget_minor_units - estimated_cost,
            transfer_line_count=len(recommendations),
            shortage_lines_total=len(unmet),
            shortage_lines_with_any_fulfillment=sum(
                1 for line in unmet if line.recommended_units > 0
            ),
            priority_weighted_units_score=sum(
                r.quantity_units * r.priority_weight for r in recommendations
            ),
        ),
        recommendations=recommendations,
        unmet_shortages=unmet,
        warnings=warnings,
    )
    validate_result(request, result)
    return result
