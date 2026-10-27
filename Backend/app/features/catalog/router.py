from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.db import repositories as repo
from app.features.catalog.schemas import MedicineCatalogResponse

router = APIRouter(prefix="/catalog", tags=["Catalog"])


@router.get("/medicines", response_model=MedicineCatalogResponse)
def get_medicines(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MedicineCatalogResponse:
    facility_id = user.facility_id if user.role == "HOSPITAL_USER" else None
    return MedicineCatalogResponse(
        medicines=repo.get_medicines_for_user(db, user.role, facility_id)
    )