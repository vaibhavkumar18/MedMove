# app/features/auth/router.py
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.features.auth import service
from app.features.auth.schemas import LoginRequest, AuthResponse, UserProfile
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        max_age=settings.JWT_EXPIRES_MINUTES * 60,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/",
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    token, user = service.login(db, payload)

    fac_code = user.facility.facility_code if user.facility else None
    fac_name = user.facility.name if user.facility else None

    _set_auth_cookie(response, token)
    return AuthResponse(
        access_token=None,
        user=UserProfile(
            user_id=str(user.id),
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            facility_code=fac_code,
            facility_name=fac_name,
        ),
    )


@router.post("/logout", status_code=204)
def logout(response: Response):
    _clear_auth_cookie(response)


@router.get("/me")
def me(user=Depends(get_current_user)):
    fac_code = user.facility.facility_code if user.facility else None
    fac_name = user.facility.name if user.facility else None

    return {
        "user": UserProfile(
            user_id=str(user.id),
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            facility_code=fac_code,
            facility_name=fac_name,
        )
    }
