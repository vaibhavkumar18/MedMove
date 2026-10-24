from datetime import date

import pytest
from pydantic import ValidationError

from medmove_optimizer.schemas import (
    CurrencyCode,
    ObjectivePolicy,
    OptimizationResult,
    PolicyInput,
    Recommendation,
    RouteInput,
    RunStatus,
    SolverStatus,
    UnmetShortage,
)


def test_actual_sample_rows_map_to_valid_request(valid_request):
    assert len(valid_request.facilities) == 10
    assert len(valid_request.medicines) == 4
    assert len(valid_request.inventory_batches) == 41
    assert len(valid_request.facility_medicine_policies) == 40
    assert len(valid_request.routes) == 36
    assert valid_request.planning_date == date(2026, 10, 24)
    assert valid_request.routes[0].currency_code is CurrencyCode.INR
    assert valid_request.inventory_batches[0].available_quantity_units == 350
    assert valid_request.routes[0].cost_per_unit_minor_units == 255


def test_sample_relationships_and_values_are_accepted(valid_request):
    facility_ids = {facility.id for facility in valid_request.facilities}
    medicine_ids = {medicine.id for medicine in valid_request.medicines}
    assert {facility.code for facility in valid_request.facilities} == facility_ids
    assert all(batch.facility_id in facility_ids for batch in valid_request.inventory_batches)
    assert all(batch.medicine_id in medicine_ids for batch in valid_request.inventory_batches)
    assert all(
        policy.facility_id in facility_ids
        for policy in valid_request.facility_medicine_policies
    )
    assert all(
        policy.medicine_id in medicine_ids
        for policy in valid_request.facility_medicine_policies
    )
    assert all(route.source_facility_id in facility_ids for route in valid_request.routes)
    assert all(route.destination_facility_id in facility_ids for route in valid_request.routes)
    assert {route.currency_code for route in valid_request.routes} == {CurrencyCode.INR}
    assert {policy.priority_weight for policy in valid_request.facility_medicine_policies} == {
        1,
        2,
        3,
        4,
        5,
    }
    assert valid_request.inventory_batches[7].id == "B_H02_MED3_A"
    assert valid_request.inventory_batches[7].expiry_date == date(2027, 4, 30)


def test_request_rejects_unknown_references_and_duplicate_policy_pairs(valid_request):
    unknown_reference = valid_request.model_dump()
    unknown_reference["routes"][0]["destination_facility_id"] = "H99"
    with pytest.raises(ValidationError):
        type(valid_request).model_validate(unknown_reference)

    duplicate_policy = valid_request.model_dump()
    duplicate_policy["facility_medicine_policies"][1] = duplicate_policy[
        "facility_medicine_policies"
    ][0]
    with pytest.raises(ValidationError):
        type(valid_request).model_validate(duplicate_policy)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("horizon_days", 0),
        ("horizon_days", 91),
        ("budget_minor_units", -1),
        ("max_solve_seconds", 0),
        ("max_solve_seconds", 61),
        ("planning_date", "not-a-date"),
    ],
)
def test_request_rejects_invalid_values(valid_request, field, value):
    data = valid_request.model_dump()
    data[field] = value
    with pytest.raises(ValidationError):
        type(valid_request).model_validate(data)


def test_request_rejects_unsupported_currency(valid_request):
    data = valid_request.model_dump()
    data["currency_code"] = "USD"
    with pytest.raises(ValidationError):
        type(valid_request).model_validate(data)


@pytest.mark.parametrize("priority_weight", [0, 6])
def test_policy_rejects_invalid_priority_weight(valid_request, priority_weight):
    data = valid_request.model_dump()
    data["facility_medicine_policies"][0]["priority_weight"] = priority_weight
    with pytest.raises(ValidationError):
        type(valid_request).model_validate(data)


