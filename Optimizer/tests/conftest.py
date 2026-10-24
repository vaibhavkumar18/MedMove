import csv
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from medmove_optimizer.schemas import (
    FacilityInput,
    InventoryBatchInput,
    MedicineInput,
    ObjectivePolicy,
    OptimizationRequest,
    PolicyInput,
    QualityStatus,
    RouteInput,
)


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as file:
        return list(csv.DictReader(file))


def _parse_bool(value: str) -> bool:
    normalized = value.strip().casefold()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise ValueError(f"invalid boolean value in sample CSV: {value!r}")


@pytest.fixture
def valid_request() -> OptimizationRequest:
    data_path = Path(__file__).parents[1] / "data" / "sample"
    facilities = _read_csv(data_path / "facilities.csv")
    medicines = _read_csv(data_path / "medicines.csv")
    batches = _read_csv(data_path / "inventory_batches.csv")
    policies = _read_csv(data_path / "facility_medicine_plans.csv")
    routes = _read_csv(data_path / "transport_routes.csv")

    return OptimizationRequest(
        schema_version="1.0",
        run_id="sample-run-001",
        planning_date=date(2026, 10, 24),
        horizon_days=30,
        budget_minor_units=18_000,
        currency_code="INR",
        objective_policy=ObjectivePolicy.PRIORITY_WEIGHTED_UNITS_THEN_COST,
        facilities=[
            FacilityInput(
                id=row["facility_code"],
                code=row["facility_code"],
                name=row["name"],
                is_active=_parse_bool(row["is_active"]),
            )
            for row in facilities
        ],
        medicines=[
            MedicineInput(
                id=row["medicine_code"],
                code=row["medicine_code"],
                name=row["generic_name"],
                base_unit=row["base_unit"],
                is_active=_parse_bool(row["is_active"]),
            )
            for row in medicines
        ],
        inventory_batches=[
            InventoryBatchInput(
                id=row["batch_code"],
                facility_id=row["facility_code"],
                medicine_id=row["medicine_code"],
                lot_number=row["lot_number"],
                expiry_date=date.fromisoformat(row["expiry_date"]),
                available_quantity_units=int(row["quantity_on_hand_units"]),
                quality_status=QualityStatus(row["quality_status"]),
            )
            for row in batches
        ],
        facility_medicine_policies=[
            PolicyInput(
                facility_id=row["facility_code"],
                medicine_id=row["medicine_code"],
                target_stock_units=int(row["target_stock_units"]),
                minimum_reserve_units=int(row["minimum_reserve_units"]),
                avg_daily_demand_units=Decimal(row["avg_daily_demand_units"]),
                priority_weight=int(row["priority_weight"]),
                minimum_remaining_shelf_life_days=int(
                    row["minimum_remaining_shelf_life_days"]
                ),
            )
            for row in policies
        ],
        routes=[
            RouteInput(
                id=row["route_code"],
                source_facility_id=row["source_facility_code"],
                destination_facility_id=row["destination_facility_code"],
                transit_days=int(row["transit_days"]),
                cost_per_unit_minor_units=int(row["cost_per_unit_minor_units"]),
                route_capacity_units=int(row["route_capacity_units"]),
                currency_code=row["currency_code"],
                is_active=_parse_bool(row["is_active"]),
            )
            for row in routes
        ],
        max_solve_seconds=10,
    )
