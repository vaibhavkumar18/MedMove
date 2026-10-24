import csv
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pydantic import ValidationError

from medmove_optimizer import optimize
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


SAMPLE_DATA_DIR = PROJECT_ROOT / "data" / "sample"
REQUIRED_COLUMNS = {
    "facilities.csv": {
        "facility_code",
        "name",
        "is_active",
    },
    "medicines.csv": {
        "medicine_code",
        "generic_name",
        "base_unit",
        "is_active",
    },
    "inventory_batches.csv": {
        "batch_code",
        "facility_code",
        "medicine_code",
        "lot_number",
        "expiry_date",
        "quantity_on_hand_units",
        "quality_status",
    },
    "facility_medicine_plans.csv": {
        "facility_code",
        "medicine_code",
        "target_stock_units",
        "minimum_reserve_units",
        "avg_daily_demand_units",
        "priority_weight",
        "minimum_remaining_shelf_life_days",
    },
    "transport_routes.csv": {
        "route_code",
        "source_facility_code",
        "destination_facility_code",
        "transit_days",
        "cost_per_unit_minor_units",
        "route_capacity_units",
        "currency_code",
        "is_active",
    },
}


def read_csv(filename: str) -> list[dict[str, str]]:
    path = SAMPLE_DATA_DIR / filename
    if not path.is_file():
        raise FileNotFoundError(f"required sample CSV is missing: {path}")
    with path.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        columns = set(reader.fieldnames or [])
        missing = REQUIRED_COLUMNS[filename] - columns
        if missing:
            names = ", ".join(sorted(missing))
            raise ValueError(f"{filename} is missing required columns: {names}")
        return list(reader)


def parse_bool(value: str, field: str) -> bool:
    normalized = value.strip().casefold()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise ValueError(f"{field} must be True or False, got {value!r}")


def build_request() -> OptimizationRequest:
    facilities = read_csv("facilities.csv")
    medicines = read_csv("medicines.csv")
    batches = read_csv("inventory_batches.csv")
    policies = read_csv("facility_medicine_plans.csv")
    routes = read_csv("transport_routes.csv")

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
                is_active=parse_bool(row["is_active"], "facility is_active"),
            )
            for row in facilities
        ],
        medicines=[
            MedicineInput(
                id=row["medicine_code"],
                code=row["medicine_code"],
                name=row["generic_name"],
                base_unit=row["base_unit"],
                is_active=parse_bool(row["is_active"], "medicine is_active"),
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
                is_active=parse_bool(row["is_active"], "route is_active"),
            )
            for row in routes
        ],
        max_solve_seconds=10,
    )


def rupees(minor_units: int) -> str:
    return f"{minor_units / 100:,.2f}"


def print_result(request: OptimizationRequest, result) -> None:
    facilities = {facility.id: facility for facility in request.facilities}
    medicines = {medicine.id: medicine for medicine in request.medicines}

    print("=== MedMove Optimizer Demo ===")
    print("\nRun summary")
    print(f"Run status: {result.status.value}")
    print(f"Run ID: {result.run_id}")
    print(f"Planning date: {request.planning_date}")
    print(f"Stage 1 solver status: {result.solver_status_stage_1.value}")
    stage_two = (
        result.solver_status_stage_2.value
        if result.solver_status_stage_2 is not None
        else "N/A"
    )
    print(f"Stage 2 solver status: {stage_two}")
    print(f"Optimality proven: {result.optimality_proven}")
    print(f"Optimizer version: {result.optimizer_version}")
    print(f"Solve time: {result.solve_time_ms} ms")

    summary = result.summary
    total_unmet_units = sum(
        shortage.shortage_after_units for shortage in result.unmet_shortages
    )
    print("\nOptimization summary")
    print(f"Recommendations: {summary.transfer_line_count}")
    print(
        "Estimated cost: "
        f"{summary.estimated_cost_minor_units:,} paise "
        f"(INR {rupees(summary.estimated_cost_minor_units)})"
    )
    print(
        "Original budget: "
        f"{request.budget_minor_units:,} paise "
        f"(INR {rupees(request.budget_minor_units)})"
    )
    print(
        "Remaining budget: "
        f"{summary.budget_remaining_minor_units:,} paise "
        f"(INR {rupees(summary.budget_remaining_minor_units)})"
    )
    print(f"Unmet-shortage records: {len(result.unmet_shortages)}")
    print(f"Total remaining shortage units: {total_unmet_units:,}")
    print("Warnings:")
    if result.warnings:
        for warning in result.warnings:
            print(f"- {warning}")
    else:
        print("- None")

    print("\nTransfer recommendations")
    if not result.recommendations:
        print("No transfer recommendations.")
    else:
        for index, recommendation in enumerate(result.recommendations, 1):
            source = facilities[recommendation.source_facility_id]
            destination = facilities[recommendation.destination_facility_id]
            medicine = medicines[recommendation.medicine_id]
            print(f"\n{index}. {recommendation.id}")
            print(
                f"   Source: {source.code} - {source.name}; "
                f"destination: {destination.code} - {destination.name}"
            )
            print(f"   Medicine: {medicine.code} - {medicine.name}")
            print(
                f"   Batch: {recommendation.source_batch_id}; "
                f"route: {recommendation.route_id}"
            )
            print(f"   Quantity: {recommendation.quantity_units:,} units")
            print(
                f"   Unit cost: {recommendation.unit_cost_minor_units:,} paise "
                f"(INR {rupees(recommendation.unit_cost_minor_units)})"
            )
            print(
                f"   Total cost: {recommendation.total_cost_minor_units:,} paise "
                f"(INR {rupees(recommendation.total_cost_minor_units)})"
            )
            print(
                f"   Transit: {recommendation.transit_days} days; "
                f"arrival: {recommendation.expected_arrival_date}"
            )
            print(f"   Destination priority: {recommendation.priority_weight}")
            print(
                "   Explanation codes: "
                f"{', '.join(recommendation.explanation_codes) or 'None'}"
            )

    print("\nUnmet shortages")
    if not result.unmet_shortages:
        print("No unmet shortages.")
    else:
        for shortage in result.unmet_shortages:
            facility = facilities[shortage.facility_id]
            medicine = medicines[shortage.medicine_id]
            print(
                f"- {facility.code} - {facility.name}; "
                f"{medicine.code} - {medicine.name}; "
                f"before: {shortage.shortage_before_units:,}; "
                f"fulfilled: {shortage.recommended_units:,}; "
                f"remaining: {shortage.shortage_after_units:,}; "
                f"priority: {shortage.priority_weight}"
            )


def main() -> int:
    try:
        request = build_request()
    except (FileNotFoundError, KeyError, ValueError, ValidationError) as error:
        print(f"Could not build OptimizationRequest: {error}", file=sys.stderr)
        return 1

    try:
        result = optimize(request)
        result.__class__.model_validate(result.model_dump())
    except Exception as error:
        print(f"Optimizer execution or result validation failed: {error}", file=sys.stderr)
        return 1

    print_result(request, result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
