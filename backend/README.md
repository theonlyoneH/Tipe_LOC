---
title: TIPE Backend
emoji: 🌍
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# TIPE backend (FastAPI)

Trade Intent Prediction Engine API: news-driven lead ranking, swipe feedback learning,
AI outreach and the real-company lead scraper.

Configure secrets in **Space → Settings → Variables and secrets** (see `.env.example`):
`MONGO_DETAILS`, `SECRET_KEY`, `GROQ_API_KEYS`, `PINECONE_API_KEY`, `PINECONE_INDEX`,
`ALLOWED_ORIGINS`, `SCRAPER_CONTACT`.

Health check: `GET /health` · API docs: `/docs`.
