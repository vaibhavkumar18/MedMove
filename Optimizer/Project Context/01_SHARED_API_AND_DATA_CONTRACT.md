# MedMove Shared API, Database and Optimizer Contract

**This file overrides inconsistent examples in any other guide.** All four role owners must use these exact field names, enums, statuses and signatures. If a genuine change is necessary, update this contract first and tell all affected roles before changing code.

## 1. Conventions

- API prefix: `/api/v1`.
- JSON over HTTP. Dates use ISO format `YYYY-MM-DD`; datetimes use timezone-aware ISO 8601.
- Quantities are whole integer units (`quantity_on_hand_units`, `recommended_quantity_units`).
- Money is integer minor units/paise. `100` = Rs 1.00, `50000` = Rs 500.00. Convert to rupees only for UI display.
- Business codes are the cross-module identifiers: facility `H01`, medicine `MED1`, batch `B_H01_MED1_A`, route `R_H01_H02`. Database UUIDs are internal to PostgreSQL and adapter code. The optimizer must not need SQL UUIDs.
- Boolean CSV values parse to real booleans, not strings.
- Unknown request fields should be rejected where Pydantic supports `extra="forbid"`.
- All quantities must be non-negative integers; no fractional medicine units.
- `objective_policy` currently supports only `PRIORITY_WEIGHTED_UNITS_THEN_COST`.
- `QualityStatus`: `ELIGIBLE`, `QUARANTINED`, `RECALLED`, `DAMAGED`.
- `UserRole`: `HOSPITAL_USER`, `NETWORK_COORDINATOR`.
- `RunStatus` in persistence/API: `RUNNING`, `COMPLETED`, `FAILED`.
- `TriggerDecision`: `RAN`, `SKIPPED_UNCHANGED`, `SKIPPED_NO_NETWORK_SHORTAGE`, `SKIPPED_SNAPSHOT_ALREADY_ANALYZED`, `FAILED`.
- `TransferStatus`: `PENDING_REVIEW`. It does not mean approved or dispatched.

## 2. Database schema - authoritative logical definition

All seven tables are defined in `contracts/02_DATABASE_SCHEMA.sql`. SQLAlchemy models must express the same fields and constraints.

### `facilities`

| Field | Type | Rule / purpose |
|---|---|---|
| `id` | UUID PK | Internal primary key |
| `facility_code` | VARCHAR(20) unique, not null | Stable business code from CSV (`H01`) |
| `name` | VARCHAR(160) not null | Display name |
| `facility_type` | VARCHAR(40) not null | Demo facility type |
| `district` | VARCHAR(100) not null | Display metadata |
| `state` | VARCHAR(100) not null | Display metadata |
| `is_active` | BOOLEAN not null default true | Inactive facilities are excluded from signup/network |
| `created_at`, `updated_at` | TIMESTAMPTZ | Audit timestamps |

### `users`

| Field | Type | Rule / purpose |
|---|---|---|
| `id` | UUID PK | Internal user ID |
| `full_name` | VARCHAR(120) not null | User display name |
| `email` | VARCHAR(254) unique, not null | Normalized lowercase email |
| `password_hash` | VARCHAR(255) not null | Argon2 hash only; never plaintext |
| `role` | VARCHAR(32) not null | `HOSPITAL_USER` or `NETWORK_COORDINATOR` |
| `facility_id` | UUID FK nullable | Required for hospital users; null for coordinator |
| `is_active` | BOOLEAN not null default true | Inactive users cannot login |
| `created_at`, `updated_at` | TIMESTAMPTZ | Audit timestamps |

Signup rules: user submits `facility_code`, but DB stores `facility_id`. Public signup always sets `HOSPITAL_USER`; ignore/reject any submitted role. Coordinator is created only by the seed script/config. A single demo join code is checked against `DEMO_HOSPITAL_JOIN_CODE` on the server.

### `medicines`

| Field | Type | Rule / purpose |
|---|---|---|
| `id` | UUID PK | Internal ID |
| `medicine_code` | VARCHAR(20) unique, not null | Stable code (`MED1`) |
| `generic_name` | VARCHAR(160) not null | Display name |
| `strength` | VARCHAR(80) not null | e.g. `500 mg` |
| `dosage_form` | VARCHAR(80) not null | tablet, sachet, capsule, etc. |
| `base_unit` | VARCHAR(40) not null | Unit used by all quantity fields |
| `is_active` | BOOLEAN not null default true | Active catalog items can be used |
| `created_at`, `updated_at` | TIMESTAMPTZ | Audit timestamps |

