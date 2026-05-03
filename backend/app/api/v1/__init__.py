from fastapi import APIRouter

api_router = APIRouter(prefix="/api/v1")

# Sprint 2+ — router'lar burada include edilir:
# from app.api.v1 import auth, users, roles, kpi, dashboard, imports
# api_router.include_router(auth.router)
# api_router.include_router(users.router)
# ...
