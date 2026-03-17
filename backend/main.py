from fastapi import FastAPI, HTTPException, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
import os
import feedparser
from dotenv import load_dotenv
from jose import jwt
from bson import ObjectId
import threading
from pinecone import Pinecone
import google.generativeai as genai
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

# -----------------------------
# Gemini Setup (Round Robin)
# -----------------------------
GEMINI_API_KEYS = [k.strip() for k in os.getenv("GEMINI_API_KEYS", "").split(",") if k.strip()]

key_index = 0
key_lock = threading.Lock()

def get_next_model():
    global key_index
    with key_lock:
        api_key = GEMINI_API_KEYS[key_index]
        key_index = (key_index + 1) % len(GEMINI_API_KEYS)
    genai.configure(api_key=api_key)
    return genai.GenerativeModel("gemini-2.5-flash")


# -----------------------------
# Pinecone Setup
# -----------------------------
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX"))

ALL_NAMESPACES = {
    "exporters": "exporter",
    "importers": "importer",
    "globalnews": "news"
}

def detect_namespaces(query):
    q = query.lower()

    keyword_map = {
        "exporters": [
            "exporter", "export", "supplier", "manufacturer",
            "expoter", "exportor", "suplier", "manufaturer", "manfacturer"
        ],

        "importers": [
            "importer", "import", "buyer", "procurement",
            "impoter", "importor", "byer", "procument", "procuremnet"
        ],

        "globalnews": [
            "news", "trade", "market", "tariff", "policy",
            "newz", "trad", "markit", "tarrif", "polcy"
        ]
    }

    matched = [ns for ns, keywords in keyword_map.items() if any(k in q for k in keywords)]

    return matched if matched else list(ALL_NAMESPACES.keys())


def retrieve(query):
    namespaces = detect_namespaces(query)
    all_hits = []

    for ns in namespaces:
        try:
            res = index.search(
                namespace=ns,
                query={"inputs": {"text": query}, "top_k": 10}
            )
            hits = res.get("result", {}).get("hits", [])
            for h in hits:
                h["_namespace"] = ns
                h["_record_type"] = ALL_NAMESPACES[ns]
            all_hits.extend(hits)
        except Exception as e:
            print("Pinecone error:", e)

    all_hits.sort(key=lambda x: x.get("_score", 0), reverse=True)
    return all_hits, namespaces


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


def generate_answer(query, results, namespaces):
    if not results:
        return "No relevant trade data found."

    context = ""
    for r in results[:5]:
        context += f"{r.get('fields', {})}\n"

    prompt = f"""
    You are TIPE AI.

    User Query:
    {query}

    Data:
    {context}

    Give a clear trade insight summary.
    """

    try:
        model = get_next_model()
        res = model.generate_content(prompt)
        return res.text.strip()
    except Exception as e:
        return f"AI Error: {str(e)}"
    
@app.post("/chat")
async def chat_endpoint(payload: dict = Body(...)):
    query = payload.get("query", "")

    if not query:
        raise HTTPException(status_code=400, detail="Query required")

    try:
        results, namespaces = retrieve(query)
        answer = generate_answer(query, results, namespaces)

        return {
            "response": answer
        }

    except Exception as e:
        print("Chat error:", e)
        return {
            "response": "⚠️ Error processing your request"
        }
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
    cursor = database.importers.find(query).sort([
    ("rank", -1),
    ("Response_Probability", -1),
    ("Intent_Score", -1)
])

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

