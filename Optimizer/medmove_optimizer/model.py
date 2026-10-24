from dataclasses import dataclass

from ortools.sat.python import cp_model

from .candidates import TransferCandidate
from .schemas import SolverStatus


@dataclass(frozen=True)
class SolverDecision:
    candidate: TransferCandidate
    quantity_units: int


@dataclass(frozen=True)
class SolveResult:
    decisions: list[SolverDecision]
    stage_1_status: SolverStatus
    stage_2_status: SolverStatus | None
    priority_score: int
    optimality_proven: bool


def _status(status: cp_model.CpSolverStatus) -> SolverStatus:
    return {
        cp_model.OPTIMAL: SolverStatus.OPTIMAL,
        cp_model.FEASIBLE: SolverStatus.FEASIBLE,
        cp_model.INFEASIBLE: SolverStatus.INFEASIBLE,
        cp_model.UNKNOWN: SolverStatus.UNKNOWN,
        cp_model.MODEL_INVALID: SolverStatus.MODEL_INVALID,
    }[status]


def _build_model(
    candidates: list[TransferCandidate],
    budget_minor_units: int,
    fixed_priority_score: int | None = None,
    minimize_cost: bool = False,
) -> tuple[cp_model.CpModel, list[cp_model.IntVar]]:
    model = cp_model.CpModel()
    variables = [
        model.NewIntVar(0, candidate.batch_quantity_units, f"transfer_{index}")
        for index, candidate in enumerate(candidates)
    ]
    by_batch: dict[str, list[int]] = {}
    by_source: dict[tuple[str, str], list[int]] = {}
    by_destination: dict[tuple[str, str], list[int]] = {}
    by_route: dict[str, list[int]] = {}
    for index, candidate in enumerate(candidates):
        by_batch.setdefault(candidate.batch_id, []).append(index)
        by_source.setdefault((candidate.source_facility_id, candidate.medicine_id), []).append(index)
        by_destination.setdefault((candidate.destination_facility_id, candidate.medicine_id), []).append(index)
        by_route.setdefault(candidate.route_id, []).append(index)
    for indexes in by_batch.values():
        model.Add(sum(variables[i] for i in indexes) <= candidates[indexes[0]].available_quantity_units)
    for indexes in by_source.values():
        model.Add(sum(variables[i] for i in indexes) <= _source_limit(candidates, indexes))
    for indexes in by_destination.values():
        model.Add(sum(variables[i] for i in indexes) <= _destination_limit(candidates, indexes))
    for indexes in by_route.values():
        model.Add(sum(variables[i] for i in indexes) <= candidates[indexes[0]].route_capacity_units)
    model.Add(
        sum(c.unit_cost_minor_units * variables[i] for i, c in enumerate(candidates))
        <= budget_minor_units
    )
    score = sum(c.priority_weight * variables[i] for i, c in enumerate(candidates))
    if fixed_priority_score is not None:
        model.Add(score == fixed_priority_score)
    if minimize_cost:
        model.Minimize(sum(c.unit_cost_minor_units * variables[i] for i, c in enumerate(candidates)))
    else:
        model.Maximize(score)
    return model, variables


def _source_limit(candidates: list[TransferCandidate], indexes: list[int]) -> int:
    return min(candidates[i].source_transferable_units for i in indexes)


def _destination_limit(candidates: list[TransferCandidate], indexes: list[int]) -> int:
    return min(candidates[i].shortage_units for i in indexes)


def solve_candidates(
    candidates: list[TransferCandidate],
    budget_minor_units: int,
    max_solve_seconds: int,
) -> SolveResult:
    if not candidates:
        return SolveResult([], SolverStatus.INFEASIBLE, None, 0, True)
    first_model, first_variables = _build_model(candidates, budget_minor_units)
    first_solver = cp_model.CpSolver()
    first_solver.parameters.max_time_in_seconds = max_solve_seconds
    first_raw_status = first_solver.Solve(first_model)
    first_status = _status(first_raw_status)
    if first_raw_status != cp_model.OPTIMAL:
        decisions = (
            [
                SolverDecision(c, first_solver.Value(v))
                for c, v in zip(candidates, first_variables)
                if first_solver.Value(v) > 0
            ]
            if first_raw_status == cp_model.FEASIBLE
            else []
        )
        return SolveResult(
            decisions,
            first_status,
            None,
            sum(d.quantity_units * d.candidate.priority_weight for d in decisions),
            False,
        )
    priority_value = round(first_solver.ObjectiveValue())
    second_model, second_variables = _build_model(
        candidates, budget_minor_units, priority_value, minimize_cost=True
    )
    second_solver = cp_model.CpSolver()
    second_solver.parameters.max_time_in_seconds = max_solve_seconds
    second_raw_status = second_solver.Solve(second_model)
    second_status = _status(second_raw_status)
    if second_raw_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        solver, variables = second_solver, second_variables
    else:
        solver, variables = first_solver, first_variables
    decisions = [
        SolverDecision(c, solver.Value(v))
        for c, v in zip(candidates, variables)
        if solver.Value(v) > 0
    ]
    return SolveResult(
        decisions,
        first_status,
        second_status,
        priority_value,
        second_raw_status == cp_model.OPTIMAL,
    )
