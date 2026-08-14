# infra/

Deployment substrate for LemmaDeck. The runtime substrate is **Azure Container Apps**,
owned and provisioned by **n-easyapp** (project `lemmadeck`), not by hand-written IaC here.

- Container App: `ca-lemmadeck` in resource group `rg-easyapp-shared`, environment `cae-easyapp-shared`.
- Image: `acreasyapp.azurecr.io/lemmadeck:latest`, built by `az acr build` from the **repo-root
  `Dockerfile`** with **build context = repo root** (both hard-coded by n-easyapp's redeploy).
- DB: **not** the Azure Postgres n-easyapp provisions. The live content DB is the shared **Supabase**
  project, schema `lemmadeck-schema`, injected as `LEMMADECK_DATABASE_URL`; locally it lives in the
  root `.env` (never committed). n-easyapp still creates a `lemmadeck-schema` on the shared Azure
  Postgres and wires it as `DATABASE_URL` — same name, different server, empty, and nothing may be
  written through it. See `.intentfold/charter/arch.md`.

Deploy / rollback / logs commands live in `.prodfarm/charter/runbook.md`. This directory is the
home for any future deploy config that is *not* owned by n-easyapp (e.g. a custom Bicep overlay);
it is intentionally empty of such config today.
