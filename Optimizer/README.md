# MedMove Optimizer

MedMove Optimizer is a standalone Python package that proposes feasible
medicine transfers between hospitals. It analyzes a validated network snapshot,
identifies shortages and transferable stock, and uses OR-Tools CP-SAT to
produce transfer recommendations.

The optimizer produces proposals only. It does not connect to a database,
authenticate users, expose HTTP endpoints, modify inventory, approve shipments,
or execute physical transfers.

## Current verification

The optimizer-only test suite passes:

```text
33 passed
```

The verified sample demonstration returns:

```text
Run status: COMPLETED
Stage 1 solver status: OPTIMAL
Stage 2 solver status: OPTIMAL
Optimality proven: True
Recommendations: 3
Estimated cost: 17,875 paise
Unmet-shortage records: 25
Total remaining shortage units: 1,660
```

## Features

- Usable inventory and medicine-shortage calculation
- Conservative source-donor protection
- Eligible transfer-candidate generation
- Directed routes and shared route capacity
- Batch expiry and destination shelf-life checks
- Integer whole-unit quantities
- Integer INR paise costs
- Overall budget constraints
- Priority-weighted shortage reduction
- Secondary transport-cost minimization
- Two-stage CP-SAT optimization
- Transfer recommendations and unmet-shortage reporting
- Independent result validation
- Input inventory immutability
- Pydantic request and result validation

The donor policy is:

```text
effective_protected_stock =
    max(target_stock_units, minimum_reserve_units)

transferable_surplus =
    max(usable_stock_units - effective_protected_stock, 0)
```

A facility below its target cannot donate that medicine.

## Project structure

```text
Optimizer/
├── medmove_optimizer/
│   ├── __init__.py
│   ├── schemas.py
│   ├── stock.py
│   ├── candidates.py
│   ├── objectives.py
│   ├── model.py
│   ├── validation.py
│   └── service.py
├── data/sample/
│   ├── facilities.csv
│   ├── medicines.csv
│   ├── inventory_batches.csv
│   ├── facility_medicine_plans.csv
│   └── transport_routes.csv
├── scripts/
│   ├── run_optimizer_demo.py
│   └── load_sample_csv.py
├── tests/
└── Project Context/
```

## Architecture and boundaries

```text
CSV or database snapshot
          |
          v
OptimizationRequest
          |
          v
Stock calculations
          |
          v
Transfer candidates
          |
          v
CP-SAT model
          |
          v
OptimizationResult
```

The optimizer owns schemas, stock rules, candidate generation, CP-SAT
constraints, objectives, recommendations, and result validation.

It does not own PostgreSQL, database repositories, authentication, JWTs,
FastAPI, frontend code, physical transfers, or inventory deductions. A future
backend can import this package directly rather than treating it as a separate
service.

## Public API

```python
from medmove_optimizer import optimize

result = optimize(request)
```

Exact signature:

```python
optimize(
    request: OptimizationRequest,
) -> OptimizationResult
```

The package also exports:

```python
from medmove_optimizer import (
    calculate_shortages,
    calculate_surpluses,
    optimize,
)
```

## Input contract

The main input model is `OptimizationRequest`. It uses Pydantic v2 and rejects
unknown fields.

| Field | Type | Meaning |
|---|---|---|
| `schema_version` | `Literal["1.0"]` | Request schema version |
| `run_id` | `str` | Optimization run identifier |
| `planning_date` | `date` | Date used for expiry checks |
| `horizon_days` | `int` | Planning horizon, 1-90 |
| `budget_minor_units` | `int` | Maximum budget in paise |
| `currency_code` | `CurrencyCode` | Currently `INR` |
| `objective_policy` | `ObjectivePolicy` | Currently `PRIORITY_WEIGHTED_UNITS_THEN_COST` |
| `facilities` | `list[FacilityInput]` | Hospital network |
| `medicines` | `list[MedicineInput]` | Medicine catalog |
| `inventory_batches` | `list[InventoryBatchInput]` | Current batches |
| `facility_medicine_policies` | `list[PolicyInput]` | Targets and policies |
| `routes` | `list[RouteInput]` | Directed transport routes |
| `max_solve_seconds` | `int` | CP-SAT limit, 1-60 seconds |

### Nested input models

```python
FacilityInput(
    id: str,
    code: str,
    name: str,
    is_active: bool,
)

MedicineInput(
    id: str,
    code: str,
    name: str,
    base_unit: str,
    is_active: bool,
)

InventoryBatchInput(
    id: str,
    facility_id: str,
    medicine_id: str,
    lot_number: str,
    expiry_date: date,
    available_quantity_units: int,
    quality_status: QualityStatus,
)

PolicyInput(
    facility_id: str,
    medicine_id: str,
    target_stock_units: int,
    minimum_reserve_units: int,
    avg_daily_demand_units: Decimal,
    priority_weight: int,
    minimum_remaining_shelf_life_days: int,
)

RouteInput(
    id: str,
    source_facility_id: str,
    destination_facility_id: str,
    transit_days: int,
    cost_per_unit_minor_units: int,
    route_capacity_units: int,
    currency_code: CurrencyCode,
    is_active: bool,
)
```

