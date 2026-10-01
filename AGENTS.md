# Notes for AI agents

- The app lives in `frontend/` (Next.js 16). Start with `frontend/README.md`.
- **Deployment:** Vercel is no longer used; the app is moving to GCP. Read
  `frontend/DEPLOYMENT.md` before touching hosting, storage paths or env vars.
  It also lists an open security issue (`/api/chat` is not behind the login).
- `frontend/data/` and `frontend/public/uploads/` hold private collection data
  and are gitignored. Never commit them.