# Industry keyword mapping (IMPORTANT)
INDUSTRY_KEYWORDS = {
    "textiles": [
        "textile", "fabric", "cotton", "yarn", "garment", "apparel",
        "knitwear", "weaving", "spinning", "dyeing", "fashion export",
        "cloth", "polyester", "denim", "silk", "wool"
    ],

    "pharma": [
        "pharma", "drug", "medicine", "biotech", "vaccine",
        "clinical trial", "api", "formulation", "fda", "healthcare",
        "generic drug", "biosimilar", "pharmaceutical export"
    ],

    "automobile": [
        "car", "auto", "vehicle", "ev", "electric vehicle",
        "automobile", "automotive", "car export", "auto parts",
        "battery", "charging station", "mobility"
    ],

    "electronics": [
        "electronics", "semiconductor", "chip", "pcb", "consumer electronics",
        "mobile", "smartphone", "laptop", "display", "microchip",
        "electronics export", "hardware", "device"
    ],

    "agriculture": [
        "agriculture", "farming", "crop", "wheat", "rice",
        "grain", "harvest", "fertilizer", "pesticide",
        "agri export", "food grain", "farm produce"
    ],

    "steel": [
        "steel", "iron", "metal", "alloy", "steel export",
        "construction steel", "scrap metal", "metal industry",
        "mining", "ore"
    ],

    "oil_gas": [
        "oil", "gas", "petroleum", "crude oil", "lng",
        "refinery", "energy export", "fuel", "diesel",
        "natural gas", "opec"
    ],

    "logistics": [
        "logistics", "shipping", "freight", "container",
        "supply chain", "port", "cargo", "shipping rates",
        "warehouse", "distribution", "last mile delivery"
    ],

    "fmcg": [
        "fmcg", "consumer goods", "retail", "packaged goods",
        "personal care", "home care", "food products",
        "beverages", "brand", "supermarket"
    ],

    "food": [
        "food export", "processed food", "dairy",
        "meat export", "seafood", "spices", "edible oil",
        "sugar", "tea", "coffee"
    ],

    "chemicals": [
        "chemical", "specialty chemicals", "petrochemical",
        "fertilizer", "industrial chemical", "plastic",
        "polymer", "resin", "coating"
    ],

    "construction": [
        "construction", "infrastructure", "real estate",
        "cement", "building material", "contractor",
        "housing", "urban development"
    ],

    "energy": [
        "renewable energy", "solar", "wind energy",
        "green energy", "power generation", "electricity",
        "battery storage", "energy transition"
    ],

    "mining": [
        "mining", "coal", "iron ore", "gold",
        "minerals", "extraction", "mineral export"
    ],

    "defense": [
        "defense", "military", "weapons", "aerospace",
        "defense export", "missile", "fighter jet"
    ],

    "aerospace": [
        "aviation", "aircraft", "aerospace",
        "airline", "cargo plane", "boeing", "airbus"
    ],

    "it": [
        "software", "it services", "technology",
        "saas", "cloud", "ai", "cybersecurity",
        "data center", "digital transformation"
    ],

    "finance": [
        "banking", "finance", "investment",
        "stock market", "inflation", "interest rate",
        "trade finance", "currency"
    ],

    "retail": [
        "retail", "ecommerce", "shopping",
        "consumer demand", "online retail",
        "marketplace", "store"
    ],

    "default": [
        "trade", "export", "import", "logistics",
        "supply chain", "global trade", "tariff",
        "trade agreement", "customs", "shipment"
    ]
}

@app.get("/trade-news")
async def get_trade_news(industry: str = "default"):
    try:
        feeds = [
            "https://feeds.reuters.com/reuters/businessNews",
            "http://feeds.bbci.co.uk/news/business/rss.xml",
            
        ]

        keywords = INDUSTRY_KEYWORDS.get(industry.lower(), INDUSTRY_KEYWORDS["default"])

        articles = []

        for url in feeds:
            feed = feedparser.parse(url)

            for entry in feed.entries:
                title = entry.title.lower()
                summary = entry.get("summary", "").lower()

                # 🔥 Base score (everyone gets included)
                score = 0.5  

                # ✅ Industry relevance boost (NOT strict filter anymore)
                if any(k in title or k in summary for k in keywords):
                    score += 0.2

                # 🎯 Trade signals
                if "export" in title or "import" in title:
                    score += 0.2
                if "surge" in title or "growth" in title:
                    score += 0.1
                if "ban" in title or "crisis" in title:
                    score += 0.1

                score = round(min(score, 0.95), 2)

                articles.append({
                    "headline": entry.title,
                    "url": entry.link,
                    "published": entry.get("published", ""),
                    "source": url,
                    "ai_analysis": {
                        "trade_signal_score": score,
                        "importance_tag": (
                            "High Impact" if score >= 0.75 else
                            "Moderate" if score >= 0.6 else
                            "Low"
                        )
                    }
                })

        # 🔥 Sort by score (best first)
        articles = sorted(
            articles,
            key=lambda x: x["ai_analysis"]["trade_signal_score"],
            reverse=True
        )

        # 🔥 Limit results
        return articles[:15]

    except Exception as e:
        print("Trade news error:", e)
        return []   
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
