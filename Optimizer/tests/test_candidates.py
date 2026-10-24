from medmove_optimizer.candidates import generate_candidates


def test_candidates_are_directed_and_have_positive_limits(valid_request):
    candidates = generate_candidates(valid_request)
    assert candidates
    assert all(candidate.source_facility_id != candidate.destination_facility_id for candidate in candidates)
    assert all(candidate.available_quantity_units > 0 for candidate in candidates)
    assert all(
        candidate.route_id == f"R_{candidate.source_facility_id}_{candidate.destination_facility_id}"
        for candidate in candidates
    )
    assert all(candidate.route_id.startswith("R_") for candidate in candidates)


def test_facility_below_target_cannot_donate_that_medicine(valid_request):
    candidates = generate_candidates(valid_request)
    assert not any(
        candidate.source_facility_id == "H06"
        and candidate.medicine_id == "MED3"
        for candidate in candidates
    )
