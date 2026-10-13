"""Uniform, user-safe API errors.

Every error response has the same JSON shape:

    {
      "error": {
        "code": "LEAD_NOT_FOUND",          # stable machine-readable code (UI maps it to friendly copy)
        "message": "This lead no longer exists.",
        "status": 404,
        "request_id": "a1b2c3d4e5f6",      # quote this to support; it's also in the server logs
        "fields": {"email": "..."}        # only for validation errors
      },
      "detail": "This lead no longer exists."   # kept for older clients
    }

Stack traces and internal details are logged server-side and never sent to users.
"""
import uuid
from typing import Dict, Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymongo.errors import AutoReconnect, NetworkTimeout, ServerSelectionTimeoutError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from .config import log


class AppError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: Optional[Dict[str, str]] = None):
        super().__init__(message)
        self.code, self.message, self.status, self.fields = code, message, status, fields


# Convenience constructors keep router code short and codes consistent.
def not_found(what: str, code: Optional[str] = None) -> AppError:
    return AppError(code or f"{what.upper().replace(' ', '_')}_NOT_FOUND", f"This {what.lower()} no longer exists or isn't yours.", 404)


def bad_request(code: str, message: str) -> AppError:
    return AppError(code, message, 400)


def unauthorized(code: str, message: str) -> AppError:
    return AppError(code, message, 401)


def conflict(code: str, message: str) -> AppError:
    return AppError(code, message, 409)


# Fallback codes/messages when a plain HTTPException (or framework error) is raised.
_STATUS_DEFAULTS = {
    400: ("BAD_REQUEST", "The request couldn't be processed."),
    401: ("NOT_AUTHENTICATED", "Please sign in to continue."),
    403: ("FORBIDDEN", "You don't have access to this."),
    404: ("NOT_FOUND", "We couldn't find what you were looking for."),
    405: ("METHOD_NOT_ALLOWED", "This action isn't supported."),
    409: ("CONFLICT", "This conflicts with existing data."),
    413: ("PAYLOAD_TOO_LARGE", "That's too much data to send at once."),
    422: ("VALIDATION_FAILED", "Some fields need attention."),
    429: ("RATE_LIMITED", "Too many requests. Please wait a moment and try again."),
    500: ("INTERNAL_ERROR", "Something went wrong on our side."),
    502: ("UPSTREAM_ERROR", "A service we depend on isn't responding."),
    503: ("SERVICE_UNAVAILABLE", "The service is temporarily unavailable."),
}


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "") or uuid.uuid4().hex[:12]


def _payload(request: Request, code: str, message: str, status: int, fields: Optional[dict] = None) -> JSONResponse:
    rid = _request_id(request)
    error = {"code": code, "message": message, "status": status, "request_id": rid}
    if fields:
        error["fields"] = fields
    return JSONResponse({"error": error, "detail": message}, status_code=status, headers={"X-Request-ID": rid})


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Tags every request with an ID (reusing the client's X-Request-ID if sent)."""

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get("X-Request-ID", "")
        request.state.request_id = incoming[:32] if incoming.isalnum() else uuid.uuid4().hex[:12]
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response


def _friendly_field_error(err: dict) -> str:
    kind, ctx = err.get("type", ""), err.get("ctx") or {}
    if kind == "missing":
        return "This field is required."
    if "email" in kind or "email" in err.get("msg", "").lower():
        return "Enter a valid email address."
    if kind == "string_too_short":
        n = ctx.get("min_length", 1)
        return "This field is required." if n == 1 else f"Must be at least {n} characters."
    if kind == "string_too_long":
        return f"Must be at most {ctx.get('max_length', '')} characters."
    if kind == "literal_error":
        return f"Must be one of: {ctx.get('expected', '')}."
    if kind.startswith(("greater_than", "less_than")):
        return err.get("msg", "Value out of range.")
    if "datetime" in kind or "date" in kind:
        return "Enter a valid date and time."
    return err.get("msg", "Invalid value.")


def install(app: FastAPI) -> None:
    app.add_middleware(RequestIdMiddleware)

    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        if exc.status >= 500:
            log.error("[%s] %s: %s", _request_id(request), exc.code, exc.message)
        return _payload(request, exc.code, exc.message, exc.status, exc.fields)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException):
        code, default_msg = _STATUS_DEFAULTS.get(exc.status_code, ("HTTP_ERROR", "Request failed."))
        message = exc.detail if isinstance(exc.detail, str) and exc.detail not in ("Not Found", "Method Not Allowed") else default_msg
        return _payload(request, code, message, exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError):
        fields = {}
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path")]
            fields[".".join(loc) or "request"] = _friendly_field_error(err)
        first = next(iter(fields.items()), ("request", "Invalid request."))
        message = f"{first[0].replace('_', ' ').capitalize()}: {first[1]}" if first[0] != "request" else first[1]
        return _payload(request, "VALIDATION_FAILED", message, 422, fields)

    @app.exception_handler(ServerSelectionTimeoutError)
    @app.exception_handler(AutoReconnect)
    @app.exception_handler(NetworkTimeout)
    async def _db_down(request: Request, exc: Exception):
        log.error("[%s] Database unavailable: %s", _request_id(request), exc)
        return _payload(request, "DATABASE_UNAVAILABLE", "We can't reach our database right now. Please try again shortly.", 503)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        log.exception("[%s] Unhandled error on %s %s", _request_id(request), request.method, request.url.path)
        return _payload(request, "INTERNAL_ERROR", "Something went wrong on our side. We've logged it.", 500)
