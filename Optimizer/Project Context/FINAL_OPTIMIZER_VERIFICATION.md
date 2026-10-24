# MedMove Optimizer Final Verification

**Verification date:** 2026-10-24  
**Scope:** optimizer package and standalone CSV demonstration only  
**Excluded:** database, backend, authentication, FastAPI, frontend, and adapter implementation

## Executive result

The existing optimizer passes the optimizer-only test suite and the actual
sample-data demonstration. No optimizer production defect was found, so no
optimizer implementation changes were made during this audit.

The verified public interface remains:

```python
from medmove_optimizer import optimize

result = optimize(request)
```

Exact signature:

```python
optimize(request: OptimizationRequest) -> OptimizationResult
```

## Files inspected

- `medmove_optimizer/__init__.py`
- `medmove_optimizer/schemas.py`
- `medmove_optimizer/stock.py`
- `medmove_optimizer/candidates.py`
- `medmove_optimizer/objectives.py`
- `medmove_optimizer/model.py`
- `medmove_optimizer/validation.py`
- `medmove_optimizer/service.py`
- `scripts/run_optimizer_demo.py`
- `scripts/load_sample_csv.py`
- `tests/conftest.py`
- `tests/test_schemas.py`
- `tests/test_stock.py`
- `tests/test_candidates.py`
- `tests/test_model.py`
- `tests/test_validation.py`
- `tests/test_service.py`
- All five files in `data/sample/`
- `requirements.txt`
- `Project Context/00_MASTER_PROJECT_CONTEXT.md`
- `Project Context/01_SHARED_API_AND_DATA_CONTRACT.md`
- `Project Context/OPTIMIZER_ENGINEER_GUIDE.md`

The database/integration files currently present in the workspace were not
modified for this audit.

## Architecture verified

1. `scripts/run_optimizer_demo.py` reads the five sample CSV files with
   `utf-8-sig`, validates required headers, and converts text into dates,
   integers, decimals, booleans, and enums.
2. Pydantic constructs and validates `OptimizationRequest`.
3. `medmove_optimizer.service.optimize` calculates shortages and candidates.
4. `model.py` solves the candidate allocation in two CP-SAT stages.
5. `service.py` converts positive solver decisions into recommendations and
   unmet-shortage records.
6. `validation.py` checks references, ownership, shelf life, source
   protection, route capacity, budget, and result arithmetic.
7. The demo prints the returned `OptimizationResult`; it does not fabricate
   recommendations or mutate inventory.

## Verification status

| Area | Verification performed | Result | Evidence | Remaining issue |
|---|---|---|---|---|
| Public API | Imported `optimize` and inspected its signature | PASS | `optimize(request: OptimizationRequest) -> OptimizationResult` | None found |
| CSV parsing | Ran the real demo against all five CSVs | PASS | Demo completed and returned recommendations | `scripts/load_sample_csv.py` is empty; the active loader is the demo/fixture mapping |
| Request validation | Existing schema tests cover uniqueness, references, enums, and invalid data | PASS | Included in 33 optimizer tests | No exhaustive fuzz testing |
| Conservative donor policy | Checked stock, candidates, model, validation, and tests | PASS | H06/MED3 regression and source-protection assertions | None found |
| Below-target donor | Verified 70 usable, target 80, reserve 20 gives zero transferable units | PASS | `test_stock.py`, `test_candidates.py`, sample result has no H06/MED3 outgoing line | None found |
| Above-target donor | Verified 500 usable, target 300, reserve 200 gives at most 200 transferable units | PASS | Stock policy tests and source-protection model/validation tests | None found |
| Batch eligibility | Checked quality, expiry, facility, medicine, and shelf-life behavior | PASS | Stock/candidate tests plus independent sample assertions | No property-based test suite |
| Directed routes | Checked source/destination direction and route references | PASS | Candidate/model/validation tests and independent sample assertions | None found |
| Destination shortage | Checked inbound quantity does not exceed shortage | PASS | Model tests, validation, and independent sample assertions | None found |
| Shared route capacity | Checked route capacity is shared across medicines | PASS | `test_model.py` and independent sample assertions | None found |
| Budget | Checked total paise cost stays within budget | PASS | Known-answer test, model tests, validation, and sample assertions | None found |
| Two-stage objective | Checked priority score is preserved and cost is secondary | PASS | Model/service tests and both statuses returned as `OPTIMAL` | No separate solver-timeout integration test |
| Solver semantics | Checked status propagation and `optimality_proven` behavior | PASS | Service/model tests cover empty candidates and invalid/nonoptimal statuses | Exact wall-clock timing is environment-dependent |
| Result arithmetic | Checked recommendation costs, summary count, budget remaining, score, and shortage arithmetic | PASS | Pydantic validators, validation tests, independent assertions | None found |
| Input immutability | Checked inventory objects remain unchanged | PASS | Service test and independent sample workflow | None found |
| Failure handling | Checked empty candidates, no recommendations, invalid requests, and unmet shortages | PASS | Service/schema tests | No real solver process failure injection |
| Database/backend scope | Explicitly excluded from this audit | NOT TESTED | Required by the attached optimizer-only task | Must be verified separately by integration owner |

## Baseline and final test results

