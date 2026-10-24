from __future__ import annotations

import csv
import os
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select

from backend.db.models import (
    Base,
    Facility,
    FacilityMedicinePlan,
    InventoryBatch,
    Medicine,
    TransportRoute,
    User,
    UserRole,
)
from backend.db.session import create_engine_from_url, create_session_factory


SAMPLE = ROOT / "data" / "sample"


def rows(filename: str) -> list[dict[str, str]]:
    with (SAMPLE / filename).open(newline="", encoding="utf-8-sig") as file:
        return list(csv.DictReader(file))


def boolean(value: str) -> bool:
    normalized = value.strip().casefold()
    if normalized not in {"true", "false"}:
        raise ValueError(f"invalid boolean: {value!r}")
    return normalized == "true"


def seed_demo(database_url: str) -> None:
    engine = create_engine_from_url(database_url)
    Base.metadata.create_all(engine)
    session_factory = create_session_factory(engine)
    with session_factory() as session:
        facility_rows = rows("facilities.csv")
        medicine_rows = rows("medicines.csv")
        for row in facility_rows:
            facility = session.scalar(
                select(Facility).where(Facility.facility_code == row["facility_code"])
            )
            if facility is None:
                facility = Facility(facility_code=row["facility_code"])
                session.add(facility)
            facility.name = row["name"]
            facility.facility_type = row.get("facility_type", "")
            facility.district = row.get("district", "")
            facility.state = row.get("state", "")
            facility.is_active = boolean(row["is_active"])
        for row in medicine_rows:
            medicine = session.scalar(
                select(Medicine).where(Medicine.medicine_code == row["medicine_code"])
            )
            if medicine is None:
                medicine = Medicine(medicine_code=row["medicine_code"])
                session.add(medicine)
            medicine.generic_name = row["generic_name"]
            medicine.strength = row.get("strength", "")
            medicine.dosage_form = row.get("dosage_form", "")
            medicine.base_unit = row["base_unit"]
            medicine.is_active = boolean(row["is_active"])
        session.flush()
        facilities = {
            row.facility_code: row
            for row in session.scalars(select(Facility))
        }
        medicines = {
            row.medicine_code: row
            for row in session.scalars(select(Medicine))
        }
        for row in rows("inventory_batches.csv"):
            batch = session.scalar(
                select(InventoryBatch).where(InventoryBatch.batch_code == row["batch_code"])
            )
            if batch is None:
                batch = InventoryBatch(batch_code=row["batch_code"])
                session.add(batch)
            batch.facility_id = facilities[row["facility_code"]].id
            batch.medicine_id = medicines[row["medicine_code"]].id
            batch.lot_number = row["lot_number"]
            batch.expiry_date = date.fromisoformat(row["expiry_date"])
            batch.quantity_on_hand_units = int(row["quantity_on_hand_units"])
            batch.quality_status = row["quality_status"]
        for row in rows("facility_medicine_plans.csv"):
            plan = session.scalar(
                select(FacilityMedicinePlan).where(
                    FacilityMedicinePlan.facility_id == facilities[row["facility_code"]].id,
                    FacilityMedicinePlan.medicine_id == medicines[row["medicine_code"]].id,
                )
            )
            if plan is None:
                plan = FacilityMedicinePlan(
                    facility_id=facilities[row["facility_code"]].id,
                    medicine_id=medicines[row["medicine_code"]].id,
                )
                session.add(plan)
            plan.target_stock_units = int(row["target_stock_units"])
            plan.minimum_reserve_units = int(row["minimum_reserve_units"])
            plan.avg_daily_demand_units = int(float(row["avg_daily_demand_units"]))
            plan.priority_weight = int(row["priority_weight"])
            plan.minimum_remaining_shelf_life_days = int(
                row["minimum_remaining_shelf_life_days"]
            )
        for row in rows("transport_routes.csv"):
            route = session.scalar(
                select(TransportRoute).where(TransportRoute.route_code == row["route_code"])
            )
            if route is None:
                route = TransportRoute(route_code=row["route_code"])
                session.add(route)
            route.source_facility_id = facilities[row["source_facility_code"]].id
            route.destination_facility_id = facilities[row["destination_facility_code"]].id
            route.transit_days = int(row["transit_days"])
            route.cost_per_unit_minor_units = int(row["cost_per_unit_minor_units"])
            route.route_capacity_units = int(row["route_capacity_units"])
            route.currency_code = row["currency_code"]
            route.is_active = boolean(row["is_active"])
        session.flush()
        coordinator_email = os.environ.get("MEDMOVE_COORDINATOR_EMAIL")
        coordinator_password_hash = os.environ.get("MEDMOVE_COORDINATOR_PASSWORD_HASH")
        if coordinator_email and coordinator_password_hash:
            coordinator = session.scalar(
                select(User).where(User.email == coordinator_email.casefold())
            )
            if coordinator is None:
                session.add(
                    User(
                        full_name="Network Coordinator",
                        email=coordinator_email.casefold(),
                        password_hash=coordinator_password_hash,
                        role=UserRole.NETWORK_COORDINATOR,
                        facility_id=None,
                    )
                )
        session.commit()


if __name__ == "__main__":
    seed_demo(os.environ.get("DATABASE_URL", "sqlite:///medmove.db"))
