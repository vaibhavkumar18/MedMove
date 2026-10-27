from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.db import repositories as repo
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings

def signup(db: Session, payload):
    if payload.join_code != settings.DEMO_HOSPITAL_JOIN_CODE:
        raise HTTPException(status_code=401, detail={"code": "INVALID_JOIN_CODE", "message": "Invalid demo join code."})
    
    existing = repo.get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=409, detail={"code": "EMAIL_ALREADY_EXISTS", "message": "Email already registered."})
    
    pwd_hash = hash_password(payload.password)
    try:
        user = repo.create_hospital_user(db, payload.full_name, payload.email.lower(), pwd_hash, payload.facility_code)
    except ValueError:
        raise HTTPException(status_code=422, detail={"code": "INVALID_FACILITY", "message": "Facility not found or inactive."})
        
    token = create_access_token(str(user.id), user.role)
    return token, user

def login(db: Session, payload):
    user = repo.get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash) or not user.is_active:
        raise HTTPException(status_code=401, detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password."})
        
    token = create_access_token(str(user.id), user.role)
    return token, user