Optimizer-only command:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests\test_stock.py tests\test_candidates.py tests\test_model.py tests\test_schemas.py tests\test_service.py tests\test_validation.py
```

Actual result:

```text
33 passed in 0.82s
```

The workspace also contains a separate database integration test. Therefore,
running the broad command currently reports 34 tests, but the 33-test command
above is the relevant optimizer-only result for this audit.

## Deterministic known-answer test

The existing `tests/test_service.py` contains a real public-interface test
using `optimize(request)`. It uses:

| Input | Value |
|---|---:|
| Source usable stock | 500 |
| Source target | 300 |
| Source minimum reserve | 200 |
| Destination usable stock | 20 |
| Destination target | 200 |
| Destination priority | 5 |
| Route capacity | 100 |
| Unit cost | 200 paise |
| Budget | 15,000 paise |

Expected and verified result:

| Metric | Result |
|---|---:|
| Transferable surplus | 200 units |
| Destination shortage before | 180 units |
| Route limit | 100 units |
| Budget-limited quantity | 75 units |
| Optimal transfer | 75 units |
| Total cost | 15,000 paise |
| Remaining shortage | 105 units |
| Remaining budget | 0 paise |

This answer is asserted in the test and is not hardcoded into production code.

## Independent sample-result assertions

In addition to the optimizer's own `validate_result` function, an independent
one-off assertion script checked every returned recommendation for:

- Different source and destination facilities.
- Source batch ownership and medicine ownership.
- Directed route ownership.
- Expected arrival date.
- Expiry and minimum remaining shelf life.
- Positive integer quantity.
- Recommendation cost multiplication.
- Conservative source protection:
  `usable_before - outgoing >= max(target, minimum_reserve)`.
- Destination incoming quantity no greater than initial shortage.
- Shared route capacity across all medicines.
- Total cost within budget.
- Summary cost arithmetic.
- Positive remaining shortage for every emitted unmet record.
- Both solver stages `OPTIMAL`.
- `optimality_proven is True`.

Actual assertion output:

```text
explicit constraint assertions passed
[
  ('H06', 'H02', 'MED2', 'B_H06_MED2_A', 60, 11100),
  ('H06', 'H02', 'MED4', 'B_H06_MED4_A', 15, 2775),
  ('H06', 'H05', 'MED4', 'B_H06_MED4_A', 20, 4000)
]
25 1660
```

## Actual sample demonstration

Command:

```powershell
.\.venv\Scripts\python.exe scripts\run_optimizer_demo.py
```

Verified run summary:

| Metric | Actual value |
|---|---|
| Run status | `COMPLETED` |
| Stage 1 | `OPTIMAL` |
| Stage 2 | `OPTIMAL` |
| Optimality proven | `True` |
| Recommendations | 3 |
| Estimated cost | 17,875 paise / INR 178.75 |
| Original budget | 18,000 paise / INR 180.00 |
| Remaining budget | 125 paise / INR 1.25 |
| Unmet-shortage records | 25 |
| Total remaining shortage units | 1,660 |
| Warnings | One unmet-shortage warning |

### Recommendations

| Source | Destination | Medicine | Batch | Route | Quantity | Unit cost | Total cost | Arrival |
|---|---|---|---|---|---:|---:|---:|---|
| H06 - Regional Medical Centre | H02 - City Hospital | MED2 - Oral Rehydration Salts | `B_H06_MED2_A` | `R_H06_H02` | 60 | 185 paise | 11,100 paise | 2026-10-25 |
| H06 - Regional Medical Centre | H02 - City Hospital | MED4 - Zinc Sulphate | `B_H06_MED4_A` | `R_H06_H02` | 15 | 185 paise | 2,775 paise | 2026-10-25 |
| H06 - Regional Medical Centre | H05 - East Community Health Centre | MED4 - Zinc Sulphate | `B_H06_MED4_A` | `R_H06_H05` | 20 | 200 paise | 4,000 paise | 2026-10-25 |

All three recommendations have explanation code
`PRIORITY_WEIGHTED_SHORTAGE_REDUCTION` and destination priority weight 5.

### Unmet shortages

The result contains 25 unmet-shortage records. They represent shortage lines,
not units. Their `shortage_after_units` values sum to 1,660 units. The demo
emits only records with a positive remaining shortage. The warning is therefore
consistent with the result contract.

The remaining shortages are explained by the actual model inputs and
constraints: most shortage lines have no eligible transferable source batch
that satisfies the conservative donor policy, directed route, expiry,
destination shelf-life, route capacity, and budget constraints. The three
selected recommendations consume 17,875 of the 18,000 paise budget and the
model cannot add another positive-cost transfer within the budget. The result
does not claim a per-line reason, so no more specific reason is invented here.

H06/MED3 remains a shortage line, but it is not a donor: its usable stock is
70, target is 80, and effective protected level is 80. Its transferable
surplus is zero.

## Defects and changes

No optimizer defect was confirmed during this audit. No files under
`medmove_optimizer/`, `tests/`, or `data/sample/` were changed for this audit.
The deterministic known-answer test, conservative donor tests, result
validation, and sample demo were already present and passed.

The only new file for this audit is this report.

## Remaining limitations

- The optimizer does not provide a structured per-unmet-shortage reason field;
  current reasons are represented only by aggregate warnings.
- The demo and fixture loaders contain the CSV mapping logic; the separate
  `scripts/load_sample_csv.py` file is empty.
- No property-based or fuzz testing was added.
- No real-time or production solver performance guarantee is made; solve time
  depends on hardware and CP-SAT search.
- Database, backend, authentication, API, and frontend behavior are outside
  this optimizer-only verification and are marked `NOT TESTED` above.