### `inventory_batches`

| Field | Type | Rule / purpose |
|---|---|---|
| `id` | UUID PK | Internal ID |
| `batch_code` | VARCHAR(60) unique, not null | Stable business code (`B_H01_MED1_A`) |
| `facility_id` | UUID FK not null | Facility that owns the batch |
| `medicine_id` | UUID FK not null | Medicine reference |
| `lot_number` | VARCHAR(100) not null | Manufacturer/demo lot identifier |
| `expiry_date` | DATE not null | Must be validated on writes |
| `quantity_on_hand_units` | INTEGER not null check >= 0 | Current recorded whole units |
| `quality_status` | VARCHAR(20) not null | `QualityStatus` enum |
| `created_at`, `updated_at` | TIMESTAMPTZ | Audit timestamps |
| constraint | unique(facility_id, medicine_id, lot_number) | No duplicate lot for same facility/medicine |

### `facility_medicine_plans`

| Field | Type | Rule / purpose |
|---|---|---|
| `id` | UUID PK | Internal ID |
| `facility_id` | UUID FK not null | Facility policy belongs to |
| `medicine_id` | UUID FK not null | Medicine covered by the policy |
| `target_stock_units` | INTEGER not null check >= 0 | Desired usable stock |
| `minimum_reserve_units` | INTEGER not null check >= 0 | Protected stock that must remain at the source |
| `avg_daily_demand_units` | INTEGER not null check >= 0 | Demo demand indicator/context; no time-series forecast in MVP |
| `priority_weight` | INTEGER not null check between 1 and 5 | Higher means the shortage gets more priority in the objective |
| `minimum_remaining_shelf_life_days` | INTEGER not null check >= 0 | Minimum shelf-life buffer at receiving facility |
| `created_at`, `updated_at` | TIMESTAMPTZ | Audit timestamps |
| constraint | unique(facility_id, medicine_id) | One plan per facility/medicine |

### `transport_routes`

| Field | Type | Rule / purpose |
|---|---|---|
| `id` | UUID PK | Internal ID |
| `route_code` | VARCHAR(60) unique, not null | Stable route code (`R_H01_H02`) |
| `source_facility_id` | UUID FK not null | Route source |
| `destination_facility_id` | UUID FK not null | Route destination; must differ from source |
| `transit_days` | INTEGER not null check >= 0 | Estimated route duration |
| `cost_per_unit_minor_units` | INTEGER not null check >= 0 | Cost per single medicine unit in paise |
| `route_capacity_units` | INTEGER not null check >= 0 | Shared capacity across all medicine lines assigned to this route in one run |
| `currency_code` | CHAR(3) not null default `INR` | MVP only supports INR |
| `is_active` | BOOLEAN not null default true | Only active routes are candidate routes |
| `created_at`, `updated_at` | TIMESTAMPTZ | Audit timestamps |
| constraint | unique(source_facility_id, destination_facility_id) | One direct route per directed pair in MVP |

### `optimization_runs`

| Field | Type | Rule / purpose |
|---|---|---|
| `id` | UUID PK | Internal run ID |
| `created_by_user_id` | UUID FK users.id not null | Hospital inventory trigger actor or Coordinator who initiated a manual run |
| `trigger_source` | VARCHAR(32) not null | `MANUAL` or `INVENTORY_UPDATE` |
| `trigger_reason` | VARCHAR(120) not null | Stable code describing why run started |
| `status` | VARCHAR(16) not null | `RUNNING`, `COMPLETED`, `FAILED` |
| `planning_date` | DATE not null | Date used for shelf-life checks |
| `budget_minor_units` | BIGINT not null check >= 0 | Total allowed cost in paise |
| `objective_policy` | VARCHAR(64) not null | `PRIORITY_WEIGHTED_UNITS_THEN_COST` |
| `input_snapshot_hash` | VARCHAR(64) not null | SHA-256 of canonical optimizer request for duplicate-run check |
| `input_summary_json` | JSONB not null | Small auditable input summary, not necessarily every row |
| `result_json` | JSONB nullable | Full `OptimizationResult` after completion |
| `solver_status_stage_1` | VARCHAR(24) nullable | Stage 1 CP-SAT status |
| `solver_status_stage_2` | VARCHAR(24) nullable | Stage 2 status, nullable if stage 1 had no proven optimum/was infeasible |
| `total_recommended_units` | BIGINT nullable | Sum of proposed transfer units |
| `total_cost_minor_units` | BIGINT nullable | Sum of proposed transfer costs in paise |
| `error_code` | VARCHAR(80) nullable | Safe machine-readable failure code; no stack trace to client |
| `created_at` | TIMESTAMPTZ not null | Creation time |
| `started_at`, `completed_at` | TIMESTAMPTZ nullable | Run timing |