def test_policy_and_route_reject_negative_quantities_and_costs():
    with pytest.raises(ValidationError):
        PolicyInput(
            facility_id="H1",
            medicine_id="MED1",
            target_stock_units=-1,
            minimum_reserve_units=0,
            avg_daily_demand_units=0,
            priority_weight=1,
            minimum_remaining_shelf_life_days=0,
        )
    with pytest.raises(ValidationError):
        RouteInput(
            id="R1",
            source_facility_id="H1",
            destination_facility_id="H2",
            transit_days=1,
            cost_per_unit_minor_units=-1,
            route_capacity_units=1,
            currency_code="INR",
            is_active=True,
        )


def test_recommendation_rejects_non_positive_quantity_and_wrong_cost():
    values = {
        "id": "REC1",
        "source_facility_id": "H1",
        "destination_facility_id": "H2",
        "medicine_id": "MED1",
        "source_batch_id": "B101",
        "route_id": "R_H1_H2",
        "quantity_units": 2,
        "expected_arrival_date": date(2026, 10, 25),
        "transit_days": 1,
        "unit_cost_minor_units": 200,
        "total_cost_minor_units": 400,
        "currency_code": "INR",
        "priority_weight": 2,
    }
    assert Recommendation.model_validate(values).explanation_codes == []
    with pytest.raises(ValidationError):
        Recommendation.model_validate({**values, "quantity_units": 0})
    with pytest.raises(ValidationError):
        Recommendation.model_validate({**values, "total_cost_minor_units": 401})


def test_unmet_shortage_validates_arithmetic():
    shortage = UnmetShortage(
        facility_id="H2",
        medicine_id="MED1",
        shortage_before_units=10,
        recommended_units=4,
        shortage_after_units=6,
        priority_weight=2,
    )
    assert shortage.shortage_after_units == 6
    with pytest.raises(ValidationError):
        UnmetShortage(
            facility_id="H2",
            medicine_id="MED1",
            shortage_before_units=10,
            recommended_units=11,
            shortage_after_units=0,
            priority_weight=2,
        )
    with pytest.raises(ValidationError):
        UnmetShortage(
            facility_id="H2",
            medicine_id="MED1",
            shortage_before_units=10,
            recommended_units=4,
            shortage_after_units=5,
            priority_weight=2,
        )


def test_result_allows_empty_outputs_and_nullable_stage_two(valid_request):
    result = OptimizationResult(
        schema_version="1.0",
        run_id=valid_request.run_id,
        status=RunStatus.COMPLETED,
        objective_policy=ObjectivePolicy.PRIORITY_WEIGHTED_UNITS_THEN_COST,
        solver_status_stage_1=SolverStatus.INFEASIBLE,
        solver_status_stage_2=None,
        optimality_proven=False,
        optimizer_version="phase-1",
        solve_time_ms=12,
        summary={
            "estimated_cost_minor_units": 0,
            "budget_remaining_minor_units": 18_000,
            "transfer_line_count": 0,
            "shortage_lines_total": 1,
            "shortage_lines_with_any_fulfillment": 0,
            "priority_weighted_units_score": 0,
        },
        unmet_shortages=[
            UnmetShortage(
                facility_id="H2",
                medicine_id="MED1",
                shortage_before_units=10,
                recommended_units=0,
                shortage_after_units=10,
                priority_weight=2,
            )
        ],
    )
    assert result.recommendations == []
    assert len(result.unmet_shortages) == 1
    assert result.warnings == []
    assert result.solver_status_stage_2 is None


@pytest.mark.parametrize("status", list(SolverStatus))
def test_all_solver_status_values_are_representable(status):
    assert SolverStatus(status).value == status.value


def test_run_status_is_distinct_from_solver_status():
    assert {status.value for status in RunStatus} == {
        "PENDING",
        "RUNNING",
        "COMPLETED",
        "FAILED",
    }
    assert RunStatus.COMPLETED.value != SolverStatus.OPTIMAL.value