Supported `QualityStatus` values are:

```text
ELIGIBLE
QUARANTINED
RECALLED
DAMAGED
EXPIRED
```

Only active facilities and medicines, `ELIGIBLE` batches, and batches not
expired on the planning date contribute to usable stock.

Money is always integer paise:

```text
₹1 = 100 paise
```

For example, `185` means INR `1.85`.

Request validation checks unique IDs, unique facility-medicine policies,
known references, matching route currency, non-negative quantities and costs,
valid dates, and valid enum values.

## How optimization works

### Stock and shortages

Usable stock is aggregated by facility and medicine. For every policy:

```text
shortage_units =
    max(target_stock_units - usable_stock_units, 0)
```

Transferable surplus uses the conservative protected level shown above.

### Candidate generation

`candidates.py` creates a candidate only when:

- Source and destination are different active facilities.
- The medicine is active.
- The source has transferable surplus.
- The destination has a positive shortage.
- The route is active and directed from source to destination.
- The batch belongs to the source and medicine.
- The batch meets arrival shelf-life requirements.
- The candidate quantity is positive.

Routes are directional. An A-to-B route does not imply a B-to-A route.

### CP-SAT model

`model.py` creates integer variables and enforces:

- Source batch availability
- Conservative source protected stock
- Destination shortage limits
- Shared capacity for each directed route
- Total budget
- Integer transfer quantities

The objective is:

```text
PRIORITY_WEIGHTED_UNITS_THEN_COST
```

Stage 1 maximizes:

```text
sum(quantity_units * priority_weight)
```

Stage 2 fixes the proven Stage 1 score and minimizes total transport cost.
Solver statuses are preserved as `OPTIMAL`, `FEASIBLE`, `INFEASIBLE`,
`UNKNOWN`, or `MODEL_INVALID`. `optimality_proven` is true only when the
required optimality conditions are actually met.

### Result validation

`validation.py` independently checks facility, medicine, batch, and route
references; route direction; active records; expiry and shelf life; source
protection; batch availability; destination shortage; route capacity; budget;
cost arithmetic; and summary arithmetic.

## Output contract

`OptimizationResult` contains:

| Field | Meaning |
|---|---|
| `schema_version` | Result schema version |
| `run_id` | Run identifier |
| `status` | Overall run status |
| `objective_policy` | Objective used |
| `solver_status_stage_1` | First solver status |
| `solver_status_stage_2` | Second solver status or `None` |
| `optimality_proven` | Whether optimality was proven |
| `optimizer_version` | Optimizer version |
| `solve_time_ms` | Measured solve time |
| `summary` | Aggregate totals |
| `recommendations` | Proposed transfer lines |
| `unmet_shortages` | Positive remaining shortages |
| `warnings` | Human-readable warnings |

`OptimizationSummary` contains:

```python
estimated_cost_minor_units
budget_remaining_minor_units
transfer_line_count
shortage_lines_total
shortage_lines_with_any_fulfillment
priority_weighted_units_score
```

Each `Recommendation` contains source and destination facility IDs, medicine
ID, source batch ID, route ID, positive quantity, expected arrival date,
transit days, unit and total cost in paise, currency, priority, and explanation
codes.

Recommendation cost is validated as:

```text
total_cost_minor_units =
    quantity_units * unit_cost_minor_units
```

Each `UnmetShortage` contains:

```python
facility_id
medicine_id
shortage_before_units
recommended_units
shortage_after_units
priority_weight
```

Only records with positive `shortage_after_units` are emitted. The number of
unmet records is not the same as the number of unmet units.

## Installation

From the `Optimizer` directory in Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

The dependency file includes OR-Tools, Pydantic, pandas, pytest, and
database/integration dependencies used elsewhere in the repository. The
optimizer itself does not require a database connection.

## Usage example

The complete sample-data mapping is implemented in
`scripts/run_optimizer_demo.py`. A compact valid request can be created with
the actual Pydantic models as follows:

