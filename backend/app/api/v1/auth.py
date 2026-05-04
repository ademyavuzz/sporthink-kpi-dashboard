"""Auth router — `/api/v1/auth/*`.

Bkz: docs/overview/06-api-spec.md
     docs/overview/05-rbac-security.md §5.4 token & §5.7 cookie kuralları

Refresh token httpOnly cookie ile döner; body'de yer almaz. Frontend axios
client `withCredentials: true` ile bu cookie'yi otomatik gönderir.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models import User
from app.schemas import (
    LoginRequest,
    MeResponse,
    SuccessEnvelope,
    TokenResponse,
    UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "sporthink_refresh"


def _set_refresh_cookie(response: Response, token: str, max_age_seconds: int) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        max_age=max_age_seconds,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path="/api/v1/auth",
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
    )


def _client_ip(request: Request) -> str | None:
    # Reverse proxy varsa nginx'in X-Forwarded-For'unu set ettiği varsayılır;
    # production'da middleware ile trim edilebilir. Şimdilik en yakın peer.
    return request.client.host if request.client else None


@router.post(
    "/login",
    response_model=SuccessEnvelope[TokenResponse],
    summary="Email + parola ile giriş",
)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[TokenResponse]:
    user, access_token, refresh_jwt, refresh_exp = await auth_service.login(
        db,
        email=body.email,
        password=body.password,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    refresh_max_age = settings.refresh_token_expire_days * 24 * 3600
    _set_refresh_cookie(response, refresh_jwt, refresh_max_age)

    return SuccessEnvelope(
        data=TokenResponse(
            access_token=access_token,
            expires_in=settings.access_token_expire_minutes * 60,
            user=UserResponse.model_validate(user),
        )
    )


@router.post(
    "/refresh",
    response_model=SuccessEnvelope[TokenResponse],
    summary="Refresh cookie ile yeni access token üret",
)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[TokenResponse]:
    from app.core.exceptions import InvalidCredentialsError

    refresh_jwt = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_jwt:
        raise InvalidCredentialsError("Refresh token missing")

    user, access_token, new_refresh_jwt, _new_exp = await auth_service.refresh(
        db,
        refresh_jwt=refresh_jwt,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    refresh_max_age = settings.refresh_token_expire_days * 24 * 3600
    _set_refresh_cookie(response, new_refresh_jwt, refresh_max_age)

    return SuccessEnvelope(
        data=TokenResponse(
            access_token=access_token,
            expires_in=settings.access_token_expire_minutes * 60,
            user=UserResponse.model_validate(user),
        )
    )


@router.post(
    "/logout",
    response_model=SuccessEnvelope[dict],
    summary="Refresh token'ı revoke et ve cookie'yi temizle",
)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    """Logout idempotenttir — token yoksa veya geçersizse de 200 döner."""
    refresh_jwt = request.cookies.get(REFRESH_COOKIE_NAME)

    # Mevcut user'ı yumuşak çek — token süresi dolduysa bile logout cookie'yi
    # temizlemeli.
    user: User | None = None
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        try:
            user = await get_current_user(token=auth_header[7:], db=db)
        except Exception:  # noqa: BLE001
            user = None

    await auth_service.logout(
        db,
        refresh_jwt=refresh_jwt,
        user=user,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    _clear_refresh_cookie(response)
    return SuccessEnvelope(data={"logged_out": True})


@router.get(
    "/me",
    response_model=SuccessEnvelope[MeResponse],
    summary="Mevcut kullanıcı + izin listesi",
)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[MeResponse]:
    perms = await auth_service.get_permission_codes(db, current_user)
    return SuccessEnvelope(
        data=MeResponse(
            user=UserResponse.model_validate(current_user),
            permissions=perms,
        )
    )
