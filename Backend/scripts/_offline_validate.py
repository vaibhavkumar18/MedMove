"""
Offline dataset validation script.
Run with: python scripts/_offline_validate.py
Does NOT connect to any database.
"""
from __future__ import annotations
import csv
import sys
from datetime import date
from pathlib import Path

# Load the standalone optimizer package
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "Optimizer"))

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "sample"


def read_csv(name: str) -> list[dict[str, str]]:
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return [{k: v.strip() for k, v in row.items()} for row in csv.DictReader(f)]


def main() -> None:
    from medmove_optimizer import optimize
    from medmove_optimizer.schemas import OptimizationRequest
    from medmove_optimizer.stock import calculate_shortages, calculate_surpluses

    facs    = read_csv("facilities.csv")
    meds    = read_csv("medicines.csv")
    batches = read_csv("inventory_batches.csv")
    plans   = read_csv("facility_medicine_plans.csv")
    routes  = read_csv("transport_routes.csv")

    planning_date = date(2027, 1, 15)
    budget = 500_000  # INR paise (Rs 5,000)

    req_data = {
        "schema_version": "1.0",
        "run_id": "offline-validation",
        "planning_date": planning_date,
        "horizon_days": 30,
        "budget_minor_units": budget,
        "currency_code": "INR",
        "objective_policy": "PRIORITY_WEIGHTED_UNITS_THEN_COST",
        "facilities": [
            {
                "id": f["facility_code"],
                "code": f["facility_code"],
                "name": f["name"],
                "is_active": f["is_active"] == "true",
            }
            for f in facs
        ],
        "medicines": [
            {
                "id": m["medicine_code"],
                "code": m["medicine_code"],
                "name": m["generic_name"],
                "base_unit": m["base_unit"],
                "is_active": m["is_active"] == "true",
            }
            for m in meds
        ],
        "inventory_batches": [
            {
                "id": b["batch_code"],
                "facility_id": b["facility_code"],
                "medicine_id": b["medicine_code"],
                "lot_number": b["lot_number"],
                "expiry_date": b["expiry_date"],
                "available_quantity_units": int(b["quantity_on_hand_units"]),
                "quality_status": b["quality_status"],
            }
            for b in batches
        ],
        "facility_medicine_policies": [
            {
                "facility_id": p["facility_code"],
                "medicine_id": p["medicine_code"],
                "target_stock_units": int(p["target_stock_units"]),
                "minimum_reserve_units": int(p["minimum_reserve_units"]),
                "avg_daily_demand_units": int(p["avg_daily_demand_units"]),
                "priority_weight": int(p["priority_weight"]),
                "minimum_remaining_shelf_life_days": int(p["minimum_remaining_shelf_life_days"]),
            }
            for p in plans
        ],
        "routes": [
            {
                "id": r["route_code"],
                "source_facility_id": r["source_facility_code"],
                "destination_facility_id": r["destination_facility_code"],
                "transit_days": int(r["transit_days"]),
                "cost_per_unit_minor_units": int(r["cost_per_unit_minor_units"]),
                "route_capacity_units": int(r["route_capacity_units"]),
                "currency_code": r["currency_code"],
                "is_active": r["is_active"].lower() == "true",
            }
            for r in routes
        ],
        "max_solve_seconds": 10,
    }

    request = OptimizationRequest.model_validate(req_data)

    # --- Shortages and surpluses ---
    shortages = calculate_shortages(request)
    surpluses = calculate_surpluses(request)

    print("=== SHORTAGES (sorted by priority desc) ===")
    for s in sorted(shortages, key=lambda x: (-x.priority_weight, x.facility_id, x.medicine_id)):
        print(
            f"  {s.facility_id:4} / {s.medicine_id:4}  "
            f"usable={s.usable_stock_units:4}  target={s.target_stock_units:4}  "
            f"short={s.shortage_units:4}  prio={s.priority_weight}"
        )

    print()
    print("=== SURPLUSES ===")
    for s in sorted(surpluses, key=lambda x: (x.facility_id, x.medicine_id)):
        print(
            f"  {s.facility_id:4} / {s.medicine_id:4}  "
            f"usable={s.usable_stock_units:4}  protected={s.protected_stock_units:4}  "
            f"transferable={s.transferable_units}"
        )

    print(f"\nTotal shortage lines: {len(shortages)}")
    print(f"Total surplus lines:  {len(surpluses)}")

    # --- Full optimization ---
    print("\n" + "=" * 60)
    print("Running full CP-SAT optimization...")
    result = optimize(request)

    print(f"\n=== OPTIMIZER RESULT ===")
    print(f"  Status:                {result.status.value}")
    print(f"  Stage 1 solver:        {result.solver_status_stage_1.value}")
    stage2 = result.solver_status_stage_2.value if result.solver_status_stage_2 else "n/a"
    print(f"  Stage 2 solver:        {stage2}")
    print(f"  Transfer lines:        {len(result.recommendations)}")
    print(f"  Unmet shortage lines:  {len(result.unmet_shortages)}")
    cost_rs = result.summary.estimated_cost_minor_units / 100
    budget_rs = result.summary.budget_remaining_minor_units / 100
    print(f"  Total cost (paise):    {result.summary.estimated_cost_minor_units}  (Rs {cost_rs:.2f})")
    print(f"  Budget remaining:      {result.summary.budget_remaining_minor_units}  (Rs {budget_rs:.2f})")
    print(f"  Priority score:        {result.summary.priority_weighted_units_score}")

    print("\n=== TRANSFER RECOMMENDATIONS ===")
    for rec in result.recommendations:
        cost_r = rec.total_cost_minor_units / 100
        print(
            f"  {rec.source_facility_id} -> {rec.destination_facility_id}"
            f"  [{rec.medicine_id}]"
            f"  batch={rec.source_batch_id}"
            f"  qty={rec.quantity_units}"
            f"  transit={rec.transit_days}d"
            f"  cost=Rs{cost_r:.2f}"
        )

    print("\n=== UNMET SHORTAGES ===")
    for u in sorted(result.unmet_shortages, key=lambda x: (-x.priority_weight, x.facility_id)):
        print(
            f"  {u.facility_id:4} / {u.medicine_id:4}"
            f"  before={u.shortage_before_units}"
            f"  recommended_in={u.recommended_units}"
            f"  after={u.shortage_after_units}"
            f"  prio={u.priority_weight}"
        )

    if result.warnings:
        print("\n=== WARNINGS ===")
        for w in result.warnings:
            print(f"  {w}")

    print("\n=== VALIDATION PASSED ===" if not result.warnings else "\n=== VALIDATION COMPLETE (with warnings) ===")


if __name__ == "__main__":
    main()
