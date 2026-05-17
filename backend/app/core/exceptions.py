import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class SporthinkException(Exception):
    code: str = "INTERNAL_ERROR"
    status_code: int = 500
    message: str = "An unexpected error occurred"

    def __init__(
        self,
        message: str | None = None,
        *,
        field: str | None = None,
        params: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message
        self.field = field
        self.params = params

    def to_response(self) -> dict[str, Any]:
        error: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
        }
        if self.field:
            error["field"] = self.field
        if self.params:
            error["params"] = self.params
        return {"success": False, "error": error}


class AuthenticationError(SporthinkException):
    code = "AUTH_REQUIRED"
    status_code = 401
    message = "Authentication required"


class TokenExpiredError(AuthenticationError):
    code = "TOKEN_EXPIRED"
    message = "Access token has expired"


class InvalidCredentialsError(AuthenticationError):
    code = "INVALID_CREDENTIALS"
    message = "Email or password is incorrect"


class RefreshTokenMissingError(AuthenticationError):
    """`/auth/refresh` çağrısında refresh cookie yoksa.

    `INVALID_CREDENTIALS` yerine ayrı kod — frontend "session bitmiş, yeniden
    giriş yap" mesajı için kullanır; "yanlış parola" mesajıyla karıştırılmaz.
    """

    code = "REFRESH_TOKEN_MISSING"
    message = "Refresh token cookie is missing"


class PermissionDeniedError(SporthinkException):
    code = "PERMISSION_DENIED"
    status_code = 403
    message = "You do not have permission to perform this action"


class ResourceNotFoundError(SporthinkException):
    code = "RESOURCE_NOT_FOUND"
    status_code = 404
    message = "Requested resource was not found"


class ValidationError(SporthinkException):
    code = "VALIDATION_ERROR"
    status_code = 422
    message = "Validation failed"


class InvalidOrExpiredTokenError(ValidationError):
    code = "INVALID_OR_EXPIRED_TOKEN"
    message = "Reset token is invalid or expired"


class LastSuperAdminError(ValidationError):
    # Pattern C invariant: sistemde her zaman ≥1 aktif Super Admin bulunmalı.
    # Son Super Admin'i silme, pasifleştirme veya rolünü düşürme girişiminde raise.
    code = "LAST_SUPER_ADMIN"
    message = "Cannot remove the last active super admin"


class SelfDestructiveActionError(ValidationError):
    # Peer model (GitHub-style): kullanıcı yönetim panelinden kendi hesabı
    # üzerinde silme, rol değiştirme veya pasifleştirme yapamaz — bu işlemler
    # başka bir admin tarafından yapılmalıdır. Yanlışlıkla kendini kilitleme
    # senaryosunu önler.
    code = "SELF_DESTRUCTIVE_ACTION_FORBIDDEN"
    message = (
        "You cannot delete, deactivate, or change the role of your own "
        "account from the user management panel"
    )


class ConflictError(SporthinkException):
    code = "CONFLICT"
    status_code = 409
    message = "Resource conflict"


class RateLimitError(SporthinkException):
    code = "RATE_LIMIT_EXCEEDED"
    status_code = 429
    message = "Rate limit exceeded"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(SporthinkException)
    async def _sporthink_exception_handler(_request: Request, exc: SporthinkException):
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())

    @app.exception_handler(StarletteHTTPException)
    async def _starlette_http_exception_handler(_request: Request, exc: StarletteHTTPException):
        # Routing 404 / 405 ve diğer Starlette/FastAPI default HTTPException'ları
        # `{"detail": "..."}` döner — §6.2 envelope kontratını ihlal eder.
        # Status code'a göre code map'le, mesajı taşı.
        code_map = {
            401: "AUTH_REQUIRED",
            403: "PERMISSION_DENIED",
            404: "RESOURCE_NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            429: "RATE_LIMIT_EXCEEDED",
        }
        code = code_map.get(exc.status_code, "INTERNAL_ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {"code": code, "message": message},
            },
        )

    # Generic Exception için middleware yaklaşımı: Starlette'in ServerErrorMiddleware
    # `@app.exception_handler(Exception)`'dan önce devreye giriyor; bu yüzden
    # custom Exception handler hiç çağrılmıyor. Outermost middleware seviyesinde
    # try/except ile yakalayıp envelope döneriz. SporthinkException ve
    # StarletteHTTPException üstte özel handler'lara düşmeye devam eder.
    @app.middleware("http")
    async def _catch_all_exceptions_middleware(request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            # SporthinkException / Starlette HTTPException üstteki handler'lardan
            # zaten 4xx response ile dönmüş olmalı — buraya sadece beklenmeyenler düşer.
            # `exc_info=True` exception bilgisini log'a tam stack ile yazar.
            logger.error(
                "unhandled_exception",
                extra={"path": request.url.path, "method": request.method},
                exc_info=True,
            )
            # `BaseException` (KeyboardInterrupt vb.) yutmuyoruz — sadece Exception.
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "An unexpected error occurred",
                    },
                },
            )

    @app.exception_handler(RequestValidationError)
    async def _request_validation_exception_handler(_request: Request, exc: RequestValidationError):
        # FastAPI default `{"detail":[...]}` formatını §6.2 envelope'a çevir.
        # İlk hatayı temsili olarak field/message'a koy; tüm hatalar params.errors'a.
        errors = exc.errors()
        first = errors[0] if errors else {}
        loc = first.get("loc", [])
        field = ".".join(str(p) for p in loc[1:]) if len(loc) > 1 else None
        message = first.get("msg") or "Validation failed"
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": message,
                    "field": field,
                    "params": {"errors": _serialize_validation_errors(errors)},
                },
            },
        )


def _serialize_validation_errors(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """RequestValidationError.errors() çıktısını JSON-safe forma getirir.

    Pydantic v2 bazı alanlarda `ctx` içinde Exception veya non-serializable
    obje koyar; envelope'a girmeden önce string'e indir.
    """
    cleaned: list[dict[str, Any]] = []
    for err in errors:
        loc = err.get("loc", [])
        cleaned.append(
            {
                "field": ".".join(str(p) for p in loc[1:]) if len(loc) > 1 else None,
                "type": err.get("type"),
                "message": err.get("msg"),
            }
        )
    return cleaned
