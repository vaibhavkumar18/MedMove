# MedMove — Hospital Medicine Redistribution Platform

**MedMove helps healthcare networks identify medicine shortages, assess transferable surplus, and generate constraint-aware redistribution recommendations across hospitals.**

The platform combines inventory and transport data with a dedicated optimization engine so that proposed transfers can be evaluated consistently across the network. Recommendations are intended to support authorized human decision-making; they do not represent completed or automatically executed transfers.

> **Data and safety note:** Demo hospitals, medicines, stock quantities, routes, costs, and policy weights are fictional. MedMove is not a source of clinical advice and has not been clinically validated for real-world medicine distribution.

---

## Contents

- [Overview](#overview)
- [Problem](#problem)
- [Solution](#solution)
- [What Makes MedMove Different](#what-makes-medmove-different)
- [Research and Related Systems](#research-and-related-systems)
- [Key Capabilities](#key-capabilities)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Core Concepts and Rules](#core-concepts-and-rules)
- [User Roles](#user-roles)
- [API Overview](#api-overview)
- [Data Model](#data-model)
- [Getting Started](#getting-started)
- [Running the Optimizer](#running-the-optimizer)
- [Testing](#testing)
- [Current Implementation Status](#current-implementation-status)
- [Demonstration Workflow](#demonstration-workflow)
- [Development Guidelines](#development-guidelines)
- [Current Boundaries](#current-boundaries)
- [Future Improvements](#future-improvements)
- [Safety and Data Disclaimer](#safety-and-data-disclaimer)

## Overview

Medicine availability can vary between hospitals. One facility may have an unmet requirement while another has eligible stock beyond its protected needs. Identifying a suitable transfer requires more than comparing stock totals: the source must retain sufficient stock, the destination must have a genuine shortage, the medicine batch must be eligible, a valid route must exist, and the proposal must fit timing, transport-capacity, and budget restrictions.

MedMove is designed to bring these considerations into one network-wide decision-support workflow. It takes a structured snapshot of facility inventory, medicine plans, batch details, and transport routes; passes that data to a constraint-based optimizer; and returns proposed transfers alongside shortages that remain unmet. The optimizer is independently implemented and tested; complete application integration is tracked separately in the implementation-status section below.

The system is designed as a modular application. The React frontend handles user interactions, the FastAPI backend coordinates requests and business rules, PostgreSQL stores operational records, and the Python optimizer evaluates transfer options.

## Problem

Medicine redistribution across a hospital network is a constrained planning problem:

- A high stock balance does not necessarily mean that a hospital can donate medicine.
- A batch may be unusable because of its quality status, expiry date, or remaining shelf life at arrival.
- A source must protect its configured target stock and minimum reserve.
- Transfers must follow eligible directed routes and remain within route-capacity limits.
- A destination should not receive more units than its outstanding requirement.
- All proposed transfers must fit the available budget.
- Some shortages may remain impossible to satisfy under the available inventory and transport conditions.

MedMove aims to make those trade-offs visible and repeatable rather than relying on informal stock comparisons.

## Solution

MedMove evaluates the participating network as a whole and produces recommendations that respect the configured data and constraints. It can identify eligible surplus, evaluate candidate transfers, optimize the proposed allocations, and report both the transfers selected and the shortages that remain.

For example, a hospital may require 120 additional units of a medicine. Another hospital's inventory balance alone is not sufficient evidence that it can donate those units. MedMove checks the source's protected stock, the batch's eligibility and expiry, the route, expected arrival, shared capacity, destination need, and total budget before proposing a transfer.

The platform is a **decision-support system**. A recommendation is a proposal for review, not an approval, shipment, or inventory movement.

## What Makes MedMove Different

MedMove's differentiator is **not simply displaying hospital inventory or matching a shortage with surplus**. Its design brings several operational rules into one network-wide optimization run, so a proposed transfer is checked against the constraints that determine whether it is actually feasible.

### 1. Feasibility-first, protected surplus

A high stock count is not automatically donor stock. The optimizer protects the source facility's configured target and minimum reserve before calculating transferable surplus:

```text
Transferable Surplus = max(Usable Stock - max(Target Stock, Minimum Reserve), 0)
```

This helps avoid recommendations that solve one facility's shortage by creating another facility's shortage.

### 2. Constraints considered together across the network

The optimization model evaluates transfer candidates with a combined set of constraints, including:

- eligible batch quality and usable quantity;
- expiry and minimum remaining shelf life at expected arrival;
- source stock protection and destination shortage limits;
- directed routes and transit times;
- shared route capacity across proposed transfers; and
- a total budget for the run.

Because route capacity and budget are shared constraints, a transfer cannot be judged in isolation from other proposed transfers in the same run.

### 3. Explicit priority-before-cost objective

Under `PRIORITY_WEIGHTED_UNITS_THEN_COST`, the optimizer first maximizes priority-weighted units delivered and then minimizes cost while preserving that best priority score. This makes the trade-off explicit rather than using the cheapest transfer as the only decision rule. Priority weights in the sample data are illustrative operational policy values, not validated clinical scores.

### 4. Unmet shortages remain visible

MedMove returns shortages that remain unsatisfied when available stock, expiry, routes, capacities, or budget prevent a feasible transfer. It does not invent stock, over-allocate a destination, or imply that every shortage can be solved.

### 5. A planned state-aware re-optimization workflow

The application design connects inventory changes to the decision engine: save a real inventory change first, check whether a network shortage exists, avoid rerunning for a no-op or an already-analyzed identical snapshot, and—when the trigger conditions pass—run the optimizer for the network rather than independently for each hospital. This workflow is an integration target and should be described as complete only after the Backend, database adapter, and UI pass the end-to-end tests in this README.

### 6. One result, role-specific views, human review

A single network-wide run can be presented as outgoing proposals to a source hospital, incoming proposals to a destination hospital, and a full network result to the Network Coordinator. Source and destination are assigned per recommendation, not fixed as permanent hospital roles. Proposals remain pending review; they do not automatically modify inventory or execute a physical transfer.

These are **MedMove's chosen product and engineering differentiators**, not a claim that no other system has similar features. See [Research and Related Systems](#research-and-related-systems) for the public comparison used to frame this positioning.

## Research and Related Systems

Public research shows that medicine redistribution, stock visibility, expiry monitoring, and inventory optimization already exist in different forms. MedMove should therefore be positioned around its specific combination of constraints and workflow—not as the first platform to redistribute medicine.

| Publicly described system or approach | What the source describes | How MedMove is positioned |
|---|---|---|
| [Farmastock — published multi-hospital study](https://pmc.ncbi.nlm.nih.gov/articles/PMC9437392/) | An online inter-hospital tool used by five hospitals in Spain to identify availability of high-cost, low-use, near-expiry medicines and record medicine transfers. | MedMove focuses on a broader constraint-based network allocation model that explicitly considers source protection, destination need, directed routes, shared capacity, total budget, weighted priority, and unmet shortages in the same solver run. The published study confirms that inter-hospital exchange and expiry awareness alone are not unique differentiators. |
| [SIRUM](https://sirum.org/about-us/) | A technology-supported model in which organizations donate surplus medicine and SIRUM matches donations with community partners who can distribute them to patients. | MedMove's intended workflow is focused on proposed transfers within a configured hospital network using facility inventory, route, and policy constraints. The operating models are related but not identical. |
| [WHO guidance on logistics management information systems](https://www.who.int/publications/i/item/9789240111585) | Guidance for better visibility, standardized logistics indicators, monitoring of stock and medicine batches, and improved distribution planning. | MedMove uses structured inventory and route inputs to calculate proposed allocations, rather than positioning itself only as a stock-reporting or KPI layer. |
| [Chhattisgarh Drug Procurement & Distribution Management Information System (DPDMIS)](https://dpdmis.in/faconline/Index/Index.aspx) | Public materials describe recording medicine receipts and issues and stock reports for excess, shortage, and near-expiry items that support redistribution/reshuffling. | MedMove's intended differentiator is converting network-level stock and route data into a constrained transfer plan, including explicit solver results and unmet needs. |

This is a **targeted public-source review, not an exhaustive vendor benchmark**. The cited descriptions do not prove that other products lack any individual constraint listed here. MedMove's differentiation should be demonstrated through its implementation, tests, and end-to-end workflow—not through an unsupported claim of global uniqueness.

## Key Capabilities

- **Network-wide inventory assessment:** work across multiple facilities using a consistent inventory snapshot.
- **Shortage analysis:** identify facility–medicine requirements that are not met by usable stock.
- **Protected-surplus calculation:** account for target stock and minimum reserves before treating stock as transferable.
- **Batch eligibility:** consider quality status, expiry, planning date, arrival time, and minimum remaining shelf life.
- **Route-aware transfer planning:** use directed transport routes with transit-time and capacity constraints.
- **Budget-aware optimization:** ensure proposed transfers stay within the configured budget.
- **Priority-aware allocation:** optimize priority-weighted units delivered before minimizing cost, when that objective policy is selected.
- **Unmet-shortage reporting:** explicitly return shortages that cannot be fully covered by feasible transfers.
- **Role-aware views:** provide network-wide views for the Network Coordinator and facility-specific inventory and transfer views for hospital users.
- **Saved optimization runs:** preserve run inputs and results for review and retrieval.
- **Inventory-change evaluation:** after a supported inventory change is saved, evaluate whether a new network-wide run is warranted according to the configured trigger rules.

Actual feature availability depends on the current implementation and its integration tests; architectural intent alone should not be interpreted as proof that a component is deployed or production-ready.

## How It Works

### 1. Load facility and inventory data

The application uses facility records, a medicine catalogue, inventory batches, facility–medicine plans, and directed transportation routes. Development and demonstration data are synthetic. The database integration layer maps stable business codes such as `H01` and `MED1` to database identifiers.

### 2. Build a consistent optimization request

When a network optimization is requested, the backend obtains the current data snapshot and the run settings, such as planning date and budget. It maps those records into the optimizer's validated request contract.

### 3. Assess shortage and transferable surplus

The optimizer evaluates usable stock and destination requirements while protecting source stock. Stock that fails the applicable quality, expiry, reserve, or route restrictions is not treated as freely transferable.

### 4. Solve the network allocation problem

The optimizer generates eligible source–destination candidates and selects a feasible set of transfer quantities subject to inventory, route, shelf-life, and budget constraints. Its objective policy prioritizes weighted units delivered and then cost where specified by the request.

### 5. Validate and persist the result

The backend/integration layer can save the optimization run, its input snapshot, result, status, and timestamps so that the result can be reviewed or retrieved later. The optimizer itself remains independent of the database and HTTP layer.

### 6. Present the recommendations

The Coordinator can review network-wide recommendations and remaining shortages. A hospital-specific view filters the same run to show transfers where that facility is the source or destination. Recommendations do not change inventory by themselves.

### Inventory-change trigger

The intended application-level workflow is to commit a valid inventory edit first, then decide whether to run optimization. A no-op edit should not launch a run. If there is no network shortage or the same input snapshot has already been analyzed, the trigger can report that optimization was skipped. If an optimization fails after an inventory update has been committed, the user must be told that the inventory edit succeeded but the run failed.

## Architecture

MedMove is structured as a **modular monolith**: one FastAPI application imports the optimizer as a Python package. The optimizer is not a separate HTTP service.

```text
                         MEDMOVE
                            |
             +--------------+--------------+
             |                             |
       React + TypeScript             FastAPI backend
          Frontend                    /api/v1 routes
             |                             |
       UI -> Hooks -> State -> API          +-------------------+
             |                             |                   |
             +----------- HTTP -------------+                   |
                                           v                   v
                                    Database adapter     Python optimizer
                                           |              (pure package)
                                           v                   |
                                       PostgreSQL              |
                                           |                   |
                                           +--- saved run <----+
```

### Component responsibilities

- **Frontend:** renders dashboards, inventory views, forms, run states, recommendations, and unmet shortages. It must not implement authoritative stock, transfer-feasibility, shortage, or cost calculations.
- **Backend:** exposes HTTP endpoints, validates input, enforces access rules, coordinates inventory updates, decides when optimization should run, invokes the optimizer, and reports predictable success/skip/failure outcomes.
- **Database and integration layer:** manages persistence, migrations, data seeding, repositories, business-code/ID mapping, optimizer-request construction, and result persistence.
- **Optimizer:** receives a validated structured snapshot and returns transfer recommendations and unmet shortages. Its core calculation code should not depend on SQL, HTTP, authentication, or the browser.

## Technology Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React, TypeScript, Vite | Web interface and interactive dashboards |
| Routing | React Router | Client-side page navigation |
| State and async workflows | Redux Toolkit / thunks as used by the frontend | Shared state and request lifecycle |
| Styling | Tailwind CSS as used by the frontend | Layout and responsive UI |
| Backend | Python, FastAPI, Pydantic | REST API, validation, role checks, and orchestration |
| ORM and migrations | SQLAlchemy 2.x, Alembic | Database models and schema evolution |
| Database | PostgreSQL | Facilities, medicines, inventory, policies, routes, and run records |
| Optimization | OR-Tools CP-SAT | Constraint-based transfer allocation |
| Testing | pytest | Unit and integration tests |

Use the versions and commands specified by the repository's dependency files. This table describes the intended technology stack; installed versions and current implementation details are determined by the codebase.

## Repository Structure

The repository uses capitalized top-level directory names:

```text
MedMove/
├── Backend/       # FastAPI application, database integration, and backend tests
├── Frontend/      # React web application
├── Optimizer/     # Python optimization package, sample data, and tests
└── README.md      # Project-wide documentation
```

The Optimizer component includes these main files and directories:

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
├── data/
│   └── sample/
│       ├── facilities.csv
│       ├── medicines.csv
│       ├── inventory_batches.csv
│       ├── facility_medicine_plans.csv
│       └── transport_routes.csv
├── scripts/
│   └── run_optimizer_demo.py
├── tests/
└── requirements.txt
```

The codebase is the source of truth for the current file structure; files may be added or moved as development proceeds.

## Core Concepts and Rules

### Inventory, shortage, and surplus

A destination shortage is based on its medicine requirement and usable stock. A source cannot donate stock merely because its total is high: target stock and minimum reserves are protected first.

The implemented transferable-surplus rule in the optimizer is:

```text
Transferable Surplus = max(Usable Stock - max(Target Stock, Minimum Reserve), 0)
```

For example, if usable stock is 70 units, target stock is 80 units, and the minimum reserve is 20 units, transferable surplus is zero. The target stock is the stronger protected threshold in this example.

### Feasibility constraints

A valid proposal may be limited by:

- batch quality status and usable quantity;
- expiry and remaining shelf life when the medicine arrives;
- source target/reserve protection;
- destination's outstanding shortage;
- existence and direction of an eligible transport route;
- transit time and shared route capacity;
- the total optimization budget.

### Objective and solver status

The objective policy `PRIORITY_WEIGHTED_UNITS_THEN_COST` first maximizes priority-weighted units delivered and then minimizes transfer cost while preserving that best priority score. The actual objective is determined by the selected policy and optimizer implementation. A solver status of `FEASIBLE` does not prove that a solution is optimal; only a verified optimal status supports that claim.

### Monetary and quantity units

- Medicine quantities are whole-number units in the medicine's declared unit.
- Money is represented as integer minor units: for INR, **100 paise = ₹1.00**.
- `200` paise means ₹2.00; `50,000` paise means ₹500.00.
- Do not mix rupees and paise or use floating-point numbers for authoritative monetary calculations.

## User Roles

### Hospital User

A hospital account is associated with one configured facility. Its authorized views should show that facility's inventory, shortage information, and incoming/outgoing recommendations. Inventory operations must derive facility scope from the authenticated user on the backend; the browser must not be trusted to choose another facility's scope.

### Network Coordinator

The Coordinator can view the whole network and initiate network-wide optimization using run settings such as planning date and budget. The Coordinator account should be provisioned through the project's controlled setup/seed process rather than public signup.

### Source and destination are transfer attributes

Source and destination are assigned separately for each recommended transfer. They are not permanent user roles. The same facility may donate one medicine and receive another medicine in the same run.

## API Overview

The application API uses the `/api/v1` prefix in the shared project design. The core interface includes the following routes, subject to the current backend implementation:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/health` | Check whether the API process is responding |
| `GET` | `/api/v1/dashboard?planning_date=...` | Retrieve dashboard summaries and latest-run information |
| `GET` | `/api/v1/inventory?facility_code=H01` | Retrieve inventory for an authorized facility scope |
| `PATCH` | `/api/v1/inventory/batches/{batch_code}` | Update supported batch fields and return the trigger outcome |
| `POST` | `/api/v1/optimization-runs` | Start a manual network-wide optimization run |
| `GET` | `/api/v1/optimization-runs/{run_id}` | Retrieve a saved run without solving it again |

Authentication-related routes are also part of the application design. Refer to the current Backend source and its API schemas for exact paths, request bodies, responses, and implemented functionality. The shared API/data contract should be treated as the source of truth for field names, enum values, and units.

### Optimizer interface

The optimizer exposes a Python function that accepts a structured request and returns a structured result:

```python
from medmove_optimizer import optimize

result = optimize(request)
```

`request` must match the `OptimizationRequest` schema in `Optimizer/medmove_optimizer/schemas.py`. The optimizer returns an `OptimizationResult` containing proposed transfer recommendations and unmet-shortage information according to the current contract.

## Data Model

The application design uses these main domain entities:

| Entity | Purpose |
|---|---|
| `facilities` | The participating hospitals and their stable business codes |
| `medicines` | The medicine catalogue and associated identifiers |
| `inventory_batches` | Facility-specific batch quantity, quality status, lot, and expiry information |
| `facility_medicine_plans` | Target stock, reserve, priority weight, demand context, and shelf-life policy for a facility–medicine pair |
| `transport_routes` | Directed route, transit time, unit cost, and shared capacity |
| `optimization_runs` | Run settings, input snapshot, run/solver status, result payload, and timestamps |

The synthetic sample dataset contains 10 facilities, 4 medicines, 41 inventory batches, 40 facility–medicine plans, and 36 directed transport routes. These counts describe the demonstration dataset and should be updated if the seed data changes.

For the application, the database integration layer owns persistence and maps stable business codes into database IDs. The optimizer works with its structured request contract and does not query PostgreSQL directly.

## Getting Started

### Prerequisites

- Git
- Python 3.12.x, according to the project baseline
- Node.js and the package manager version compatible with the Frontend lockfile
- PostgreSQL for the integrated application

### 1. Clone the repository

```powershell
git clone https://github.com/vaibhavkumar18/MedMove.git
cd MedMove
```

### 2. Set up the Optimizer

```powershell
cd Optimizer
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure the Backend

1. Open `Backend/` and inspect its dependency files, environment example, migration configuration, and local setup instructions.
2. Create a local environment file from the supplied example, if present. Never commit real secrets.
3. Configure the PostgreSQL connection and required authentication/demo settings using the exact environment-variable names expected by the code.
4. Install dependencies from the Backend's declared dependency file.
5. Apply migrations and load demo data using the seed command provided by the current Backend source/documentation.
6. Start FastAPI using the actual app entry point documented in `Backend/`.

### 4. Configure the Frontend

1. Open `Frontend/` in a separate terminal.
2. Install dependencies using the package manager indicated by the lockfile.
3. Configure the backend base URL according to the Frontend environment configuration.
4. Start the development server using the script declared in `Frontend/package.json`.

### 5. Run the full application

Start PostgreSQL, the Backend, and the Frontend in their respective terminals. Confirm the API is healthy and the database has been seeded before following the demonstration workflow. Use the exact startup, migration, and seed commands provided by the current source; this README does not substitute for per-component configuration.

## Running the Optimizer

From PowerShell in the `Optimizer/` directory:

```powershell
.\.venv\Scripts\python.exe scripts\run_optimizer_demo.py
```

The demo loads the synthetic sample files, builds an optimization request, invokes the optimizer, and prints the proposed transfers and unmet shortages.

To call the package from Python:

```python
from medmove_optimizer import optimize

result = optimize(request)
```

Use the existing demo script as the schema-accurate example for constructing `request`; its fields must match `schemas.py`.

## Testing

### Optimizer-specific tests

From the `Optimizer/` directory:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests\test_stock.py tests\test_candidates.py tests\test_model.py tests\test_schemas.py tests\test_service.py tests\test_validation.py
```

The latest recorded optimizer verification reported **33 passing optimizer-specific tests** and a successful sample demo. Re-run the commands against the current checkout to confirm the result after any changes.

### All available Optimizer tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

The complete test suite may also include database integration tests and may require PostgreSQL or additional environment configuration.

### Integration verification checklist

- [ ] Seed data can be loaded repeatably without duplicating records.
- [ ] Hospital users are limited to their linked facility's inventory.
- [ ] A public signup cannot create a Network Coordinator account.
- [ ] The Coordinator can start a network-wide run.
- [ ] Inventory changes are committed before trigger evaluation.
- [ ] A no-op change does not start a new run.
- [ ] No-shortage and already-analyzed-snapshot cases return an explicit skip outcome.
- [ ] The optimizer result is saved and can be retrieved after refresh.
- [ ] The same transfer appears as outgoing for its source and incoming for its destination.
- [ ] Unmet shortages remain visible when constraints prevent full coverage.
- [ ] A recommendation does not silently modify stock.
- [ ] Frontend, Backend, optimizer, and integration tests pass.

## Current Implementation Status

MedMove is being developed as a connected application. The standalone optimizer has a recorded verification result; that result should not be read as proof that the entire frontend–backend–database workflow has passed end-to-end verification.

| Area | Status supported by current project evidence |
|---|---|
| Python optimizer package | Implemented and independently tested. Its public entry point is `from medmove_optimizer import optimize`. |
| Optimization constraints and output validation | Covered by optimizer tests and the latest recorded verification report. |
| Synthetic CSV demonstration | Demo script completed successfully in the recorded verification. Inputs and costs are illustrative. |
| Optimizer-specific test suite | Latest recorded report: **33 tests passed**. Run the tests again after changes to confirm the current checkout. |
| PostgreSQL persistence, backend authentication, trigger orchestration, and React workflow | These are part of the whole-system design. Treat them as fully integrated only after their tests and the end-to-end checklist below pass against the current checkout. |

The recorded sample optimization produced 95 proposed units at a total cost of ₹178.75 against a ₹180.00 budget, leaving ₹1.25. It also reported 25 unmet-shortage records totaling 1,660 units. These numbers describe one fictional sample run; they are not real hospital results, performance guarantees, or expected outcomes for other inputs.

For the wider application, the integration checklist below is the acceptance test. Do not describe a workflow as complete merely because its architecture or endpoint has been specified.

## Demonstration Workflow

1. **Review the network:** introduce the participating facilities and explain that the sample dataset is synthetic.
2. **Inspect inventory and shortages:** show why a large stock balance is not always transferable surplus.
3. **Start an optimization run:** use the Coordinator view to select a planning date and budget and start a network-wide run.
4. **Explain a recommendation:** identify its source, destination, medicine, quantity, cost, and relevant reserve/route/expiry constraints.
5. **Review an unmet shortage:** explain how stock availability, route capacity, expiry, or budget may prevent full coverage.
6. **Compare hospital views:** show a proposal as outgoing for its source and incoming for its destination.
7. **Show inventory-change handling:** edit a supported batch field and save it; explain the actual trigger status returned by the Backend.
8. **Emphasize human review:** recommendations help decision-making but do not authorize or execute physical transfers.

## Development Guidelines

- Read the shared API and data contract before changing API fields, schema names, enum values, or units.
- Keep the optimizer pure: do not add database, HTTP, authentication, or frontend dependencies to its core calculation package.
- Keep authoritative inventory, shortage, feasibility, and cost calculations out of the browser.
- Keep database writes and persistent business records in the Backend/database integration layer.
- Preserve input snapshots and saved run results so the outcome can be reviewed and reproduced.
- Use integer medicine units and integer monetary minor units.
- Test business constraints when changing stock calculations, candidate generation, solver objectives, or validation.
- Do not claim tests passed unless they were run; include the exact command and result in engineering handoffs.
- Do not commit `.env` files, credentials, virtual environments, caches, or generated build output.

## Current Boundaries

MedMove focuses on inventory assessment and medicine-transfer recommendations. The current design does not itself:

- purchase medicines or place supplier orders;
- book vehicles or automatically dispatch shipments;
- mark a recommendation as physically delivered;
- modify source or destination inventory merely because a recommendation exists;
- provide treatment, diagnosis, or prescribing advice;
- perform a validated future-demand forecast solely from demand-related input fields;
- integrate with live hospital information systems or real logistics providers by default.

The current trigger design is synchronous and intended for a relatively small network. Real-world deployment would need additional performance, reliability, operational, security, clinical, legal, and data-governance validation.

## Future Improvements

Potential extensions include:

- recommendation review and approval workflows;
- transaction-safe dispatch, receipt, and inventory movement records;
- audit trails for planning decisions and resulting stock movements;
- more detailed, machine-readable reasons for unmet shortages;
- expanded randomized, edge-case, and performance tests;
- integration with hospital and pharmacy systems after data standards and governance are agreed;
- background job processing if measured optimization runtime makes synchronous requests unsuitable;
- demand forecasting after a separate data pipeline, evaluation plan, and validation dataset are established.

These are possible future additions, not assertions about existing functionality.

## Safety and Data Disclaimer

MedMove is a decision-support software project. Demo data, costs, routes, and policy weights are illustrative and must not be treated as real hospital or clinical information. The platform has not been clinically validated and does not provide medical advice. Before any real-world transfer, authorized personnel must independently confirm stock records, batch quality, expiry, storage and handling requirements, transport arrangements, hospital policy, and applicable rules.

---

MedMove aims to make medicine redistribution across hospital networks more transparent, constraint-aware, and reviewable by bringing inventory data and optimization into a shared workflow.
