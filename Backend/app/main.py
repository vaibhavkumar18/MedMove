from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.features.auth.router import router as auth_router
from app.features.inventory.router import router as inv_router
from app.features.catalog.router import router as catalog_router
from app.features.optimization.router import router as opt_router
from app.features.dashboard.router import router as dash_router

app = FastAPI(title="MedMove API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in settings.FRONTEND_ORIGINS.split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(inv_router, prefix="/api/v1")
app.include_router(catalog_router, prefix="/api/v1")
app.include_router(opt_router, prefix="/api/v1")
app.include_router(dash_router, prefix="/api/v1")

@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "medmove-api"}