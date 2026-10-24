# MedMove Database and Optimizer Integration Contract

**Status:** authoritative MVP handoff  
**Audience:** Backend Engineer, Database & Integration Engineer, Frontend Engineer  
**Database target:** PostgreSQL 15+  
**Optimizer package:** `medmove_optimizer`

This document describes the integration that is implemented in this repository.
The optimizer remains a pure Python calculation package. It does not connect to
PostgreSQL, FastAPI, authentication, or a frontend.

## 1. Public optimizer interface

The backend imports the optimizer from the package root:

```python
from medmove_optimizer import optimize
from medmove_optimizer.schemas import OptimizationRequest, OptimizationResult

result: OptimizationResult = optimize(request)
```

Exact signature:

```python
optimize(request: OptimizationRequest) -> OptimizationResult
```

The adapter must construct a validated `OptimizationRequest`, call this
function once for the whole network, and preserve the returned
`OptimizationResult`. It must not reimplement shortage, surplus, route, shelf
life, budget, or objective calculations.

## 2. Identifier mapping

PostgreSQL uses UUID primary keys for joins. The optimizer uses stable business
codes so that a request is readable and independent of database UUID values.

| Database entity | Database primary key | Optimizer identifier | Example |
|---|---|---|---|
| Facility | `facilities.id` UUID | `FacilityInput.id` and `.code` | `H06` |
| Medicine | `medicines.id` UUID | `MedicineInput.id` and `.code` | `MED3` |
| Batch | `inventory_batches.id` UUID | `InventoryBatchInput.id` | `B_H06_MED3_A` |
| Policy | `(facility_code, medicine_code)` relationship | `PolicyInput.facility_id`, `.medicine_id` | `H06`, `MED3` |
| Route | `transport_routes.id` UUID | `RouteInput.id` | `R_H06_H02` |
| Recommendation | `transfer_recommendations.id` UUID | `Recommendation.id` stable code | `REC-0001-R_H06_H02-B_H06_MED2_A` |
| Optimization run | `optimization_runs.id` UUID | `OptimizationRequest.run_id` | `run-20261024-001` |

The adapter keeps lookup dictionaries in both directions while mapping:

```text
facility_code -> facility UUID
medicine_code -> medicine UUID
batch_code -> batch UUID
route_code -> route UUID
```

The result JSON retains optimizer codes. Relational recommendation rows, when
created by a future API persistence layer, resolve those codes to UUID foreign
keys using the same maps. No UUID is sent to the optimizer.

## 3. Request contract

`OptimizationRequest` has `extra="forbid"` and validates all references. The
following are the exact accepted top-level fields.

| Field | Type | Meaning | Source | Example | Used by |
|---|---|---|---|---|---|
| `schema_version` | `Literal["1.0"]` | Request schema version | Application | `"1.0"` | Request validation |
| `run_id` | `str` | Stable run code | Backend | `"run-20261024-001"` | Result and persistence |
| `planning_date` | `date` | Date used for expiry checks | Run command | `"2026-10-24"` | Stock/shelf-life |
| `horizon_days` | `int`, 1-90 | Planning horizon | Run command/config | `30` | Request context |
| `budget_minor_units` | `int >= 0` | Budget in INR paise | Coordinator/config | `18000` | Solver budget |
| `currency_code` | `CurrencyCode` | Currently INR | Config/routes | `"INR"` | Currency validation |
| `objective_policy` | `ObjectivePolicy` | Current objective policy | Config | `"PRIORITY_WEIGHTED_UNITS_THEN_COST"` | Solver |
| `facilities` | `list[FacilityInput]` | Active/inactive network facilities | `facilities` | See below | Stock and routes |
| `medicines` | `list[MedicineInput]` | Medicine catalog | `medicines` | See below | Stock and policies |
| `inventory_batches` | `list[InventoryBatchInput]` | Current batch snapshot | `inventory_batches` | See below | Usable stock/candidates |
| `facility_medicine_policies` | `list[PolicyInput]` | Target, reserve, priority, shelf-life policy | `facility_medicine_plans` | See below | Shortages/candidates |
| `routes` | `list[RouteInput]` | Active directed transport routes | `transport_routes` | See below | Candidates/capacity/cost |
| `max_solve_seconds` | `int`, 1-60 | CP-SAT time limit | Config/request | `10` | Solver |

