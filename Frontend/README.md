MedMove Frontend & Backend API Contract
React + TypeScript + Vite frontend for the MedMove hackathon MVP. This
document is the integration handover for the backend engineer. It
describes the endpoints the frontend expects, permissions, payloads,
response fields, trigger behavior, and local setup.
Contract rule: Keep endpoint paths, JSON keys, and enum values
consistent across frontend and backend. Where a response example is
marked illustrative, return the same information with the agreed
names. Do not expose secrets to the browser.

Contents
1. Requirements and local setup
2. Architecture
3. Environment configuration
4. API conventions
5. Authentication and roles
6. Endpoint summary
7. Endpoint specifications
8. Inventory trigger contract
9. Optimization and transfer rules
10. Frontend integration behavior
11. Errors and status codes
12. Security and data rules
13. Backend implementation
    checklist
14. Frontend test checklist
Requirements and local setup
- Node.js 20+ recommended
- npm
- Backend API running locally
npm install
cp .env.example .env
npm run dev
Vite normally runs at http://localhost:5173.
Architecture
React UI
  -> Hooks
    -> Redux Toolkit slices / async thunks
      -> typed API modules
        -> Axios HTTP client
          -> Backend API (/api/v1)
            -> PostgreSQL / persistence
            -> optimization service
Frontend folders:
- src/pages/ --- routes/screens
- src/components/ --- shared interface components
- src/hooks/ --- page-friendly hooks
- src/store/ --- Redux slices and async thunks
- src/api/ --- typed HTTP calls
- src/types/contracts.ts --- shared request/response types
- src/utils/ --- dates, money and error helpers
Pages must not call Axios directly. They use hooks, which dispatch
thunks and call the API modules.
Environment configuration
Create .env in the frontend root, next to package.json:
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_API_BASE_URL is the API root and includes /api/v1. The
Axios client appends endpoint paths such as /auth/login.

Only public configuration belongs in VITE_* variables. Never put
DATABASE_URL, JWT signing secrets, Coordinator credentials, or the
hospital join-code secret in the frontend.

Restart Vite after editing .env:
# Stop the current server with Ctrl+C, then:
npm run dev
API conventions
- Base URL example: http://localhost:8000/api/v1
- Request/response format: JSON, except if the backend explicitly
  defines a different format for login.
- Authenticated calls send Authorization: Bearer <access_token>.
- Frontend timeout: 15 seconds.
- Date values should use ISO 8601 dates (YYYY-MM-DD) unless a
  timestamp is specifically required.
- Database primary keys are UUIDs; business identifiers such as
  facility codes (H01) and medicine codes (MED1) are separate.
- Money is stored/transmitted in paise (integer minor units).
  Convert to rupees only for display. Example: 20400 paise displays
  as ₹204.00; a budget input of ₹500.00 sends
  budget_minor_units: 50000.
- Do not send the entire network inventory from the browser to the
  optimizer. The backend loads the current trusted inventory snapshot
  from the database.
Authentication and roles
Roles
- HOSPITAL_USER --- can view their own facility data, manage their
  own inventory batches, and view transfers involving their facility.
- NETWORK_COORDINATOR --- can view network-wide summaries and
  transfers, and launch manual optimization runs. The Coordinator
  account is provisioned separately; there is no Coordinator signup
  screen.
The backend must enforce permissions on every endpoint. Hiding a button
in React is not security.
Token/session behavior
- Successful signup/login returns an access token and a safe user
  profile.
- Frontend stores the token in sessionStorage under
  medmove_access_token for this demo.
- Authenticated API calls send Authorization: Bearer <token>.
- On app startup, frontend calls GET /auth/me to restore the current
  identity.
- Logout clears the token and user state.
- For an unauthorized (401) response on protected endpoints,
  frontend clears the token and redirects the user to sign in.
- Login, signup and session-restore requests should be allowed to
  return their own 401 errors without triggering the global
  unauthorized redirect.
Safe user profile
The profile should contain enough information to render the role-aware
UI without secrets. Expected conceptual fields:
{
  "id": "UUID",
  "name": "Example User",
  "email": "user@hospital.org",
  "role": "HOSPITAL_USER",
  "facility": {
    "id": "UUID",
    "code": "H02",
    "name": "Example Hospital"
  }
}
For a Network Coordinator, facility may be null if the account is
network-scoped. Do not return password hashes, join codes, tokens
belonging to other users, or secret configuration. Confirm field names
against src/types/contracts.ts before implementation.
Endpoint summary
All paths below are relative to /api/v1.
  Method            Endpoint                            Access            Purpose
  GET             /auth/signup-options              Public            List active
                                                                          signup
                                                                          facilities; never
                                                                          return join code

  POST            /auth/signup                      Public            Create a Hospital
                                                                          User linked to an
                                                                          existing facility

  POST            /auth/login                       Public            Verify
                                                                          credentials and
                                                                          return
                                                                          token/profile

  GET             /auth/me                          Authenticated     Return the
                                                                          current safe user
                                                                          profile

  GET             /dashboard                        Authenticated     Role-scoped
                                                                          dashboard
                                                                          summaries and
                                                                          shortage rows;
                                                                          does not optimize

  GET             /inventory                        Authenticated     List inventory
                                                                          visible to the
                                                                          current role; no
                                                                          optimization
                                                                          trigger

  GET             /catalog/medicines                Authenticated     List active
                                                                          medicines
                                                                          available to the
                                                                          current
                                                                          user/facility

  POST            /inventory/batches                Hospital User     Create a batch
                                                                          for the signed-in
                                                                          user's facility;
                                                                          commit then
                                                                          evaluate trigger

  PATCH           /inventory/batches/{batch_code}   Hospital User     Update allowed
                                                                          fields of an
                                                                          owned batch;
                                                                          commit then
                                                                          evaluate trigger

  POST            /optimization-runs                Network           Run optimization
                                                        Coordinator       manually using
                                                                          date, budget and
                                                                          objective policy

  GET             /optimization-runs/latest         Authenticated     Read latest saved
                                                                          run with
                                                                          role-based
                                                                          transfer
                                                                          filtering

  GET             /optimization-runs/{run_id}       Authenticated     Read a specific
                                                                          saved run with
                                                                          role-based
                                                                          transfer
                                                                      filtering
Do not add undocumented endpoints by assumption. If the backend requires
health-check, logout, pagination or facility-specific routes, agree on
those explicitly and update this contract.
Endpoint specifications
1. GET /auth/signup-options
Access: Public.
Purpose: Populate the hospital/facility dropdown on signup.

Example response:
{
  "facilities": [
    {
      "id": "UUID",
      "facility_code": "H02",
      "name": "Example Hospital",
      "location": "Lucknow"
    }
  ]
}
- Return active facilities only.
- Do not return the join code or any secret.
- Frontend displays the facility name and may show the facility code.
- The exact outer response key should match the frontend contract. If
  src/types/contracts.ts defines a different key, use that key
  consistently.
2. POST /auth/signup
Access: Public. Creates only a HOSPITAL_USER.

Expected request fields:
{
  "name": "Example User",
  "email": "user@hospital.org",
  "password": "user-entered-password",
  "facility_code": "H02",
  "join_code": "user-entered-demo-code"
}
The frontend signup form collects full name, work email, password,
existing facility and demo join code. Confirm exact key names against
src/types/contracts.ts and src/api/authApi.ts.

Successful response should return the access token and safe profile,
using the same shape as login:
{
  "access_token": "JWT",
  "token_type": "bearer",
  "user": {
    "id": "UUID",
    "name": "Example User",
    "email": "user@hospital.org",
    "role": "HOSPITAL_USER",
    "facility": {
      "id": "UUID",
      "code": "H02",
      "name": "Example Hospital"
    }
  }
}
Expected errors include invalid email, weak/short password, duplicate
email, invalid join code, inactive/unknown facility, or missing fields.
Never accept a role from the public signup payload; derive it on the
server.
3. POST /auth/login
Access: Public.

Request:
{
  "email": "user@hospital.org",
  "password": "user-entered-password"
}
Successful response: access token and safe profile, same shape as
signup. The returned role determines the destination route:
- HOSPITAL_USER → /dashboard
- NETWORK_COORDINATOR → /network
On invalid credentials, use a generic message that does not reveal
whether the email exists.
4. GET /auth/me
Access: Authenticated.

Header:
Authorization: Bearer <access_token>
Returns the current user's safe profile in the same shape as the user
object from login. Return 401 if the token is missing, invalid or
expired.
5. GET /dashboard
Access: Authenticated.

Purpose: Return summary data for the current role. This endpoint does
not run optimization.
- Hospital User: only their own facility's metrics, shortage rows,
  recent run/trigger status and related summary data.
