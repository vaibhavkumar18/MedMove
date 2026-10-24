# MedMove - Master Project Context

**Audience:** all four role owners and their coding agents  
**Delivery target:** four-day hackathon MVP  
**Purpose:** help a new teammate understand the product, their responsibility, the implementation order, the cross-module interfaces, and what counts as finished.

> Read this document and the shared contract before coding. The shared contract is the source of truth for API names, field names, types, response models, status values, and function signatures. Do not invent alternative names in a role's implementation.

## 1. Product in plain language

MedMove is a **network-wide medicine redistribution decision-support prototype**. It looks across a group of participating hospitals, detects medicine shortages and potentially transferable surplus, and suggests feasible transfers while considering stock protection, expiry, delivery time, route capacity, medicine priorities, and an overall budget.

Example: ten demo hospitals belong to the same fictional network. Hospital H02 has only 20 usable units of Medicine MED1 and its configured target is 200, so the initial target gap is 180 units. Hospital H01 may have eligible stock above its protected reserve. The optimizer checks whether H01 can send some units to H02 through an active directed route while keeping H01 above its reserve and meeting expiry/shelf-life and budget restrictions. It may recommend 80 units, or recommend less, or report the shortage as unmet if no valid transfer is possible.

MedMove does not buy stock, book vehicles, approve shipments, physically dispatch medicines, or deduct recommended quantities from inventory. A result is a **proposal for review**, not a completed transfer. All demo facilities, users, inventory and costs are fictional.

## 2. What the four-day MVP must demonstrate

The judge should be able to:

1. Open the React app and sign up as a hospital user by selecting one of the ten seeded demo facilities and entering the demo join code.
2. Log in again with that account. On refresh, the app restores the signed-in session using the demo JWT in `sessionStorage` and verifies it with `/auth/me`.
3. See a hospital-specific dashboard, inventory table, current shortage information, and incoming/outgoing recommendations involving that hospital only.
4. Change a batch quantity, expiry date, or quality status and press Save.
5. See the backend save the change first, then automatically evaluate the trigger conditions. If a network shortage exists and the input snapshot has changed, one network-wide optimization runs.
6. See the resulting saved recommendations filtered for the hospital account. A hospital may appear as a source on one transfer and a destination on another.
7. Log in as the seeded Network Coordinator, see the full ten-hospital network, view all proposed transfers and unmet shortages, and manually run the first or a subsequent optimization using a planning date and budget.
8. Understand from the status message whether a trigger ran, was skipped, or failed.

That full path matters more than implementing extra pages or production-grade infrastructure.

## 3. The three user concepts

### 3.1 Hospital User

A Hospital User is an authenticated user account linked to exactly one preconfigured facility. A user can sign up for an existing facility, sign in, inspect its inventory, create or update its batch records, view its shortage information, and see transfer rows where it is the source or destination.

Backend security rule: the account's facility is derived from the verified JWT and database user record. Inventory create/update requests must never trust a `facility_code` supplied by the browser. If Hospital H02 tries to edit an H01 batch, reject the request and do not modify data.

### 3.2 Network Coordinator

The Network Coordinator is a privileged seeded account. The Coordinator can view the entire network and manually trigger the first or a later optimization run. The Coordinator is not creatable by public signup. For the four-day demo there is no Coordinator approval workflow, dispatch tracking, or multi-step transfer acceptance process.

### 3.3 Source and destination are not user roles

The optimizer assigns source and destination **per proposed transfer** based on the current data. A hospital can send MED1 and receive MED2 in the same run. Do not add permanent `SOURCE_HOSPITAL` or `DESTINATION_HOSPITAL` account roles.

## 4. Agreed architecture

```text
Browser: React + TypeScript (Frontend Engineer)
  UI components/pages
       -> Hooks
       -> Redux Toolkit state/thunks
       -> API client (HTTP + bearer JWT)
                         |
                         | /api/v1 JSON requests
                         v
One FastAPI process (Backend Engineer)
  auth / dashboard / inventory / optimization feature routers
       -> feature services: validation, access rules, trigger decision, orchestration
       -> Database & Integration functions
       -> imported Python optimizer function `optimize(request)`
                         |                            |
                         v                            v
                 PostgreSQL tables            OR-Tools CP-SAT
                 and saved run results         (pure calculation package)
```

The optimizer is imported as a Python package into FastAPI. It is **not a separate server**. There is no Node.js backend, Redis, Celery, external optimizer microservice, continuous polling service or database trigger in this MVP. The application-level trigger runs synchronously after an inventory mutation is committed.

## 5. Role ownership and boundaries

### Optimizer Engineer owns `optimizer/`

Deliver a deterministic, pure calculation API:

- `calculate_shortages(request) -> list[ShortageLine]`
- `calculate_surpluses(request) -> list[SurplusLine]`
- `optimize(request) -> OptimizationResult`