The full result JSON contains transfers and unmet-shortage rows. This is a deliberate four-day simplification that avoids a separate transfer table. Do not duplicate the same result in extra tables for this MVP.

## 3. Common and health endpoint

### `GET /api/v1/health` (public)

No input. It verifies the FastAPI process is running; it must not query optimizer or mutate data. Response `200`: `{"status":"ok","service":"medmove-api"}`.

## 4. Authentication API contracts

### `GET /api/v1/auth/signup-options` (public)

Purpose: populate the facility dropdown. Returns only active facility display fields, never the join code or private data.

```json
{
  "facilities": [
    {"facility_code":"H01","name":"Central District Hospital","district":"Lucknow","state":"Uttar Pradesh"}
  ]
}
```

### `POST /api/v1/auth/signup` (public)

Request:

```json
{
  "full_name":"Asha Sharma",
  "email":"asha@example.test",
  "password":"demo-password-123",
  "facility_code":"H01",
  "join_code":"medmove-demo-2026"
}
```

Rules: validate the server-configured `DEMO_HOSPITAL_JOIN_CODE`; normalize email; require a reasonable password (minimum 8 characters); verify an active facility exists; reject duplicate email; hash with Argon2; always set `role=HOSPITAL_USER`; set facility from the server's facility lookup. Do not accept `role`, `facility_id`, `is_active` or `password_hash` from the request. New facility creation is out of scope.

Success `201`:

```json
{
  "access_token":"<jwt>",
  "token_type":"bearer",
  "user":{
    "user_id":"<uuid>","full_name":"Asha Sharma","email":"asha@example.test",
    "role":"HOSPITAL_USER","facility_code":"H01","facility_name":"Central District Hospital"
  }
}
```

Errors: `409 EMAIL_ALREADY_EXISTS`; `422 INVALID_FACILITY_OR_FIELDS`; `401 INVALID_JOIN_CODE`. Never return password/hash.

### `POST /api/v1/auth/login` (public)

Request: `{"email":"asha@example.test","password":"demo-password-123"}`. Success response has the same token/profile shape as signup. Invalid credentials and inactive account return generic `401 INVALID_CREDENTIALS`; do not disclose whether the email exists.

### `GET /api/v1/auth/me` (bearer token)

Response: `{"user":{"user_id":"<uuid>","full_name":"Asha Sharma","email":"asha@example.test","role":"HOSPITAL_USER","facility_code":"H01","facility_name":"Central District Hospital"}}`. For Coordinator, `facility_code` and `facility_name` are null. Reload uses this endpoint to revalidate the session and learn role/facility from the database.

## 5. Catalog and dashboard APIs

### `GET /api/v1/catalog/medicines` (authenticated)

- Hospital User: return active medicines with a `facility_medicine_plan` for their facility.
- Coordinator: return active medicines in the catalog.
- Output: `{"medicines":[{"medicine_code":"MED1","generic_name":"Paracetamol","strength":"500 mg","dosage_form":"tablet","base_unit":"tablet"}]}`.

### `GET /api/v1/dashboard` (authenticated, role-scoped)

Hospital User receives only its facility summary and shortage rows. Coordinator receives all ten facility summaries and all network shortage rows. Same JSON shape is used for both roles:

```json
{
  "viewer":{"role":"HOSPITAL_USER","facility_code":"H01","facility_name":"Central District Hospital"},
  "generated_at":"2026-10-24T10:00:00Z",
  "summary":{
    "facility_count":1,"medicine_count":4,"shortage_line_count":0,
    "total_shortage_units":0,"eligible_surplus_line_count":1,
    "eligible_surplus_units":120,"latest_run_status":"COMPLETED"
  },
  "facilities":[{
    "facility_code":"H01","facility_name":"Central District Hospital",
    "shortage_line_count":0,"total_shortage_units":0,
    "eligible_surplus_line_count":1,"eligible_surplus_units":120
  }],
  "shortages":[],
  "latest_run":{"run_id":"<uuid>","status":"COMPLETED","trigger_source":"MANUAL","created_at":"2026-10-24T10:00:00Z"}
}
```

For a `NETWORK_COORDINATOR`, the same shape contains all ten facilities and shortage rows for any facility with a shortage. Counts shown are illustrative and do not promise the same output as the CSV dataset. `latest_run` may be `null` before any run. Backend constructs a canonical request with the DB adapter and uses the optimizer helpers `calculate_shortages` and `calculate_surpluses` to produce the stock summary; it must not invent a separate shortage formula. `eligible_surplus_units` is a conservative pre-route estimate: `max(0, usable_stock_units - max(target_stock_units, minimum_reserve_units))`. It is not a promise that this stock can be transferred, because destination shelf-life, route, capacity and budget constraints are checked by the optimizer. A facility below target must not donate that medicine.

## 6. Inventory API contracts

### `GET /api/v1/inventory` (authenticated)

- Hospital User: always return only inventory at the facility from its authenticated user record. Ignore or reject a client attempt to pick another facility.
- Coordinator: may pass optional query `facility_code=H01`; without it, list all demo batches.
- GET never fires optimization.

Output: `{"batches":[{"batch_code":"B_H01_MED1_A","facility_code":"H01","facility_name":"Central District Hospital","medicine_code":"MED1","generic_name":"Paracetamol","lot_number":"LOT-H01-MED1-A","expiry_date":"2027-06-30","quantity_on_hand_units":350,"quality_status":"ELIGIBLE","updated_at":"2026-10-24T10:00:00Z"}]}`.

### `POST /api/v1/inventory/batches` (Hospital User only)

Creates a new batch for the authenticated user's own facility. The UI does not send a facility ID/code.

Request:

```json
{
  "medicine_code":"MED1",
  "lot_number":"LOT-NEW-01",
  "expiry_date":"2027-06-30",
  "quantity_on_hand_units":60,
  "quality_status":"ELIGIBLE"
}
```

Rules: medicine must be active and configured for the user's facility by a stock plan; lot must be unique within facility+medicine; quantity >= 0; quality must be a supported enum. Commit first, then evaluate trigger. Success `201` returns `inventory_batch` plus `trigger` object as defined below.

### `PATCH /api/v1/inventory/batches/{batch_code}` (Hospital User only)

Only these mutable fields are accepted; at least one must be provided:

```json
{"quantity_on_hand_units":260,"expiry_date":"2027-05-31","quality_status":"ELIGIBLE"}
```

`quantity_on_hand_units` is integer >= 0. `expiry_date` is `YYYY-MM-DD`. `quality_status` is the enum. Reject `facility_code`, `facility_id`, `medicine_code`, `batch_code`, `id`, and unknown fields. Backend proves the batch belongs to the JWT user's facility before update; use a generic not-found response if not owned. Commit first, then trigger evaluation. If submitted values equal stored values, no optimizer call is made.

POST/PATCH success has this shape:

```json
{
  "inventory_batch": {"batch_code":"B_H01_MED1_A","facility_code":"H01","medicine_code":"MED1","expiry_date":"2027-06-30","quantity_on_hand_units":260,"quality_status":"ELIGIBLE"},
  "trigger": {
    "decision":"RAN",
    "reason":"NETWORK_SHORTAGE_AND_NEW_SNAPSHOT",
    "optimization_run_id":"<uuid>",
    "run_status":"COMPLETED",
    "message":"Inventory saved and network recommendations refreshed."
  }
}
```