```python
from datetime import date
from decimal import Decimal

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

request = OptimizationRequest(
    schema_version="1.0",
    run_id="example-run-001",
    planning_date=date(2026, 10, 24),
    horizon_days=30,
    budget_minor_units=15_000,
    currency_code="INR",
    objective_policy=ObjectivePolicy.PRIORITY_WEIGHTED_UNITS_THEN_COST,
    facilities=[
        FacilityInput(
            id="A",
            code="A",
            name="Source Hospital",
            is_active=True,
        ),
        FacilityInput(
            id="B",
            code="B",
            name="Destination Hospital",
            is_active=True,
        ),
    ],
    medicines=[
        MedicineInput(
            id="MED1",
            code="MED1",
            name="Example Medicine",
            base_unit="unit",
            is_active=True,
        )
    ],
    inventory_batches=[
        InventoryBatchInput(
            id="BATCH-A-MED1",
            facility_id="A",
            medicine_id="MED1",
            lot_number="LOT-A-MED1",
            expiry_date=date(2027, 6, 30),
            available_quantity_units=500,
            quality_status=QualityStatus.ELIGIBLE,
        ),
        InventoryBatchInput(
            id="BATCH-B-MED1",
            facility_id="B",
            medicine_id="MED1",
            lot_number="LOT-B-MED1",
            expiry_date=date(2027, 6, 30),
            available_quantity_units=20,
            quality_status=QualityStatus.ELIGIBLE,
        ),
    ],
    facility_medicine_policies=[
        PolicyInput(
            facility_id="A",
            medicine_id="MED1",
            target_stock_units=300,
            minimum_reserve_units=200,
            avg_daily_demand_units=Decimal("1"),
            priority_weight=1,
            minimum_remaining_shelf_life_days=14,
        ),
        PolicyInput(
            facility_id="B",
            medicine_id="MED1",
            target_stock_units=200,
            minimum_reserve_units=0,
            avg_daily_demand_units=Decimal("1"),
            priority_weight=5,
            minimum_remaining_shelf_life_days=14,
        ),
    ],
    routes=[
        RouteInput(
            id="ROUTE-A-B",
            source_facility_id="A",
            destination_facility_id="B",
            transit_days=1,
            cost_per_unit_minor_units=200,
            route_capacity_units=100,
            currency_code="INR",
            is_active=True,
        )
    ],
    max_solve_seconds=10,
)

result = optimize(request)
print(result.status)
print(result.summary)
```

This is the deterministic known-answer scenario. The verified result is 75
units transferred for 15,000 paise, leaving 105 shortage units.

## Run the sample demo

From the `Optimizer` directory:

```powershell
.\.venv\Scripts\python.exe scripts\run_optimizer_demo.py
```

The script locates the project root, reads all five sample CSV files with
UTF-8-SIG support, validates required headers, converts values into the actual
Pydantic schemas, calls the real optimizer, and prints the result.

Current verified recommendations:

| Source | Destination | Medicine | Batch | Route | Quantity | Total cost |
|---|---|---|---|---|---:|---:|
| H06 | H02 | MED2 | `B_H06_MED2_A` | `R_H06_H02` | 60 | 11,100 paise |
| H06 | H02 | MED4 | `B_H06_MED4_A` | `R_H06_H02` | 15 | 2,775 paise |
| H06 | H05 | MED4 | `B_H06_MED4_A` | `R_H06_H05` | 20 | 4,000 paise |

Total sample cost:

```text
17,875 paise = INR 178.75
```

## Run tests

### Optimizer-only tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests\test_stock.py tests\test_candidates.py tests\test_model.py tests\test_schemas.py tests\test_service.py tests\test_validation.py
```

Verified result:

```text
33 passed
```

These tests cover schemas, stock eligibility, expiry, shelf life, conservative
donor behavior, candidate generation, directed routes, route capacity, budget,
objective behavior, known-answer optimization, empty candidates, unmet
shortages, result validation, and input immutability.

### Complete repository suite

The repository also contains separate database/integration tests. To run every
currently discovered test:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

The optimizer verification result above intentionally refers only to the
optimizer-specific test selection.

## Output interpretation

A recommendation is a proposed movement of a specific batch from a source
facility to a destination facility. It is not an inventory mutation and does
not prove that a shipment occurred.

The sample result contains:

```text
3 recommendation records
25 unmet-shortage records
1,660 total remaining shortage units
```

The 25 records are shortage lines, not shortage units. A warning is produced
when positive shortages remain within the current stock, route, shelf-life,
capacity, and budget constraints.

## Deterministic known-answer scenario

The existing service test verifies:

| Input | Value |
|---|---:|
| Source usable stock | 500 units |
| Source target | 300 units |
| Source minimum reserve | 200 units |
| Destination usable stock | 20 units |
| Destination target | 200 units |
| Route capacity | 100 units |
| Unit cost | 200 paise |
| Budget | 15,000 paise |

Verified result:

```text
Transferable surplus: 200 units
Destination shortage: 180 units
Transfer: 75 units
Total cost: 15,000 paise
Remaining shortage: 105 units
Remaining budget: 0 paise
```

The expected answer is asserted in a test and is not special-case production
logic.

## Limitations and current scope

- Unmet-shortage warnings are aggregate text; there is no structured
  per-shortage reason field.
- `scripts/load_sample_csv.py` is empty. The active CSV mapping is in the demo
  script and pytest fixture.
- CP-SAT is synchronous and solve time depends on the machine and search.
- No production performance guarantee is made for larger networks.
- The package does not persist results or connect to a database.
- The package does not provide FastAPI endpoints or authentication.
- The package does not execute transfers or mutate inventory.
- Recommendations are proposals for review, not proof of physical movement.
- No property-based or fuzz-testing suite is included.

## Future improvements

The following are not implemented and are possible future work:

- Move CSV-to-request construction into a reusable loader module.
- Add structured reason codes for each unmet shortage.
- Add property-based tests for model invariants.
- Add solver timeout and failure-injection tests.
- Add structured logging and solve metrics.
- Add larger benchmark datasets.
- Add a future transfer approval and execution workflow.