It receives a complete validated snapshot using business codes such as `H01`, `MED1`, and `B_H01_MED1_A`. It does not query the database, read CSVs, call HTTP, or know about JWTs. It returns transfer proposals and shortages still unmet. It must not mutate input inventory.

### Backend Engineer owns `backend/app/features/`, `app/main.py`, and API/trigger tests

Own the API routes, Pydantic HTTP models, auth/role dependencies, trigger decision, orchestration and safe failure responses. The backend coordinates the database adapter and optimizer function but does not duplicate optimizer math or write competing SQL models.

### Database & Integration Engineer owns `backend/app/db/`, `app/integrations/optimizer_adapter.py`, `backend/scripts/`, seed data tests and `data/sample/`

Own the seven tables, SQLAlchemy models, database session, repositories, synthetic CSV import, seeded Coordinator account, hospital-user creation/lookups, facility scoping helpers, network snapshot mapping to optimizer business codes and result persistence. This role does not own FastAPI routes or optimization constraints.

### Frontend Engineer owns `frontend/`

Build React pages using the required four layers: **UI -> Hooks -> State -> API**. Implement signup/login, role-aware dashboards, inventory edits, trigger status messages, manual Coordinator runs and filtered recommendations. The frontend never calculates authoritative shortages, transfers or feasibility.

## 6. Exact workflow and why it is ordered this way

### A. First-time setup

1. Database & Integration Engineer creates the schema and runs `seed_demo.py`. The seed script imports ten facilities, medicines, plans, batches and routes from the CSVs. It also creates one Coordinator account with a password hash. The seed script is repeatable and must not duplicate rows each time it runs.
2. Hospital user opens Signup. The frontend requests `/auth/signup-options` to populate the list of existing demo facilities. User submits full name, email, password, selected facility code and the demo join code.
3. Backend validates the join code and selected active facility, hashes the password, always assigns role `HOSPITAL_USER`, and creates the account. The browser cannot submit a role or create a new facility.
4. Login or successful signup returns a JWT and safe user profile. React stores the token in `sessionStorage` for this demo and attaches it as `Authorization: Bearer <token>` on protected requests. On reload, React calls `/auth/me` to verify the token and learn the current role/facility.
5. A Hospital User sees only its own facility's inventory and relevant transfer rows. The Network Coordinator sees all facilities and the manual run control.
6. The Coordinator starts the first optimization with a planning date and budget. FastAPI builds the full network request from PostgreSQL, calls `optimize(request)` once, saves the result and returns it. The frontend renders the Coordinator's network result and each hospital's personalized view can fetch the same saved run through the role-filtered API.

### B. Inventory update and automatic trigger

1. A Hospital User changes quantity, expiry date or quality status for a batch belonging to its own facility.
2. React calls `PATCH /api/v1/inventory/batches/{batch_code}`. The body contains only mutable fields; it contains no facility ID.
3. FastAPI authenticates the JWT, derives the user's facility, validates ownership, and calls Database & Integration's update helper.
4. Database helper commits the inventory edit and reports which fields truly changed. **The inventory commit happens before optimization**, so the optimizer sees the newly saved state.
5. If no value changed, the trigger returns `SKIPPED_UNCHANGED` and does not call the optimizer.
6. If a real change occurred, backend builds the current optimizer request and calls `calculate_shortages(request)`, a cheap pure pre-check implemented by the Optimizer Engineer using the same stock rules. Dashboard summaries use both `calculate_shortages` and `calculate_surpluses`, avoiding conflicting stock formulas in the backend.
7. If no network shortage exists, return `SKIPPED_NO_NETWORK_SHORTAGE`. If a shortage exists but its canonical input snapshot hash matches the most recent completed run, return `SKIPPED_SNAPSHOT_ALREADY_ANALYZED`.
8. Otherwise, create a run record and call `optimize(request)` once for all ten participating facilities. This is the single network-wide optimization; there is not one run per hospital.
9. Save the run result, then respond to the inventory update request with `trigger.decision` and `optimization_run_id`. The frontend refreshes the dashboard and latest-run endpoint.
10. If optimization fails after the inventory save, the inventory remains saved. The API response explains that the update succeeded but optimization failed. The UI must not falsely state that optimization succeeded.

This is a synchronous application-level trigger for a small seed dataset. It blocks the update response while the optimization finishes. That is an intentional four-day simplification. It is not suitable for a production network or long-running solve; a durable job queue can be added later if required.

### C. What the dashboards show

- **Hospital User Dashboard:** own current stock and shortage summaries, latest optimization status, incoming transfers, outgoing transfers, quantity/cost/estimated transit time, source/destination names, review status, and unmet shortage for the user's facility.
- **Network Coordinator Dashboard:** facility list and shortage/surplus summaries for all ten facilities, latest run status, global proposed transfers, total estimated cost, and all unmet shortages. Coordinator can manually trigger optimization with planning date and budget.
- **Transfer rows:** all are `PENDING_REVIEW`. There is no button that changes stock or marks a physical transfer delivered in the MVP.

