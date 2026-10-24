from dataclasses import dataclass

from .schemas import OptimizationRequest
from .stock import batch_meets_shelf_life, calculate_shortages, calculate_surpluses, policy_map


@dataclass(frozen=True)
class TransferCandidate:
    batch_id: str
    source_facility_id: str
    destination_facility_id: str
    medicine_id: str
    route_id: str
    available_quantity_units: int
    batch_quantity_units: int
    source_transferable_units: int
    shortage_units: int
    transit_days: int
    unit_cost_minor_units: int
    route_capacity_units: int
    priority_weight: int


def generate_candidates(request: OptimizationRequest) -> list[TransferCandidate]:
    facilities = {f.id: f for f in request.facilities}
    medicines = {m.id: m for m in request.medicines}
    policies = policy_map(request)
    shortages = {(s.facility_id, s.medicine_id): s for s in calculate_shortages(request)}
    surplus_limits = {
        (s.facility_id, s.medicine_id): s.transferable_units
        for s in calculate_surpluses(request)
    }
    candidates: list[TransferCandidate] = []
    for route in sorted(request.routes, key=lambda item: item.id):
        source = facilities[route.source_facility_id]
        destination = facilities[route.destination_facility_id]
        if (
            not route.is_active
            or not source.is_active
            or not destination.is_active
            or source.id == destination.id
        ):
            continue
        for batch in sorted(request.inventory_batches, key=lambda item: item.id):
            source_key = (batch.facility_id, batch.medicine_id)
            destination_key = (destination.id, batch.medicine_id)
            destination_policy = policies.get(destination_key)
            if (
                batch.facility_id != source.id
                or batch.medicine_id not in medicines
                or not medicines[batch.medicine_id].is_active
                or source_key not in surplus_limits
                or destination_key not in shortages
                or destination_policy is None
                or not batch_meets_shelf_life(
                    batch,
                    request.planning_date,
                    route.transit_days,
                    destination_policy.minimum_remaining_shelf_life_days,
                )
            ):
                continue
            quantity = min(
                batch.available_quantity_units,
                surplus_limits[source_key],
                shortages[destination_key].shortage_units,
            )
            if quantity > 0:
                candidates.append(
                    TransferCandidate(
                        batch.id,
                        source.id,
                        destination.id,
                        batch.medicine_id,
                        route.id,
                        quantity,
                        batch.available_quantity_units,
                        surplus_limits[source_key],
                        shortages[destination_key].shortage_units,
                        route.transit_days,
                        route.cost_per_unit_minor_units,
                        route.route_capacity_units,
                        destination_policy.priority_weight,
                    )
                )
    return candidates