### Request nested fields

#### `FacilityInput`

| Field | Type | Meaning | Source | Example | Used by |
|---|---|---|---|---|---|
| `id` | `str` | Optimizer facility identifier | `facility_code` | `"H06"` | References |
| `code` | `str` | Display/business code | `facility_code` | `"H06"` | Output mapping |
| `name` | `str` | Hospital name | `facilities.name` | `"Regional Medical Centre"` | Display |
| `is_active` | `bool` | Whether facility participates | `facilities.is_active` | `true` | Eligibility |

#### `MedicineInput`

| Field | Type | Meaning | Source | Example | Used by |
|---|---|---|---|---|---|
| `id` | `str` | Optimizer medicine identifier | `medicine_code` | `"MED3"` | References |
| `code` | `str` | Display/business code | `medicine_code` | `"MED3"` | Output mapping |
| `name` | `str` | Generic medicine name | `medicines.generic_name` | `"Amoxicillin"` | Display |
| `base_unit` | `str` | Whole-unit name | `medicines.base_unit` | `"capsule"` | Display |
| `is_active` | `bool` | Whether catalog item participates | `medicines.is_active` | `true` | Eligibility |

#### `InventoryBatchInput`

| Field | Type | Meaning | Source | Example | Used by |
|---|---|---|---|---|---|
| `id` | `str` | Stable batch code | `inventory_batches.batch_code` | `"B_H06_MED3_A"` | Candidate/result |
| `facility_id` | `str` | Owning facility code | Facility lookup | `"H06"` | Source stock |
| `medicine_id` | `str` | Medicine code | Medicine lookup | `"MED3"` | Stock |
| `lot_number` | `str` | Lot identifier | `inventory_batches.lot_number` | `"LOT-H06-MED3-A"` | Audit |
| `expiry_date` | `date` | Batch expiry | `inventory_batches.expiry_date` | `"2027-01-31"` | Eligibility |
| `available_quantity_units` | `int >= 0` | Current available whole units | `quantity_on_hand_units` | `70` | Capacity |
| `quality_status` | `QualityStatus` | Batch quality | `inventory_batches.quality_status` | `"ELIGIBLE"` | Eligibility |

#### `PolicyInput`

| Field | Type | Meaning | Source | Example | Used by |
|---|---|---|---|---|---|
| `facility_id` | `str` | Facility code | Plan facility lookup | `"H06"` | Pair key |
| `medicine_id` | `str` | Medicine code | Plan medicine lookup | `"MED3"` | Pair key |
| `target_stock_units` | `int >= 0` | Desired usable stock | Plan | `80` | Shortage/protection |
| `minimum_reserve_units` | `int >= 0` | Minimum protected stock | Plan | `20` | Protection |
| `avg_daily_demand_units` | `Decimal >= 0` | Demand context | Plan | `4` | Request context |
| `priority_weight` | `int`, 1-5 | Shortage priority | Plan | `3` | Objective |
| `minimum_remaining_shelf_life_days` | `int >= 0` | Required arrival shelf life | Plan | `14` | Candidate eligibility |

#### `RouteInput`

