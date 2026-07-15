# IntentMill Grill — STEMROBIN-34 (self-adjudicated, cap13)

Full-delegation seed (STEMROBIN-32, released cap8). No human in the loop; every
blocking decision is adjudicated from the live charter + the seed grill record
`.prodfarm/batches/0006-titles-auth-cleanup/grill.md` (**G-2**). Below: the
decisions, each resolved from a cited authority.

## D1 — Where does the section name live: a `content` card field, or the overlay?

**Decision: a plain `name` field on the card in `content` JSONB.** The ticket is
explicit ("writes the section name into the matching card node of
`sr_lessons.content` (add a field e.g. `name`)"; "section name becomes a required
card field going forward"). Full per-locale i18n of section labels is a future
translation-ticket concern (the renderer's own comment already framed the label
dictionary that way). Charter SSOT is satisfied by making `content` the single
authority and deleting the parallel `ANCHOR_NAME` dict.

## D2 — Restore source of truth for the names

**Decision: the STEMROBIN-21 migration snapshots** (`…/snapshots/<id>.html`), the
`<span class="sr-sec-name">` inside each `<section data-sr-section>`, matched to a
card by anchor. This is exactly the source G-2 names, and the migration is where
the name was dropped (`migrate-lib.extractSectionInner` strips `.sr-sec-label`).
The genres have unique anchors, so anchor is an unambiguous key. Verified: all 16
snapshots cover every DB card anchor; the trailing `practice` section has no card
(correctly ignored).

## D3 — Restore mechanism: script vs modify the migration

**Decision: a separate temporary deterministic script** (`restore-section-names.mjs`),
per the seed ("写临时恢复 skill") and the part-1 instruction. The frozen one-shot
`migrate-lib.htmlToCards` is left untouched (Surgical Changes).

## D4 — Reversibility + idempotency

**Decision:** snapshot each lesson's pre-mutation `content` JSONB to
`refs/content-backup/<id>.json` before writing; the write only sets `name`;
re-running re-derives identical names and reports 0 changes. Satisfies the
constraint "确定性脚本、幂等、留快照" and redline #2 (no irreversible data pollution).

## D5 — Do we re-render the 16 `html`/`pdf` caches now?

**Decision: no — out of scope for this enabler.** The acceptance is stated purely
against `content` JSONB + the generator; `html`/`pdf` are derived caches and the
learner-facing display of restored names + the lesson title in 全文速览 is the job
of STEMROBIN-35 (which this ticket unblocks). Re-rendering all 16 (rewriting
`html`+`pdf`, and stage-2 cannot pass the saver's outline check per the module's
known-limit) would be a larger mutation the ticket did not ask for. Flagged as a
residual for the consumer ticket.

## D6 — `sr_users` / prose

**Decision:** never touched; the write is a single `UPDATE sr_lessons SET content`
(+ `updated_at`) per lesson. Redline-respecting, matches "不动 sr_users;
不改课文正文实质（仅补 section 名）".

## Grill leaks

- The one-shot `migrate-lib.htmlToCards` would now emit `name`-less cards that
  fail the stricter `check-content`. It is not on any live path (STEMROBIN-21 is
  done); left as a documented residual rather than reopening frozen migration.
