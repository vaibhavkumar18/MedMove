from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.repositories import get_user_by_id
from app.core.security import verify_token

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "INVALID_TOKEN", "message": "Invalid or expired token"})
    
    user = get_user_by_id(db, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "USER_NOT_FOUND", "message": "User not found or inactive"})
    return user

def require_hospital_user(user = Depends(get_current_user)):
    if user.role != "HOSPITAL_USER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "HOSPITAL_USER_REQUIRED", "message": "Access denied"})
    return user

def require_coordinator(user = Depends(get_current_user)):
    if user.role != "NETWORK_COORDINATOR":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "COORDINATOR_REQUIRED", "message": "Access denied"})
    return user