<div align="center">

# 🌍 TIPE — Trade Intent Prediction Engine

### *Next-Gen AI Trade Intelligence & Autonomous Outreach Platform*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.128-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18.2-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.3-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)
[![TailwindCSS v4](https://img.shields.io/badge/TailwindCSS-v4.1-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-Async_Motor-47A248.svg?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Groq LLM](https://img.shields.io/badge/Groq-Llama_3.3_70B-F55036.svg)](https://groq.com)
[![Pinecone](https://img.shields.io/badge/Pinecone-Vector_DB-000000.svg)](https://www.pinecone.io)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-Random_Forest-F7931E.svg?logo=scikit-learn&logoColor=white)](https://scikit-learn.org)
[![Leaflet](https://img.shields.io/badge/Leaflet-Geospatial_Map-199900.svg?logo=leaflet&logoColor=white)](https://leafletjs.com)

<p align="center">
  <a href="https://tipe-theta.vercel.app/"><strong>🌐 Live Web Application</strong></a> •
  <a href="https://darshanpurohit-tipe-backend.hf.space/"><strong>⚡ Backend API</strong></a> •
  <a href="https://darshanpurohit-tipe-backend.hf.space/docs"><strong>📖 Interactive Swagger Docs</strong></a> •
  <a href="docs/TIPE_IMPLEMENTATION_GUIDE.md"><strong>📑 Implementation Guide</strong></a>
</p>

</div>

---

## 📌 Executive Summary

**TIPE (Trade Intent Prediction Engine)** is an intelligent B2B trade-matchmaking and sales-engagement ecosystem. Traditional international trade prospecting relies on static, months-old directories and impersonal mass emailing with response rates below 1%. 

TIPE revolutionizes this paradigm through a closed-loop intelligence architecture:
1. **Live Geopolitical Intelligence**: Continuously ingests and classifies global trade news into actionable opportunities and risk signals.
2. **Adaptive Market-Regime Ranking**: Dynamically alters the ranking pipeline based on current trade volatility using strategy and decorator design patterns.
3. **Frictionless Swipe Vetting**: Exporters and importers evaluate verified leads using intuitive Tinder-style card gestures mapped to an interactive 3D-feel geospatial world map.
4. **Machine Learning from User Feedback**: An online Random Forest classifier and reason-attribution engine learn per-user preferences in real time with exponential time-decay weighting.
5. **Autonomous Contextual Outreach**: Every approved lead instantly triggers an AI agent (Groq Llama 3.3 70B / Gemini) that drafts customized multi-channel outreach referencing the exact real-time news driver that triggered the match.

---

## 🚀 Key Highlights & Capabilities

### 1. 📰 Market-Regime News Intelligence
- Ingests live RSS streams from Google News and BBC Business, classified via sentiment and topic tagging.
- Headlines are scored into **Opportunity (+)**, **Risk/Tariff (-)**, and **Neutral** categories with decay weighting based on recency.
- Detects the macro **Market Regime**:
  - `calm`: Moderate news influence (weight: 0.15).
  - `active`: Elevated headline sensitivity (weight: 0.30).
  - `boom`: Opportunity-dominated market (weight: 0.35 + `MomentumDecorator`).
  - `shock`: Tariff/crisis volatility (weight: 0.45 + `RiskAversionDecorator`).

### 2. 🧠 Dynamic Ranking Engine (Strategy + Decorator)
- **Base Ranker Selection**: Employs heuristic `StaticFitRanker` initially, automatically graduating to an online `RandomForestRanker` as the user accumulates swipe decisions.
- **Composable Decorator Chain**:
  ```
  Base Ranker (Static / Random Forest)
      │
      ▼
  NewsImpact Decorator (Regime-weighted news sentiment)
      │
      ▼
  Momentum / RiskAversion (Regime-triggered boosts/penalties)
      │
      ▼
  Pinecone Semantic Match (Vector cosine similarity)
      │
      ▼
  SwipeFeedback Decorator (Reason-based penalty & approval boost)
      │
      ▼
  SkipPenalty Decorator (Temporal back-off for skipped leads)
      │
      ▼
  Diversity Decorator (Prevents single-country clustering)
  ```
- **Transparent Explainability**: Every lead card provides an inspectable `score_breakdown` drawer displaying the exact numerical contribution from every algorithmic layer.

### 3. 🌲 Online Machine Learning & Rejection Intelligence
- **Why Was It Rejected?**: When rejecting a lead, users can tag one of five explicit reasons (or press keys `1`–`5`):
  - `wrong_market`: Penalizes leads from the same country.
  - `too_small`: Penalizes leads below the target revenue/employee threshold.
  - `low_intent`: Penalizes leads with lower calculated intent.
  - `wrong_channel`: Demotes leads requiring the rejected communication channel.
  - `not_relevant`: Penalizes general lookalikes across all feature vectors.
- **Inferred Attribution**: If skipped or unclassified, the engine calculates the maximum divergence against the user's historical approvals and infers the rejection cause automatically.
- **Exponential Half-Life**: User actions decay over a configurable half-life (default: 72 hours), ensuring the ranking model dynamically adapts to shifting procurement needs without getting trapped in historical biases.

### 4. 🗺️ Geospatial Deck Map Integration
- Built with **Leaflet** and **OpenStreetMap** (zero API keys required, customizable via tile URLs).
- Underneath the swipe deck, the map automatically flies with smooth camera panning to the country of the currently active prospect.
- Renders geodesic trade routes between the user's home country and the prospect's port of origin.
- Visualizes global trade news hotspots with live sentiment color coding (green = opportunity, red = tariff/risk).

### 5. 🌐 Ethical Open-Data Lead Discovery Scraper
- **100% Compliant & Open**: Zero scraping of LinkedIn or search engines.
- **Data Ingestion Pipeline**:
  1. **Wikidata SPARQL**: Queries active enterprises filtered by industry and sub-industry taxonomy with revenue, employee headcount, and registered LEI.
  2. **GLEIF Registry**: Verifies official legal entity identifiers (LEI) and enriches registered headquarters city.
  3. **Robots.txt-Compliant Web Crawler**: Inspects homepage and `/contact` page with strict rate limits, extracts public role-based mailboxes (`info@`, `sales@`, `export@`), and scans for buyer vs. manufacturer phrasing.
- **Deployment Flexibility**: Runs on-demand during user registration, via an always-on background worker, or as a scheduled GitHub Actions cron job every 6 hours.

### 6. 💬 Autonomous Multi-Channel Outreach & Copilot
- **Provider-Agnostic LLM Engine**: Powered by Groq (Llama 3.3 70B) or Google Gemini 2.5 Flash with automatic key rotation and graceful fallback to battle-tested parametric templates.
- **News-Grounded Openers**: AI draft messages directly cite recent market developments that justify immediate outreach.
- **Autopilot vs. Copilot**:
  - *Autopilot ON*: Incoming prospect messages are analyzed and replied to autonomously.
  - *Autopilot OFF*: Responses are staged as rich drafts for human review, editing, and one-click approval.
- **Thread Intelligence**: Continuous extraction of prospect sentiment, sales funnel stage, next best action, and meeting intent.
- **Full Meeting Lifecycle**: One-click meeting scheduling, automated transcription summary extraction, and post-meeting follow-up generation.
- **Real SMTP Dispatch**: Integrates with live SMTP mail servers or generates instant deep-links for WhatsApp, LinkedIn, and default email clients.

### 7. 📊 LinkedIn Content Engine & Analytics
- **Thought Leadership Generation**: Creates ready-to-post LinkedIn content synthesizing current trade news and portfolio trends.
- **Real-Time Analytics Dashboard**: Visualizes pipeline velocity, channel conversion rates, geographic deal distribution, and approval funnels.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Vercel Edge)                                │
│   React 18 • TypeScript • Vite • Tailwind CSS v4 • TanStack Query • Leaflet     │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ HTTPS / REST API + Bearer JWT
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND API (FastAPI)                                 │
│   FastAPI 0.128 • Async Motor • Pydantic v2 • Scikit-Learn • GZip Middleware    │
├──────────────────────────────────────┬──────────────────────────────────────────┤
│ Routers:                             │ Services:                                │
│  • /auth (JWT & Profiles)            │  • ranking/ (Regimes, Rankers, Feedback) │
│  • /leads (Deck, Swipes, Insights)   │  • news (RSS Feeds, Sentiment Scorer)    │
│  • /conversations (Outreach & Chat)  │  • outreach (AI Drafting & SMTP Mailer)  │
│  • /meetings (Booking & Summaries)   │  • llm (Groq Llama 3.3 / Gemini Flash)   │
│  • /content & /analytics             │  • vector (Pinecone Semantic RAG)        │
└──────────────┬───────────────────────┼──────────────────────────┬───────────────┘
               │                       │                          │
               ▼                       ▼                          ▼
      ┌─────────────────┐    ┌──────────────────┐       ┌──────────────────┐
      │  MongoDB Atlas  │    │  Groq / Gemini   │       │  Pinecone Vector │
      │ Users, Leads,   │    │  Llama 3.3 70B   │       │  Lead & News     │
      │ Swipes, Comms   │    │  Key Rotation    │       │  Embeddings      │
      └────────▲────────┘    └──────────────────┘       └──────────────────┘
               │
               │ Upserts enriched leads
      ┌────────┴──────────────────────────────────────────────────────────────────┐
      │                         LEAD SCRAPER WORKER                               │
      │   Wikidata SPARQL (CC0) ──► GLEIF LEI Registry ──► robots.txt Web Crawler │
      │   (GitHub Actions Cron / Standalone Docker Worker / On-Demand API Trigger)│
      └───────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
.
├── backend/                        # FastAPI Backend Application
│   ├── core/                       # Core infrastructure & configuration
│   │   ├── config.py               # Central settings loaded from environment
│   │   ├── db.py                   # Async Motor Mongo client, indexes & helpers
│   │   ├── errors.py               # Standardized API error responses
│   │   └── security.py             # JWT token creation, decoding & bcrypt hashing
│   ├── routers/                    # Clean REST API router endpoints
│   │   ├── analytics.py            # Sales funnel, channel conversions & trends
│   │   ├── auth.py                 # Registration, login & profile management
│   │   ├── chat.py                 # Contextual RAG chat assistant
│   │   ├── content.py              # AI LinkedIn content generator
│   │   ├── leads.py                # Lead deck retrieval, swipes, undo & feedback
│   │   ├── meetings.py             # Meeting scheduling, AI summaries & follow-ups
│   │   └── outreach.py             # Messaging threads, autopilot & drafts
│   ├── services/                   # Business logic and domain services
│   │   ├── ranking/                # The adaptive ranking engine
│   │   │   ├── regime.py           # Market regime detection (calm/active/boom/shock)
│   │   │   ├── rankers.py          # StaticFitRanker & RandomForestRanker
│   │   │   ├── decorators.py       # News, Momentum, Risk, Vector, Feedback decorators
│   │   │   ├── feedback.py         # Reason attribution & time-decay penalties
│   │   │   ├── features.py         # Feature vector extraction for ML models
│   │   │   └── engine.py           # Dynamic pipeline orchestrator
│   │   ├── leads.py                # Lead normalization & data provider selection
│   │   ├── llm.py                  # Multi-key Groq & Gemini provider with failover
│   │   ├── news.py                 # RSS fetching, sentiment parsing & TTL caching
│   │   ├── outreach.py             # Outreach drafting, reply handling & SMTP delivery
│   │   └── vector.py               # Pinecone vector retrieval integration
│   ├── scraper/                    # Autonomous open-data lead sourcing pipeline
│   │   ├── providers/              # Wikidata SPARQL & GLEIF Registry adapters
│   │   ├── enrich/                 # robots.txt compliant web crawler & text analyzer
│   │   ├── pipeline.py             # Discovery, validation and scoring pipeline
│   │   ├── scoring.py              # Heuristic lead quality scoring
│   │   └── worker.py               # CLI worker for cron, one-off, or daemon runs
│   ├── Dockerfile                  # API Docker container definition
│   ├── Dockerfile.scraper          # Scraper worker Docker container definition
│   ├── main.py                     # API entry point & middleware wiring
│   └── requirements.txt            # Python dependencies with pinned versions
│
├── src/                            # Frontend Application (React 18 + TS + Vite)
│   ├── app/
│   │   ├── components/             # Reusable UI components
│   │   │   ├── DeckMap.tsx         # Leaflet world map with flight paths & news hotspots
│   │   │   ├── SwipeCard.tsx       # Interactive gesture-driven lead card
│   │   │   ├── EngineBadge.tsx     # Active market regime & pipeline badge
│   │   │   ├── NewsTicker.tsx      # Live streaming market headlines banner
│   │   │   ├── ChatWidget.tsx      # Floating RAG assistant widget
│   │   │   ├── Layout.tsx          # App navigation, sidebar & header
│   │   │   └── ...                 # Modal dialogs, skeletons, error boundaries
│   │   ├── lib/                    # Client libraries & utilities
│   │   │   ├── api.ts              # Typed API client with automatic token attachment
│   │   │   ├── queries.ts          # TanStack Query custom hooks with optimistic cache
│   │   │   ├── session.ts          # JWT session storage & auth listener
│   │   │   ├── types.ts            # TypeScript interfaces & domain models
│   │   │   └── utils.ts            # Formatting, styling & calculation helpers
│   │   ├── pages/                  # Route views
│   │   │   ├── Dashboard.tsx       # Executive overview & fast-action widgets
│   │   │   ├── ApproveLeads.tsx    # Tinder swipe vetting deck on interactive map
│   │   │   ├── ApprovedLeads.tsx   # Verified lead catalog & outreach triggers
│   │   │   ├── Conversations.tsx   # Multi-channel messaging threads & autopilot
│   │   │   ├── Meetings.tsx        # Calendar & AI meeting notes
│   │   │   ├── ContentEngine.tsx   # LinkedIn post generator
│   │   │   ├── Analytics.tsx       # Conversion metrics & geographic charts
│   │   │   └── Profile.tsx         # User preferences, industry & country settings
│   │   └── routes.tsx              # Lazy-loaded router configuration
│   ├── styles/                     # Tailwind CSS v4 & theme definitions
│   ├── index.html                  # HTML5 entry template
│   └── vite-env.d.ts               # Vite TypeScript typings
│
├── docs/
│   └── TIPE_IMPLEMENTATION_GUIDE.md # 50KB+ Deep technical guide & architecture doc
├── .github/
│   └── workflows/
│       └── scraper.yml             # Scheduled GitHub Actions cron scraper
├── package.json                    # Frontend dependencies & npm scripts
├── vite.config.ts                  # Vite build configuration with path aliases
└── tsconfig.json                   # Strict TypeScript compiler configuration
```

---

## 🛠️ Technology Stack

| Domain | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | React 18 + TypeScript | Component architecture with strict typing |
| **Build Tool** | Vite 6 | Rapid HMR and optimized tree-shaken production bundles |
| **Styling & Design** | Tailwind CSS v4 + Radix UI | Modern responsive UI, micro-animations and accessibility |
| **State & Cache** | TanStack Query v5 + Zustand | Server-state caching, prefetching, and client state management |
| **Geospatial Mapping**| Leaflet + React-Leaflet | Dynamic camera flight, world map and trade route visualization |
| **Motion & Gestures** | Framer Motion (Motion v12) | Smooth swipe card physics, drag animations and transitions |
| **Backend Framework** | FastAPI 0.128 + Starlette | High-performance asynchronous REST API with automatic OpenAPI docs |
| **Database** | MongoDB Atlas via Async Motor | Document storage for users, decisions, threads and scraped leads |
| **Machine Learning**  | Scikit-Learn | Online Random Forest classification trained per user |
| **LLM Engine**        | Groq (Llama 3.3 70B) / Gemini 2.5 | Multi-key rotated inference for outreach and analysis |
| **Vector Database**   | Pinecone v7 | Semantic search for lead and news embeddings |
| **Data Scraping**     | Wikidata SPARQL + GLEIF + Requests | CC0 enterprise knowledge graph extraction and LEI verification |

---

## ⚡ Quickstart & Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Yarn**: v1.22+ or modern Yarn / npm
- **Python**: v3.10, v3.11, or v3.12
- **MongoDB**: A free MongoDB Atlas cluster connection string (or local MongoDB on port 27017)

---

### Step 1: Clone Repository & Configure Environment

```bash
# Clone the repository
git clone https://github.com/your-username/tipe.git
cd tipe
```

#### Frontend Environment Setup:
```bash
# Copy frontend template
cp .env.example .env
```
Ensure `VITE_API_URL` points to your local backend:
```env
VITE_API_URL=http://localhost:8005
```

#### Backend Environment Setup:
```bash
cd backend
cp .env.example .env
```
Fill in the essential variables in `backend/.env`:
```env
MONGO_DETAILS=mongodb+srv://<username>:<password>@cluster.mongodb.net/
SECRET_KEY=generate-a-secure-random-secret-key-32-chars-minimum
# Optional: Set either Groq or Gemini for real AI inference (fallback templates used if empty)
GROQ_API_KEYS=gsk_your_groq_api_key_here
```

---

### Step 2: Start the Backend Service

```bash
cd backend

# Create and activate Python virtual environment
# On macOS / Linux:
python3 -m venv .venv
source .venv/bin/activate

# On Windows (PowerShell):
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
uvicorn main:app --reload --port 8005
```
The backend API is now running at **`http://localhost:8005`**.  
Interactive Swagger documentation is available at **`http://localhost:8005/docs`**.

---

### Step 3: Start the Frontend Application

In a new terminal window:
```bash
# From the repository root
yarn install

# Start Vite development server
yarn dev
```
Open **`http://localhost:5173`** in your browser to experience TIPE.

---

### Step 4: Running the Lead Scraper (Optional)

You can scrape real global companies for any industry anytime:

```bash
cd backend

# 1. Scrape an industry immediately (e.g. Textiles, Electronics, Pharmaceuticals)
python -m scraper.worker --industry "Textiles"

# 2. Run a one-off refresh across all stale industries (cron style)
python -m scraper.worker --once

# 3. Run as an always-on background worker polling every hour
python -m scraper.worker --loop --interval 3600
```

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_DETAILS` | **Yes** | `mongodb://localhost:27017` | MongoDB connection URI |
| `SECRET_KEY` | **Yes** | *Auto-generated ephemeral* | Secret string used to sign JWT session tokens |
| `MONGO_DB` | No | `proexport_db` | Target MongoDB database name |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated list of allowed CORS origins |
| `GROQ_API_KEYS` | No | `""` | Comma-separated Groq API keys (rotates round-robin) |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Target Groq LLM model ID |
| `GEMINI_API_KEYS`| No | `""` | Comma-separated Google Gemini API keys |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Target Gemini LLM model ID |
| `PINECONE_API_KEY`| No | `""` | Pinecone vector index API key |
| `PINECONE_INDEX` | No | `""` | Target Pinecone index name |
| `NEWS_CACHE_SECONDS` | No | `600` | In-memory cache duration for RSS news queries |
| `NEWS_WEIGHTS` | No | `calm:0.15,active:0.30,...` | News impact multiplier per market regime |
| `RF_MIN_DECISIONS` | No | `8` | Minimum swipes before Random Forest activates |
| `FEEDBACK_HALF_LIFE_HOURS` | No | `72` | Time-decay rate for previous user swipe actions |
| `DEMO_USER_EMAILS` | No | `test@gmail.com` | Accounts that receive the curated demo dataset |
| `SCRAPER_CONTACT` | No | `https://github.com/tipe-app` | Contact URL/email identifying the scraper User-Agent |
| `SCRAPE_ON_DEMAND` | No | `true` | Allows API to initiate background scrape on new user sign-up |
| `SMTP_HOST` | No | `""` | SMTP mail server hostname for live email delivery |
| `SMTP_PORT` | No | `587` | SMTP mail server port |
| `SMTP_USER` | No | `""` | SMTP authentication username |
| `SMTP_PASSWORD` | No | `""` | SMTP authentication password |
| `SMTP_FROM` | No | `""` | From email address for dispatched messages |

### Frontend (`.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | **Yes** | `http://localhost:8005` | Base HTTP endpoint for the backend API |
| `VITE_MAP_TILES` | No | *OpenStreetMap tiles* | Custom map tile server URL template |
| `VITE_MAP_ATTRIBUTION` | No | *OSM contributors* | Custom map attribution HTML string |

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register` | Create user profile and trigger initial industry scrape |
| `POST` | `/login` | Authenticate user credentials and return bearer JWT |
| `GET` | `/user/profile` | Retrieve authenticated user settings and country preferences |
| `PUT` | `/user/profile` | Update user country, export category and outreach settings |
| `GET` | `/leads` | Fetch ranked swipe deck, active market regime, and pipeline details |
| `POST` | `/leads/{id}/decision` | Record card swipe action (`approved`, `rejected`, `skipped`) |
| `DELETE`| `/leads/{id}/decision` | Undo last card swipe and remove associated initial draft |
| `POST` | `/leads/{id}/feedback` | Record specific rejection attribution (`wrong_market`, `too_small`, etc.) |
| `GET` | `/leads/{id}/insight` | Generate contextual AI explanation for why a lead was recommended |
| `GET` | `/approved-leads` | List all vetted and approved leads with outreach status |
| `GET` | `/trade-news` | Public endpoint returning classified news headlines by industry |
| `GET` | `/conversations` | Retrieve all active outreach conversation threads |
| `GET` | `/conversations/{id}` | Retrieve message history and metadata for a specific lead thread |
| `PATCH`| `/conversations/{id}` | Toggle AI autopilot mode or switch preferred channel |
| `POST` | `/conversations/{id}/messages` | Send message or log prospect response (`sender: "lead"`) |
| `POST` | `/conversations/{id}/messages/{mid}/approve` | Approve, modify or discard an AI-generated draft |
| `POST` | `/conversations/{id}/suggest` | Generate real-time AI suggested response options |
| `POST` | `/conversations/{id}/analyze` | Perform sentiment, sales stage, and meeting intent analysis |
| `GET` | `/meetings` | Retrieve scheduled meetings and upcoming calendar items |
| `POST` | `/meetings` | Schedule a confirmed meeting with a vetted lead |
| `POST` | `/meetings/{id}/summary` | Generate automated meeting summary and key action items |
| `POST` | `/meetings/{id}/follow-up`| Draft automated follow-up communication after a meeting |
| `GET` | `/content` | Retrieve saved and published LinkedIn content posts |
| `POST` | `/content/generate` | Generate AI trade intelligence post based on live news |
| `GET` | `/analytics` | Retrieve conversion funnel, channel performance, and weekly velocity |
| `POST` | `/chat` | Context-aware RAG assistant answering trade and platform queries |
| `GET` | `/health` | Server health check reporting LLM, Pinecone, and SMTP status |

---

## ⌨️ Swipe Deck Keyboard Shortcuts

The Approve Leads screen supports complete hands-on-keyboard operation:

| Key | Action |
|---|---|
| <kbd>→</kbd> or <kbd>Enter</kbd> / <kbd>Space</kbd> | **Approve Lead** (Swipes card right, triggers AI outreach) |
| <kbd>←</kbd> | **Reject Lead** (Swipes card left, reveals feedback reason chips) |
| <kbd>↑</kbd> | **Skip Lead** (Swipes card up, returns to deck later) |
| <kbd>Z</kbd> | **Undo Swipe** (Reverts last decision and cleans up pending draft) |
| <kbd>1</kbd> | Select Rejection Reason: **Wrong Market** |
| <kbd>2</kbd> | Select Rejection Reason: **Too Small** |
| <kbd>3</kbd> | Select Rejection Reason: **Low Intent** |
| <kbd>4</kbd> | Select Rejection Reason: **Wrong Channel** |
| <kbd>5</kbd> | Select Rejection Reason: **Not Relevant** |

---

## 🧪 Testing & Verification

```bash
# Run TypeScript typecheck across frontend codebase
yarn typecheck

# Run production build to verify bundles
yarn build

# Test backend health endpoint
curl http://localhost:8005/health
```

---

## 🔒 Security & Data Privacy

- **No Hardcoded Secrets**: Every secret, API key, and database credential is strictly loaded via environment variables and excluded by `.gitignore`.
- **Stateless Authentication**: Cryptographically signed JSON Web Tokens (HMAC-SHA256) with configurable TTL.
- **Password Security**: Passwords hashed using industry-standard `bcrypt` with salt rounds.
- **Ethical Web Scraping**: The lead scraper identifies itself with a transparent `User-Agent` containing the operator's contact address, respects `robots.txt`, implements exponential backoff, and only accesses public legal registers and contact pages.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built with ❤️ for global trade innovation. Powered by FastAPI, React, Groq, and MongoDB.</sub>
</div>
