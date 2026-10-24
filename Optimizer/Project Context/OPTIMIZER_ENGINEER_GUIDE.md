# Optimizer Engineer - Detailed Implementation Guide

## 0. Your responsibility in one sentence

Build the mathematical decision engine that receives a complete network snapshot and returns feasible, explainable medicine-transfer proposals. It must not depend on FastAPI, PostgreSQL, browser state, or CSV files.

Read first: `00_MASTER_PROJECT_CONTEXT.md` and `contracts/01_SHARED_API_AND_DATA_CONTRACT.md`. The contract is authoritative.

## 1. What you are building, in beginner terms

Imagine the system has ten hospitals. Some have less of a medicine than their target. Some may have stock above their protected reserve. You must calculate a set of transfers that helps shortage hospitals without violating the source's reserve, using in-date eligible batches, staying within direct routes, respecting shared route capacities and not spending more than the Coordinator's budget.

The optimizer's job is not to decide whether an actual transfer is approved. Every proposed line is `PENDING_REVIEW`. It must not deduct quantities from inventory or mutate the request.

The optimizer is called by the Backend Engineer after the Database & Integration Engineer has converted database records into the canonical `OptimizationRequest`. Your input uses business codes (`H01`, `MED1`, `B_H01_MED1_A`), never SQL UUIDs.

## 2. Folder structure you own

```text
optimizer/
  medmove_optimizer/
    __init__.py          # public exports: calculate_shortages, optimize
    schemas.py           # Pydantic request and result models
    stock.py             # single source of truth for eligibility and shortage calculations
    candidates.py        # valid donor-batch / route / recipient candidates
    objectives.py        # priority-weighted units and cost objective helpers
    model.py             # OR-Tools CP-SAT variables and constraints
    validation.py        # independent result consistency checks
    service.py           # public pure functions and stage 1 -> stage 2 sequence
  tests/
    conftest.py
    test_schemas.py
    test_stock.py
    test_candidates.py
    test_model.py
    test_validation.py
    test_service.py
  requirements.txt
```

Do not create API routes, SQLAlchemy files, `.env` settings, React components or CSV loading under `optimizer/`.

## 3. Public interface - implement these first

```python
calculate_shortages(request: OptimizationRequest) -> list[ShortageLine]
calculate_surpluses(request: OptimizationRequest) -> list[SurplusLine]
optimize(request: OptimizationRequest) -> OptimizationResult
```

All three functions must be synchronous and deterministic for the same input. They perform only in-memory calculation. They must not read files, connect to PostgreSQL, call HTTP, use global mutable state, or change any input quantity.

`calculate_shortages` is used by the Backend Engineer for a cheap trigger pre-check and for dashboard shortage totals. `calculate_surpluses` provides a potential-surplus dashboard estimate. Both must use exactly the same batch/stock eligibility helper as `optimize`, so the trigger/dashboard does not operate on a different stock definition.

`optimize` takes the full request and returns the complete result shape in the shared contract, including:

- planning date and objective policy;
- stage 1 and stage 2 solver statuses;
- total transfers, recommended units, estimated cost in paise;
- each proposed transfer with source, destination, medicine and source batch codes;
- unmet shortages before and after recommended inbound units;
- warnings for any solver limitation, if appropriate.

## 4. Build in this exact phase order

### Phase 1 - Schemas and units

Implement all input/output Pydantic models listed in the shared contract. Use `extra="forbid"` where supported. Validate all list references and nonnegative quantities. Validate priority weight is between 1 and 5 and supported enum values are exact.

Fields to be especially careful about:

- `quantity_on_hand_units`: current batch stock as whole units.
- `target_stock_units`: desired usable stock at a facility for one medicine.
- `minimum_reserve_units`: source reserve that may not be transferred away.
- `minimum_remaining_shelf_life_days`: receiver's minimum shelf-life buffer.
- `cost_per_unit_minor_units`: per-unit route price in **paise**.
- `budget_minor_units`: total budget in **paise**.
- `route_capacity_units`: combined maximum units across all medicine transfers on that directed route for one solve.

Write schema tests before writing the solver. Include `100` paise = Rs 1.00 examples so no-one multiplies costs by 100 twice.

### Phase 2 - Stock calculations (`stock.py`)

Implement small, well-tested functions. Recommended responsibilities:

