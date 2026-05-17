"""Auth router — `/api/v1/auth/*`.

Bkz: docs/overview/06-api-spec.md
     docs/overview/05-rbac-security.md §5.4 token & §5.7 cookie kuralları

Refresh token httpOnly cookie ile döner; body'de yer almaz. Frontend axios
client `withCredentials: true` ile bu cookie'yi otomatik gönderir.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import RefreshTokenMissingError
from app.dependencies import get_current_user, get_db
from app.models import User
from app.schemas import (
    AvatarResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MeResponse,
    MeUpdateRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
    SuccessEnvelope,
    TokenResponse,
    UserResponse,
    VerifyResetTokenResponse,
)
from app.services import auth_service, password_reset_service, profile_service

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "sporthink_refresh"


def _set_refresh_cookie(response: Response, token: str, max_age_seconds: int | None) -> None:
    """Refresh token cookie set eder.

    `max_age_seconds=None` → session cookie (browser kapanınca silinir,
    "Beni hatırla" işaretlenmediğinde böyledir).
    """
    kwargs: dict = {
        "key": REFRESH_COOKIE_NAME,
        "value": token,
        "httponly": True,
        "secure": settings.is_production,
        "samesite": "lax",
        "path": "/api/v1/auth",
    }
    if max_age_seconds is not None:
        kwargs["max_age"] = max_age_seconds
    response.set_cookie(**kwargs)


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
    refresh_max_age = settings.refresh_token_expire_days * 24 * 3600 if body.remember_me else None
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
    refresh_jwt = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_jwt:
        raise RefreshTokenMissingError()

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


@router.patch(
    "/me",
    response_model=SuccessEnvelope[UserResponse],
    summary="Kendi profil bilgilerini güncelle",
)
async def update_me(
    body: MeUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[UserResponse]:
    """Email değişmiyor — admin işidir. Diğer profil alanları (ad, soyad,
    telefon, departman, görev) güncellenebilir."""
    user = await profile_service.update_me(
        db,
        current_user,
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
        department=body.department,
        job_title=body.job_title,
        bio=body.bio,
        birth_date=body.birth_date,
        location=body.location,
        website_url=body.website_url,
        linkedin_url=body.linkedin_url,
        twitter_url=body.twitter_url,
        github_url=body.github_url,
        instagram_url=body.instagram_url,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return SuccessEnvelope(data=UserResponse.model_validate(user))


@router.post(
    "/me/avatar",
    response_model=SuccessEnvelope[AvatarResponse],
    summary="Profil resmi yükle (PNG/JPG/WEBP, max 2MB)",
)
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[AvatarResponse]:
    content = await file.read()
    user = await profile_service.upload_avatar(
        db,
        current_user,
        content=content,
        content_type=file.content_type,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return SuccessEnvelope(data=AvatarResponse(avatar_url=user.avatar_url))


@router.delete(
    "/me/avatar",
    response_model=SuccessEnvelope[AvatarResponse],
    summary="Profil resmini kaldır",
)
async def remove_avatar(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[AvatarResponse]:
    user = await profile_service.remove_avatar(
        db,
        current_user,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return SuccessEnvelope(data=AvatarResponse(avatar_url=user.avatar_url))


@router.post(
    "/me/change-password",
    response_model=SuccessEnvelope[ChangePasswordResponse],
    summary="Kendi şifreni değiştir (mevcut şifre doğrulamasıyla)",
)
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ChangePasswordResponse]:
    """Başarılı olunca tüm aktif refresh tokenlar revoke edilir; refresh
    cookie de temizlenir. Frontend'in kullanıcıyı login sayfasına yönlendirmesi
    beklenir."""
    await profile_service.change_password(
        db,
        current_user,
        current_password=body.current_password,
        new_password=body.new_password,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    _clear_refresh_cookie(response)
    return SuccessEnvelope(data=ChangePasswordResponse(success=True))


def _mask_email(email: str) -> str:
    """`adem.yavuz@gmail.com` → `ad***@gmail.com` — token verify response'da."""
    try:
        local, domain = email.split("@", 1)
    except ValueError:
        return email
    if len(local) <= 2:
        return f"{local[0]}***@{domain}"
    return f"{local[:2]}***@{domain}"


@router.post(
    "/forgot-password",
    response_model=SuccessEnvelope[ForgotPasswordResponse],
    summary="Şifre sıfırlama linki email ile gönderir",
)
async def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ForgotPasswordResponse]:
    """Email enum'unu sızdırmamak için yanıt her zaman aynı (`{sent: true}`).

    Kullanıcı yoksa ya da pasifse sessizce no-op olur — saldırgan response'tan
    email kayıtlı mı anlayamaz. Audit log'a yine yazılır.
    """
    await password_reset_service.request_password_reset(
        db,
        email=body.email,
        lang=body.lang,
        ip=_client_ip(request),
    )
    return SuccessEnvelope(data=ForgotPasswordResponse(sent=True))


@router.get(
    "/verify-reset-token",
    response_model=SuccessEnvelope[VerifyResetTokenResponse],
    summary="Davet/sıfırlama token'ı geçerli mi?",
)
async def verify_reset_token(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[VerifyResetTokenResponse]:
    """Frontend reset sayfası mount olunca çağırır — token bozuk veya süresi
    dolmuşsa kullanıcıya hata mesajı gösterir."""
    row, user = await password_reset_service.verify_token(db, token)
    return SuccessEnvelope(
        data=VerifyResetTokenResponse(
            valid=True,
            purpose=row.purpose.value,
            user_email=_mask_email(user.email),
            first_name=user.first_name,
        )
    )


@router.post(
    "/reset-password",
    response_model=SuccessEnvelope[ResetPasswordResponse],
    summary="Token ile yeni şifre belirler (davet veya sıfırlama)",
)
async def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ResetPasswordResponse]:
    """Token'ı yakar (used_at), yeni şifreyi hash'leyip kaydeder, tüm
    aktif refresh token'ları revoke eder. Kullanıcı yeniden login olmalıdır.
    """
    user = await password_reset_service.consume_token_and_set_password(
        db,
        token=body.token,
        new_password=body.new_password,
        ip=_client_ip(request),
    )
    return SuccessEnvelope(data=ResetPasswordResponse(success=True, email=user.email))
