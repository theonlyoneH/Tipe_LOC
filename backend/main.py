from fastapi import FastAPI, HTTPException, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
import os
from dotenv import load_dotenv
from jose import jwt
from bson import ObjectId
load_dotenv()

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Configuration
MONGO_DETAILS = os.getenv("MONGO_DETAILS", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_DETAILS)
database = client.proexport_db
user_collection = database.get_collection("users")

# Auth Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

approved_collection = database.get_collection("approved_leads")
# Models
class UserSchema(BaseModel):
    email: EmailStr
    password: str
    category: str
    industry: str
    country: str
    description: Optional[str] = ""

class LoginSchema(BaseModel):
    email: EmailStr
    password: str

class UpdateUserSchema(BaseModel):
    description: Optional[str] = None
    industry: Optional[str] = None
    category: Optional[str] = None

# Helpers
def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Routes
@app.post("/register")
async def register_user(user: UserSchema = Body(...)):
    existing_user = await user_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_dict = user.dict()

    # ✅ Hardcode country based on category
    if user.category == "exporter":
        user_dict["country"] = "India"
    else:
        user_dict["country"] = "Global"

    # ✅ Hash password
    user_dict["password"] = get_password_hash(user.password)

    # ✅ Insert user
    new_user = await user_collection.insert_one(user_dict)

    return {
        "message": "User registered successfully",
        "id": str(new_user.inserted_id)
    }
@app.post("/login")
async def login_user(login: LoginSchema = Body(...)):
    user = await user_collection.find_one({"email": login.email})
    if not user or not verify_password(login.password, user["password"]):
        return {"success": False, "message": "Invalid email or password"}
    
    token = create_access_token(data={"sub": user["email"]}, expires_delta=timedelta(days=1))
    
    # Return user data (excluding password)
    user_data = {
    "email": user["email"],
    "category": user["category"],
    "industry": user["industry"],
    "country": user.get("country", ""),
    "description": user.get("description", "")
}
    
    return {
        "success": True,
        "token": token,
        "user": user_data
    }

@app.get("/user/profile")
async def get_profile(email: str):
    user = await user_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "email": user["email"],
        "category": user["category"],
        "industry": user["industry"],
        "country": user.get("country", ""),
        "description": user.get("description", "")
    }

@app.put("/user/profile")
async def update_profile(email: str, update_data: UpdateUserSchema = Body(...)):
    user = await user_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    await user_collection.update_one({"email": email}, {"$set": update_dict})
    return {"message": "Profile updated successfully"}

# Dummy chat endpoint to maintain compatibility with existing frontend
@app.post("/chat")
async def chat_endpoint(payload: dict = Body(...)):
    query = payload.get("query", "")
    # This is a placeholder for the actual AI logic
    return {"response": f"I received your query: {query}. How can I assist you with your export growth?"}

@app.get("/leads")
async def get_leads(industry: str, user_email: Optional[str] = None):
    if not industry:
        raise HTTPException(status_code=400, detail="Industry required")

    approved_ids = []

    # Only filter approved leads if user_email is provided
    if user_email:
        cursor = approved_collection.find({"user_email": user_email})
        async for doc in cursor:
            approved_ids.append(ObjectId(doc["lead_id"]))

    query = {
        "Industry": {"$regex": f"^{industry}$", "$options": "i"}
    }

    if approved_ids:
        query["_id"] = {"$nin": approved_ids}

    leads = []
    # Sort by rank descending — highest ranked leads appear first
    cursor = database.importers.find(query).sort("rank", -1)

    async for lead in cursor:
        lead["_id"] = str(lead["_id"])
        leads.append(lead)

    return leads


@app.post("/leads/{lead_id}/approve")
async def approve_lead(lead_id: str, payload: dict = Body(...)):
    user_email = payload.get("user_email")

    if not user_email:
        raise HTTPException(status_code=400, detail="User email required")

    existing = await approved_collection.find_one({
        "user_email": user_email,
        "lead_id": lead_id
    })

    if existing:
        raise HTTPException(status_code=400, detail="Already approved")

    lead = await database.importers.find_one({"_id": ObjectId(lead_id)})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead["_id"] = str(lead["_id"])

    await approved_collection.insert_one({
        "user_email": user_email,
        "lead_id": lead_id,
        "status": "approved",
        "approved_at": datetime.utcnow(),
        "lead_data": lead
    })

    return {"message": "Lead approved successfully"}
@app.get("/approved-leads")
async def get_approved_leads(user_email: str):
    leads = []

    cursor = approved_collection.find({"user_email": user_email})

    async for lead in cursor:
        lead["_id"] = str(lead["_id"])
        leads.append(lead)

    return leads
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
