# DevOps — deployment and operations

Human-authored. How **this** project is deployed and operated.
Section shape is fixed — see `format.md`.

Most tickets end at merge. A ticket the human filed as **`Finish: auto-deploy`** runs the deploy leg
below right after merging, so this file has to be executable as written — an agent will follow it
without asking. Read the commands at the moment of deploying and run them as written; a deploy
command recalled from earlier in the run is the one that is out of date.

## Contract

**Environments**

<What exists — production, staging, preview — and their URLs.>

**Where it runs**

<The platform and the shape of the deployed thing: the service, the image, the domain that points at
it. Enough that "deployed" is unambiguous.>

**n-easyapp is not assumed.** Most projects deploy their own way; write that way here. Use n-easyapp
(and the Azure resources behind it) only when the human explicitly asks for it — then record the
easyapp project name here and in `.dimleaper/project.json` under `deploy`.

## Tools

**Deploy**

<The actual deploy command or pipeline, exactly as invoked. A first-time deploy and a redeploy are
usually different — write both, and say which is the routine one.>

```bash
<command>
```

**Post-deploy check**

<The URL to hit and what a healthy response looks like. "The deploy command exited 0" is not
confirmation — the check below is what says a deploy took.>

```bash
<command>
```

**Secrets and configuration**

<Where runtime configuration lives and how it is changed. Never the values.>

**Operations**

<Logs, monitoring, cron and scheduled jobs, rollback — each as the command that does it.>

## Guidance

<How to approach an operational change here: what to try before escalating, which failure means stop
rather than retry, what a rollback must not do.>

## Redlines

**A closed list, looked up — never judged.** Do not ask "is this a big deal?"; check whether the
action is on the list. If it is: **route around it, or stop and hand it to the human.** Never
proceed, never approximate, never decide on the human's behalf.

Every entry says which of the two it is — **forbidden outright**, or **not without the human's
explicit approval**. An entry that needs a read-through to apply is not a redline; write it as
Guidance instead (`format.md`, test 2).

Deployment writes to external systems, so this is the section cap4 looks up before it deploys.

1. **Creating or deleting cloud resources** — not without the human's explicit approval.
2. **Deploying for the first time** — not without the human's explicit approval. Lookupable: the
   service has no existing revision / no prior deploy recorded here.
3. **A deploy that is not a plain image swap** — <name the concrete shapes for this project, so this
   is looked up and not judged: a schema migration in the diff, a change to the infrastructure files,
   a changed ingress or scaling configuration, a changed secret name>. Not without the human's
   explicit approval. **"Is this destructive?" is not a question to answer at deploy time** — if you
   cannot tell from the list, that itself is the stop.
4. **Pointing a production domain at anything new** — not without the human's explicit approval.
5. **Reporting a deploy as done without running the post-deploy check** — forbidden outright.
6. **<Anything about this project's infrastructure that must never happen>** — <which of the two>.
