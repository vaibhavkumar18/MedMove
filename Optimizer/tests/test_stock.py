from datetime import date

from medmove_optimizer.stock import (
    batch_meets_shelf_life,
    calculate_shortages,
    calculate_surpluses,
    protected_stock_units,
    usable_stock_by_pair,
)


def test_stock_calculations_use_only_eligible_unexpired_batches(valid_request):
    stock = usable_stock_by_pair(valid_request)
    assert stock[("H01", "MED1")] == 500
    shortages = calculate_shortages(valid_request)
    assert any(line.facility_id == "H02" and line.medicine_id == "MED1" for line in shortages)
    assert all(line.shortage_units > 0 for line in shortages)
    assert any(
        line.facility_id == "H01" and line.medicine_id == "MED1"
        for line in calculate_surpluses(valid_request)
    )


def test_shelf_life_is_checked_at_expected_arrival(valid_request):
    batch = valid_request.inventory_batches[1]
    assert not batch_meets_shelf_life(batch, date(2026, 10, 24), 2, 14)


def test_conservative_donor_policy_uses_target_or_reserve_whichever_is_higher(
    valid_request,
):
    policy = valid_request.facility_medicine_policies[0].model_copy(
        update={"target_stock_units": 300, "minimum_reserve_units": 200}
    )
    assert protected_stock_units(policy) == 300

    high_target_policy = policy.model_copy(
        update={"target_stock_units": 500, "minimum_reserve_units": 300}
    )
    assert protected_stock_units(high_target_policy) == 500

    stock = 500
    assert max(0, stock - protected_stock_units(policy)) == 200
    assert max(0, 70 - protected_stock_units(high_target_policy)) == 0
