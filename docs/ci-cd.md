# ORC production CI/CD

Production source: feat/orc-gcp. Pushes and manual dispatch on that exact branch exchange GitHub OIDC through provider github-orc into gh-orc, then submit frontend/cloudbuild.yaml as cb-orc. Main is not production source.

Linux tests and build use the existing migration Dockerfile and bundled snapshot without database or provider credentials. Image layers are scanned before publication. The existing orc/site registry stores immutable SHA/build tags; release stages without traffic, guards concurrent traffic changes, promotes by digest and restores the previous revision on failure. Public readiness uses https://orc.axxes.app/. Runtime orc-runtime and orc-database-url are preserved; the build identity requires no secret read access.

The serving image is recorded in docs/gcp-verification.json: source 1d605b3, build aba3b971-ac80-4299-a8b9-43615227fac1, digest sha256:337d4f0f0ace57ad0c14ffed1c8acf8d9bb39b8bedf05455de282553628865ab. This patch changes configuration only and does not merge the migration into main.
