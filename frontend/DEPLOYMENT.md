# Deployment notes

Status as of 2026-10-01: **Vercel is no longer used. The app will move to
Google Cloud (GCP); no target has been built yet.** `vercel.json` is left over
from an earlier attempt and can be deleted once the GCP setup exists.

## What the server must provide

The app is not stateless. It reads and writes local files at runtime, so the
host needs a disk that survives restarts and redeploys.

| What | Default location | Override |
| --- | --- | --- |
| Inventory database (SQLite, WAL mode) | `data/inventory.db` (+ `-wal`, `-shm`) | `INVENTORY_DB_PATH` |
| Audit-log signing key | `audit.key` next to the database | moves with `INVENTORY_DB_PATH` |
| Certificate PDFs and Word originals | `data/certificates/` | `INVENTORY_CERTIFICATE_DIR` |
| CMS image uploads | `public/uploads/` | `INVENTORY_UPLOAD_DIR` |

`data/` and `public/uploads/` are gitignored and hold private collection data
(purchase prices, valuations). They must be copied to the server separately,
never committed. Losing `audit.key` breaks verification of the existing audit
log.

`better-sqlite3` is a native module: run `npm install` on the target platform
(don't copy `node_modules` from a Mac to a Linux server).

## Environment

| Variable | Purpose |
| --- | --- |
| `INVENTORY_PASSWORD` | Admin sign-in password (required) |
| `CRVMGMT_SECRET` | Session signing secret; falls back to `INVENTORY_PASSWORD`. Set its own value in production |
| `PUBLIC_SITE_ENABLED` | `true` serves the public site; otherwise every non-admin path redirects to the inventory |
| `MAC_API_BASE` | AXXES API used by `src/lib/mac.ts` (default `https://members.axxes.club`) |
| `NEXT_PUBLIC_IMAGE_HOST` | Image host for artwork images |
| `WP_ORIGIN` | Only for `npm run wp:fetch` |
| `AGY_PATH` | Path to the `agy` CLI used by the chat widget (`/api/chat`) |
| `CRVMGMT_URL`, `CRVMGMT_PORT` | Electron desktop wrapper only (`desktop/main.js`) |

`npm run start` listens on port **9182**, not 3000.

## Features tied to the owner's Mac

These won't work on a Linux cloud server as written:

- **FileMaker sync** (`src/lib/inventory/filemaker.ts`) drives FileMaker Pro
  through AppleScript or ODBC on the same machine.
- **Chat widget** (`src/app/api/chat/route.ts`) shells out to a local `agy` CLI.
- **Desktop app** (`desktop/`) is an Electron shell around the web app.

Plan to either keep these on the Mac (pointing the desktop app at the hosted
URL via `CRVMGMT_URL`) or rework them before relying on them in the cloud.

## Open security issue: fix before enabling the public site

`/api/chat` is not in `isManagementPath` (`src/lib/site-config.ts`), so the
proxy doesn't require a sign-in for it, and `ChatWidget` is mounted in the root
layout, so it appears on public pages too. Its prompt tells the CLI it can read
`data/inventory.db`, which includes prices and valuations. With
`PUBLIC_SITE_ENABLED=true`, any visitor could ask for them. Either add
`/api/chat` to `isManagementPath` and render the widget only in the admin
layout, or give the public chat no database access.

## GCP options

Cloud Run's filesystem is ephemeral, like Vercel's, so the current code needs
one of the following:

1. **Compute Engine VM with a persistent disk (closest to today).** Run
   `npm run build && npm run start` under a process manager (systemd/pm2)
   behind a reverse proxy with TLS. Point the `INVENTORY_*` paths at the
   persistent disk. Back up that disk (snapshots), since it holds the only
   live copy of the inventory database. Needs almost no code changes.
2. **Cloud Run plus managed storage.** Move the database to Cloud SQL and
   certificates/uploads to Cloud Storage. This is a real refactor of
   `src/lib/inventory/db.ts`, `uploads.ts`, `certificate-files.ts` and the
   audit key. Note that Cloud Run with a mounted GCS bucket is not safe for
   SQLite (no reliable file locking).

Owner's lean: undecided. Option 1 is the low-effort path.