| Field | Type | Meaning | Source | Example | Used by |
|---|---|---|---|---|---|
| `id` | `str` | Stable route code | `transport_routes.route_code` | `"R_H06_H02"` | Candidate/result |
| `source_facility_id` | `str` | Directed source code | Route facility lookup | `"H06"` | Direction |
| `destination_facility_id` | `str` | Directed destination code | Route facility lookup | `"H02"` | Direction |
| `transit_days` | `int >= 0` | Travel time | Route | `1` | Arrival date |
| `cost_per_unit_minor_units` | `int >= 0` | Cost per unit in paise | Route | `185` | Objective/budget |
| `route_capacity_units` | `int >= 0` | Shared route capacity | Route | `100` | Constraint |
| `currency_code` | `CurrencyCode` | Route currency | Route | `"INR"` | Request validation |
| `is_active` | `bool` | Route availability | Route | `true` | Candidate eligibility |

## 4. Result contract

`OptimizationResult` is the exact returned Pydantic model.

| Field | Type | Meaning | Source | Example | Used by |
|---|---|---|---|---|---|
| `schema_version` | `Literal["1.0"]` | Result schema version | Request | `"1.0"` | API contract |
| `run_id` | `str` | Run code | Request | `"run-20261024-001"` | Persistence |
| `status` | `RunStatus` | Overall run state | Service | `"COMPLETED"` | UI/API |
| `objective_policy` | `ObjectivePolicy` | Objective used | Request | `"PRIORITY_WEIGHTED_UNITS_THEN_COST"` | Audit |
| `solver_status_stage_1` | `SolverStatus` | Priority stage result | CP-SAT | `"OPTIMAL"` | Audit |
| `solver_status_stage_2` | `SolverStatus \| None` | Cost stage result | CP-SAT | `"OPTIMAL"` | Audit |
| `optimality_proven` | `bool` | Both stages proven optimal | Service/model | `true` | Honest status |
| `optimizer_version` | `str` | Algorithm version | Service | `"1.0"` | Audit |
| `solve_time_ms` | `int >= 0` | Measured solve time | Service | `93` | Observability |
| `summary` | `OptimizationSummary` | Arithmetic totals | Service | See below | Dashboard |
| `recommendations` | `list[Recommendation]` | Proposed transfers | Service | See below | Review |
| `unmet_shortages` | `list[UnmetShortage]` | Positive remaining shortages only | Service | See below | Dashboard |
| `warnings` | `list[str]` | Human-readable limitations | Service | `[]` or warning | UI/log |

### Result nested fields

#### `OptimizationSummary`

| Field | Type | Meaning | Source | Example | Used by |
|---|---|---|---|---|---|
| `estimated_cost_minor_units` | `int >= 0` | Sum of recommendation costs | Recommendations | `17875` | Budget/UI |
| `budget_remaining_minor_units` | `int >= 0` | Budget minus cost | Request/result | `125` | UI |
| `transfer_line_count` | `int >= 0` | Recommendation count | Recommendations | `3` | UI |
| `shortage_lines_total` | `int >= 0` | Emitted unmet record count | Unmet list | `25` | UI |
| `shortage_lines_with_any_fulfillment` | `int >= 0` | Unmet records with inbound units | Unmet list | `2` | UI |
| `priority_weighted_units_score` | `int >= 0` | Sum quantity times priority | Recommendations | `475` | Audit |

#### `Recommendation`

