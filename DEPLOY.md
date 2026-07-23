# Deploying VITA (free cloud)

This repo is set up to deploy as **one Docker service + one Postgres database** on
**[Render](https://render.com)** (free tier). The Docker image builds the React
frontend and serves it from the FastAPI backend on the **same origin**, so there
is **no CORS, no cross-URL wiring, and no separate frontend config**.

The whole thing is described by [`render.yaml`](render.yaml) (a "blueprint"), so
Render provisions everything automatically.

---

## What you get

- One public URL (e.g. `https://cleardesk.onrender.com`) serving the full app.
- A managed Postgres database, auto-connected via `DATABASE_URL`.
- Tables created and demo data seeded automatically on first boot.
- WebSockets (live agent feed) working over `wss://` out of the box.

Demo logins (password `demo1234`): `uploader@cleardesk.dev`,
`reviewer@cleardesk.dev`, `admin@cleardesk.dev`.

---

## Step 1 — Push the repo to GitHub

If you haven't already:

```bash
cd "C:\Users\Ritadhwaj Ray\Hackathon\cleardesk"
git add -A
git commit -m "Deploy-ready: Docker + Render blueprint"
git push
```

Your repo must be on GitHub (or GitLab/Bitbucket) for Render to read it.

## Step 2 — Create a Render account

1. Go to https://render.com and **Sign up** (use "Sign in with GitHub" — free, no card).
2. Authorize Render to access your repositories (you can limit it to just `cleardesk`).

## Step 3 — Deploy the blueprint

1. In the Render dashboard click **New +** → **Blueprint**.
2. Pick your **cleardesk** repository → **Connect**.
3. Render reads `render.yaml` and shows a plan: one **PostgreSQL** database and one
   **Web Service** (Docker). Both on the **Free** plan.
4. Give the blueprint a name (e.g. `cleardesk`) and click **Apply**.

Render now:
- creates the free Postgres database,
- builds the Docker image (frontend build → backend), which takes ~4–8 minutes,
- injects `DATABASE_URL` and a generated `JWT_SECRET`,
- boots the service, which auto-creates tables and seeds demo data.

Watch the **Logs** tab. When you see `Uvicorn running` and the health check turns
green, it's live.

## Step 4 — Open the app

Click the service's URL at the top of its page
(`https://cleardesk-XXXX.onrender.com`). Log in with one of the demo accounts and
run a case from the sample documents.

That's it — the app is live. 🎉

---

## Step 5 (optional) — Enable real document reading with Gemini

The default `LLM_PROVIDER=mock` makes the whole app work with **no API key**, but
the agents return canned readings. To have them actually read uploaded documents:

1. Get a free key at https://aistudio.google.com/apikey (Google login, no card).
2. In Render → your **cleardesk** service → **Environment** → **Add Environment
   Variable**:
   - `LLM_PROVIDER` = `gemini`
   - `GEMINI_API_KEY` = *your key*
3. **Save Changes** — the service redeploys and now reads documents for real.

Free-tier rate limits are fine for a demo; the app spaces out and caches calls.

---

## Good to know (free-tier behaviour)

- **Cold starts.** Free web services sleep after ~15 min idle. The next request
  wakes it (≈30–60 s). Just refresh once.
- **Ephemeral uploads.** Uploaded files live on the container's disk and are wiped
  on redeploy/restart. Fine for a demo; for persistence attach a Render disk
  (paid) or wire object storage (S3/MinIO) — the schema already stores file paths.
- **Free Postgres** on Render expires ~90 days after creation. To keep data
  longer, use a free **[Neon](https://neon.tech)** database instead (see below).
- **Region.** Pick a region close to you when prompted for lowest latency.

---

## Alternative database — Neon (longer-lived, free)

If you'd rather not use Render's expiring Postgres:

1. Create a free project at https://neon.tech and copy its connection string.
2. In `render.yaml`, delete the `databases:` block and replace the `DATABASE_URL`
   env var's `fromDatabase` with `sync: false`:
   ```yaml
   - key: DATABASE_URL
     sync: false
   ```
3. After the service is created, set `DATABASE_URL` to the Neon string in the
   Render **Environment** tab. (The backend auto-converts a `postgres://` URL to
   the `postgresql://` scheme SQLAlchemy expects.)

---

## Other platforms (same Docker image works)

The `Dockerfile` is platform-agnostic, so you can also deploy on:

- **Railway** (`railway.app`) — New Project → Deploy from repo → add a Postgres
  plugin → set `DATABASE_URL`. Uses the Dockerfile automatically.
- **Fly.io** (`fly.io`) — `fly launch` (detects the Dockerfile) → `fly postgres
  create` → `fly postgres attach`. Set `AUTO_SEED=true`.

Set the same env vars (`DATABASE_URL`, `JWT_SECRET`, `AUTO_SEED`, optionally
`LLM_PROVIDER`/`GEMINI_API_KEY`).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails on `npm run build` | Check the build logs; the build ignores type errors, so it's usually a missing dep — ensure `frontend/package.json` committed. |
| App loads but API calls 502 for a minute | Cold start — wait ~60 s and refresh. |
| "relation does not exist" | Tables are created on startup; check logs for a DB connection error (bad `DATABASE_URL`). |
| Login fails | Seeding runs on startup; check logs for `seed skipped`. Re-deploy to re-run. |
| Agents error with 404/429 | Gemini model/quota — the app auto-falls back; or run on `mock`. |
