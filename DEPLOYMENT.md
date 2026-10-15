# 🚀 TIPE Deployment Guide

How this fork is deployed: the **frontend on Vercel** and the **backend on Render**, both free tier and both auto-deploying from `main`.

| Part | Host | URL |
|---|---|---|
| Frontend (Vite + React) | Vercel | https://tipe-loc.vercel.app |
| Backend (FastAPI, Docker) | Render | https://tipe-backend.onrender.com |
| API docs (Swagger) | Render | https://tipe-backend.onrender.com/docs |
| Health check | Render | https://tipe-backend.onrender.com/health |
| Database | MongoDB Atlas | `tipecluster` |

```
Browser ──► Vercel (tipe-loc.vercel.app)
               │  VITE_API_URL
               ▼
            Render (tipe-backend.onrender.com) ──► MongoDB Atlas
                                                ├─► Pinecone
                                                └─► Groq / Gemini
```

---

## Why not Hugging Face Spaces?

`backend/Dockerfile` and the frontmatter in `backend/README.md` were written for a Hugging Face Docker Space. Since mid-2026, though, HF only lets free accounts create **Static** Spaces. Docker and Gradio Spaces need a paid plan, and a Static Space can't run Python. The same Dockerfile runs on Render unchanged.

## Why the backend is not on Vercel

When you import the repo, Vercel detects both apps and offers to host `backend/` as serverless functions. **Don't do that:**
- The Python dependencies (numpy, scipy, scikit-learn and the rest) add up to about 240 MB, which is right at Vercel's 250 MB function limit.
- Serverless functions are killed after each request, so the lead scraper and other long-running jobs would be cut off.

---

## 1. Frontend → Vercel

1. Go to https://vercel.com/new, sign in with GitHub and pick `theonlyoneH/Tipe_LOC`.
2. Vercel shows "Multiple applications detected". Click **Import single project** on the **app (Vite)** row, not the backend row and not the "Services" preset.
3. Settings:

   | Field | Value |
   |---|---|
   | Project Name | `tipe-loc` (use a hyphen; the name becomes the URL) |
   | Root Directory | `./` |
   | Application Preset | Vite |
   | Build / Output / Install | leave the overrides **off** (defaults: `vite build`, `dist`, `yarn install`) |

4. Environment variable:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://tipe-backend.onrender.com` (no trailing slash) |

5. Click **Deploy**.

`vercel.json` already rewrites every route to `/`, so refreshing a page like `/login` doesn't 404.

> ⚠️ Vite bakes `VITE_*` variables into the bundle **at build time**. After changing `VITE_API_URL`, go to **Deployments → ⋯ → Redeploy**, or the change won't take effect.

---

## 2. Backend → Render

1. Go to https://dashboard.render.com, sign in with GitHub, then **New + → Web Service** and pick `theonlyoneH/Tipe_LOC`.
2. Render sees `package.json` at the repo root and **autofills Node settings. Change them:**

   | Field | Value |
   |---|---|
   | Name | `tipe-backend` (this sets the URL) |
   | Root Directory | `backend` (fill this in first) |
   | Language | **Docker** (not Node) |
   | Branch | `main` |
   | Dockerfile Path | `./Dockerfile` |
   | Instance Type | **Free ($0)**, not the preselected $7 plan |

   Once you pick Docker, the Build and Start command fields go away, because the Dockerfile runs `uvicorn` on port 7860.

3. Environment variables (copy the values from your local `backend/.env`; **Add from .env** pastes them in one go):

   | Key | Value | Notes |
   |---|---|---|
   | `PORT` | `7860` | Tells Render which port the container listens on |
   | `ALLOWED_ORIGINS` | `https://tipe-loc.vercel.app` | Must match the Vercel URL **exactly**: no path, no trailing slash, or the browser blocks API calls (CORS) |
   | `MONGO_DETAILS` | Atlas `mongodb+srv://...` string | `localhost` won't work on Render |
   | `SECRET_KEY` | long random string | Render's **Generate** button works |
   | `GEMINI_API_KEYS` / `GROQ_API_KEYS` | LLM key(s), comma-separated | Optional. Keys are sorted by prefix (`gsk_` → Groq, `AIza` → Gemini), so putting one in the wrong variable still works |
   | `PINECONE_API_KEY` | | Optional |
   | `PINECONE_INDEX` | | Optional |
   | `SCRAPER_CONTACT` | `https://github.com/theonlyoneH/Tipe_LOC` | See below |

4. **MongoDB Atlas → Network Access:** add `0.0.0.0/0`. Render doesn't use a fixed IP address, so without this entry the database connection is refused.
5. Click **Deploy web service**. It's working when the logs show `Uvicorn running on http://0.0.0.0:7860`.

### What is `SCRAPER_CONTACT`?

It goes into the scraper's User-Agent header (`backend/scraper/common.py`):

```
TIPE-LeadResearch/1.0 (+https://github.com/theonlyoneH/Tipe_LOC)
```

It lets the sites the scraper visits (Wikidata, GLEIF, company websites) see who is crawling them and how to get in touch. Wikidata's bot policy asks for this, and bots without it are more likely to get rate-limited or blocked. It's not a secret and doesn't change app behaviour. If it isn't set, it falls back to `https://github.com/tipe-app`.

---

## 3. Verify

```bash
curl https://tipe-backend.onrender.com/health
# {"status":"ok","llm_provider":"groq","pinecone":true,"smtp":false}
```

- `llm_provider`: `groq`, `gemini` or `null` (no LLM; the app uses templated fallbacks)
- `pinecone`: `true` when both Pinecone variables are set
- `smtp`: `false` until `SMTP_HOST` and the related variables are set (needed only to send outreach emails)

`404 Not Found` on `GET /` or `/favicon.ico` in the Render logs is **expected**. The API has no root page; Render's own probe and browsers request it anyway.

Then open https://tipe-loc.vercel.app/login and sign in.

---

## 4. Keep-alive (free tier sleep)

Free Render services **sleep after about 15 minutes without traffic**, and the first request after that takes 30–60 seconds while it boots. `.github/workflows/keepalive.yml` pings `/health` and retries until the backend answers.

Setup: GitHub repo → **Settings → Secrets and variables → Actions → Variables** → add
`BACKEND_URL` = `https://tipe-backend.onrender.com`

> The workflow currently runs **once a day** (`41 6 * * *`). That was tuned for HF's 48-hour sleep and won't keep Render awake. To keep it warm, change the cron to `*/10 * * * *`. One service running 24/7 fits inside Render's free monthly hours.

---

## Updating

Push to `main`. Vercel and Render both rebuild automatically. Render only redeploys when files under `backend/` change.

```bash
git push origin main
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Render: `failed to read dockerfile: open Dockerfile: no such file or directory` | Root Directory isn't set. Set it to `backend` and the Dockerfile Path to `./Dockerfile`, then **Manual Deploy → Deploy latest commit** |
| Render tries `yarn build` / `yarn start` | Language was left on Node. Switch it to Docker |
| Browser console: CORS error | `ALLOWED_ORIGINS` doesn't exactly match the Vercel URL |
| Frontend still calls the old or localhost API | `VITE_API_URL` was changed without redeploying on Vercel |
| Backend logs: Mongo timeout / `ServerSelectionTimeoutError` | Atlas Network Access is missing `0.0.0.0/0`, or `MONGO_DETAILS` points to localhost |
| Service restarts with `Out of memory` | The free plan has 512 MB RAM and the ML dependencies are heavy. Trim `requirements.txt` or upgrade the instance |
| First request is very slow | The service was asleep (see Keep-alive) |