Allowed `trigger.decision`: `RAN`, `SKIPPED_UNCHANGED`, `SKIPPED_NO_NETWORK_SHORTAGE`, `SKIPPED_SNAPSHOT_ALREADY_ANALYZED`, `FAILED`. `optimization_run_id` and `run_status` may be null when no run was created. If the inventory commit succeeds but optimizer fails, return a successful inventory-write response with `decision=FAILED` and a safe message that says the inventory was saved but optimization failed. Do not pretend the edit rolled back.

## 7. Optimization APIs

### `POST /api/v1/optimization-runs` (Network Coordinator only)

Used for first/manual runs. Hospital users receive `403 COORDINATOR_REQUIRED`.

Request:

```json
{
  "planning_date":"2026-10-24",
  "budget_minor_units":50000,
  "objective_policy":"PRIORITY_WEIGHTED_UNITS_THEN_COST"
}
```

`50000` is Rs 500.00. It includes only run parameters; browser never submits the full stock snapshot. Backend/adapter loads the full network from DB. On success `200`, return the following shape (fields are the saved run plus the optimizer result):

```json
{
  "run": {
    "run_id":"<uuid>","status":"COMPLETED","trigger_source":"MANUAL",
    "trigger_reason":"COORDINATOR_MANUAL_RUN","planning_date":"2026-10-24",
    "budget_minor_units":50000,"objective_policy":"PRIORITY_WEIGHTED_UNITS_THEN_COST",
    "input_snapshot_hash":"<sha256>","created_at":"2026-10-24T10:00:00Z",
    "solver_status_stage_1":"OPTIMAL","solver_status_stage_2":"OPTIMAL"
  },
  "summary": {
    "transfer_count":1,"total_recommended_units":80,"total_cost_minor_units":20400,
    "initial_shortage_line_count":1,"unmet_shortage_line_count":1,
    "total_unmet_shortage_units":100,"priority_weighted_units_score":400
  },
  "transfers":[{"source_facility_code":"H01","destination_facility_code":"H02","medicine_code":"MED1","source_batch_code":"B_H01_MED1_A","recommended_quantity_units":80,"cost_per_unit_minor_units":255,"estimated_cost_minor_units":20400,"transit_days":2,"reason":"Illustrative reason","status":"PENDING_REVIEW"}],
  "unmet_shortages":[{"facility_code":"H02","medicine_code":"MED1","shortage_before_units":180,"recommended_inbound_units":80,"shortage_after_units":100,"reason":"Illustrative reason"}],
  "warnings":[]
}
```

This output is illustrative; actual values come from the current database. If a solve fails, the failure is saved in `optimization_runs`; return a structured safe error with a run reference and no stack trace.

### `GET /api/v1/optimization-runs/latest` (authenticated, role-scoped)

Returns a projection of the latest saved run. Coordinator sees all transfers and unmet shortages. Hospital User sees only transfer rows where its own facility is source or destination and only unmet shortage rows for its own facility. Each hospital transfer line includes `direction: OUTGOING` if it is the source or `INCOMING` if it is the destination. That direction is computed by the backend for display; do not store it as a permanent hospital role.

Response shape:

```json
{
  "run":{"run_id":"<uuid>","status":"COMPLETED","trigger_source":"INVENTORY_UPDATE","planning_date":"2026-10-24","budget_minor_units":50000,"objective_policy":"PRIORITY_WEIGHTED_UNITS_THEN_COST","created_at":"2026-10-24T10:00:00Z","solver_status_stage_1":"OPTIMAL","solver_status_stage_2":"OPTIMAL"},
  "visibility_scope":"FACILITY",
  "facility_code":"H01",
  "summary":{"transfer_count":1,"recommended_units":80,"estimated_cost_minor_units":20400,"unmet_shortage_count":0,"unmet_shortage_units":0},
  "transfers":[{"source_facility_code":"H01","destination_facility_code":"H02","medicine_code":"MED1","source_batch_code":"B_H01_MED1_A","recommended_quantity_units":80,"estimated_cost_minor_units":20400,"transit_days":2,"status":"PENDING_REVIEW","direction":"OUTGOING"}],
  "unmet_shortages":[]
}
```

