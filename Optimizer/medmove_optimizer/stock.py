from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

from .schemas import InventoryBatchInput, OptimizationRequest, PolicyInput, QualityStatus


@dataclass(frozen=True)
class ShortageLine:
    facility_id: str
    medicine_id: str
    usable_stock_units: int
    target_stock_units: int
    shortage_units: int
    priority_weight: int


@dataclass(frozen=True)
class SurplusLine:
    facility_id: str
    medicine_id: str
    usable_stock_units: int
    protected_stock_units: int
    transferable_units: int


def policy_map(request: OptimizationRequest) -> dict[tuple[str, str], PolicyInput]:
    return {(p.facility_id, p.medicine_id): p for p in request.facility_medicine_policies}


def usable_stock_by_pair(
    request: OptimizationRequest, planning_date: date | None = None
) -> dict[tuple[str, str], int]:
    as_of = planning_date or request.planning_date
    active_facilities = {f.id for f in request.facilities if f.is_active}
    active_medicines = {m.id for m in request.medicines if m.is_active}
    stock: dict[tuple[str, str], int] = defaultdict(int)
    for batch in request.inventory_batches:
        if (
            batch.facility_id in active_facilities
            and batch.medicine_id in active_medicines
            and batch.quality_status is QualityStatus.ELIGIBLE
            and batch.expiry_date >= as_of
        ):
            stock[(batch.facility_id, batch.medicine_id)] += batch.available_quantity_units
    return dict(stock)


def protected_stock_units(policy: PolicyInput) -> int:
    return max(policy.target_stock_units, policy.minimum_reserve_units)


def batch_meets_shelf_life(
    batch: InventoryBatchInput,
    planning_date: date,
    transit_days: int,
    minimum_remaining_shelf_life_days: int,
) -> bool:
    arrival = planning_date + timedelta(days=transit_days)
    return (
        batch.quality_status is QualityStatus.ELIGIBLE
        and batch.expiry_date
        >= arrival + timedelta(days=minimum_remaining_shelf_life_days)
    )


def calculate_shortages(request: OptimizationRequest) -> list[ShortageLine]:
    stock = usable_stock_by_pair(request)
    lines: list[ShortageLine] = []
    for key, policy in policy_map(request).items():
        usable = stock.get(key, 0)
        shortage = max(0, policy.target_stock_units - usable)
        if shortage:
            lines.append(
                ShortageLine(
                    policy.facility_id,
                    policy.medicine_id,
                    usable,
                    policy.target_stock_units,
                    shortage,
                    policy.priority_weight,
                )
            )
    return lines


def calculate_surpluses(request: OptimizationRequest) -> list[SurplusLine]:
    stock = usable_stock_by_pair(request)
    lines: list[SurplusLine] = []
    for key, policy in policy_map(request).items():
        usable = stock.get(key, 0)
        protected = protected_stock_units(policy)
        transferable = max(0, usable - protected)
        if transferable:
            lines.append(
                SurplusLine(
                    policy.facility_id,
                    policy.medicine_id,
                    usable,
                    protected,
                    transferable,
                )
            )
    return lines