## 7. Business and technical rules

1. All demo facilities and medicine data are fictional and seeded; no real hospital integration is assumed.
2. Only active facilities appear in signup options.
3. Public signup always creates `HOSPITAL_USER`; it cannot set or choose `NETWORK_COORDINATOR`.
4. Coordinator credentials are seeded from backend environment configuration; never hardcode real secrets or print passwords to logs.
5. A user can view/edit only their linked hospital's inventory. The coordinator can view the network and run optimization, but does not edit batch stock in the MVP.
6. The optimizer uses integer whole-unit quantities. Monetary amounts are integer paise (minor units): `100` = Rs 1.00; `50000` = Rs 500.00. Never mix rupees and paise.
7. A batch is eligible only if quality status is `ELIGIBLE`, its expiry is after the planning/arrival shelf-life threshold, and the required active directed route exists.
8. Source stock must remain at or above `minimum_reserve_units` after proposals; a destination's recommendations cannot exceed its configured shortage; a route's shared capacity is enforced across all medicines; total transfer cost cannot exceed the run budget.
9. The objective is `PRIORITY_WEIGHTED_UNITS_THEN_COST`: first maximize priority-weighted units delivered, then minimize cost while preserving that best score. A FEASIBLE solver status must not be described as proven optimal.
10. Only changed inventory quantity/expiry/quality fields trigger the automatic check in the MVP. GET requests, page refresh, signup/login and seed imports do not trigger optimization.
11. The initial run is manual by the Coordinator. Later meaningful inventory mutations can auto-trigger a new run. A trigger checks for shortage first and skips an unchanged already-analysed snapshot.
12. A recommendation is not an inventory mutation. Never subtract proposed quantities from source stock or add them to destination stock before a separate future transfer workflow is implemented.
13. Every feature returns predictable loading, empty, skipped, failed or completed states. Do not hide solver or trigger failures.

## 8. Four-day implementation plan

### Day 1: Contract and skeleton

- All roles read the contract and agree not to rename fields.
- Database & Integration creates models/migrations and repeatable CSV seed.
- Optimizer Engineer implements schemas and shortage calculations first.
- Backend Engineer creates FastAPI app, auth endpoints/security skeleton and API models.
- Frontend Engineer creates route/layout/store/API layers and login/signup pages with mock API shapes.

### Day 2: Independent modules

- Optimizer Engineer implements candidate generation, OR-Tools constraints, objectives, result validation and tests.
- Database & Integration adds auth repositories, facility scoping, optimizer request mapper and run persistence.
- Backend Engineer implements dashboard/inventory/manual-run endpoints and trigger orchestration using temporary adapter stubs if necessary.
- Frontend Engineer adds hospital and Coordinator dashboard, inventory editing and recommendation cards using contract-shaped fixtures.

### Day 3: Integration

- Connect real database adapter to FastAPI and the pure optimizer package.
- Verify signup -> login -> own inventory -> update -> trigger -> saved run -> refreshed dashboard.
- Verify Coordinator login -> all-network dashboard -> manual run -> result.
- Fix contract mismatches before styling.

### Day 4: Stabilize and rehearse

- Start from clean database, run seed, log in with both roles, run full flow twice.
- Test invalid credentials, forbidden cross-hospital updates, invalid quantity, no-op update, no-shortage skip, budget infeasibility, expiring/quality-ineligible batch, missing route and optimizer error.
- Verify each recommendation appears as outgoing for its source and incoming for its destination.
- Freeze new features, prepare an honest demo narration and known-limitations note.

## 9. Definition of done

The MVP is ready only when all of these are true:

- `seed_demo.py` can be rerun without duplicating seed rows.
- A hospital user can sign up for an existing facility and log in after logout/reload.
- The Coordinator account is seeded and cannot be created through public signup.
- Hospital A cannot read or modify Hospital B's private inventory endpoint by changing a URL or request body.
- The Coordinator sees ten facilities and can execute a network-wide run.
- An inventory change is committed before the trigger executes.
- A no-op edit does not call the optimizer.
- A meaningful edit plus a network shortage triggers at most one solve for the current snapshot.
- Recommendations use the common contract and display the same quantities on the source and destination views.
- An unmet shortage is shown if constraints prevent full coverage.
- No recommendation silently changes physical stock.
- Backend, optimizer and frontend smoke tests pass; setup instructions work from a clean checkout.

## 10. Deliberately out of scope

Do not add multi-tenant production hardening, email verification, password reset, OAuth, refresh-token rotation, new-facility onboarding, user invitations, coordinator approval workflows, transfer dispatch/receipt, notifications/email/SMS, mobile app, continuous polling, Celery/Redis, optimizer microservice, ML predictions, AI chat, real clinical guidance or route APIs. Those are future ideas, not four-day deliverables.