- Network Coordinator: network-wide active facility count,
  shortage/surplus summary, facility rows, latest run summary and
  network-level unmet shortage data.
The frontend expects the contract-defined DashboardResponse. Use
src/types/contracts.ts as the field-name source of truth. Do not
return other hospitals' private data to a Hospital User and rely on
frontend filtering.
6. GET /inventory
Access: Authenticated.

Purpose: List inventory batches visible to the current role.

Expected batch information used by the UI includes:
- batch code
- medicine code/name
- lot number
- expiry date
- on-hand quantity
- quality status
- facility identity/code/name, where allowed
- updated timestamp
Hospital User sees their own facility's batches. Coordinator may inspect
network inventory if supported by the agreed API contract, but cannot
edit inventory in this MVP. This endpoint does not trigger optimization.

If the frontend contract supports a Coordinator facility filter, agree
on the exact query parameter name and validate it server-side. Do not
silently invent a query parameter.
7. GET /catalog/medicines
Access: Authenticated.

Purpose: Populate the create-batch medicine dropdown.

Return active medicines allowed for the current role/facility. Each
option needs the medicine identifier/code and display name required by
MedicineOption in src/types/contracts.ts. The frontend should not
hardcode the live medicine list.
8. POST /inventory/batches
Access: HOSPITAL_USER only.

Creates a batch owned by the signed-in user's facility. The backend
derives facility identity from the authenticated user; never trust a
facility ID supplied by the browser.

Expected create form fields:
{
  "medicine_code": "MED1",
  "lot_number": "LOT-2026-001",
  "expiry_date": "2027-06-30",
  "quantity": 120,
  "quality_status": "ELIGIBLE"
}
The exact field names/enums must match src/types/contracts.ts and
src/api/inventoryApi.ts.

Processing order is important:
1. Validate user, facility ownership, medicine and payload.
2. Save/commit the inventory batch.
3. Evaluate the automatic optimization trigger against the committed
   network snapshot.
4. Return the saved batch and a separate trigger outcome.
5. The inventory save remains successful even if the optimizer fails
   after commit.
Example response shape (illustrative; use the shared contract's exact
keys):
{
  "batch": {
    "batch_code": "BATCH-001",
    "medicine_code": "MED1",
    "lot_number": "LOT-2026-001",
    "expiry_date": "2027-06-30",
    "quantity": 120,
    "quality_status": "ELIGIBLE"
  },
  "trigger": {
    "status": "RAN",
    "run_status": "COMPLETED",
    "run_id": "UUID",
    "message": "Inventory saved and recommendations refreshed."
  }
}
9. PATCH /inventory/batches/{batch_code}
Access: HOSPITAL_USER only, and the batch must belong to the
user's facility.

Only these values are editable in the MVP:
- quantity
- expiry_date
- quality_status
Example request:
{
  "quantity": 95,
  "expiry_date": "2027-08-31",
  "quality_status": "ELIGIBLE"
}
Do not accept facility ID/code, medicine code, or batch code in the
request body. The batch code belongs in the URL. Reject attempts to edit
a batch owned by another facility.

Processing order:
1. Validate ownership and allowed mutable fields.
2. Save/commit the changes.
3. Evaluate the trigger.
4. Return the saved batch and trigger outcome separately.
A trigger failure does not roll back an already committed inventory
edit.
10. POST /optimization-runs
Access: NETWORK_COORDINATOR only. Backend must return 403 to a
Hospital User, even if they call the API directly.

The Coordinator form collects planning date and budget in rupees. The
frontend converts budget to paise before sending. The request also
carries the agreed objective policy.

Illustrative request:
{
  "planning_date": "2026-10-25",
  "budget_minor_units": 50000,
  "objective_policy": "PRIORITY_THEN_COST"
}
Use the exact allowed objective policy values from the optimizer/backend
contract. Do not accept full inventory, shortages, facilities or route
candidates from the browser; the backend reads the current database
snapshot.

The response should persist and return a run identifier, run status,
summary metrics, proposed transfer rows and unmet shortages according to
LatestRunResponse / OptimizationRunResponse in
src/types/contracts.ts.

The UI must distinguish a proven OPTIMAL result from FEASIBLE; do
not label a merely feasible solver result as globally optimal.
11. GET /optimization-runs/latest
Access: Authenticated.
- Coordinator: latest saved run with all network transfer rows and
  unmet shortages.
