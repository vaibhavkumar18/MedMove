from datetime import datetime, timedelta, timezone
import jwt
from passlib.hash import argon2
from app.core.config import settings

def hash_password(password: str) -> str:
    return argon2.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return argon2.verify(plain, hashed)

def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRES_MINUTES)
    to_encode = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm="HS256")

def verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None