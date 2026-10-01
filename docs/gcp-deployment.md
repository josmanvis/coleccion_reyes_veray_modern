# Colección Reyes-Veray on Google Cloud

Public site: https://orc.axxes.app
Vitrine product/login: https://vitrine.axxes.app and https://vitrine.axxes.club
Project: `gravy-meta`; region: `us-west1`.

## Resources and operating costs

The website uses one Cloud Run service (`orc`) with request billing, 1 CPU, 512 MiB RAM, zero minimum instances, a maximum of three instances, and concurrency 40. Idle requests do not require an always-running server. It reuses the existing AXXES load balancer, wildcard certificate and Cloud SQL instance; this deployment adds no dedicated database or load balancer.

`gravy-meta-orc-web` holds the existing publicly available artwork images and precomputed WebP sizes (320, 640, 960 and 1600 pixels). Immutable versioned URLs have a one-year browser cache lifetime. Images load directly from Cloud Storage, avoiding Cloud Run resizing CPU and application upload/download bandwidth. Files are fetched lazily; gallery searches reuse their filtered index rather than refilter on every scroll update.

`gravy-meta-orc-private` is reserved for future client originals/documents. Public access is prevented. Both buckets are regional with uniform bucket-level access, no object versioning, and seven-day soft deletion. Public web assets stay in Standard storage. The empty private bucket has Autoclass enabled with Archive as its terminal tier, adapting future originals to actual access without retrieval or early-deletion fees. The private bucket is currently empty. Future original uploads do not become public automatically. Existing public archive downloads preserve the previous website behavior.

For a conservative 200 GiB estimate, Standard storage is approximately $4/month before derivatives, operations, downloads, soft-deleted data, taxes and shared infrastructure charges. Upload bandwidth is free; internet downloads are separately billed. Private Autoclass objects at least 128 KiB move to Nearline after 30 unread days, Coldline after 90 and Archive after 365; reading them returns them to Standard. At 200 GiB entirely cold, underlying storage would be about $2/month Nearline, $0.80 Coldline or $0.24 Archive, plus Autoclass management ($0.0025/1,000 eligible objects/month), operations and downloads. Public images remain Standard. Current official pricing: https://cloud.google.com/storage/pricing . The existing database/load-balancer bill belongs to the shared platform and is not included in this storage estimate.

## Catalog and inquiries

Runtime catalog reads and inquiry writes use the existing `axxes_prod` database on `gravy-meta:us-west1:axxes-prod-db` directly. The `orc_web` PostgreSQL role can read tenant-filtered `orc_public` views and insert/update this client's contacts; it cannot read the underlying private tables or modify another tenant. Published products/pages and visible blocks are filtered in PostgreSQL. The service account `orc-runtime` can access only `orc-database-url` plus the Cloud SQL connection permission; it has no storage write or bucket-admin access.

The standalone container receives the database URL through Secret Manager; no database credential is in its source/image/build arguments. Reads are cached and pages revalidate. A verified public snapshot allows offline builds and fallback reads during database outages. Inquiry success requires a committed GCP CRM write; failures return an error rather than silently acknowledge the request.

The existing shared `members.axxes.club` deployment currently uses Neon. ORC does not call it in production. Changes made solely in that separate Neon-backed administration deployment will not update the GCP catalog automatically. This migration deliberately does not switch unrelated clients' shared database connection. Manage this client's production records in Cloud SQL; migrating the shared administration platform is separate scope. No inquiry is mirrored to Neon.

## Repeatable build and deploy

From the repository root:

```sh
npm --prefix frontend ci
npm --prefix frontend test
npm --prefix frontend run lint
npx --prefix frontend tsc --noEmit --project frontend/tsconfig.json
node --test scripts/asset-paths.test.mjs

gcloud builds submit frontend --project=gravy-meta --region=us-west1 \
  --config=frontend/cloudbuild.yaml --async
```

