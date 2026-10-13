"""TIPE backend entry point: `uvicorn main:app`."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from core import db, errors
from core.config import settings
from routers import analytics, auth, chat, content, leads, meetings, outreach
from services import llm

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="TIPE - Trade Intent Prediction Engine", version="2.0.0")

errors.install(app)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    # Auth uses bearer tokens, not cookies; credentials can't be combined with "*".
    allow_credentials="*" not in settings.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

for r in (auth, leads, outreach, meetings, content, analytics, chat):
    app.include_router(r.router)


@app.on_event("startup")
async def startup() -> None:
    await db.ensure_indexes()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "llm_provider": llm.provider(),
        "pinecone": bool(settings.PINECONE_API_KEY and settings.PINECONE_INDEX),
        "smtp": bool(settings.SMTP_HOST),
    }


if __name__ == "__main__":
    import os

    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8005")), reload=False)