`visibility_scope` is `NETWORK` for Coordinator and `FACILITY` for Hospital User. For a Hospital User, summary totals are calculated from the visible transfer rows and visible unmet shortages only. For Coordinator, summary totals cover the global run. Before the first run, return `{"run":null,"visibility_scope":"FACILITY" or "NETWORK","facility_code":"H01" or null,"summary":{"transfer_count":0,"recommended_units":0,"estimated_cost_minor_units":0,"unmet_shortage_count":0,"unmet_shortage_units":0},"transfers":[],"unmet_shortages":[]}`.

### `GET /api/v1/optimization-runs/{run_id}` (authenticated, role-scoped)

Same response/filtering rules as latest, but for the specified run. If missing, return 404. A hospital must not obtain other facilities' unrelated private inventory from this endpoint; transfer rows can contain source/destination names because both parties need context for the proposed cross-facility transfer.

## 8. Optimizer request/response contracts

### Request: `OptimizationRequest`

```json
{
  "planning_date":"2026-10-24",
  "budget_minor_units":50000,
  "objective_policy":"PRIORITY_WEIGHTED_UNITS_THEN_COST",
  "facilities":[{"facility_code":"H01","name":"Central District Hospital","is_active":true}],
  "medicines":[{"medicine_code":"MED1","generic_name":"Paracetamol","strength":"500 mg","dosage_form":"tablet","base_unit":"tablet","is_active":true}],
  "inventory_batches":[{"batch_code":"B_H01_MED1_A","facility_code":"H01","medicine_code":"MED1","lot_number":"LOT-H01-MED1-A","expiry_date":"2027-06-30","quantity_on_hand_units":350,"quality_status":"ELIGIBLE"}],
  "facility_medicine_plans":[{"facility_code":"H01","medicine_code":"MED1","target_stock_units":200,"minimum_reserve_units":50,"avg_daily_demand_units":10,"priority_weight":1,"minimum_remaining_shelf_life_days":14}],
  "transport_routes":[{"route_code":"R_H01_H02","source_facility_code":"H01","destination_facility_code":"H02","transit_days":2,"cost_per_unit_minor_units":255,"route_capacity_units":120,"currency_code":"INR","is_active":true}]
}
```

Every list contains all relevant active network records for this run. The example contains only a subset to illustrate field names. Database adapter translates internal UUIDs to codes; Optimizer Engineer does not import SQLAlchemy.

### Required model behavior

- `FacilityInput`: facility code, name, active flag.
- `MedicineInput`: medicine code, generic name, strength, dosage form, base unit, active flag.
- `InventoryBatchInput`: batch code, facility code, medicine code, lot number, expiry date, on-hand units, quality status.
- `FacilityMedicinePlanInput`: facility code, medicine code, target, protected minimum reserve, average daily demand, priority weight (1-5), minimum remaining shelf-life days.
- `TransportRouteInput`: route code, source/destination codes, transit days, cost per unit in paise, shared route capacity units, currency code, active flag.
- `OptimizationRequest`: planning date, budget in paise, objective policy, lists of each above.

### `calculate_shortages(request) -> list[ShortageLine]`

A fast deterministic pre-check. Each `ShortageLine` contains `facility_code`, `medicine_code`, `usable_stock_units`, `target_stock_units`, `shortage_units`, and `priority_weight`. It uses the same stock-eligibility function as `optimize`, not a separate backend formula. For each facility/medicine, calculate eligible usable stock for its target policy and `shortage_units=max(0,target_stock_units-usable_stock_units)`. The pre-check does not prove that a donor or route exists; it only decides whether the network has a shortage worth solving. If shortage exists but no transfer is feasible, `optimize` returns unmet shortage rows.

### `calculate_surpluses(request) -> list[SurplusLine]`

A fast dashboard estimate that uses the same usable-stock helper. Each `SurplusLine` contains `facility_code`, `medicine_code`, `usable_stock_units`, `minimum_reserve_units`, `surplus_units`, and `priority_weight`. For this MVP, `surplus_units=max(0, usable_stock_units-max(target_stock_units, minimum_reserve_units))`. This is conservative potential stock above the effective protected level before destination-specific route, transit/expiry, shared capacity and budget checks; never display it as a guaranteed transferable quantity. The optimizer still decides whether a specific transfer is feasible.

### `OptimizationResult`

