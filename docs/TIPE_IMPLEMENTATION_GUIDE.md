# TIPE: Implementation Guide & Interview Cheat Sheet

> **TIPE (Trade Intent Prediction Engine)** is a B2B trade-matchmaking platform. Exporters and importers swipe on
> potential trade partners. A ranking engine re-orders those partners using live global news and what
> the user swipes, and every approval starts AI-written outreach.

This document covers *what* was built, *how* it works (with the exact formulas used in the code), and *why*
each decision was made. The last section is a question bank in the style an interview panel would use.

---

## Table of contents

1. [The product in 60 seconds](#1-the-product-in-60-seconds)
2. [Architecture](#2-architecture)
3. [Data sources: demo vs. real leads](#3-data-sources-demo-vs-real-leads)
4. [News intelligence pipeline](#4-news-intelligence-pipeline)
5. [The ranking engine (the core algorithm)](#5-the-ranking-engine-the-core-algorithm)
6. [Swipe feedback: learning *why* a lead was rejected](#6-swipe-feedback-learning-why-a-lead-was-rejected)
7. [The random forest](#7-the-random-forest)
8. [The real-lead scraper](#8-the-real-lead-scraper)
9. [AI outreach](#9-ai-outreach)
10. [Caching (every layer)](#10-caching-every-layer)
11. [Performance & UX work](#11-performance--ux-work)
12. [Security](#12-security) · [Error handling](#12b-error-handling)
13. [Testing & verification](#13-testing--verification)
14. [Deployment](#14-deployment)
15. [Known limitations & what I'd do next](#15-known-limitations--what-id-do-next)
16. [Interview question bank](#16-interview-question-bank)
17. [Glossary](#17-glossary)

---

## 1. The product in 60 seconds

| Step | What the user sees | What happens underneath |
|---|---|---|
| Sign up | Picks exporter/importer, industry, country | JWT session issued. A background scrape starts for that industry if it has no cached leads |
| Approve Leads | Tinder-style deck on top of a world map | Leads ranked by the regime-aware pipeline. The map flies to each lead's country |
| Swipe right | "Approved, AI is drafting an opener" | Decision stored, conversation created, LLM writes the first message in a background task |
| Swipe left | "Why not?" chips (or our guess) | Reason stored (explicit or inferred). Similar leads get penalised on the next re-rank |
| Conversations | Chat thread with drafts, autopilot, AI insights | Log the prospect's reply and the AI answers. Sentiment, stage and next action are computed |
| Meetings / Content / Analytics | Real data, AI summaries and posts | All computed from the user's own decisions, conversations and the news |

**Headline features**
- **Dynamic ranking:** the algorithm itself changes with the news (strategy + decorator patterns).
- **Learns from rejections:** reason-aware penalties plus a per-user random forest.
- **Real leads:** companies from open data in every country, refreshed by a deployable worker.
- **Live map:** the swipe deck sits on a map that follows each lead's country.
- **AI outreach:** Groq (Llama 3.3 70B), with template fallback so the app still works without an LLM.

---

## 2. Architecture

```
                         ┌──────────────────────────── Frontend (Vercel) ───────────────────────────┐
                         │ React 18 + TS + Vite · TanStack Query (persisted) · Zustand · Leaflet    │
                         │ Pages lazy-loaded · hover prefetch · idle chunk preloading               │
                         └───────────────▲──────────────────────────────────────────────────────────┘
                                         │ HTTPS + Bearer JWT (GZip)
┌────────────────────────────────────────┴──── Backend API (Hugging Face Space, FastAPI) ───────────┐
│ routers/    auth · leads · outreach · meetings · content · analytics · chat                       │
│ services/   news ──► ranking/ (regime · rankers · decorators · feedback · features · engine)      │
│             leads (normalise) · outreach (LLM) · llm (Groq/Gemini) · vector (Pinecone)            │
│ scraper/    pipeline (on-demand for new users)                                                    │
└──────┬──────────────────────┬──────────────────────┬──────────────────────────┬───────────────────┘
       │                      │                      │                          │
   MongoDB Atlas          Groq LLM API         Pinecone (RAG)         Google News / BBC RSS
 users, decisions,
 conversations, messages,
 meetings, content,
 scraped_leads, scrape_jobs
       ▲
       │ upserts
┌──────┴───────── Scraper worker (GitHub Actions cron every 6 h, or Docker worker) ─────────────────┐
│ Wikidata SPARQL ──► store ──► enrich: GLEIF registry + company website (robots.txt-aware) ──► score│
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Backend layout

| Folder | Responsibility |
|---|---|
| `core/` | `config.py` (every setting comes from env vars), `db.py` (collections, indexes, serialisation), `security.py` (JWT, bcrypt) |
| `services/news.py` | Fetches, classifies and caches headlines |
| `services/ranking/` | The ranking engine. Sections 5–7 |
| `services/leads.py` | Picks the source collection (demo or real) and normalises every lead into one shape |
| `services/outreach.py` | Opening messages, replies, conversation analysis, SMTP delivery |
| `services/llm.py` | Provider-agnostic LLM client with key rotation and failover |
| `scraper/` | Open-data lead discovery and enrichment. Section 8 |

**Why this split?** The routers stay thin (HTTP concerns only), and the services contain the logic, so the
same code runs inside the API and inside the standalone worker. The scraper reuses `core/` and stores
leads in a shape `services/leads.normalize()` already understands.

---

## 3. Data sources: demo vs. real leads

| User | Lead source | Why |
|---|---|---|
| Accounts in `DEMO_USER_EMAILS` (default `test@gmail.com`) | `importers` / `exporters` collections (the original synthetic ML dataset, which has a pre-computed `rank`) | Reviewers get a full, deterministic demo |
| Everyone else | `scraped_leads` (real companies), filtered by `industry_key` | Real users get real, contactable companies |

`services/leads.normalize(doc, role)` maps either schema to one API shape: `company_name`, `country`,
`intent_score`, `response_probability`, `signals[]`, `contact{email, phone, linkedin, website}`,
`base_score`, `is_real`, `data_source`, `source_url`, and so on. **The ranking engine never needs to know
where a lead came from.**

**Base score** (the offline fit, 0–1):
- If `rank` exists: `base = rank/100`. For scraped leads there's also a role boost: exporters get
  `+0.03 × min(3, buyer_signal)` and importers get `+0.03 × min(3, maker_signal)`.
- Otherwise: `base = 0.4·intent + 0.3·response_prob + 0.15·prompt_response + 0.15·good_payment`.

---

## 4. News intelligence pipeline

File: `services/news.py`

1. **Fetch** three feeds in parallel (thread pool, 8 s timeout each): a Google News search for the
   industry (`"<industry>" (export OR import OR tariff OR trade OR demand)`), a general global-trade
   search, and BBC Business. Duplicate headlines are removed by a normalised title key.
2. **Classify** each headline with word-boundary regexes. Plain substring search caused false positives:
   `"api"` matched *capital* and `"ai"` matched *said*.
   - **Countries:** an alias table (e.g. `"dubai" → UAE`), regions (`"EU" → Germany, France, …`), and a
     case-sensitive `US` check, so the pronoun "us" doesn't count.
   - **Polarity:** `polarity = tanh(Σ opportunity_weights − Σ risk_weights)`, in −1…+1.
     Opportunity terms include *surge, free trade, deal, demand*; risk terms include *war, sanction,
     embargo, anti-dumping*.
   - **Signal:** `opportunity` if polarity > 0.15, `risk` if < −0.15, otherwise `neutral`. A tariff
     mention overrides a non-opportunity signal to `tariff`.
   - **Relevance:** `min(1, 0.25·industry_term_hits + 0.12·trade_term_hits)`.
   - **Recency:** `exp(−age_hours / 48)`.
   - **Trade signal score:** `0.35 + 0.35·relevance + 0.2·min(1, |polarity| + 0.3·tariff) + 0.1·recency`.
3. **Cache** per industry for 10 minutes. If every feed fails, the last good copy is served for another 60 s.

**Why keyword classification instead of an LLM?** It's deterministic, free, and takes a millisecond per
headline. That matters because the classification feeds the ranking on every request. An LLM would add
latency, cost and non-determinism to the hot path.

---

## 5. The ranking engine (the core algorithm)

Folder: `services/ranking/`. **Design patterns: Strategy (base model) + Decorator (adjustment layers),
selected by a market-regime detector.**

### 5.1 The flow

```
articles ──► detect regime ──┐
swipes  ──► FeedbackModel ───┼──► build_pipeline() ──► pipeline.rank(leads, ctx) ──► squash ──► deck
leads   ──► feature enrich ──┘        (strategy + decorators chosen per request)
            (news_score per lead)
```

### 5.2 Step 1: feature enrichment (news impact per lead)

For each lead, look at every article that mentions the lead's country:

```
weight  = (0.4 + 0.6·relevance) × (0.5 + 0.5·recency)

impact  = −0.5   if tariff AND your country is also in the article    (tariff friction between you and them)
        = +0.7   if tariff AND the lead is tariff-exposed             (buyer is actively diversifying suppliers)
        = +0.35  if tariff otherwise                                  (may open supplier diversification)
        = polarity  for non-tariff news (ignored if |polarity| < 0.1)

news_score = 0.5 + 0.5·tanh(Σ impact·weight)        ∈ (0, 1), 0.5 = neutral
```

The top three contributions are kept as `news_reasons` (headline, URL, "why") and shown on the card.

**The tariff rule is the interesting trade insight.** US tariffs on Chinese goods hurt a Chinese
exporter, but they push a US buyer to look for suppliers elsewhere, which is an *opportunity* for an
Indian exporter. Tariffs between *your* country and *theirs* are a risk.

### 5.3 Step 2: market regime detection (`regime.py`)

```
strength(article) = (|polarity| + 0.5·tariff) × (0.4 + 0.6·relevance) × (0.5 + 0.5·recency)
intensity         = mean strength of the top 8 articles
risk_share        = (# tariff-or-negative articles) / (# directional articles)
hot_countries[c]  = Σ (tariff ? −0.5 : polarity) × (0.5 + 0.5·recency)     over articles mentioning c
```

| Condition | Regime | Meaning |
|---|---|---|
| intensity ≥ 0.42 and risk_share ≥ 0.45 | **shock** | Risk- or tariff-heavy news cycle |
| intensity ≥ 0.42 and risk_share < 0.45 | **boom** | Strong opportunity news |
| intensity ≥ 0.25 | **active** | Steady news flow |
| otherwise | **calm** | Quiet; trust fundamentals |

**Calibration:** the thresholds were tuned on real feeds. With the first guess (0.55), every industry came
out "active". After tuning, Steel (84% risk/tariff headlines from US tariffs) and Auto Parts (60%) came
out as **shock**, while Textiles, Pharma and Solar stayed **active**. All thresholds are env vars.

### 5.4 Step 3: strategy selection (the base model)

| Condition | Base ranker |
|---|---|
| ≥ 8 decisions with ≥ 2 approvals and ≥ 2 rejections | `RandomForestRanker` (section 7), which wraps `StaticFitRanker` as its fallback |
| otherwise | `StaticFitRanker` (`score = base_score`) |

**Why a Strategy?** Both rankers share the `Ranker.rank(leads, ctx)` interface, so the engine can swap
them at runtime based on how much data exists. That's the classic cold-start problem.

### 5.5 Step 4: decorators, chosen by regime

Each decorator wraps a `Ranker`. It calls the inner ranker, adjusts the scores, and appends an entry to
`score_breakdown` (shown on the card as "How it was ranked").

| Regime | Pipeline (innermost to outermost) |
|---|---|
| calm | base → NewsImpact(**0.15**) |
| active | base → NewsImpact(**0.30**) |
| boom | base → NewsImpact(**0.35**) → **Momentum** |
| shock | base → NewsImpact(**0.45**) → **RiskAversion** |
| *(all regimes, then)* | → Semantic *(if Pinecone)* → SwipeFeedback *(if any swipes)* → SkipPenalty → **Diversity** |

| Decorator | Adjustment |
|---|---|
| `NewsImpactDecorator(w)` | `Δ = w × (news_score − 0.5)` |
| `MomentumDecorator` | `heat = max(0, hot[country])`; `Δ = min(0.08, 0.04·heat) + 0.03` if the lead has a growth signal (funding, hiring, spike) and heat > 0 |
| `RiskAversionDecorator` | `Δ = max(−0.1, 0.05·min(0, hot[country])) − 0.05·war_risk − 0.03·market_shock + 0.03·trust_verified` |
| `SemanticDecorator` | `Δ = 0.1 × (pinecone_similarity − 0.5)` |
| `FeedbackDecorator` | `Δ = FeedbackModel.adjust(lead)`, clamped to [−0.35, +0.2] (section 6) |
| `SkipPenaltyDecorator` | `Δ = −0.12` for leads skipped earlier (they come back later in the deck) |
| `DiversityDecorator` | Re-orders only: in the top 30, never more than 2 leads from the same country in a row |

**Why decorators?** Every concern (news, risk, feedback, diversity) is a small class you can test on its
own. The regime picks the composition at runtime. Adding a new signal (e.g. a currency-volatility layer)
means writing one class and adding one line to `build_pipeline()`, without touching the others. That's
the open/closed principle.

### 5.6 Step 5: final score

Decorators add raw deltas, so a lead with base 0.95 and strong news could reach about 1.2. Hard clipping
made every top lead show "99%", so the engine squashes smoothly instead:

```
dynamic_score    = 0.5 + 0.49 · tanh((raw − 0.5) · 2.2)       # monotonic, so the order is preserved
match_percentage = clamp(round(100 · dynamic_score), 1, 99)
rank_delta       = position by base_score − final position     # ">0" means "moved up today"
```

The engine also returns `engine = {regime, pipeline[], notes[], feedback summary}`. The UI shows it as the
**engine badge** on the deck.

### 5.7 Why the result is "dynamic like Tinder"

- **Within a session:** each swipe is applied to the cached pool immediately. A debounced re-rank about
  1.2 s later recomputes preferences, retrains the forest if the swipe history changed, and re-orders the
  remaining deck. The card you're looking at is pinned so it doesn't jump.
- **Over time:** swipe influence decays with a 72 h half-life, so the deck follows changing tastes.
- **With the world:** a news change can switch the regime (e.g. active → shock), which changes the
  algorithm itself, not just the weights.

---

## 6. Swipe feedback: learning *why* a lead was rejected

File: `services/ranking/feedback.py`

### 6.1 Capturing the reason

After a left swipe, five chips appear (keys 1–5): **wrong market, too small, not buying now, can't reach
them, not a fit**.
- If the user picks one: `POST /leads/{id}/feedback` stores it with `reason_source = "user"`.
- If not, the server already stored an **inferred** reason at swipe time (`reason_source = "inferred"`),
  which counts at ×0.6 weight.

**Inference** (`infer_reason`), first match wins, comparing the rejected lead with the user's approvals:
1. `wrong_market`: the user has approvals, but none in this country, and this country's approval rate is below 0.5
2. `too_small`: revenue < 0.5 × the median revenue of approved leads
3. `low_intent`: intent < the median intent of approved leads − 0.1
4. `wrong_channel`: the user has never approved a lead on this channel
5. otherwise `not_relevant`

The guessed chip is highlighted ("our guess"), so the user can confirm it with one tap.

### 6.2 Turning reasons into ranking adjustments

Each event gets a recency weight `w = 0.5^(age_hours / 72)` (×0.6 if inferred). For each candidate lead:

| Rejection reason | Rule (compared with the rejected lead "ref") | Penalty |
|---|---|---|
| wrong_market | same country | −0.25·w |
| too_small | revenue ≤ 2.5 × ref revenue | −0.12·w |
| low_intent | intent ≤ ref intent + 0.05 | −0.12·w |
| wrong_channel | same preferred channel | −0.12·w |
| not_relevant / none | similarity > 0.8 | −0.2·similarity·w |
| **Approval** | similarity > 0.8 ("more like this") | **+0.08·similarity·w** |

Plus aggregate taste once there are at least 3 swipes, using Laplace-smoothed rates
`rate = (approvals + 1) / (approvals + rejections + 2)`:

```
Δ_taste = 0.12·(country_rate − 0.5) + 0.06·(channel_rate − 0.5)
```

The final adjustment is clamped to **[−0.35, +0.2]**. Penalties are allowed to be stronger than boosts,
because a rejection is a stronger signal than an approval. The strongest cause becomes the card text,
e.g. *"Similar to BUY-1025 you rejected (company too small)"*.

**Lookalike similarity** (`features.similarity`): Euclidean distance over 8 firmographic features
(intent, reply odds, prompt response, log revenue, log team size, payment history, tariff exposure,
signal count), mapped to `max(0, 1 − dist/1.4)`, then +0.15 for the same country and +0.05 for the same
channel. News and base features are excluded from similarity because they change daily.

**Why Laplace smoothing?** Without it, one rejection in Germany would give Germany a 0% approval rate.
Smoothing starts every market at 50% and moves gradually, which stops a single swipe from over-reacting.

---

## 7. The random forest

File: `services/ranking/rankers.py`

| Aspect | Choice |
|---|---|
| Model | `sklearn.ensemble.RandomForestClassifier(n_estimators=80, max_depth=5, min_samples_leaf=2, class_weight="balanced", random_state=42)` |
| Label | approved = 1, rejected = 0 (skips ignored) |
| Features (13) | intent, reply odds, prompt response, log revenue, log team size, payment history, tariff exposure, buying-signal count, **news impact at swipe time**, baseline fit, channel one-hot (email, linkedin, whatsapp) |
| Sample weight | `0.5 + recency_weight`, so recent swipes matter more |
| Trigger | ≥ 8 decisions, ≥ 2 of each class |
| Blend | `alpha = min(0.7, n/40)`; `score += alpha · (P(approve) − score)` |
| Caching | One model per user, retrained only when the fingerprint `(n_decisions, Σ weights)` changes |
| Safety | Any training or prediction error falls back to the baseline ranker |
| Explainability | The top-5 `feature_importances_` are shown in the engine panel. Each card shows "your forest predicts X% chance you'd approve" |

**Why a random forest?**
- Works with **tiny data** (8–500 rows) without heavy tuning. Depth 5 and min-leaf 2 limit overfitting.
- Handles **non-linear interactions**, e.g. "big companies are fine, but not in Russia", which a linear
  model can't express.
- No feature scaling needed; robust to mixed binary and continuous features.
- `class_weight="balanced"` handles users who approve far more than they reject (or the reverse).
- Trains in about 50 ms, so it can retrain inside the request path. It runs in a thread pool so the
  async event loop isn't blocked.
- `feature_importances_` gives free explainability, which matters for user trust.

**Why the blend (alpha) instead of using the forest alone?** With 8 swipes the forest is noisy. The blend
moves from about 20% model weight at 8 swipes to 70% at 28+, so the baseline anchors early behaviour.
It's a simple form of Bayesian shrinkage.

**Verified behaviour:** in a test where the user rejected small companies, the forest ranked *revenue*
as its most important feature, and no small company remained in the top 10 afterwards.

---

## 8. The real-lead scraper

Folder: `scraper/`. Pipeline: **discover → store → enrich → re-score**.

### 8.1 Sources (and why not LinkedIn or Google)

| Source | What it gives | Licence / terms |
|---|---|---|
| **Wikidata SPARQL** | Active companies in the industry *and its sub-industries*, in every country: name, description, country, website, LinkedIn page ID, employees, USD revenue, LEI | CC0 (public domain), built for automated queries |
| **GLEIF LEI API** | Confirms the company is an **active, registered legal entity**; adds the legal name and city | Free, no key |
| **Company websites** | Homepage + one contact page: generic role emails, phone, description, buyer/maker wording | Public pages, `robots.txt` respected |

Scraping LinkedIn or Google violates their terms, gets IPs banned, and makes the product fragile. Open
data is legal, stable and enough to produce real, contactable leads.

### 8.2 How discovery works

1. **Industry resolution:** the free-text industry (e.g. "Auto Parts") becomes search phrases (the
   industry itself, "<industry> industry", plus hint phrases like "automotive industry"). Wikidata's
   search API returns candidate items. A SPARQL count keeps only items that companies actually use as
   their industry (P452), at least 10 each, up to 4. *Example: Textiles → `Q607081` (textile industry) +
   `Q11828862` (clothing industry).*
2. **Company query:** one SPARQL query **per industry item**. A combined query timed out at Wikidata's
   60 s limit. Each query has these filters:
   - `?c wdt:P452/wdt:P279* wd:<industry>`: sub-industries are included
   - `FILTER NOT EXISTS { ?c wdt:P576 [] }`: no dissolved companies
   - `FILTER NOT EXISTS { ?country wdt:P576 [] }`: no historical countries such as "German Reich"
   - `{ ?c wdt:P856 ?website } UNION { ?c wdt:P4264 ?linkedin }`: only contactable companies

   If a query times out, it's retried once with a lighter version (no revenue, fewer label languages).
3. **Normalise:** country names map to the app's names ("People's Republic of China" → China),
   unlabeled entities are skipped, and results are de-duplicated by QID.
4. **Upsert** into `scraped_leads` keyed by `(industry_key, source_id)`. Bulk writes in batches of 500.
   Open-data fields are refreshed with `$set`; enrichment results survive because initial scores use
   `$setOnInsert`.

*Measured:* Textiles returned about 400 active, contactable companies across 62 countries in 2–5 s.

### 8.3 Enrichment

- **Website** (`enrich/website.py`):
  - **Robots.txt:** checked first (`urllib.robotparser`), cached per host.
  - **Pages read:** at most the homepage plus one same-domain contact page, capped at 1.5 MB each.
  - **Rate limit:** at least 1 s between requests to the same host (`common.get`).
  - **Emails:** only role addresses on the company's own domain (`info@`, `sales@`, `export@`,
    `procurement@`, …). Personal addresses are never kept.
  - **Signals:** counts buyer terms (importer, distributor, wholesale, sourcing) and maker terms
    (manufacturer, factory, exporter).
- **GLEIF** (`enrich/gleif.py`): look up by LEI if known, otherwise by exact legal name within the country.
  `Verified_Entity = ACTIVE entity with an ISSUED registration`.
- Up to 12 companies are enriched in parallel across different hosts. The oldest or never-enriched go
  first, and each company is re-checked after 14 days.

### 8.4 Estimated scores (transparent heuristics)

Open data has no "intent" field, so these are honest estimates from observable facts:

```
intent       = 0.3 + 0.3·max(buyer, 0.6·maker) + 0.15·verified + 0.15·size + 0.1·reachable
response     = 0.12 + 0.35·has_email + 0.2·has_linkedin + 0.13·has_phone + 0.1·has_website + 0.1·verified
completeness = 0.25·site + 0.25·email + 0.15·linkedin + 0.1·phone + 0.1·verified + 0.15·has_size
rank         = 100 · (0.4·intent + 0.35·response + 0.25·completeness)
```
(`buyer` and `maker` are hit counts ÷ 3, capped at 1; `size = log10(employees + 1) / 4`)

The ranking engine and the user's swipes then refine these numbers.

### 8.5 Running it

| Mode | How |
|---|---|
| **On demand** | `/leads` calls `ensure_fresh(industry)`. If the industry is stale or missing, an `asyncio` task runs discovery plus 25 enrichments. The UI polls every 4 s and cards stream in (about 15 s in tests) |
| **Cron (free)** | `.github/workflows/scraper.yml` runs `python -m scraper.worker --once` every 6 h for every industry any real user picked, plus `SCRAPE_INDUSTRIES` |
| **Always-on** | `backend/Dockerfile.scraper` runs `--loop --interval 3600` on Render, Railway or Fly |

Job state lives in `scrape_jobs` (queued → running → enriching → done/failed). A running job that hasn't
updated for an hour counts as crashed and is retried. Duplicate in-process runs are prevented with a task
registry.

---

## 9. AI outreach

Files: `services/outreach.py`, `routers/outreach.py`, `services/llm.py`

### 9.1 Flow

```
swipe right ──► decision saved ──► conversation created (channel = lead's preferred channel)
            └─► BackgroundTasks: LLM writes opener ──► autopilot ON: approve (and send via SMTP if configured)
                                                   └─► autopilot OFF: save as draft for review
prospect replies (user pastes it via "Log prospect reply")
            ──► autopilot ON: LLM answers immediately ──► background: re-analyse conversation
```

- **Opener prompt** includes the seller's profile, the lead's buying signals and **the news that ranked the
  lead**, so the first touch is timely ("Given the India–EU trade deal…"). The style depends on the
  channel: an email has a subject line and 90–140 words, a LinkedIn message is under 300 characters, a
  WhatsApp message is 2–3 sentences.
- **Guardrails** in the system prompt: never invent prices, certifications or names; offer to confirm
  missing facts.
- **Analysis** returns JSON (sentiment 0–1, label, stage, meeting intent, next action, summary). The LLM
  runs in JSON mode, with a keyword heuristic as fallback.
- **Stages only move forward** (contacted → engaged → meeting_requested → meeting_scheduled →
  negotiating). Won and lost always apply. This stops a later analysis from undoing "meeting scheduled".
- **Message statuses:** `draft`, then `approved` (ready to send, with copy and open-in-Email/WhatsApp/
  LinkedIn links), then `delivered` (actually sent via SMTP), plus `received` for logged replies. The
  status never claims a message was sent when it wasn't.

### 9.2 The LLM client

- **Providers:** Groq (Llama 3.3 70B, OpenAI-compatible REST) or Gemini.
- **Key detection:** the provider is detected **by key prefix** (`gsk_` = Groq, `AIza` = Gemini). A Groq
  key placed in `GEMINI_API_KEYS` still works. The original project had exactly that mismatch, which meant
  the AI never ran.
- **Rotation:** round-robin across keys, behind a lock.
- **Failover:** each key is tried once per call, so a rate-limited key falls through to the next.
- **No LLM configured:** every feature has a deterministic template fallback, so the product still works.
- **Async-safe:** the blocking HTTP call runs in a thread pool.

### 9.3 RAG chat assistant

`POST /chat` detects which Pinecone namespaces fit the question (exporters, importers, globalnews), adds
today's classified news and the user's profile to the context, keeps the last 8 turns of history, and
grounds the answer in the retrieved records with source labels.

---

## 10. Caching (every layer)

| Layer | What | Where | Lifetime / invalidation | Why |
|---|---|---|---|---|
| Data | Scraped companies | MongoDB `scraped_leads` (shared across users) | Re-discovered after 24 h; enrichment re-checked after 14 days | Scraping is slow and must be polite. One industry's scrape serves every user in it |
| Data | Scrape job state | MongoDB `scrape_jobs` | Per run; stuck jobs retried after 1 h | Lets the API, the cron and the worker coordinate |
| API | News per industry | In-memory dict | 10 min; stale copy served 60 s if feeds fail | Feeds take about 1.6 s and news is on the hot path |
| API | Candidate pool per user | In-memory | 5 min (15 s while scraping); **updated in place on each swipe**; rebuilt after a profile change, an undo, or newer scrape data | Re-ranking after every swipe must be fast |
| API | Pinecone similarity per user | In-memory | 10 min | A vector search per request is expensive |
| API | Random forest per user | In-memory | Until the swipe fingerprint changes | No retraining when nothing changed |
| API | AI lead insights | In-memory **LRU (5,000 entries)** | Least-recently-used evicted | LLM calls cost money and time |
| API | `robots.txt` rules | In-memory per host | Per process | One robots fetch per site |
| Transport | API responses | GZip middleware | Responses > 1 KB | News and lead payloads compress about 5× |
| Client | All queries | TanStack Query | `staleTime` 60 s, `gcTime` 24 h, background refetch | Navigation feels instant; data stays fresh |
| Client | Persisted cache | `localStorage`, per user, 24 h | Cleared on logout or a different user | **Instant first paint on reload** |
| Client | Hover prefetch | `prefetchRoute()` | On nav hover/focus | Data is ready before the click |
| Client | Code chunks | Idle preloading of every page | After first idle | Route changes need no network |
| CDN | Hashed static assets | Vercel `Cache-Control: immutable, 1 year` | New hash per deploy | Returning visitors download nothing |

**Invalidation strategy.** Event-driven where possible: a swipe mutates the pool, a profile change drops the
user's caches, undo drops the model, and new scrape data rebuilds the pool. Otherwise each cache has a TTL
matched to how fast its data changes (news minutes, companies a day, websites two weeks).

**Known trade-off.** The in-memory caches are per process. That's fine on a single Hugging Face Space;
with several instances I'd move them to Redis (section 15).

---

## 11. Performance & UX work

| Problem | Fix |
|---|---|
| Scroll position carried over between pages (opening a page at the bottom) | All pages share one `<main>` scroll container. A `useLayoutEffect` on `pathname` scrolls it to the top |
| Overscroll "rubber band" revealed a white page | `overscroll-behavior: none` on html/body, `contain` on inner scroll areas, and a body background matching the app |
| Swipe deck skipped every other lead | The old code filtered approved leads out *and* incremented an index. The deck now always shows `queue[0]` and pins the current card across re-ranks |
| Slow first load | Route-level code splitting, vendor chunks (react, data, motion), recharts only on Analytics (the dashboard uses CSS bars), Leaflet only on Approve Leads. Initial JS is about 154 KB gzipped |
| Reload showed spinners | Persisted query cache plus an inline boot screen in `index.html` |
| Janky news ticker | Pure CSS `translate3d` marquee (GPU), paused on hover, honours `prefers-reduced-motion` |
| Map hidden behind cards | Deck sits on the right on desktop (map visible on the left); `flyTo` offsets the target so the country stays visible; on mobile the target is pushed up |
| Duplicate React in dev after lazy import | `optimizeDeps.include: ['leaflet', 'react-leaflet']` |
| Mobile overlaps | Chat button hidden on the deck and chat pages on phones; insights panel becomes a slide-over |
| Accessibility | Keyboard shortcuts (← → ↑, Z undo, 1–5 reasons), `aria-label`s, reduced-motion support |

---

## 12. Security

- **JWT (HS256, 24 h)** on every non-public route. The original API took `?email=` with no check, so anyone could read any profile.
- **bcrypt** password hashing (passlib).
- **SECRET_KEY:** if unset, a random key is generated instead of the old hard-coded `"your-secret-key"`.
- **CORS** comes from `ALLOWED_ORIGINS`; credentials are disabled when origins are `*`.
- **Ownership checks:** every conversation, meeting and post query filters by `user_email`.
- **Regex injection:** the industry filter uses `re.escape`.
- **Pydantic validation** on every body: email format, password ≥ 6 characters, enums for categories and channels.
- **Client:** a 401 response signs the user out automatically and clears their cached data.
- **Scraper ethics:** respects `robots.txt`, identifying User-Agent with a contact URL, per-host rate limit, role emails only (GDPR-friendlier).
- **Secrets:** `.env` files are git-ignored; `.env.example` documents every variable.

---

## 12b. Error handling

**Goal:** a failure should never show a raw stack trace or "Request failed (500)". The user sees what
happened, what to do next, and a **code plus reference** they can quote to support.

**Backend** (`core/errors.py`)
- **One error shape** for every failure:
  `{"error": {"code", "message", "status", "request_id", "fields?"}, "detail": message}`
  (`detail` is kept for older clients).
- **`AppError(code, message, status)`** and helpers (`not_found`, `unauthorized`, `conflict`, `bad_request`)
  give stable codes such as `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `SESSION_EXPIRED`,
  `CONVERSATION_NOT_FOUND` and `UNKNOWN_REASON`.
- **Validation errors (422)** become per-field messages ("Must be at least 6 characters").
- **Database outages** (`ServerSelectionTimeoutError`, `AutoReconnect`, `NetworkTimeout`) become
  `503 DATABASE_UNAVAILABLE`.
- **Unhandled exceptions** become `500 INTERNAL_ERROR`. The full stack trace is logged server-side
  with the request ID; internal details never reach the client (tested with a secret in the exception).
- **Request ID:** every request gets an `X-Request-ID` (the client's ID is reused when it sends one),
  exposed via CORS and written into the error body, so a user report links straight to the logs.

**Frontend**
- **`ApiError`** (`lib/api.ts`) carries `status`, `code`, `requestId` and `fields`, plus a `retryable` flag.
  The client generates a request ID, so even network failures have a reference.
  - Timeouts: 20 s by default, 60 s for AI endpoints.
  - `OFFLINE` is detected before sending; `NETWORK_ERROR` and `TIMEOUT` are distinguished.
  - A 401 signs the user out.
- **`describeError` / `notifyError`** (`lib/errors.tsx`) map codes to friendly copy. Toasts show the title,
  message, `Code · Ref`, and a Retry button when retrying can help. Identical toasts are de-duplicated.
- **Global handlers** (`lib/queries.ts`):
  - **Failed actions:** every failed mutation shows a toast titled with its `meta.errorTitle`
    ("Couldn't save your swipe").
  - **Background refresh:** a failure while saved data exists shows "Couldn't refresh - showing saved data".
  - **Retries:** queries retry only retryable failures (network, timeouts, 5xx), never 4xx, with
    exponential backoff.
- **Inline `ErrorState`:** when a page's first load fails, it shows a friendly panel with Try again and a
  copyable reference instead of a blank page.
- **`FormError`:** login and register show field-level problems plus the code.
- **Crash isolation:** a route-level error boundary sits inside the layout, so a crashing page keeps the
  sidebar usable. The app-level boundary is the last resort. Stale-chunk errors after a deploy are
  detected and shown as "A new version is available - Reload".
- **`OfflineBanner`:** shown while offline; all data refreshes when the connection returns.

**Verified in the browser**
- **Wrong password:** inline "Couldn't sign you in" with `INVALID_CREDENTIALS`.
- **Unknown page:** "Page Not Found" with the sidebar intact.
- **Backend killed:** the next page shows "Can't reach TIPE" with `NETWORK_ERROR`, a reference and Try again.
- **Actions with the backend down:** toast with Retry.
- **Offline:** the banner appears.
- **Throughout:** zero uncaught page errors.

**Interview angle.** Errors split into three kinds: *user-fixable* (validation, credentials, shown inline
next to the input), *transient* (network, 5xx, retried automatically, then offered a Retry), and *bugs*
(500, crash boundary, logged with a request ID). Stable codes decouple UI copy from server messages, so
the wording can change, or be translated, without touching the API.

---

## 13. Testing & verification

| Test | Covers |
|---|---|
| `test_api` (mongomock + FastAPI TestClient) | Register/login/401, ranked leads, approve/reject/skip/undo, conversation auto-creation, reply logging plus AI reply, draft approval, meetings, content, analytics, profile |
| `test_engine` | Calm→shock pipeline switch, decorator composition, random-forest activation after 14 swipes, reason inference, explicit feedback, no small companies in the top 10 after "too small" rejections, diversity runs |
| `test_llm` | Key-prefix detection, failover after a 429, Gemini response parsing |
| `test_scraper` (live network) | Wikidata discovery, GLEIF verification, website enrichment, candidate generation for a real user |
| Playwright E2E (Chromium, desktop + mobile) | Register, dashboard, swipes (keys + mouse drag), undo, reason chips, map movement, engine panel, outreach, scroll reset, real-user sourcing flow, demo user sees demo data, zero console errors |
| `tsc --noEmit` + `vite build` | Type safety and bundle composition |

---

## 14. Deployment

| Piece | Where | Notes |
|---|---|---|
| Frontend | Vercel | Set `VITE_API_URL` (optionally `VITE_MAP_TILES`). SPA rewrites and immutable asset caching are in `vercel.json` |
| Backend API | **New** Hugging Face Docker Space | Push the `backend/` folder (its `README.md` holds the Space config: `sdk: docker`, `app_port: 7860`). Add the secrets in Space settings |
| Scraper | GitHub Actions cron | Needs the `MONGO_DETAILS` repo secret; can be run by hand for one industry |
| Database | MongoDB Atlas | Indexes are created at startup, each independently |

**Required secrets:** `MONGO_DETAILS`, `SECRET_KEY`, `GROQ_API_KEYS`. **Recommended:** `PINECONE_API_KEY`,
`PINECONE_INDEX`, `ALLOWED_ORIGINS`, `SCRAPER_CONTACT`. **Optional:** `SMTP_*`, `DEMO_USER_EMAILS`,
`SCRAPE_INDUSTRIES`. Every setting is documented in `backend/.env.example`.

**Checks after deploying:**
- `GET /health` should report the LLM provider, Pinecone and SMTP status.
- Deploy the frontend and backend **together**: the API now requires bearer tokens.

---

## 15. Known limitations & what I'd do next

| Limitation | Next step |
|---|---|
| In-memory caches are per process | Redis (e.g. the Upstash free tier) for the pool, news, insights and models; a pub/sub event on swipe for cross-instance invalidation |
| Prospect replies are pasted in by hand | Gmail/Outlook APIs (or an IMAP poller) for inbound email; the WhatsApp Business API |
| Scraped "intent" is a heuristic | UN Comtrade import volumes per country and HS code as a real demand signal; OpenCorporates for SMEs |
| Open data favours large firms | More registries (OpenCorporates, national company registers) to reach SMEs |
| Keyword news classification misses nuance | A small fine-tuned classifier, or a batched LLM pass at cache-refresh time (off the hot path) |
| Random forest is per user, so cold start for every new user | Pool anonymised swipes across users in the same industry as a prior (collaborative filtering), then personalise |
| No offline evaluation of ranking | Log impressions and decisions; track approval-rate@10 and NDCG; A/B test regime weights |
| Fixed regime thresholds | Learn them per industry from historical approval rates |

---

## 16. Interview question bank

### Architecture & design

**Q: Walk me through what happens when a user opens the deck.**
A: The frontend renders instantly from the persisted React Query cache and revalidates in the background.
`GET /leads` then:
1. Checks the scrape job (real users) and starts one if the industry is stale.
2. Loads the per-user candidate pool (cached for 5 min).
3. Gets news for the industry (cached for 10 min).
4. Gets Pinecone similarity scores (cached).
5. Loads the user's swipe history into a `FeedbackModel`.
6. Runs `rank_leads` in a thread pool: enrich news per lead, detect the regime, build the
   strategy + decorator pipeline, rank, squash, compute rank deltas.

It returns the leads plus the engine description. The map lazy-loads in parallel.

**Q: Why the Strategy and Decorator patterns? Isn't that over-engineering?**
A: They solve two separate problems.
- **Strategy:** the *base model* must change with data volume (cold start → random forest).
- **Decorator:** the *adjustments* must change with the news regime (shock adds risk aversion, boom adds
  momentum).

Each layer is a 10–20 line class I can test alone, and the regime picks the composition at runtime. The
alternative is one function with nested if/else per regime and signal, which gets unmaintainable as soon
as you add a second regime-specific rule. It also gives explainability for free: each layer writes its
contribution to `score_breakdown`, which the UI shows.

**Q: Why FastAPI + MongoDB?**
A:
- **FastAPI:** async I/O fits a workload dominated by network calls (Mongo, LLM, feeds, Pinecone).
  Pydantic gives validation and auto-generated docs.
- **MongoDB:** leads come from different sources with different schemas (synthetic ML data vs. scraped
  companies), so a document store with a normaliser fits. Conversations and messages are naturally
  documents.
- **Indexes:** `(user_email, lead_id)`, `(industry_key, source_id)` unique, and so on keep queries
  index-backed.

**Q: How do you keep CPU work from blocking the async server?**
A: Random-forest training, feed parsing, LLM HTTP calls and SPARQL all run through `run_in_threadpool`.
Nothing blocking runs on the event loop.

### Ranking

**Q: How does news actually change the ranking? Give a concrete example.**
A: News changes the ranking in two ways.
1. **Per lead:** a lead in Germany gets `news_score > 0.5` when headlines about Germany are positive. An
   "India–EU trade deal" headline lifted German and Dutch leads; Russian leads dropped 4 places after a
   war headline.
2. **For the whole engine:** if the news mix becomes risk-heavy (Steel: 84% tariff/risk headlines), the
   regime switches to *shock*. News weight rises from 0.30 to 0.45 and a RiskAversion layer is added, so
   the algorithm itself changes.

**Q: Explain the tariff logic.**
A: Tariffs are two-sided. If an article mentions *both* the user's country and the lead's country, it's
friction between them (−0.5). If it mentions only the lead's country, that buyer probably has to
diversify suppliers (+0.35, or +0.7 if the lead is already flagged as tariff-exposed). So "US tariffs on
China" lifts US buyers for an Indian exporter.

**Q: Why squash the final score with tanh instead of clipping?**
A: Decorators add unbounded deltas. With clipping, many top leads became exactly 99%, which lost their
relative order and looked fake. `0.5 + 0.49·tanh((x − 0.5)·2.2)` is monotonic (same order), bounded,
roughly linear around the middle, and compresses only the extremes.

**Q: How do you avoid a deck full of one country?**
A: `DiversityDecorator` re-orders the top 30 greedily. If the last two picks are the same country, it takes
the next-best lead from a different one. It's MMR-style diversification (maximal marginal relevance): a
small relevance cost buys exploration, the way a dating app mixes up profiles.

**Q: How do you know the thresholds are right?**
A: They were calibrated on live feeds. The first guess classified everything as "active"; after tuning,
tariff-hit industries became "shock" and the others stayed "active", which matches intuition. They're env
vars, so they can be adjusted without a deploy. The honest answer is that the next step is offline
evaluation: log decisions and optimise thresholds against approval rate.

### Feedback & ML

**Q: How do you learn *why* someone rejected a lead?**
A: Two paths. The user can say why (one tap, keys 1–5), or we infer it by comparing the lead with their
approvals: country never approved, revenue below half the approved median, intent below the median, an
unused channel, or "not a fit". Inferred reasons count 60%. Each reason maps to a targeted rule, e.g.
"too small" penalises everything up to 2.5× that company's revenue.

**Q: Why a random forest and not logistic regression, XGBoost, or a neural net?**
A:
- **Logistic regression** can't learn interactions like "large is fine, except in market X".
- **XGBoost** is overkill at 8–200 rows and easier to overfit.
- **Neural nets** need far more data.

A shallow random forest works on tiny data, needs no scaling, trains in about 50 ms (so it can retrain
per swipe), handles imbalance with `class_weight="balanced"`, and exposes feature importances for
explainability.

**Q: How do you handle cold start and overfitting?**
A:
- **Cold start:** the forest only activates after 8 swipes with at least 2 of each class. Before that the
  baseline plus rule-based feedback run.
- **Overfitting:** max depth 5 and min leaf 2. The model's influence is blended:
  `alpha = min(0.7, n/40)`, so it never fully replaces the baseline (shrinkage).

**Q: Why exponential decay on swipes?**
A: Preferences drift. A 72 h half-life means today's swipes dominate, which makes the deck feel responsive
within a session, while old behaviour still counts a little.

**Q: Isn't retraining per request expensive?**
A: The model is cached per user and keyed by a fingerprint of the swipe history `(count, Σ weights)`, so it
retrains only when the history changes. Training 80 trees on fewer than 500 rows takes milliseconds.

### Scraper & data

**Q: Why not just scrape LinkedIn?**
A: It violates LinkedIn's terms, gets IPs banned quickly, and there's legal precedent against it. A product
built on it breaks. Wikidata is CC0 and built for machine queries, GLEIF is a free official registry, and
company websites are public pages read politely (robots.txt, rate limits, role emails only).

**Q: How did you make the SPARQL query reliable?**
A: The first version (two industries, HQ labels, 10 languages) hit Wikidata's 60 s timeout. I split it into
one query per industry, removed the HQ join (GLEIF provides the city), reduced label languages, and added
a retry with an even lighter query. Each query now takes 2–18 s.

**Q: How do new users get leads immediately if the scraper runs on a cron?**
A: `/leads` calls `ensure_fresh()`. If the industry is missing or stale, it starts an in-process `asyncio`
task (discovery plus 25 enrichments) and records the job in Mongo. The UI shows a "Finding real companies"
panel and polls every 4 s; the pool rebuilds when the job's `updated_at` moves. The first cards appeared
after about 15 s in tests. The cron then completes enrichment.

**Q: How do you avoid duplicate scrapes when the API and the cron run at the same time?**
A: Job state lives in `scrape_jobs` (one doc per industry, unique index). The API checks `is_stale()` and
keeps an in-process registry of running tasks. Upserts are keyed by `(industry_key, source_id)`, so a
duplicate run is idempotent rather than harmful.

**Q: The intent score for scraped companies is made up, isn't it?**
A: It's an *estimate from observable facts*, and the documentation says so: buyer wording on their
website, verified legal entity, size, and contactability. It's a prior. The random forest and the user's
swipes correct it per user. Real demand data (UN Comtrade import volumes) is the documented next step.

### Caching & performance

**Q: Describe your caching strategy.**
A: Three tiers.
1. **Persistent shared data in Mongo:** scraped companies shared by all users in an industry, refreshed
   every 24 h.
2. **Per-process memory caches with TTLs matched to data volatility:** news 10 min, lead pool 5 min,
   Pinecone 10 min, models until history changes, insights LRU.
3. **Client:** React Query with a 24 h persisted cache, hover prefetch, chunk preloading, and immutable
   CDN assets.

Invalidation is event-driven where it matters: a swipe updates the pool in place, a profile change drops
the user's caches, and new scrape data triggers a pool rebuild.

**Q: What breaks if you scale to many instances?**
A: In-memory caches diverge across instances: one could serve a pool that doesn't reflect a swipe handled
by another. The fix is Redis for shared caches, plus pub/sub invalidation on swipe. Mongo-backed data is
already shared.

**Q: How did you make the site "load instantly"?**
A:
- Code splitting per route, and vendor chunks so a deploy doesn't invalidate cached libraries.
- Heavy libraries load only where they're used: recharts on Analytics, Leaflet on the deck.
- The persisted query cache paints the last data before the network responds.
- Prefetch on hover, idle chunk preloading, GZip on the API, and an inline boot screen.

**Q: What was the scroll bug and how did you fix it?**
A: Every page renders inside one `<main overflow-y-auto>`. React Router swaps the content but the container
keeps its `scrollTop`, so the next page opened at the old offset. A `useLayoutEffect` keyed on
`location.pathname` resets it before paint. The separate overscroll issue (white page when pulling past
the top) was fixed with `overscroll-behavior` and a matching background.

### AI

**Q: How do you stop the LLM from inventing facts in outreach?**
A: The prompts contain only known facts (seller profile, lead signals, real headlines), and the system
prompt forbids inventing prices, certifications or names. Messages are drafts unless autopilot is on, and
autopilot only *approves*. Real sending needs SMTP plus a known email, so a human can always review first.

**Q: What if Groq is down or rate-limited?**
A: Keys rotate round-robin and each is tried once per call. If all fail, every feature falls back to a
deterministic template or heuristic (opener, replies, analysis, posts), so the user flow never breaks.

**Q: Why does the opener mention news?**
A: Timeliness raises reply rates, and the same headline that ranked the lead is the most relevant hook,
e.g. "Given the India–EU trade deal…". The ranking explanation and the outreach share one source of truth.

### Security

**Q: What security issues did you find in the original code?**
A:
- No authentication on data endpoints (`/user/profile?email=` exposed anyone's profile).
- A hard-coded default JWT secret.
- CORS `*` with credentials enabled.
- An unescaped user string in a Mongo regex.
- `.env` files with live keys committed to git.

All of these were fixed except rotating the leaked keys, which is the owner's action.

**Q: Is the scraper legal and ethical?**
A: It uses open-licensed data (Wikidata CC0) and an official free registry (GLEIF). It reads only public
pages, respects robots.txt, identifies itself with a contact URL, rate-limits per host, and stores only
role-based business emails. For EU outreach, the system prompt and templates should include an opt-out
line (GDPR legitimate-interest basis).

---

## 17. Glossary

| Term | Meaning |
|---|---|
| **Regime** | Market state inferred from the news mix: calm, active, boom or shock |
| **Base score** | A lead's static fit before any news or feedback |
| **news_score** | 0–1 impact of current headlines on the lead's market (0.5 = neutral) |
| **rank_delta** | Places a lead moved versus its baseline position ("↑3 today") |
| **score_breakdown** | Per-layer contributions shown on the card |
| **Inferred reason** | The engine's guess at why a lead was rejected; weighted 0.6 |
| **LEI** | Legal Entity Identifier from GLEIF; "verified" means an active, issued registration |
| **QID** | A Wikidata item ID (e.g. Q607081 = textile industry) |
| **Autopilot** | The AI answers logged replies and approves its own messages |
| **Pool** | The per-user cached candidate list that gets re-ranked |