1. Filter batches by facility/medicine.
2. Determine if a batch can contribute to usable stock for a facility at planning date and its shelf-life policy.
3. Compute usable on-hand stock per facility/medicine.
4. Compute initial shortage: `max(0, target_stock_units - usable_stock_units)`.
5. Compute maximum stock above the effective protected source level for dashboard estimates and candidate generation. The effective protected level is `max(target_stock_units, minimum_reserve_units)`.
6. Compute remaining shortage after proposed inbound units.

Eligibility rules:

- facility and medicine must be active;
- batch `quality_status` must equal `ELIGIBLE`;
- batch cannot be expired for the relevant planning/arrival time;
- for a candidate transfer, `expiry_date >= planning_date + route.transit_days + destination_plan.minimum_remaining_shelf_life_days`;
- ineligible/recalled/quarantined/damaged batches cannot be candidates;
- source protected reserve must still remain after all transfers across its eligible batches.

Be explicit about date arithmetic. A source batch may be eligible for one destination route and not another because transit duration and destination shelf-life buffer differ. Candidate eligibility should be evaluated per source batch + route + destination plan.

`calculate_shortages(request)` should calculate whether a target gap exists using the same quality/expiry stock helper. `calculate_surpluses(request)` should report `max(0, usable_stock_units - max(target_stock_units, minimum_reserve_units))` for each plan as a conservative pre-route estimate. A facility below target must not donate that medicine, even when its usable stock exceeds the minimum reserve. Neither function proves that a pairwise transfer is possible. A shortage can exist even if no donor/route can cover it; the full solve then reports unmet shortage.

### Phase 3 - Candidate generation (`candidates.py`)

Generate possible transfer variables only when all of these are true:

- source and destination are different and active;
- same medicine is configured in both facilities;
- initial destination shortage for that medicine is positive;
- source has potentially transferable stock above `max(target_stock_units, minimum_reserve_units)`;
- an active directed route exists from source to destination;
- the batch is quality eligible and meets arrival shelf-life conditions;
- route capacity is positive and per-unit cost is valid.

Do not invent routes. A transfer can only use an explicit active direct route. No multi-hop routing is required for the MVP. Keep the candidate record explicit: route code, source batch code, source facility code, destination facility code, medicine code, per-unit paise cost, transit days, route capacity.

### Phase 4 - CP-SAT model (`model.py`)

Use integer decision variables representing units transferred for each candidate. Avoid floating-point quantities or costs.

Required hard constraints:

1. **Batch availability:** sum of quantities allocated from one batch to any destination cannot exceed the batch quantity.
2. **Protected source stock:** for each source facility/medicine, total transfer from all its batches cannot leave the source below `max(target_stock_units, minimum_reserve_units)`. Count eligible usable on-hand stock correctly and ensure a source below target cannot donate that medicine.
3. **Destination shortage cap:** inbound quantity for a facility/medicine cannot exceed its shortage before this run.
4. **Directed routes:** each variable references one active explicit source-to-destination route.
5. **Shared route capacity:** sum of all unit quantities assigned to the route, across every medicine, must be <= `route_capacity_units`.
6. **Budget:** sum of quantity x `cost_per_unit_minor_units` must be <= `budget_minor_units`.
7. **Integer/nonnegative:** quantities are integers >= 0; only positive transfer lines are emitted.
8. **Expiry/quality:** only pre-generated eligible candidates can have decision variables.

Avoid double-counting the same physical batch across multiple candidate choices. Batch availability is one shared constraint over every candidate referring to that batch.

### Phase 5 - Objective (`objectives.py` and `service.py`)

The agreed policy is `PRIORITY_WEIGHTED_UNITS_THEN_COST`, implemented as two stages:

- **Stage 1:** maximize `sum(quantity * destination.priority_weight)` across transfers.
- If Stage 1 has a proven optimum, add a constraint fixing that best weighted score and **Stage 2** minimizes total cost.
- If Stage 1 only returns `FEASIBLE`, do not claim it is globally optimal. Do not freeze an unproven score and label the final result optimal. Return solver statuses/warnings honestly; if the stage 2 logic cannot preserve a proven score, either skip stage 2 or label its limited meaning clearly.
- If Stage 1 returns `INFEASIBLE`/`MODEL_INVALID` or another terminal failure, return a safe, validated result or raise a domain exception that the backend persists as a failed run. Do not produce fabricated transfers.