| Field | Type | Meaning | Source | Example | Used by |
|---|---|---|---|---|---|
| `id` | `str` | Stable recommendation code | Optimizer | `"REC-0001-R_H06_H02-B_H06_MED2_A"` | Persistence |
| `source_facility_id` | `str` | Source facility code | Candidate | `"H06"` | UUID lookup |
| `destination_facility_id` | `str` | Destination facility code | Candidate | `"H02"` | UUID lookup |
| `medicine_id` | `str` | Medicine code | Candidate | `"MED2"` | UUID lookup |
| `source_batch_id` | `str` | Source batch code | Candidate | `"B_H06_MED2_A"` | UUID lookup |
| `route_id` | `str` | Route code | Candidate | `"R_H06_H02"` | UUID lookup |
| `quantity_units` | `int > 0` | Proposed whole units | Solver | `60` | Review |
| `expected_arrival_date` | `date` | Planning date plus transit | Service | `"2026-10-25"` | Review |
| `transit_days` | `int >= 0` | Route duration | Route | `1` | Review |
| `unit_cost_minor_units` | `int >= 0` | Paise per unit | Route | `185` | Cost |
| `total_cost_minor_units` | `int >= 0` | Quantity times unit cost | Service/model | `11100` | Cost |
| `currency_code` | `CurrencyCode` | Cost currency | Request | `"INR"` | UI |
| `priority_weight` | `int`, 1-5 | Destination priority | Policy | `5` | Objective/UI |
| `explanation_codes` | `list[str]` | Machine-readable reasons | Service | `["PRIORITY_WEIGHTED_SHORTAGE_REDUCTION"]` | UI/audit |

#### `UnmetShortage`

| Field | Type | Meaning | Source | Example | Used by |
|---|---|---|---|---|---|
| `facility_id` | `str` | Destination/facility code | Shortage line | `"H02"` | UUID lookup |
| `medicine_id` | `str` | Medicine code | Shortage line | `"MED2"` | UUID lookup |
| `shortage_before_units` | `int >= 0` | Initial shortage | Stock calculation | `70` | Audit |
| `recommended_units` | `int >= 0` | Inbound units assigned | Service | `60` | Audit |
| `shortage_after_units` | `int >= 0` | Remaining shortage | Service | `10` | Dashboard |
| `priority_weight` | `int`, 1-5 | Policy priority | Policy | `5` | Dashboard |

## 5. Database schema

The SQLAlchemy models are in `backend/app/db/models.py`. The PostgreSQL
baseline is `backend/migrations/001_initial.sql`. UUIDs are generated by the
application/model layer; PostgreSQL deployment should enable `pgcrypto` if
server-side UUID defaults are preferred.

### Relationships

```text
facilities 1---* users
facilities 1---* inventory_batches *---1 medicines
facilities 1---* facility_medicine_plans *---1 medicines
facilities 1---* transport_routes (source)
facilities 1---* transport_routes (destination)
users 1---* optimization_runs
optimization_runs 1---* transfer_recommendations
optimization_runs 1---* unmet_shortages
```

The current MVP stores the complete result in `optimization_runs.result_json`.
The recommendation and shortage tables are also defined for relational
queries and are populated by the adapter persistence helper. They do not change
inventory and recommendation status is always `PENDING_REVIEW`.

### Table field contract

The core tables are:

- `facilities`: UUID `id`, unique `facility_code`, name/type/district/state,
  active flag, timestamps.
- `users`: UUID `id`, full name, normalized unique email, Argon2 password hash,
  `HOSPITAL_USER` or `NETWORK_COORDINATOR`, nullable facility, active flag,
  timestamps.
- `medicines`: UUID `id`, unique code, generic name, strength, dosage form,
  base unit, active flag, timestamps.
- `inventory_batches`: UUID `id`, unique batch code, facility/medicine
  foreign keys, lot, expiry, non-negative quantity, supported quality status,
  timestamps, and unique facility/medicine/lot.
- `facility_medicine_plans`: UUID `id`, facility/medicine foreign keys,
  non-negative target/reserve/demand/shelf-life values, priority 1-5,
  unique facility/medicine.
- `transport_routes`: UUID `id`, unique route code, directed source/destination,
  transit, integer paise cost, capacity, INR currency, active flag, unique
  source/destination pair.
- `optimization_runs`: UUID `id`, run metadata, trigger source/reason,
  status, snapshot hash, input summary JSON, result JSON, solver statuses,
  totals, safe error code, and timestamps.
- `transfer_recommendations`: UUID `id`, run and source/destination/medicine/
  batch/route foreign keys, optimizer recommendation code, positive quantity,
  arrival/cost fields, explanation JSON, and `PENDING_REVIEW` status.
