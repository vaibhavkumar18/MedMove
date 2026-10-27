# app/features/dashboard/router.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.features.dashboard.service import get_dashboard_data

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("")
def get_dashboard(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Role-scoped dashboard summary.
    Hospital users see only their own facility data.
    Network coordinators see the full network.
    """
    return get_dashboard_data(db, user)