Do not add undocumented multi-objective weights or silently switch the objective. The budget is a hard constraint, not just a soft cost preference.

### Phase 6 - Results and validation

For each positive transfer variable, emit:

- `source_facility_code`
- `destination_facility_code`
- `medicine_code`
- `source_batch_code`
- `recommended_quantity_units`
- `cost_per_unit_minor_units`
- `estimated_cost_minor_units`
- `transit_days`
- short, truthful `reason`
- `status = PENDING_REVIEW`

For each initial shortage line, calculate:

`recommended_inbound_units = sum(inbound proposed transfer quantities for that facility/medicine)`

`shortage_after_units = max(0, shortage_before_units - recommended_inbound_units)`

If after is positive, emit an unmet-shortage row with a clear explanation. Avoid promising exactly why a particular line was not covered if the model did not capture a specific constraint reason; general accurate reasons are fine, e.g. "Not all shortage could be covered within current stock, route, expiry and budget limits."

`validation.py` must independently verify output invariants after solving:

- no zero/negative transfer rows;
- total transfer cost equals sum of line costs;
- total cost <= budget;
- no source batch over-allocated;
- no destination shortage overfilled;
- no route capacity exceeded;
- source protected reserve preserved;
- no ineligible/expired batch used;
- shortages before/inbound/after are arithmetically consistent.

Never return solver output until validation passes. If it fails, raise a clear optimizer-domain error and let the backend mark the run failed.

## 5. File-by-file responsibility

| File | Purpose |
|---|---|
| `schemas.py` | Canonical typed request/result; no DB or API |
| `stock.py` | Shared eligibility, stock, shortage and reserve calculation |
| `candidates.py` | Translate business rules into candidate transfer choices |
| `objectives.py` | Build transparent score and cost expressions |
| `model.py` | CP-SAT variables and hard constraints |
| `validation.py` | Independent guardrails on returned results |
| `service.py` | `calculate_shortages`, two-stage solve, response assembly |
| `__init__.py` | Export only the supported public functions |
| `tests/` | prove core rules and edge cases |

## 6. Required test cases

At minimum test:

1. Basic case: one donor, one shortage, one valid route; recommendation is positive and within limits.
2. No shortage: `calculate_shortages` is empty and optimization returns no transfers.
3. No donor surplus after reserve: no source reserve violation; destination shortage remains unmet.
4. Batch expired before arrival/shelf-life buffer: batch not selected.
5. Quarantined/recalled/damaged batch: never selected.
6. Missing/inactive route: no transfer on that pair.
7. Shared route capacity: total quantity over all medicines on route does not exceed capacity.
8. Budget too small: total cost never exceeds budget; shortage can remain unmet.
9. Destination target gap limits inbound quantity.
10. Same batch candidate to multiple hospitals cannot over-allocate the batch.
11. Priority stage: higher-weight destination is favored when hard constraints and objective tradeoffs allow it.
12. Stage status accuracy: FEASIBLE is never mislabeled as proven OPTIMAL.
13. Empty candidate set is a valid result with unmet shortages, not a crash.
14. Output arithmetic and result validator.
15. Inputs are unchanged after both public functions run.

Use small hand-authored fixtures in optimizer tests; do not make unit tests dependent on PostgreSQL or the sample CSV directory.

## 7. Integration handoff

The Backend Engineer imports exactly:

```python
from medmove_optimizer import calculate_shortages, calculate_surpluses, optimize
```

The Database & Integration Engineer builds `OptimizationRequest` using the contract's business codes and returns a canonical snapshot hash. Do not rename the fields for convenience. The optimizer should be testable using an in-memory Pydantic request before the real DB adapter exists.

Handoff checklist:

- all schemas match the contract;
- public imports work;
- all tests pass;
- one fixture demonstrates a sensible transfer;
- no invalid batch/route/reserve/budget case breaks constraints;
- output contains unmet shortage rows when necessary;
- a FEASIBLE solver status is reported honestly;
- no file/DB/network dependency exists in the optimizer package.

## 8. Four-day focus

- Day 1: schemas, stock rules, small tests.
- Day 2: candidate generation, CP-SAT constraints, objective stages.
- Day 3: adapter/backend integration and full scenario test.
- Day 4: edge cases, validation, demo stability. Do not add new optimization features.
