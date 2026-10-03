# ORC CI ownership

Main runs credential-free frontend Linux lint, TypeScript and build checks. MAC_API_BASE is a closed localhost endpoint, forcing the existing bundled fallback; CI does not contact Members. Electron binary download is disabled. Tests run when a source branch supplies a test script.

Production source remains feat/orc-gcp. Main lacks the serving GCP catalog/inquiry/asset implementation and must not deploy or replace it as part of CI configuration work. A separate configuration-only PR targets feat/orc-gcp; no application migration is merged into main.