- Hospital User: same saved run, filtered to transfers where their
  facility is source or destination, plus relevant unmet shortage rows
  for their facility.
Each transfer row should contain the source and destination identity,
medicine, source batch code, recommended quantity, estimated cost in
paise, transit days, reason and review status where available.

For a Hospital User, the UI derives direction per row:
- OUTGOING if their facility is the source.
- INCOMING if their facility is the destination.
Do not assign a permanent "sender" or "receiver" role to a hospital. The
same hospital can send one medicine and receive another.

If no run exists, return the contract-defined empty/no-run result (or a
documented 404 if that is what the shared contract specifies) and let
the frontend show an empty state. Agree on this behavior before
implementation.
12. GET /optimization-runs/{run_id}
Access: Authenticated.

Returns a saved run by ID using the same role-based filtering as
/optimization-runs/latest. A Hospital User must not be able to read
other hospitals' transfer details outside their allowed scope.
Inventory trigger contract
Every successful batch create/edit must return the inventory save result
separately from the automatic trigger result. Use the exact enum values
below:
  Trigger status                        Meaning                 Frontend message
                                                                behavior
  RAN + run status COMPLETED        Inventory saved and     Show success; refresh
                                        optimization completed  inventory, dashboard
                                                                and latest run

  SKIPPED_UNCHANGED                   Submitted values did    Show that nothing
                                        not change the stored   changed
                                        record                  

  SKIPPED_NO_NETWORK_SHORTAGE         No network shortage; no Show saved result and
                                        optimization needed     explain the skip

  SKIPPED_SNAPSHOT_ALREADY_ANALYZED   Current snapshot        Show that existing
                                        already has a result    result is current

  FAILED                              Inventory saved but     Keep saved data
                                        optimization failed     visible; show separate
                                        after commit            trigger failure and
                                                                suggest
                                                                Coordinator/manual
                                                            retry
A skip is not necessarily an error. Never report the inventory write as
failed solely because optimization failed after the commit.
Optimization and transfer rules
The backend/optimizer is authoritative for shortages, eligibility,
routes, cost and transfer decisions. The frontend only displays the
returned result.

The implementation should respect these project rules:
- Only quality-eligible stock can be considered.
- Expiry/shelf-life constraints must be checked for arrival.
- A source must retain its required minimum reserve after sending.
- A destination cannot receive more than its shortage.
- Transfers require an active direct route; a reverse route is not
  implied.
- Total quantity across medicine lines on a route cannot exceed route
  capacity.
- Total transfer cost cannot exceed the budget.
- Objective: maximize priority-weighted units first, then minimize
  cost while preserving the proven first-stage score.
- If a complete plan is impossible, return unmet shortage values
  rather than inventing stock.
- Recommendations have status PENDING_REVIEW in this MVP.
- Recommendations do not approve, dispatch, deduct stock or mutate
  inventory.
- The browser never computes the authoritative optimization result.
Frontend integration behavior
After signup/login
1. Store token in session storage.
2. Set safe user profile in Redux.
3. Navigate based on role.
4. On reload, call /auth/me to restore the session.
After inventory create/edit
1. Display the inventory save result.
2. Read and display the trigger object separately.
3. Re-fetch /inventory and /dashboard.
4. If a run completed, re-fetch /optimization-runs/latest.
5. If trigger failed after commit, keep the updated batch visible.
After manual optimization
1. Coordinator submits planning date, budget and objective policy.
2. Frontend converts rupees to paise.
3. Show loading state.
4. Call POST /optimization-runs.
5. Display returned run status/results.
6. Refresh /dashboard and /optimization-runs/latest.
Recommendations table
Display, when present:
- direction for Hospital User (OUTGOING / INCOMING)
- source facility and destination facility
- medicine and source batch code
- recommended quantity
- estimated cost (convert paise to rupees exactly once)
- transit days
- reason
- PENDING_REVIEW status
Coordinator sees the network view and all transfer rows. Show unmet
shortages with medicine, facility, shortage before, recommended inbound
and shortage after. Do not add Approve/Dispatch actions.
Errors and status codes
Use a consistent JSON error format. Recommended example:
{
  "detail": "Human-readable error message"
}
For field validation errors, a FastAPI-style shape is supported:
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "Invalid email address",
      "type": "value_error"
    }
  ]
}
The frontend error helper reads error.message, detail string,
detail array or message. Prefer a stable response contract.

