# 🚀 TIPE - Trade Intent Prediction Engine

## 🌐 Live Access
- **Frontend**: [https://tipe-theta.vercel.app/](https://tipe-theta.vercel.app/)
- **Backend API**: [https://darshanpurohit-tipe-backend.hf.space/](https://darshanpurohit-tipe-backend.hf.space/)
- **API Documentation**: [https://darshanpurohit-tipe-backend.hf.space/docs](https://darshanpurohit-tipe-backend.hf.space/docs)

## 🔐 Test Credentials
Use these credentials to explore the platform:
- **Email**: `test@gmail.com`
- **Password**: `123456`

---

## 📝 Overview
TIPE is an enterprise-grade AI-powered export matchmaking platform that transforms static trade listings into an adaptive, intent-driven, swipe-based global trade intelligence system. Built for hackathon excellence, it leverages RAG (Retrieval-Augmented Generation) to connect exporters and importers with high precision.

## ✨ Key Functionalities

### 1. 🎯 AI-Powered Lead Discovery (RAG)
- **Vector Search**: Semantic search across "exporters", "importers", and "news" using Pinecone.
- **Tinder-Style Swipe**: Revolutionary B2B lead vetting with physics-based gestures (Right = Approve, Left = Reject, Up = Skip).
- **Gemini Reasoning**: AI-generated explanations for *why* a lead matches your profile.

### 2. 📊 Intelligence & Analytics
- **Live Dashboard**: Real-time KPI tracking, pipeline visualization, and trade momentum indexing.
- **Deep Analytics**: Interactive charts generated via Recharts showing ICP distribution and market segments.
- **Trade Momentum Index**: A proprietary score combining vector similarity and intent signals.

### 3. 💬 Automated Outreach & CRM
- **Multi-channel Conversations**: Integrated management for LinkedIn, Email, and WhatsApp.
- **AI-Handled Chats**: Toggle AI mode to let the engine handle initial outreach and lead qualification.
- **Approved Leads CRM**: Searchable database of vetted leads with quick-action contact buttons.

### 4. 📅 Meeting & Content Engine
- **Smart Meetings**: Calendar integration with AI-generated meeting summaries.
- **Content Engine**: AI-powered LinkedIn automation to generate and schedule high-engagement trade posts.

### 5. 🛡️ Trust & Security
- **Trust Layer**: Blockchain-verified firmographics (SHA-256 hashing) representing verified trade records.
- **JWT Auth**: Secure session management with Bcrypt password hashing.

---

## 🛠 Tech Stack

### Frontend
- **React 18** + TypeScript + Vite
- **Zustand**: Global state management
- **Framer Motion**: Gesture-driven animations
- **Tailwind CSS v4**: Modern utility-first styling
- **TanStack Query**: Optimistic UI updates and server state

### Backend
- **FastAPI**: High-performance Python async framework
- **MongoDB**: User profiles and lead persistence
- **Pinecone**: Vector database for semantic RAG workflows
- **Google Gemini**: Round-robin API key rotation for production-scale reasoning

---

## 📁 Project Structure

```text
├── backend/                # FastAPI Application
│   ├── main.py            # RAG Logic & API Endpoints
│   ├── Dockerfile         # Hugging Face Spaces Deployment
│   └── requirements.txt   # Python Dependencies
├── src/                   # React Frontend
│   ├── app/
│   │   ├── pages/         # Dashboard, ApproveLeads, Analytics, etc.
│   │   ├── components/    # SwipeCard, KPICard, Layout
│   │   └── store/         # Zustand Store
│   └── styles/            # Tailwind Global Styles
└── .env                   # Configuration (VITE_API_URL, etc.)
```

## 🚀 Getting Started

### Installation
```bash
# Frontend
npm install
npm run dev

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## 🏆 Hackathon Standouts
1. **Swipe Gesture Innovation**: First B2B platform using Tinder-style mechanics for lead qualification.
2. **Robust RAG Pipeline**: Combines Pinecone vector namespaces with Gemini for contextual reasoning.
3. **Production Ready**: Full CI/CD via Vercel and Hugging Face, optimized with Docker.

---
**Built with ❤️ for the future of Global Trade**

