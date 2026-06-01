# Deploy Highlights API to Render

The Highlights admin tab needs these routes on production:

- `GET /api/highlights?site=...` (public)
- `GET|POST /api/admin/highlights` (admin)

If either returns `{"message":"Route not found"}`, the **Render backend** is still on an old build (frontend/Vercel deploys do not update the API).

## 1. Render service settings

In [Render Dashboard](https://dashboard.render.com) → your API service (`vortex-backend-qybl`):

| Setting | Value |
|---------|--------|
| **Root Directory** | `backend` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Branch** | `main` |
| **Auto-Deploy** | On |

Save changes, then **Manual Deploy** → **Deploy latest commit**.

## 2. Verify (run after deploy finishes)

```bash
curl -s https://vortex-backend-qybl.onrender.com/api/health
```

Expected (new build):

```json
{
  "status": "OK",
  "buildId": "highlights-2026-06-01",
  "apiFeatures": {
    "highlights": true,
    "publicHighlights": true
  }
}
```

```bash
curl -s "https://vortex-backend-qybl.onrender.com/api/highlights?site=hub"
```

Expected: `{"success":true,"highlights":[...]}` (empty array is fine), **not** `Route not found`.

## 3. Admin UI

Hard-refresh the site (Cmd+Shift+R), log in again if needed, open **Highlights** tab.

## Troubleshooting

- **Health has no `buildId` or `apiFeatures`** — Render is still serving an old `server.js`. Redeploy from `main` with Root Directory `backend`.
- **Deploy fails in Render logs** — fix build/start errors; the previous container keeps running (old routes).
- **Repo not connected** — Link GitHub repo `JimmyJr77/vortex` or push code Render can pull.

Optional: add a [Deploy Hook](https://render.com/docs/deploy-hooks) URL and trigger it after each `backend/` change.