- `unmet_shortages`: UUID `id`, run/facility/medicine foreign keys, before,
  fulfilled, after, and priority values. Only positive after-shortages are
  saved.

Public signup always creates `HOSPITAL_USER` for an active preconfigured
facility. It never accepts a role or facility UUID. The coordinator is created
only by the controlled seed/setup function.

## 6. Adapter and run workflow

The implemented adapter is:

```python
from backend.integrations.optimizer_adapter import run_optimization_from_database

result = run_optimization_from_database(
    session,
    initiated_by_user_id=coordinator_id,
    planning_date=date(2026, 10, 24),
    budget_minor_units=18_000,
)
```

Exact signature:

```python
def run_optimization_from_database(
    session: Session,
    *,
    initiated_by_user_id: UUID,
    planning_date: date,
    budget_minor_units: int,
    run_code: str | None = None,
    trigger_source: TriggerSource = TriggerSource.MANUAL,
    trigger_reason: str = "MANUAL_RERUN",
    horizon_days: int = 30,
    max_solve_seconds: int = 10,
) -> OptimizationResult
```

The function accepts an existing SQLAlchemy `Session`, the UUID of the
initiating database user, planning parameters, and optional run metadata. It
returns the validated Pydantic `OptimizationResult` after persistence. The
returned `run_id` identifies the saved database run.

Internally, the adapter:

1. Loads active facilities, medicines, batches, policies, and routes.
2. Converts UUID-backed rows to stable optimizer codes.
3. Builds and validates `OptimizationRequest`.
4. Computes a canonical SHA-256 request snapshot.
5. Creates a running `optimization_runs` row.
6. Calls `optimize(request)` exactly once.
7. Saves the full Pydantic result as JSON.
8. Saves recommendation and positive unmet-shortage rows.
9. Updates run status, solver statuses, totals, and completion time.
10. Returns the validated `OptimizationResult`.

If the optimizer raises, the run is marked `FAILED` with a safe
`OPTIMIZER_ERROR` code and the exception is re-raised for the backend error
handler. Stack traces must stay in server logs, not API responses.

## 7. Calling boundary for the Backend Engineer

The Backend Engineer owns inventory-update trigger decisions and HTTP behavior.
After an inventory transaction is committed, that service may call
`run_optimization_from_database(...)` for a network-wide run. This integration
package does not implement inventory endpoints, automatic trigger orchestration,
authentication, JWTs, or FastAPI routers.

The adapter rejects an identical completed snapshot using a SHA-256 hash of the
canonical request with `run_id` excluded. A caller that wants to rerun the same
data must first change the snapshot or explicitly decide how to handle the
`DuplicateRunError`. Recommendations are proposals: the adapter never subtracts
from inventory or executes a transfer.

## 8. Request, response, and error contracts

The database/integration layer accepts typed Python objects. A future FastAPI
layer should expose JSON over `/api/v1`.

Successful optimizer integration returns the exact `OptimizationResult`.
Database errors and optimizer errors must be explicit. Use safe machine-readable
error codes such as:

| Code | Meaning |
|---|---|
| `INVALID_REQUEST` | Database snapshot could not satisfy Pydantic request schema. |
| `DUPLICATE_RUN` | Same completed snapshot was already analyzed. |
| `OPTIMIZER_ERROR` | Optimizer raised or returned an invalid result. |
| `DATABASE_ERROR` | Persistence failed. |
| `INVALID_CREDENTIALS` | Login failed without revealing whether email exists. |
| `INVALID_JOIN_CODE` | Public signup join code was wrong. |
| `EMAIL_ALREADY_EXISTS` | Signup email is already registered. |
| `FORBIDDEN_FACILITY` | User attempted cross-facility access. |

Never return passwords, password hashes, database credentials, stack traces, or
secret join codes.

## 9. Example request JSON

