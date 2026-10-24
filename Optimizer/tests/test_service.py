from medmove_optimizer import optimize
from medmove_optimizer.schemas import OptimizationRequest


def _known_answer_request() -> OptimizationRequest:
    return OptimizationRequest.model_validate(
        {
            "schema_version": "1.0",
            "run_id": "known-answer-run",
            "planning_date": "2026-10-24",
            "horizon_days": 30,
            "budget_minor_units": 15_000,
            "currency_code": "INR",
            "objective_policy": "PRIORITY_WEIGHTED_UNITS_THEN_COST",
            "facilities": [
                {"id": "H1", "code": "H1", "name": "Source Hospital", "is_active": True},
                {"id": "H2", "code": "H2", "name": "Destination Hospital", "is_active": True},
            ],
            "medicines": [
                {
                    "id": "MED1",
                    "code": "MED1",
                    "name": "Test Medicine",
                    "base_unit": "unit",
                    "is_active": True,
                }
            ],
            "inventory_batches": [
                {
                    "id": "B1",
                    "facility_id": "H1",
                    "medicine_id": "MED1",
                    "lot_number": "LOT-B1",
                    "expiry_date": "2027-12-31",
                    "available_quantity_units": 500,
                    "quality_status": "ELIGIBLE",
                },
                {
                    "id": "B2",
                    "facility_id": "H2",
                    "medicine_id": "MED1",
                    "lot_number": "LOT-B2",
                    "expiry_date": "2027-12-31",
                    "available_quantity_units": 20,
                    "quality_status": "ELIGIBLE",
                },
            ],
            "facility_medicine_policies": [
                {
                    "facility_id": "H1",
                    "medicine_id": "MED1",
                    "target_stock_units": 300,
                    "minimum_reserve_units": 300,
                    "avg_daily_demand_units": 0,
                    "priority_weight": 1,
                    "minimum_remaining_shelf_life_days": 0,
                },
                {
                    "facility_id": "H2",
                    "medicine_id": "MED1",
                    "target_stock_units": 200,
                    "minimum_reserve_units": 0,
                    "avg_daily_demand_units": 0,
                    "priority_weight": 1,
                    "minimum_remaining_shelf_life_days": 0,
                },
            ],
            "routes": [
                {
                    "id": "R_H1_H2",
                    "source_facility_id": "H1",
                    "destination_facility_id": "H2",
                    "transit_days": 1,
                    "cost_per_unit_minor_units": 200,
                    "route_capacity_units": 100,
                    "currency_code": "INR",
                    "is_active": True,
                }
            ],
            "max_solve_seconds": 5,
        }
    )


def test_known_answer_budget_limited_transfer():
    result = optimize(_known_answer_request())

    assert result.status.value == "COMPLETED"
    assert result.solver_status_stage_1.value == "OPTIMAL"
    assert result.solver_status_stage_2.value == "OPTIMAL"
    assert result.optimality_proven is True
    assert len(result.recommendations) == 1
    assert result.recommendations[0].quantity_units == 75
    assert result.recommendations[0].total_cost_minor_units == 15_000
    assert result.unmet_shortages[0].shortage_before_units == 180
    assert result.unmet_shortages[0].recommended_units == 75
    assert result.unmet_shortages[0].shortage_after_units == 105


def test_optimize_returns_valid_result_without_mutating_request(valid_request):
    before = valid_request.model_dump(mode="json")
    result = optimize(valid_request)
    assert result.status.value == "COMPLETED"
    assert result.solver_status_stage_1.value == "OPTIMAL"
    assert result.solver_status_stage_2.value == "OPTIMAL"
    assert valid_request.model_dump(mode="json") == before
    assert result.summary.transfer_line_count == len(result.recommendations)
    assert all(recommendation.quantity_units > 0 for recommendation in result.recommendations)
    assert any("shortages remain unmet" in warning for warning in result.warnings)
    assert all(shortage.shortage_after_units > 0 for shortage in result.unmet_shortages)


def test_optimize_reports_empty_candidates_and_unmet_shortages(valid_request):
    request = valid_request.model_copy(update={"routes": []})
    result = optimize(request)
    assert result.recommendations == []
    assert result.solver_status_stage_1.value == "INFEASIBLE"
    assert result.unmet_shortages
    assert any("No feasible transfer candidates" in warning for warning in result.warnings)
    assert any("shortages remain unmet" in warning for warning in result.warnings)


def test_optimize_reports_budget_limited_partial_result(valid_request):
    request = valid_request.model_copy(update={"budget_minor_units": 0})
    result = optimize(request)
    assert result.status.value == "COMPLETED"
    assert result.recommendations == []
    assert result.unmet_shortages
    assert any("shortages remain unmet" in warning for warning in result.warnings)
