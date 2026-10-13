from typing import Literal, Optional

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, EmailStr, Field

from core import db
from core.errors import conflict, unauthorized
from core.security import create_access_token, get_current_user, hash_password, public_user, verify_password
from services import leads as lead_service

router = APIRouter(tags=["auth"])


class RegisterSchema(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    category: Literal["exporter", "importer"]
    industry: str = Field(min_length=1)
    country: Optional[str] = ""
    company_name: Optional[str] = ""
    description: Optional[str] = ""


class LoginSchema(BaseModel):
    email: EmailStr
    password: str


class UpdateUserSchema(BaseModel):
    category: Optional[Literal["exporter", "importer"]] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    company_name: Optional[str] = None
    description: Optional[str] = None


def _session(user: dict) -> dict:
    return {"success": True, "token": create_access_token(user["email"]), "user": public_user(user)}


@router.post("/register")
async def register(payload: RegisterSchema = Body(...)):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise conflict("EMAIL_TAKEN", "An account with this email already exists. Try signing in.")
    doc = payload.model_dump()
    doc.update(email=email, password=hash_password(payload.password))
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"message": "User registered successfully", "id": str(res.inserted_id), **_session(doc)}


@router.post("/login")
async def login(payload: LoginSchema = Body(...)):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password"]):
        raise unauthorized("INVALID_CREDENTIALS", "Incorrect email or password.")
    return _session(user)


@router.get("/user/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    return public_user(user)


@router.put("/user/profile")
async def update_profile(payload: UpdateUserSchema = Body(...), user: dict = Depends(get_current_user)):
    update = {k: (v.strip() if isinstance(v, str) else v) for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"_id": user["_id"]}, {"$set": update})
        # Industry / category / country change which leads exist and how they rank.
        from routers.leads import invalidate_user

        invalidate_user(user["email"])
    user.update(update)
    return public_user(user)


@router.get("/meta/industries")
async def industries():
    return await lead_service.industries()