Cloud Build runs the tests and Linux production build inside Node 24, and pushes an image into the `orc` Artifact Registry repository. Inspect the completed build, get its image digest, and deploy that verified digest:

```sh
python3 scripts/deploy-gcp.py deploy \
  --image=us-west1-docker.pkg.dev/gravy-meta/orc/site@sha256:THE_VERIFIED_DIGEST
```

The `route` action adds only `orc.axxes.app` to the shared URL map using its concurrency fingerprint. The `dns` action adds only this hostname at authoritative Cloudflare DNS and mirrors it in the prepared Google zone. These are already configured; do not reconfigure unrelated hosts. Deployment/provisioning CLI access belongs to authorized operators, not the runtime identity.

## Current-image preparation and later bulk uploads

For the original migration, set `ORC_ARCHIVE` to the local WordPress archive root, then run:

```sh
UV_THREADPOOL_SIZE=8 ORC_ARCHIVE=/path/to/coleccionreyesveray.com \
  node scripts/prepare-assets.mjs
scripts/upload-assets.sh
```

The script normalizes references, recovers missing originals from the previous public origins, generates derivatives once and records missing assets. Generated staging files are ignored by git; only the image mapping is bundled server-side. Prepare fully before uploading. Treat `v1` objects as immutable; use a new version prefix when replacing a collection.

For the later 200 GB set, upload original files directly to the private bucket with Google Cloud tooling, not through a Next.js form:

```sh
gcloud storage rsync /path/to/client-files \
  gs://gravy-meta-orc-private/originals/SET_VERSION --recursive
```

Resumable transfers allow interrupted large uploads to continue. Preserve filenames/checksums, create web derivatives only for images published on the site, upload those to a new public version prefix, and update this client's GCP catalog mappings before publishing. Keep confidential documents in the private bucket. Authorized private downloads should use short-lived signed URLs when that workflow is added; the current public site has no private-file uploader or document browser.

## Verification record

See `docs/gcp-verification.json` for deployed revision/image, route checks, database isolation and inquiry checks, asset reconciliation, and source image reconciliation. All 8,484 referenced images were recovered; no missing source image is expected in this release.

## Vitrine product entry

Both Vitrine domains present the original premium landing page, membership prices, real `/register` and `/sign-in`, and the Vitrine-branded desk at `/orc`. The gated `/orc/viewing-room` uses ORC’s public collection renderer. The `vitrine-app` and `vitrine` Cloud Run services use the GCP catalog, domain-specific environment secrets and the `vitrine-app-runtime` identity. Separate `vitrine` cookie prefixes and domains avoid overwriting other suite sessions. Accounts share the GCP datastore and can sign in to either domain; cookies do not cross `.app` and `.club`. Cross-domain Handshake SSO is not enabled.

New registration records a selected membership request and awaits existing manual activation or an owner’s invitation; payment checkout is not configured. It never grants the Reyes-Veray client seat. Authorized entry-organization seats open only the pinned client collection; direct private collection seats retain the existing subscription checks. The collection switcher remains available on unpaid collections.

Its source is the Vitrine repository branch `feat/orc-vitrine`, with a separate `cloudbuild-orc.yaml` build workflow. Each Vitrine service has a limit of two instances, 1 CPU, 512 MiB, concurrency 40, zero minimum instances and request billing. The shared load balancer/certificate carries both hostnames.

After remote object checksum/size verification, `scripts/migrate-image-references.mjs` updates known image references in this client's products and published/visible CMS records to GCS originals. `--dry-run` executes the same scoped updates and rolls back. The real run requires complete asset verification and writes a unique ignored JSON backup before committing. Unchanged JSON fields and other tenants are preserved. Vitrine's table requests the prepared 320px WebP derivative instead of each original.

Autoclass behavior and exclusions: https://docs.cloud.google.com/storage/docs/autoclass . Enablement occurred while the private bucket was empty.