```json
{
  "schema_version": "1.0",
  "run_id": "run-20261024-001",
  "planning_date": "2026-10-24",
  "horizon_days": 30,
  "budget_minor_units": 18000,
  "currency_code": "INR",
  "objective_policy": "PRIORITY_WEIGHTED_UNITS_THEN_COST",
  "facilities": [
    {"id": "H06", "code": "H06", "name": "Regional Medical Centre", "is_active": true}
  ],
  "medicines": [
    {"id": "MED3", "code": "MED3", "name": "Amoxicillin", "base_unit": "capsule", "is_active": true}
  ],
  "inventory_batches": [
    {
      "id": "B_H06_MED3_A",
      "facility_id": "H06",
      "medicine_id": "MED3",
      "lot_number": "LOT-H06-MED3-A",
      "expiry_date": "2027-01-31",
      "available_quantity_units": 70,
      "quality_status": "ELIGIBLE"
    }
  ],
  "facility_medicine_policies": [
    {
      "facility_id": "H06",
      "medicine_id": "MED3",
      "target_stock_units": 80,
      "minimum_reserve_units": 20,
      "avg_daily_demand_units": 4,
      "priority_weight": 3,
      "minimum_remaining_shelf_life_days": 14
    }
  ],
  "routes": [],
  "max_solve_seconds": 10
}
```

## 10. Example result JSON

```json
{
  "schema_version": "1.0",
  "run_id": "run-20261024-001",
  "status": "COMPLETED",
  "objective_policy": "PRIORITY_WEIGHTED_UNITS_THEN_COST",
  "solver_status_stage_1": "OPTIMAL",
  "solver_status_stage_2": "OPTIMAL",
  "optimality_proven": true,
  "optimizer_version": "1.0",
  "solve_time_ms": 93,
  "summary": {
    "estimated_cost_minor_units": 11100,
    "budget_remaining_minor_units": 6900,
    "transfer_line_count": 1,
    "shortage_lines_total": 1,
    "shortage_lines_with_any_fulfillment": 1,
    "priority_weighted_units_score": 180
  },
  "recommendations": [
    {
      "id": "REC-0001-R_H06_H02-B_H06_MED2_A",
      "source_facility_id": "H06",
      "destination_facility_id": "H02",
      "medicine_id": "MED2",
      "source_batch_id": "B_H06_MED2_A",
      "route_id": "R_H06_H02",
      "quantity_units": 60,
      "expected_arrival_date": "2026-10-25",
      "transit_days": 1,
      "unit_cost_minor_units": 185,
      "total_cost_minor_units": 11100,
      "currency_code": "INR",
      "priority_weight": 3,
      "explanation_codes": ["PRIORITY_WEIGHTED_SHORTAGE_REDUCTION"]
    }
  ],
  "unmet_shortages": [
    {
      "facility_id": "H02",
      "medicine_id": "MED2",
      "shortage_before_units": 120,
      "recommended_units": 60,
      "shortage_after_units": 60,
      "priority_weight": 3
    }
  ],
  "warnings": []
}
```

## 11. Tests and run commands

Install dependencies in the project virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Run the optimizer and integration tests:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

The integration tests use SQLite in memory for speed and isolation. Production
uses PostgreSQL through `DATABASE_URL`, for example:

```text
postgresql+psycopg://medmove:password@localhost:5432/medmove
```

The repository does not start PostgreSQL or FastAPI automatically. The seed
script is:

```powershell
.\.venv\Scripts\python.exe scripts\seed_demo.py
```

It reads the five CSV files and is repeatable. Set `DATABASE_URL` to a
PostgreSQL URL for deployment, or omit it for the default local SQLite file.
The optional `MEDMOVE_COORDINATOR_EMAIL` and
`MEDMOVE_COORDINATOR_PASSWORD_HASH` variables create a coordinator row with a
hash supplied by the separate authentication/setup owner. This package does
not hash passwords or implement signup.
