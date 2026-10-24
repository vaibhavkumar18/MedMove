from medmove_optimizer import optimize
from medmove_optimizer.validation import validate_result


def test_sample_result_passes_business_validation(valid_request):
    result = optimize(valid_request)
    validate_result(valid_request, result)
    assert result.summary.estimated_cost_minor_units == sum(
        recommendation.total_cost_minor_units
        for recommendation in result.recommendations
    )

