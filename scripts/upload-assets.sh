#!/bin/sh
set -eu
# Complete prepare-assets.mjs before uploading; interrupted runs are resumable.
# Keep immutable v1 objects; use a new version prefix for replacement collections.
gcloud storage rsync .superpowers/orc/assets gs://gravy-meta-orc-web --recursive --cache-control='public,max-age=31536000,immutable' --checksums-only --project=gravy-meta
