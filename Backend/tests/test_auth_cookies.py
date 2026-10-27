import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db
from app.core.security import create_access_token, hash_password
from app.db import models
from app.main import app


def _coordinator(db):
    user = models.User(
        id=uuid.uuid4(),
        full_name="Cookie Coordinator",
        email="cookie-coordinator@test.com",
        password_hash=hash_password("correct-password"),
        role="NETWORK_COORDINATOR",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_login_sets_httponly_cookie_and_me_restores_session(db):
    _coordinator(db)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides.pop(get_current_user, None)
    try:
        with TestClient(app) as client:
            login = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "cookie-coordinator@test.com",
                    "password": "correct-password",
                },
            )
            assert login.status_code == 200
            assert login.json()["access_token"] is None
            cookie = login.cookies.get("medmove_access_token")
            assert cookie
            assert "HttpOnly" in login.headers["set-cookie"]
            assert "Max-Age=28800" in login.headers["set-cookie"]
            assert "Path=/" in login.headers["set-cookie"]
            assert "SameSite=lax" in login.headers["set-cookie"]

            restored = client.get("/api/v1/auth/me")
            assert restored.status_code == 200
            assert restored.json()["user"]["email"] == "cookie-coordinator@test.com"
    finally:
        app.dependency_overrides.clear()


def test_logout_clears_cookie_and_bearer_tokens_remain_supported(db):
    user = _coordinator(db)
    token = create_access_token(str(user.id), user.role)
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            bearer = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert bearer.status_code == 200

            login = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "cookie-coordinator@test.com",
                    "password": "correct-password",
                },
            )
            assert login.status_code == 200
            logout = client.post("/api/v1/auth/logout")
            assert logout.status_code == 204
            assert "Max-Age=0" in logout.headers["set-cookie"]
            assert client.get("/api/v1/auth/me").status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_invalid_and_expired_tokens_are_rejected(db):
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            invalid = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer not-a-token"},
            )
            expired_token = jwt.encode(
                {
                    "sub": str(uuid.uuid4()),
                    "role": "NETWORK_COORDINATOR",
                    "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
                },
                settings.JWT_SECRET_KEY,
                algorithm="HS256",
            )
            expired = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {expired_token}"},
            )

        assert invalid.status_code == 401
        assert expired.status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_hospital_user_cookie_restores_facility_scoped_session(db):
    facility = models.Facility(
        id=uuid.uuid4(),
        facility_code="HC01",
        name="Cookie Hospital",
        facility_type="HOSPITAL",
        district="Test",
        state="Test",
        is_active=True,
    )
    user = models.User(
        id=uuid.uuid4(),
        full_name="Cookie Hospital User",
        email="cookie-hospital@test.com",
        password_hash=hash_password("correct-password"),
        role="HOSPITAL_USER",
        facility=facility,
        is_active=True,
    )
    db.add_all([facility, user])
    db.commit()
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            login = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "cookie-hospital@test.com",
                    "password": "correct-password",
                },
            )
            me = client.get("/api/v1/auth/me")
            latest = client.get("/api/v1/optimization-runs/latest")

        assert login.status_code == 200
        assert me.status_code == 200
        assert me.json()["user"]["role"] == "HOSPITAL_USER"
        assert me.json()["user"]["facility_code"] == "HC01"
        assert latest.status_code == 200
    finally:
        app.dependency_overrides.clear()
