# MedMove sample data

All rows are synthetic and intended only for a hackathon demonstration. Do not treat the medicine quantities or transport costs as actual clinical or operational guidance.

## Files and columns

- `facilities.csv`: `facility_code,name,facility_type,district,state,is_active`
- `medicines.csv`: `medicine_code,generic_name,strength,dosage_form,base_unit,is_active`
- `inventory_batches.csv`: `batch_code,facility_code,medicine_code,lot_number,expiry_date,quantity_on_hand_units,quality_status`
- `facility_medicine_plans.csv`: `facility_code,medicine_code,target_stock_units,minimum_reserve_units,avg_daily_demand_units,priority_weight,minimum_remaining_shelf_life_days`
- `transport_routes.csv`: `route_code,source_facility_code,destination_facility_code,transit_days,cost_per_unit_minor_units,route_capacity_units,currency_code,is_active`

## Expected current record counts

- 10 facilities (`H01` to `H10`)
- 4 medicines (`MED1` to `MED4`)
- 40 facility-medicine policies (one per facility/medicine pair)
- 41 inventory batches
- 36 directed route rows

The seed script must validate references and fail clearly if a row points to an unknown facility or medicine. It should be safe to rerun without duplicating records or overwriting user-edited batch quantities.

## Important rules

- Facility/medicine/batch/route codes are stable business identifiers for demo and optimizer requests. Database primary keys are UUIDs.
- `quantity_on_hand_units`, target, reserve, daily demand and route capacity are whole integer units.
- `cost_per_unit_minor_units` is already paise: `255` means Rs 2.55 per unit. Do not multiply by 100 during import or mapping.
- `quality_status` must be one of `ELIGIBLE`, `QUARANTINED`, `RECALLED`, `DAMAGED`.
- Routes are directed. A route `H01 -> H02` does not imply a route `H02 -> H01`.
- Signup joins an existing seeded facility; it does not create a new facility. The demo join code is configured on the backend and never returned from signup-options.
- The Network Coordinator account is created by `seed_demo.py` using backend env settings. It is not created from CSV and cannot be created through public signup.
