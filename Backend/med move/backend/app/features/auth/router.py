# app/features/auth/router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.db import repositories as repo
from app.features.auth import service
from app.features.auth.schemas import SignupRequest, LoginRequest, AuthResponse, UserProfile

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.get("/signup-options")
def signup_options(db: Session = Depends(get_db)):
    facilities = repo.list_active_signup_facilities(db)
    return {"facilities": [{"facility_code": f.facility_code, "name": f.name, "district": f.district, "state": f.state} for f in facilities]}

@router.post("/signup", status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    token, user = service.signup(db, payload)
    
    # Safely handle facility (Hospital users have one, Coordinator does not)
    fac_code = user.facility.facility_code if user.facility else None
    fac_name = user.facility.name if user.facility else None
    
    return AuthResponse(
        access_token=token, 
        user=UserProfile(
            user_id=str(user.id), 
            full_name=user.full_name, 
            email=user.email, 
            role=user.role, 
            facility_code=fac_code, 
            facility_name=fac_name
        )
    )

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    token, user = service.login(db, payload)
    
    # Safely handle facility
    fac_code = user.facility.facility_code if user.facility else None
    fac_name = user.facility.name if user.facility else None
    
    return AuthResponse(
        access_token=token, 
        user=UserProfile(
            user_id=str(user.id), 
            full_name=user.full_name, 
            email=user.email, 
            role=user.role, 
            facility_code=fac_code, 
            facility_name=fac_name
        )
    )

@router.get("/me")
def me(user=Depends(get_current_user)):
    # Safely handle facility
    fac_code = user.facility.facility_code if user.facility else None
    fac_name = user.facility.name if user.facility else None
    
    return {"user": UserProfile(
        user_id=str(user.id), 
        full_name=user.full_name, 
        email=user.email, 
        role=user.role, 
        facility_code=fac_code, 
        facility_name=fac_name
    )}