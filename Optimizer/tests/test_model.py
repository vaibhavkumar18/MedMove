from medmove_optimizer.candidates import TransferCandidate
from medmove_optimizer.model import solve_candidates


def test_solver_respects_shared_route_capacity_and_budget():
    candidates = [
        TransferCandidate("B1", "H1", "H2", "M1", "R1", 100, 100, 100, 1, 2, 50, 1, 1),
        TransferCandidate("B2", "H1", "H3", "M2", "R1", 100, 100, 100, 1, 2, 50, 1, 1),
    ]
    result = solve_candidates(candidates, budget_minor_units=100, max_solve_seconds=5)
    assert sum(decision.quantity_units for decision in result.decisions) <= 50
    assert sum(
        decision.quantity_units * decision.candidate.unit_cost_minor_units
        for decision in result.decisions
    ) <= 100
    assert result.priority_score == sum(
        decision.quantity_units * decision.candidate.priority_weight
        for decision in result.decisions
    )
