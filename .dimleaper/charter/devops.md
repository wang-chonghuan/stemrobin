# DevOps — deployment and operations

Human-authored. How **this** project is deployed and operated.
Section shape is fixed — see `format.md`.

Most tickets end at merge. A ticket the human filed as **`Finish: auto-deploy`** runs the deploy leg
below right after merging, so this file has to be executable as written — an agent will follow it
without asking. Read the commands at the moment of deploying and run them as written; a deploy
command recalled from earlier in the run is the one that is out of date.

> Migrated 2026-08-05 from `.prodfarm/charter/runbook.md` (Deploy, Troubleshoot) and
> `.prodfarm/charter/redlines.md` (the spend threshold).

## Contract

**Environments**

One environment: **production**. There is no staging and no preview environment.

- **Live URL: https://lemmadeck.com** (`www` 301s to the apex).
- Origin still answers at
  `https://ca-stemrobin.kindsmoke-4d84c417.northeurope.azurecontainerapps.io`.

**Where it runs**

- Azure Container Apps app **`ca-stemrobin`**, resource group `rg-easyapp-shared`, on the n-easyapp
  substrate (shared environment `cae-easyapp-shared`). n-easyapp **is** this project's deploy path —
  the easyapp project name is `stemrobin`, also recorded in `.dimleaper/project.json` under `deploy`.
- Image `acreasyapp.azurecr.io/stemrobin:latest`, built by `az acr build`.
- The app runs at **`--min-replicas 1`** — no scale-to-zero.
- **Build invariant**: n-easyapp hard-codes the Dockerfile and the build context at the **repo root**.
  The root `Dockerfile` builds the standalone app: `npm ci` from `app/`'s manifest, `npm run build`,
  then ships only `app/.output`.
- **Domain layout** (n-golive cap2, STEMROBIN-111): Cloudflare zone `lemmadeck.com` —
  `A @ → 20.54.18.105` **DNS only (grey; the Azure managed cert needs to reach the origin)**,
  `TXT asuid` = the container app's customDomainVerificationId, `CNAME www → lemmadeck.com`
  **proxied (orange)** plus a redirect rule. Cert `mc-cae-easyapp-sh-lemmadeck-com-3571` (DigiCert,
  auto-renewing) is bound `SniEnabled` on the shared environment.
- Retired 2026-07-25: `mynatree.com` and `stemrobin.com` serve nothing — no DNS records, no hostname
  binding. Their Cloudflare zones are still in the account (re-pointable).

## Tools

**Deploy** — the routine and only path is an n-easyapp **redeploy** of project `stemrobin`: it builds
`acreasyapp.azurecr.io/stemrobin:latest` via `az acr build` and updates the container app. Invoke the
**n-easyapp** skill's redeploy capability for project `stemrobin`; do not hand-assemble the `az`
commands.

**Post-deploy check** — the deploy is confirmed by the live site answering, not by the command's exit
code:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://lemmadeck.com/
```

Healthy is `200`. Then open the page and confirm the change that was deployed is visible.

**Secrets and configuration** — runtime env comes from Azure (the container app's env vars/secrets),
not from the repo `.env`. Change it through n-easyapp / `az containerapp`, never by baking a value
into the image.

**Operations**

```bash
az containerapp logs show -n ca-stemrobin -g rg-easyapp-shared --tail 50
```

## Guidance

A deploy here is a plain image rebuild-and-swap. If the diff being deployed contains anything more
than application code — a schema change, a Dockerfile or infra change, a new env var the container
does not yet have — that is not a routine redeploy; see the redlines below and stop.

An `az` command failing on authentication is a stop (re-auth is the human's), not something to retry
with a different subscription or account.

## Redlines

**A closed list, looked up — never judged.** Do not ask "is this a big deal?"; check whether the
action is on the list. If it is: **route around it, or stop and hand it to the human.** Never
proceed, never approximate, never decide on the human's behalf.

Every entry says which of the two it is — **forbidden outright**, or **not without the human's
explicit approval**. An entry that needs a read-through to apply is not a redline; write it as
Guidance instead (`format.md`, test 2).

Deployment writes to external systems, so this is the section cap4 looks up before it deploys.

1. **Creating or deleting cloud resources beyond the established n-easyapp redeploy path** — not
   without the human's explicit approval.
2. **Deploying for the first time** — not without the human's explicit approval. Lookupable: the
   service has no existing revision.
3. **A deploy that changes the runtime by more than the image's application code** — not without the
   human's explicit approval. The concrete shapes, so this is looked up and not judged:
   - a **schema statement was run** against the live database as part of this work (the DDL file
     `ssot-schemas/db-schemas/lemmadeck.sql` merely *describes* the schema and never ships — editing
     it is not on this list; **applying** anything to the database is);
   - the root `Dockerfile` or anything under `infra/` changed;
   - the container needs an env key it does not already have (`az containerapp show … env[].name`);
   - the ingress or the scaling configuration changed.

   **"Is this destructive?" is not a question to answer at deploy time** — if you cannot tell from
   this list, that itself is the stop. (Reworded 2026-08-06 after STEMROBIN-123: the old entry
   triggered on *the diff touching* the DDL file, which stopped a deploy whose runtime effect was
   nil. A redline that fires on a file nobody ships teaches people to wave it through, which is the
   one thing a redline must never become.)
4. **Moving the root `Dockerfile`, or changing its build context away from the repo root** —
   forbidden outright. n-easyapp hard-codes both; moving it breaks every deploy.
5. **Setting the container app to scale to zero** (`--min-replicas 0`) — forbidden outright.
6. **Pointing a production domain at anything new**, or changing the `lemmadeck.com` Cloudflare
   records or the proxy (grey/orange) state — not without the human's explicit approval.
7. **Reporting a deploy as done without running the post-deploy check** — forbidden outright.
8. **Any action incurring new recurring cost, or a one-off cost above $5** — not without the human's
   explicit approval.
