# ORC GCP Migration Implementation Plan

> Execute inline with superpowers:executing-plans. The user approved the spec and explicitly instructed implementation and deployment; continue without redundant approval prompts.

**Goal:** Serve the functioning collection at orc.axxes.app on GCP with low ongoing costs and storage ready for later client assets.
**Architecture:** Cloud Run in us-west1 behind the existing HTTPS load balancer, regional GCS for immutable public image variants, existing Members production catalog/CRM. Separate private storage for later originals/documents.
**Tech Stack:** Next.js 16, Node 24, Cloud Build, Artifact Registry, Cloud Run, Cloud Storage, existing Certificate Manager and authoritative Cloudflare DNS.
**Spec:** docs/superpowers/specs/2026-10-01-orc-gcp-migration-design.md

## Global constraints
- Preserve existing collection behavior and isolate changes to this client and the required public Members routing fix.
- Keep min instances zero; cap instances and use request-based billing. No new database or dedicated load balancer.
- Public derivatives and private future files use separate access policies; never publish private originals.
- Existing image archive is the source for this release; future 200 GB uploads do not require a new uploader UI now.
- Keep secret values out of source, logs and container layers. Preserve other host rules and DNS records.

## Review focus
- Authentication boundaries: only existing public tenant endpoints bypass middleware; private/prefix-confusable endpoints remain protected.
- Missing/encoded image references: reconcile exact object mapping, report missing assets, never silently redirect to external providers.
- Build-time network failure: timeout API calls, preserve fallback catalog, and do not accept HTML login responses as successful inquiries.
- High bandwidth and image CPU: create responsive WebP variants once and reuse immutable URLs rather than transform on every request.
- DNS/LB concurrency: back up configuration and add only this hostname using current configuration and fingerprint.

### Task 1: Restore public catalog access
**Files:** Members src/middleware.ts and tests/public-tenant-routes.test.ts; its cloudbuild.yaml test step.
**Produces:** Public JSON reads and inquiry persistence for tenant coleccion-reyes-veray.
- [ ] Reproduce login redirects; write and run a middleware regression test for inventory/inquiries and private boundaries. Expected public paths currently redirect.
- [ ] Allow the existing /api/v1/public/tenants segment; run regression and existing appropriate tests.
- [ ] Build the Members service on Linux and release with its existing rollout/rollback script.
- [ ] Verify live public JSON, private auth, catalog counts and backing GCP storage/database configuration without printing credentials.

### Task 2: Migrate and optimize referenced images
**Files:** scripts/prepare-assets.mjs, scripts/prepare-assets.test.mjs, frontend/src/data/image-manifest.json, scripts/upload-assets.sh.
**Consumes:** Existing 5.4 GB local archive and live tenant image references.
**Produces:** Deterministic versioned GCS paths and responsive WebP image variants.
- [ ] Inventory local/live images and CMS references; test URL normalization and path containment against encoded paths/external providers.
- [ ] Generate original copies plus WebP widths 320, 640, 960, 1600 using sharp; map original URLs and legacy CDN aliases to the same GCP objects; record missing files.
- [ ] Create regional public-web and private-client buckets; configure public derivatives, private originals, cache headers and limited retention.
- [ ] Upload assets and verify remote metadata/checksums and manifest completeness.

### Task 3: Prepare efficient Next.js deployment
**Files:** frontend/src/lib/getImageUrl.ts, frontend/src/lib/image-loader.ts, frontend/src/lib/mac.ts, frontend/next.config.ts, relevant image components, frontend/Dockerfile, frontend/cloudbuild.yaml, frontend/.dockerignore, frontend/.gcloudignore; frontend tests.
**Consumes:** Image manifest and functioning Members public API.
**Produces:** Standalone Linux container with bounded API calls and reusable precomputed image variants.
- [ ] Add failing tests for variant selection, mapping encoded legacy references, fallback behavior and inquiry redirect rejection.
- [ ] Implement GCP image resolution/custom loader, use narrow remote patterns, remove provider-only image resizing and UploadThing deployment dependency.
- [ ] Reduce gallery payload and prevent unnecessary full-inventory/static-generation network calls; retain page revalidation and dynamic detail support.
- [ ] Add reproducible build config, scale-to-zero service configuration and documentation; run tests/typecheck and Linux production build.

### Task 4: Release and activate domain
**Files:** scripts/deploy-gcp.py, docs/gcp-deployment.md, docs/gcp-verification.json.
**Consumes:** Verified container and uploaded image variants.
**Produces:** Live https://orc.axxes.app with GCP image delivery and working inquiries.
- [ ] Deploy orc with min=0, max=3, request billing, dedicated runtime identity and no unnecessary storage write privileges.
- [ ] Create serverless NEG/backend and add ORC host rule from the current URL map; verify TLS/host routing before publication.
- [ ] Add authoritative DNS and mirrored Google DNS record; verify ordinary HTTPS and DNS resolution.
- [ ] Check all route types, representative responsive images, CMS/catalog JSON, private API auth, and identified test inquiry persistence.
- [ ] Record source/image revision, counts, test evidence, cost model, bulk upload instructions, limitations; review diff and commit changes.
