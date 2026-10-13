from datetime import datetime, timedelta

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from . import db
from .errors import unauthorized
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def create_access_token(email: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=settings.TOKEN_TTL_HOURS)
    return jwt.encode({"sub": email, "exp": expire}, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def public_user(user: dict) -> dict:
    return {
        "email": user["email"],
        "category": user.get("category", "exporter"),
        "industry": user.get("industry", ""),
        "country": user.get("country", ""),
        "company_name": user.get("company_name", ""),
        "description": user.get("description", ""),
    }


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not creds:
        raise unauthorized("NOT_AUTHENTICATED", "Please sign in to continue.")
    try:
        payload = jwt.decode(creds.credentials, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        email = payload.get("sub")
    except JWTError:
        raise unauthorized("SESSION_EXPIRED", "Your session has expired. Please sign in again.")
    user = await db.users.find_one({"email": email})
    if not user:
        raise unauthorized("ACCOUNT_NOT_FOUND", "This account no longer exists. Please sign in again.")
    return user
