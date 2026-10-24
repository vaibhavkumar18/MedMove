from .candidates import TransferCandidate


def priority_score(candidate: TransferCandidate, quantity_units: int) -> int:
    return quantity_units * candidate.priority_weight


def cost_score(candidate: TransferCandidate, quantity_units: int) -> int:
    return quantity_units * candidate.unit_cost_minor_units

