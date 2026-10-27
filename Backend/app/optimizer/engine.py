from app.optimizer.schemas import OptimizationRequest, OptimizationResult, ShortageLine, SurplusLine
from datetime import date

def calculate_shortages(request: OptimizationRequest) -> list[ShortageLine]:
    shortages = []
    # Simple stub logic: aggregate usable stock per facility/medicine and compare to target
    stock = {}
    for b in request.inventory_batches:
        if b["quality_status"] == "ELIGIBLE":
            key = (b["facility_code"], b["medicine_code"])
            stock[key] = stock.get(key, 0) + b["quantity_on_hand_units"]
            
    for p in request.facility_medicine_plans:
        key = (p["facility_code"], p["medicine_code"])
        usable = stock.get(key, 0)
        target = p["target_stock_units"]
        if usable < target:
            shortages.append(ShortageLine(
                facility_code=p["facility_code"], medicine_code=p["medicine_code"],
                usable_stock_units=usable, target_stock_units=target,
                shortage_units=target - usable, priority_weight=p["priority_weight"]
            ))
    return shortages

def calculate_surpluses(request: OptimizationRequest) -> list[SurplusLine]:
    surpluses = []
    stock = {}
    for b in request.inventory_batches:
        if b["quality_status"] == "ELIGIBLE":
            key = (b["facility_code"], b["medicine_code"])
            stock[key] = stock.get(key, 0) + b["quantity_on_hand_units"]
            
    for p in request.facility_medicine_plans:
        key = (p["facility_code"], p["medicine_code"])
        usable = stock.get(key, 0)
        reserve = p["minimum_reserve_units"]
        if usable > reserve:
            surpluses.append(SurplusLine(
                facility_code=p["facility_code"], medicine_code=p["medicine_code"],
                usable_stock_units=usable, minimum_reserve_units=reserve,
                surplus_units=usable - reserve, priority_weight=p["priority_weight"]
            ))
    return surpluses

def optimize(request: OptimizationRequest) -> OptimizationResult:
    # Stub: Returns a valid empty result. In production, this calls OR-Tools.
    return OptimizationResult(
        planning_date=request.planning_date, objective_policy=request.objective_policy,
        summary={
            "transfer_count": 0, "total_recommended_units": 0, "total_cost_minor_units": 0,
            "initial_shortage_line_count": len(calculate_shortages(request)),
            "unmet_shortage_line_count": 0, "total_unmet_shortage_units": 0, "priority_weighted_units_score": 0
        }
    )