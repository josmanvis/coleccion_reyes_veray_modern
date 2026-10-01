# Colección Reyes-Veray on GCP

## Approved intent
Serve the existing collection website at https://orc.axxes.app entirely from GCP. Preserve the gallery, artist pages, CMS content, and acquisition/contact inquiries. The user approved Cloud Run, Cloud Storage, and reuse of the GCP-backed AXXES catalog/CRM. Plan storage for approximately 200 GB of additional client images and files; this does not authorize building a new upload UI.

## Verified starting point
The repository contains a Next.js 16 application in frontend/. Its bundled snapshot contains 4,258 records and 11,360 image references. A local 5.4 GB WordPress asset archive exists; frontend/public/wp-content is an absolute local symlink and cannot be relied upon in a cloud build. Fallback image URLs use WordPress Photon and legacy UploadThing fields remain. Runtime content and inquiries use the coleccion-reyes-veray tenant on members.axxes.club.

Both the canonical members public inventory endpoint and its direct Cloud Run counterpart currently redirect to Handshake sign-in instead of returning JSON. Public tenant reads and inquiry submissions must be verified and repaired in the owning service without bypassing authentication on private routes.

Project gravy-meta has Cloud Run services in us-west1, the axxes-lb HTTPS load balancer, and an ACTIVE *.axxes.app Certificate Manager entry. orc.axxes.app has no existing host rule or record in the Google DNS zone. Authoritative axxes.app nameservers are Cloudflare: publishing only to Google DNS would not activate the hostname.

## Architecture
Deploy the Next.js application as a dedicated orc Cloud Run service in us-west1 using reproducible Cloud Build and Artifact Registry configuration. Attach a dedicated serverless backend to the existing load balancer and add only the orc.axxes.app host rule. Use the existing wildcard certificate and publish the hostname at the authoritative DNS provider. Preserve other load-balancer routes and DNS records.

Reuse the existing GCP production AXXES tenant and CRM rather than create another database. Confirm its backing database and all returned asset origins are on GCP before claiming an entirely GCP runtime. Fix the public API redirect in the owning service with narrowly scoped public-route treatment and regression coverage.

## Storage and future uploads
Use dedicated regional Cloud Storage buckets in us-west1 for public web derivatives and private originals/client documents, with uniform bucket-level access. Standard storage is the initial default: at approximately 200 GiB it costs about $4/month before operations, transfer, deleted versions, and taxes. This conservative estimate treats the user's 200 GB as 200 GiB.

Keep public thumbnails and display images in Standard, with versioned object names and appropriate cache headers. Keep originals and documents private; serve authorized downloads using short-lived signed URLs. Do not expose original documents through the public image bucket. Evaluate colder classes after actual access patterns are known. Autoclass is an option for unpredictable original-file access; explicit Nearline, Coldline, or Archive classes suit known retention patterns but impose retrieval and minimum-duration charges. Do not choose Archive solely by its storage price.

Future bulk uploads should go directly to Cloud Storage through resumable uploads rather than through the website request body. This migration documents that path; a client-facing upload interface is a separate scope. Avoid duplicate retention and indefinite version accumulation; document actual recovery/retention settings. Generate appropriately sized web images so browsing does not download full originals. Add client-specific storage labels and billing visibility.

Pricing source checked 2026-10-01: https://cloud.google.com/storage/pricing . Oregon indicative monthly rates per GiB: Standard $0.020, Nearline $0.010, Coldline $0.004, Archive $0.0012. Internet delivery and operations are separate costs.

## Migration and failure handling
Inventory every image referenced by bundled data and live tenant responses, including CMS images and legacy UploadThing originals/thumbnails. Create a manifest mapping original references to GCP object keys, verify file sizes and hashes, and record missing files explicitly. Copy the local archive and recover referenced remote-only assets where necessary. Update website fallback resolution and remote image patterns for the GCP objects. Reconcile live tenant references without changing unrelated client records.

Retain resilient bundled fallback content, but do not hide an API failure as a successful live integration. Bound outbound API waits and return a clear inquiry failure if persistence fails. Avoid duplicate inquiry creation on retry. Build assets independently of the machine-specific public symlink. Remove active Vercel/Netlify and UploadThing deployment dependencies only after replacements are verified. Deletion of the existing Vercel project is outside this design.

## Verification and acceptance
Run the production Linux build through Cloud Build. Verify homepage, gallery, artist index/detail, artwork detail, about, exhibition, and contact pages. Verify representative optimized images and full asset-manifest reconciliation, with no WordPress/UploadThing runtime image dependencies. Exercise public catalog/CMS endpoints and an identified test inquiry, confirming persistence in the GCP CRM. Confirm private endpoints still require authentication.

Validate the new hostname through the load balancer before DNS activation, then verify ordinary DNS and HTTPS, redirects, TLS, and browser network origins. Check unrelated existing host routes remain intact. Record the deployed image digest, source revision, verification results, remaining limitations, and repeatable deployment/upload instructions.
