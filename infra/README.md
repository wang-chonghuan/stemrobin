# infra/

Deployment substrate for StemRobin. The runtime substrate is **Azure Container Apps**,
owned and provisioned by **n-easyapp** (project `stemrobin`), not by hand-written IaC here.

- Container App: `ca-stemrobin` in resource group `rg-easyapp-shared`, environment `cae-easyapp-shared`.
- Image: `acreasyapp.azurecr.io/stemrobin:latest`, built by `az acr build` from the **repo-root
  `Dockerfile`** with **build context = repo root** (both hard-coded by n-easyapp's redeploy).
- DB: shared Azure Postgres, per-project schema `stemrobin-schema`. Connection string is injected
  as an env var by n-easyapp; locally it lives in the root `.env` (never committed).

Deploy / rollback / logs commands live in `.prodfarm/charter/runbook.md`. This directory is the
home for any future deploy config that is *not* owned by n-easyapp (e.g. a custom Bicep overlay);
it is intentionally empty of such config today.