```json
{
  "planning_date":"2026-10-24",
  "objective_policy":"PRIORITY_WEIGHTED_UNITS_THEN_COST",
  "solver_status_stage_1":"OPTIMAL",
  "solver_status_stage_2":"OPTIMAL",
  "summary":{
    "transfer_count":1,
    "total_recommended_units":80,
    "total_cost_minor_units":20400,
    "initial_shortage_line_count":1,
    "unmet_shortage_line_count":1,
    "total_unmet_shortage_units":100,
    "priority_weighted_units_score":400
  },
  "transfers":[{
    "source_facility_code":"H01",
    "destination_facility_code":"H02",
    "medicine_code":"MED1",
    "source_batch_code":"B_H01_MED1_A",
    "recommended_quantity_units":80,
    "cost_per_unit_minor_units":255,
    "estimated_cost_minor_units":20400,
    "transit_days":2,
    "reason":"H02 has an eligible shortage; H01 can provide this quantity while preserving its reserve and the route/budget constraints.",
    "status":"PENDING_REVIEW"
  }],
  "unmet_shortages":[{
    "facility_code":"H02",
    "medicine_code":"MED1",
    "shortage_before_units":180,
    "recommended_inbound_units":80,
    "shortage_after_units":100,
    "reason":"Only 80 units were feasible under the current stock, route, expiry and budget constraints."
  }],
  "warnings":[]
}
```

The example is illustrative only; not a promise of output from the seed CSV. Transfer rows may split across multiple source batches. The result must aggregate shortages using the same recommended inbounds so `shortage_after_units = max(0, shortage_before_units - recommended_inbound_units)`.

## 9. Optimizer business rules

1. Only active facilities, active medicines, active routes and quality-`ELIGIBLE` batches are candidates.
2. No batch can be allocated more units than it contains.
3. Source can only transfer stock above `max(target_stock_units, minimum_reserve_units)` for the medicine across all its source batches. The effective protected level must remain after all proposals.
4. Destination recommendations for a medicine must not exceed its shortage.
5. A direct directed route must exist from source to destination. This MVP has no multi-hop route planning.
6. Route capacity is shared across all medicine transfer lines assigned to the route for the run: sum of quantities over that route <= route capacity.
7. For a candidate line, `expiry_date` must be at least `planning_date + transit_days + destination.minimum_remaining_shelf_life_days`.
8. Total sum of transfer quantity x per-unit route cost in paise <= `budget_minor_units`.
9. Quantity variables are whole positive units; never output zero/negative transfers.
10. Stage 1 maximizes `recommended_quantity_units * destination.priority_weight` across transfer lines. Stage 2 minimizes total cost while keeping the Stage 1 weighted score fixed at the proven best value. If stage 1 is only FEASIBLE, do not claim the global objective is optimal; stage 2 must not falsely promise a proof it cannot establish.
11. If the solve finds no feasible transfer, return an empty `transfers` list and detailed `unmet_shortages`; this is a valid result, not an API crash.
12. `optimize` is pure: it performs no DB/network/file IO and never changes input quantities.

## 10. Exact cross-role function signatures

### Database & Integration -> Backend

Use these as the planned interface. Return types can be Pydantic/SQLAlchemy objects, but field semantics must remain stable.

```python
list_active_signup_facilities(db: Session) -> list[SignupFacilityOption]
create_hospital_user(db: Session, full_name: str, email: str, password_hash: str, facility_code: str) -> User
get_user_by_email(db: Session, email: str) -> User | None
get_user_by_id(db: Session, user_id: UUID) -> User | None
list_inventory_batches(db: Session, facility_id: UUID | None, facility_code: str | None) -> list[InventoryBatchData]
create_inventory_batch(db: Session, facility_id: UUID, medicine_code: str, lot_number: str, expiry_date: date, quantity_on_hand_units: int, quality_status: str) -> tuple[InventoryBatchData, set[str]]
update_inventory_batch(db: Session, facility_id: UUID, batch_code: str, patch: dict) -> tuple[InventoryBatchData, set[str]]
get_medicines_for_user(db: Session, role: str, facility_id: UUID | None) -> list[MedicineData]
build_optimizer_request(db: Session, planning_date: date, budget_minor_units: int, objective_policy: str) -> tuple[OptimizationRequest, str]
create_optimization_run(db: Session, created_by_user_id: UUID, trigger_source: str, trigger_reason: str, planning_date: date, budget_minor_units: int, objective_policy: str, input_snapshot_hash: str) -> OptimizationRun
mark_run_completed(db: Session, run_id: UUID, result: OptimizationResult, input_summary: dict) -> OptimizationRun
mark_run_failed(db: Session, run_id: UUID, error_code: str) -> OptimizationRun
get_latest_run(db: Session) -> OptimizationRun | None
get_run_by_id(db: Session, run_id: UUID) -> OptimizationRun | None
```

