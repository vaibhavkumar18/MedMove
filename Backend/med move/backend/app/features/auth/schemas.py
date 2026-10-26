from pydantic import BaseModel, EmailStr, Field

class SignupRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)
    facility_code: str
    join_code: str

class LoginRequest(BaseModel):
    email: str
    password: str

class UserProfile(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    facility_code: str | None = None
    facility_name: str | None = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile