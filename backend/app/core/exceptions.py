from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


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