Recommended status behavior:
- 200 OK --- successful read/update/run retrieval.
- 201 Created --- successful signup or batch creation.
- 400 Bad Request --- malformed/invalid business request, where
  appropriate.
- 401 Unauthorized --- missing/invalid/expired token or invalid
  credentials.
- 403 Forbidden --- authenticated role is not allowed to perform the
  action.
- 404 Not Found --- missing resource or no latest run, if agreed for
  that endpoint.
- 409 Conflict --- duplicate email or conflicting resource, if used
  consistently.
- 422 Unprocessable Entity --- field validation errors.
- 500 Internal Server Error --- unexpected backend error; do not
  leak stack traces/secrets.
- 503 Service Unavailable --- optimizer unavailable, where
  appropriate. If inventory was already committed, still return a
  response that makes the successful save and failed trigger explicit.
For every API-driven page, the frontend needs loading, error/retry,
empty and success states.
Security and data rules
- Never expose DATABASE_URL, JWT signing secret, Coordinator
  password, or join-code secret to Vite/browser variables.
- Signup never lets a user choose their role or create a new facility.
- Never return join code from signup options.
- Backend derives facility ownership from the authenticated user for
  inventory writes.
- Backend validates authorization on every read/write; frontend role
  guards are UX only.
- Coordinator is seeded/provisioned separately.
- A Hospital User only sees their own facility data and transfer rows
  involving that facility.
- Never trust client-provided network inventory as optimizer input.
- Never expose stack traces, password hashes or secret values in API
  responses.
- Validate quantities, expiry dates, quality enum, budget, objective
  policy, route/capacity constraints and resource ownership on the
  server.
Backend implementation checklist
- [ ] Configure /api/v1 prefix and CORS for the frontend origin (for
  local Vite, http://localhost:5173).
- [ ] Implement signup options, signup, login and /auth/me.
- [ ] Seed active facilities, medicines, routes, minimum reserves,
  route capacities and a Coordinator account.
- [ ] Use password hashing and signed JWTs; never store plaintext
  passwords.
- [ ] Implement role enforcement and facility ownership checks.
- [ ] Implement dashboard response scoped by role.
- [ ] Implement inventory list, medicine catalog, batch create and
  allowed-field patch.
- [ ] Commit inventory changes before running trigger logic.
- [ ] Return all documented trigger statuses and separate trigger
  failures from inventory-save failures.
- [ ] Implement manual Coordinator-only optimization run.
- [ ] Persist run metadata, transfer rows, unmet shortages and
  metrics.
- [ ] Implement latest/specific run reads with role-based filtering.
- [ ] Keep money as integer paise in API/database.
- [ ] Return stable JSON error responses and appropriate HTTP status
  codes.
- [ ] Add tests for auth, authorization, ownership, trigger
  skips/failure, budget constraints and role-filtered results.
- [ ] Test the API using the same JSON keys/enums as
  src/types/contracts.ts.
Frontend test checklist
- [ ] Signup dropdown loads active facilities from the API.
- [ ] Signup rejects duplicate email, invalid join code, invalid
  facility and invalid fields.
- [ ] Login works and returns the correct role.
- [ ] Refresh restores a valid session; expired token clears session
  and redirects.
- [ ] Hospital User cannot read another facility's private data or
  edit another facility's batch.
- [ ] Coordinator can view network data and run optimization; Hospital
  User receives 403 if calling the run endpoint.
- [ ] Inventory create/edit submits only allowed fields.
- [ ] Inventory save and trigger outcomes display independently.
- [ ] Trigger skip/failure messages match the returned enum.
- [ ] Source sees a transfer as outgoing and destination sees it as
  incoming.
- [ ] Coordinator sees the full network result.
- [ ] Paise-to-rupees conversion occurs exactly once.
- [ ] Empty, loading, failed and completed optimization states are
  covered.
- [ ] No approval, dispatch or stock deduction is implied by a
  recommendation.
Source-of-truth note
The route list, role behavior, inventory mutation rules and trigger
enums in this README reflect the MedMove frontend/API handover contract.
Illustrative JSON field names must be checked against the actual
src/types/contracts.ts and typed API modules before the backend is
finalized. If a field name differs there, update the shared contract and
this README together rather than implementing mismatched assumptions.