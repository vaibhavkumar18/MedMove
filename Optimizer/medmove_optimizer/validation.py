from collections import defaultdict
from datetime import timedelta

from .schemas import OptimizationRequest, OptimizationResult
from .stock import (
    batch_meets_shelf_life,
    calculate_shortages,
    policy_map,
    protected_stock_units,
    usable_stock_by_pair,
)


def validate_result(request: OptimizationRequest, result: OptimizationResult) -> None:
    facilities = {f.id for f in request.facilities}
    active_facilities = {f.id for f in request.facilities if f.is_active}
    medicines = {m.id for m in request.medicines}
    batches = {b.id: b for b in request.inventory_batches}
    routes = {r.id: r for r in request.routes}
    policies = policy_map(request)
    shortages = {
        (s.facility_id, s.medicine_id): s.shortage_units
        for s in calculate_shortages(request)
    }
    source_outgoing: dict[tuple[str, str], int] = defaultdict(int)
    batch_outgoing: dict[str, int] = defaultdict(int)
    destination_incoming: dict[tuple[str, str], int] = defaultdict(int)
    route_load: dict[str, int] = defaultdict(int)
    total_cost = 0
    for recommendation in result.recommendations:
        if recommendation.source_facility_id not in facilities:
            raise ValueError("recommendation references an unknown source facility")
        if recommendation.destination_facility_id not in facilities:
            raise ValueError("recommendation references an unknown destination facility")
        if (
            recommendation.source_facility_id not in active_facilities
            or recommendation.destination_facility_id not in active_facilities
        ):
            raise ValueError("recommendation references an inactive facility")
        if recommendation.source_facility_id == recommendation.destination_facility_id:
            raise ValueError("recommendation source and destination must differ")
        if recommendation.medicine_id not in medicines:
            raise ValueError("recommendation references an unknown medicine")
        batch = batches.get(recommendation.source_batch_id)
        route = routes.get(recommendation.route_id)
        if batch is None or route is None:
            raise ValueError("recommendation references an unknown batch or route")
        if (
            batch.facility_id != recommendation.source_facility_id
            or batch.medicine_id != recommendation.medicine_id
        ):
            raise ValueError("recommendation batch does not match source and medicine")
        if (
            route.source_facility_id != recommendation.source_facility_id
            or route.destination_facility_id != recommendation.destination_facility_id
            or not route.is_active
        ):
            raise ValueError("recommendation route does not match its facilities")
        if recommendation.currency_code != request.currency_code:
            raise ValueError("recommendation currency does not match request currency")
        destination_policy = policies.get(
            (recommendation.destination_facility_id, recommendation.medicine_id)
        )
        if destination_policy is None or not batch_meets_shelf_life(
            batch,
            request.planning_date,
            route.transit_days,
            destination_policy.minimum_remaining_shelf_life_days,
        ):
            raise ValueError("recommendation batch does not meet shelf-life requirements")
        if recommendation.transit_days != route.transit_days:
            raise ValueError("recommendation transit days do not match route")
        if recommendation.expected_arrival_date != request.planning_date + timedelta(
            days=route.transit_days
        ):
            raise ValueError("recommendation arrival date does not match route")
        source_outgoing[(batch.facility_id, batch.medicine_id)] += recommendation.quantity_units
        batch_outgoing[batch.id] += recommendation.quantity_units
        destination_incoming[
            (recommendation.destination_facility_id, recommendation.medicine_id)
        ] += recommendation.quantity_units
        route_load[route.id] += recommendation.quantity_units
        total_cost += recommendation.total_cost_minor_units
    usable = usable_stock_by_pair(request)
    for batch_id, amount in batch_outgoing.items():
        if amount > batches[batch_id].available_quantity_units:
            raise ValueError("recommendations exceed source batch availability")
    for key, amount in source_outgoing.items():
        policy = policies[key]
        if amount > max(0, usable.get(key, 0) - protected_stock_units(policy)):
            raise ValueError("recommendations violate source reserve")
    for key, amount in destination_incoming.items():
        if amount > shortages.get(key, 0):
            raise ValueError("recommendations exceed destination shortage")
    for route_id, amount in route_load.items():
        if amount > routes[route_id].route_capacity_units:
            raise ValueError("recommendations exceed route capacity")
    if total_cost > request.budget_minor_units:
        raise ValueError("recommendations exceed budget")
    if result.summary.estimated_cost_minor_units != total_cost:
        raise ValueError("summary cost does not match recommendations")
    if result.summary.budget_remaining_minor_units != request.budget_minor_units - total_cost:
        raise ValueError("summary budget remaining does not match recommendations")
    expected_unmet_units = sum(line.shortage_after_units for line in result.unmet_shortages)
    if result.summary.shortage_lines_total != len(result.unmet_shortages):
        raise ValueError("summary shortage line count does not match unmet shortages")
    for shortage in result.unmet_shortages:
        key = (shortage.facility_id, shortage.medicine_id)
        expected_recommended = min(shortage.shortage_before_units, destination_incoming.get(key, 0))
        if shortage.recommended_units != expected_recommended:
            raise ValueError("unmet shortage fulfillment does not match recommendations")
        if shortage.shortage_after_units <= 0:
            raise ValueError("unmet shortages must have a positive remaining shortage")
    expected_fulfilled_lines = sum(
        1
        for key, amount in destination_incoming.items()
        if amount > 0
        and amount < shortages.get(key, 0)
    )
    if result.summary.shortage_lines_with_any_fulfillment != expected_fulfilled_lines:
        raise ValueError("summary fulfilled shortage count does not match unmet shortages")
    if expected_unmet_units < 0:
        raise ValueError("unmet shortage units cannot be negative")