`build_optimizer_request` canonicalizes the complete input and computes SHA-256 from the canonical JSON. It returns a request using business codes plus a stable hash. `create_inventory_batch`/`update_inventory_batch` commit the transaction and return only the set of fields whose stored values actually changed. If an inventory update service fails before commit, it raises and no trigger runs.

### Backend -> Optimizer

```python
calculate_shortages(request: OptimizationRequest) -> list[ShortageLine]
calculate_surpluses(request: OptimizationRequest) -> list[SurplusLine]
optimize(request: OptimizationRequest) -> OptimizationResult
```

Both are synchronous pure Python calls in this MVP. Backend creates/persists the run state and catches solver exceptions; it does not implement objective/constraint math.

## 11. Trigger algorithm (must match backend and tests)

After POST/PATCH inventory successfully commits:

1. If changed field set is empty, return `SKIPPED_UNCHANGED`.
2. Build one canonical network request with the current planning date, default/current budget and objective policy. `planning_date` for a trigger is server-configured/current local demo date or the saved default; define it in `settings.py` and use it consistently.
3. Run `calculate_shortages(request)` using the shared optimizer stock rules.
4. If there are no shortage lines with `shortage_units > 0`, return `SKIPPED_NO_NETWORK_SHORTAGE`.
5. If the newest completed run has the same `input_snapshot_hash`, return `SKIPPED_SNAPSHOT_ALREADY_ANALYZED`.
6. Otherwise create a run with `trigger_source=INVENTORY_UPDATE`, `trigger_reason=NETWORK_SHORTAGE_AND_NEW_SNAPSHOT`, call `optimize(request)` exactly once, and persist result or safe failure.
7. Return trigger decision and run ID/status. Inventory remains saved even when optimization fails.

`seed_demo.py`, signup/login, dashboard GET, inventory GET and recommendation GET do not trigger. Route/policy changes are seeded/configured only in this MVP and need a manual Coordinator run; no route/policy mutation endpoints are required.

## 12. Error response convention

Use the same safe shape for application errors:

```json
{"error":{"code":"BATCH_NOT_FOUND","message":"The requested batch was not found for this account."}}
```

Minimum status mapping: 401 bad/expired token or invalid credentials; 403 role lacks permission; 404 unknown or not-owned batch/run; 409 duplicate email or lot; 422 invalid field/rule; 500 unexpected internal failure. Do not leak SQL, password hashes, JWT, Python traceback or internal secrets. If only optimizer fails after inventory is committed, use the successful inventory response with `trigger.decision=FAILED` as described above.

## 13. Frontend page-to-API mapping

| Page | Main API calls | Required displayed fields |
|---|---|---|
| Signup | `GET /auth/signup-options`, `POST /auth/signup` | name, email, password, facility dropdown, join code, field errors |
| Login | `POST /auth/login` | email, password, safe error |
| App bootstrap | `GET /auth/me` | current user role and facility name/code |
| Hospital Dashboard | `GET /dashboard`, `GET /optimization-runs/latest` | own stock/shortage summary, latest run status, own transfer rows |
| Coordinator Dashboard | `GET /dashboard`, `GET /optimization-runs/latest` | ten-facility summary, shortages, global transfers/unmet shortages, run controls |
| Inventory | `GET /inventory`, `GET /catalog/medicines`, `POST/PATCH /inventory/batches` | medicine, lot, expiry, quantity, quality, trigger result |
| Recommendations | `GET /optimization-runs/latest` | source/destination, medicine, batch, quantity, estimated cost, transit days, status, unmet shortage |

Frontend four-layer architecture is specified in `FRONTEND_ENGINEER_GUIDE.md`.
