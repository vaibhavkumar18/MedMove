"""Quick CSV integrity check for the demo dataset. No database access."""
from __future__ import annotations
import csv
import sys
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data" / "sample"

def read(name: str) -> list[dict[str, str]]:
    with open(DATA / name, encoding="utf-8") as f:
        return [{k: v.strip() for k, v in row.items()} for row in csv.DictReader(f)]

def main() -> None:
    facs    = read("facilities.csv")
    meds    = read("medicines.csv")
    batches = read("inventory_batches.csv")
    plans   = read("facility_medicine_plans.csv")
    routes  = read("transport_routes.csv")

    fac_codes = {r["facility_code"] for r in facs}
    med_codes = {r["medicine_code"] for r in meds}

    print(f"facilities  : {len(facs)}  (unique codes: {len(fac_codes)})")
    print(f"medicines   : {len(meds)}  (unique codes: {len(med_codes)})")
    print(f"plans       : {len(plans)}")
    print(f"batches     : {len(batches)}")
    print(f"routes      : {len(routes)}")
    print()

    planning_date = date(2027, 1, 15)
    errors: list[str] = []
    warnings: list[str] = []

    # --- Facilities ---
    codes: set[str] = set()
    for r in facs:
        c = r["facility_code"]
        if c in codes:
            errors.append(f"DUPLICATE facility_code: {c}")
        codes.add(c)

    # --- Medicines ---
    codes = set()
    for r in meds:
        c = r["medicine_code"]
        if c in codes:
            errors.append(f"DUPLICATE medicine_code: {c}")
        codes.add(c)

    # --- Plans ---
    plan_keys: set[tuple[str, str]] = set()
    for r in plans:
        key = (r["facility_code"], r["medicine_code"])
        if key in plan_keys:
            errors.append(f"DUPLICATE plan: {key}")
        plan_keys.add(key)
        if r["facility_code"] not in fac_codes:
            errors.append(f"Plan refs unknown facility: {r['facility_code']}")
        if r["medicine_code"] not in med_codes:
            errors.append(f"Plan refs unknown medicine: {r['medicine_code']}")
        for field in ("target_stock_units", "minimum_reserve_units", "avg_daily_demand_units", "minimum_remaining_shelf_life_days"):
            if int(r[field]) < 0:
                errors.append(f"Negative plan value {field} in {key}")
        pw = int(r["priority_weight"])
        if not (1 <= pw <= 5):
            errors.append(f"priority_weight out of range in {key}: {pw}")

    # --- Batches ---
    batch_codes: set[str] = set()
    lot_keys: set[tuple[str, str, str]] = set()
    expired_batches: list[str] = []
    non_eligible: list[tuple[str, str]] = []
    near_expiry: list[str] = []

    for r in batches:
        bc = r["batch_code"]
        lk = (r["facility_code"], r["medicine_code"], r["lot_number"])
        if bc in batch_codes:
            errors.append(f"DUPLICATE batch_code: {bc}")
        if lk in lot_keys:
            errors.append(f"DUPLICATE (fac,med,lot): {lk}")
        batch_codes.add(bc)
        lot_keys.add(lk)
        if r["facility_code"] not in fac_codes:
            errors.append(f"Batch refs unknown facility: {bc}")
        if r["medicine_code"] not in med_codes:
            errors.append(f"Batch refs unknown medicine: {bc}")
        expiry = date.fromisoformat(r["expiry_date"])
        qty = int(r["quantity_on_hand_units"])
        status = r["quality_status"]
        if qty < 0:
            errors.append(f"Negative quantity in batch: {bc}")
        if status not in {"ELIGIBLE", "QUARANTINED", "RECALLED", "DAMAGED"}:
            errors.append(f"Invalid quality_status in batch {bc}: {status}")
        if expiry < planning_date:
            expired_batches.append(bc)
        elif (expiry - planning_date).days <= 90:
            near_expiry.append(f"{bc} (expires {r['expiry_date']}, {(expiry - planning_date).days}d from planning date)")
        if status != "ELIGIBLE":
            non_eligible.append((bc, status))

    # --- Routes ---
    route_codes: set[str] = set()
    route_pairs: set[tuple[str, str]] = set()
    for r in routes:
        rc = r["route_code"]
        pair = (r["source_facility_code"], r["destination_facility_code"])
        if rc in route_codes:
            errors.append(f"DUPLICATE route_code: {rc}")
        if pair in route_pairs:
            errors.append(f"DUPLICATE route pair: {pair}")
        route_codes.add(rc)
        route_pairs.add(pair)
        if r["source_facility_code"] not in fac_codes:
            errors.append(f"Route refs unknown src: {rc}")
        if r["destination_facility_code"] not in fac_codes:
            errors.append(f"Route refs unknown dst: {rc}")
        if pair[0] == pair[1]:
            errors.append(f"Self-route: {rc}")
        if r["currency_code"] != "INR":
            errors.append(f"Non-INR currency in route: {rc}")
        for field in ("transit_days", "cost_per_unit_minor_units", "route_capacity_units"):
            if int(r[field]) < 0:
                errors.append(f"Negative {field} in route {rc}")
        # Check boolean
        if r["is_active"].lower() not in ("true", "false"):
            errors.append(f"Invalid is_active in route {rc}: {r['is_active']}")

    # --- Report ---
    if errors:
        print("=== ERRORS ===")
        for e in errors:
            print(f"  ✗ {e}")
    else:
        print("=== INTEGRITY: PASS — no errors ===")

    print()
    print(f"Batches expired by planning_date {planning_date}: {expired_batches}")
    print(f"Non-ELIGIBLE batches: {non_eligible}")
    print(f"Near-expiry batches (within 90 days of planning_date):")
    for n in near_expiry:
        print(f"  {n}")

    if errors:
        sys.exit(1)

if __name__ == "__main__":
    main()
