# IntentMill Draft

## Source

- ticket key: STEMROBIN-22-card-reading-flow
- ticket id: STEMROBIN-22
- `meta.json` read: yes (`.intentmill/tickets/STEMROBIN-22-card-reading-flow/meta.json`)
- `intent.md` read as raw original user input: yes (ticket full text + live charter injected)
- `AGENTS.md`: routed via injected charter (`.prodfarm/charter/*`) — engineering-rules, architecture, runbook read from `intent.md` injection
- `.prodfarm/charter/`: read (goal, redlines, engineering-rules, architecture, runbook) via intent injection
- `.evodocs/modules/`: intent injection carried only module titles (no substantive body); treated as no substantive evodocs — used targeted code inspection instead
- design context read (decided, honored): `.tmp/seed-drafts.md` (§架构定调 G1–G8, 草案4), `.tmp/plan-card-reading.md` (§1, §3.1, §9, §11), `.tmp/seed-drafts.md` 草案 4
- code inspected (repo-root-relative):
  - `app/src/routes/_app/lesson.$id.tsx` (current full-lesson iframe view + practice drawer wiring)
  - `app/src/lib/lessons.ts` (lesson server fns over `sr_lessons`)
  - `app/src/lib/quiz.ts` (practice deck: KEY-secret fetch + server-side judging + answer events)
  - `app/src/components/quiz-drawer.tsx` (drawer UI pattern, `renderMath` app-DOM KaTeX)
  - `app/src/lib/session.server.ts` (`currentUserId`, HMAC cookie)
  - `app/src/lib/session.ts` (client `getCurrentUser`)
  - `app/src/routes/__root.tsx` (global KaTeX auto-render load)
  - `app/src/routes/_app/index.tsx` (catalog availability)
  - `app/src/styles/app.css` (`--sr-*` tokens, `.sr-detail`/`.sr-d-*`/`.sr-quiz-*` classes, mobile media queries)
  - `ssot-schemas/db-schemas/stemrobin.sql` lines 196–295 (JSONB content SSOT contract)
- external docs: none needed — no new library/SDK; KaTeX + Postgres + TanStack Start already in use and documented in-repo.
- `nf-db` usage: `nf-db` skill not installed in this environment. Live DB inspection done read-only via `psql "$EASYAPP_DATABASE_URL"` (the charter runbook's sanctioned path) against the shared Azure Postgres. Only SELECTs were run; no writes. Recorded here per common-rules.
- frontend `DESIGN.md`: `resources/reference/DESIGN.md` is the binding three-color palette source; its tokens are already materialized as the `--sr-*` CSS variables in `app/src/styles/app.css` and inline in each lesson `<head>`. All new UI reuses those tokens/classes — no new hues, spacing, or components.

## Draft Spec

After delivery, opening a migrated math lesson (`/lesson/$id` for any of the 16 `math-s2-*`/`math-s3-*` ids whose `sr_lessons.content` is non-null) presents the 課文 as a **card-by-card 精读 flow** instead of one full-lesson iframe:

- **S1 One card at a time.** The view renders exactly one numbered card (`content.cards[i]`, ordered by array position; the learner-visible number is `card.num`). The card body = its `body` nodes rendered in order: prose nodes → the `zh` overlay `t` HTML, svg nodes → the neutral inline `svg` (with its `caption_id` prose caption if present). Formulas render via KaTeX exactly as in the existing full-lesson render.
- **S2 Per-card read-check gate (soft).** Below the card, that card's `read_check[]` items are presented (2–3 lightweight "did you read this" questions). Modes are `choice` (options resolved from overlay text) and `input` (typed). The learner must answer the current card's read-checks correctly to reveal the "next card" advance.
  - Correct → the card is marked passed; advance becomes available / auto-advances to the next card.
  - Wrong → an inline "回到本卡再读一遍" prompt appears and the item stays answerable (retry). No penalty, no lock, no skip.
- **S3 Review already-read cards.** The learner can navigate back to any already-passed card (soft gate blocks only *forward* past an unpassed current card). A card already passed stays passed.
- **S4 Completion → practice unlock.** When every card is passed, the view shows a "读完 / 可进入练习" state, and the existing practice deck (`QuizDrawer` over `sr_questions`) becomes openable from this page (it is locked/disabled until then).
- **S5 Server-side judging + events.** Read-check correctness is judged **server-side** (a new server fn), never in the browser. When a learner is logged in, each attempt is recorded in `sr_content_answer_events` with `kind='read_check'`, `node_id=<read_check id>`, `is_correct`, `chosen`/`answer_text`, `locale='zh'`. When not logged in, the item is still judged (so the flow is usable) but **no event is recorded** (honors "未登录不记录作答"). Progress is not persisted/consumed this ticket (D6 out of scope) — advancement is per-page-visit client state.
- **S6 Answer-key secrecy (G5).** The initial per-card payload to the browser contains **no** `correct_index` / `accept` / `key`. The server projects the KEY out of the JSONB before sending. The verdict is returned only by the judging server fn after the learner answers.
- **S7 No overflow, formulas render.** Per-card content does not overflow horizontally on desktop or a narrow mobile viewport; KaTeX formulas and SVG render.
- **S8 Non-regression.** The existing practice quiz (post-read), PDF download, catalog, and lesson prev/next nav keep working. `zh`-only (no locale switching — that is STEMROBIN-24). Migrated content, overlays, and `sr_users` are untouched (read-only).

## Draft Plan

Preserve existing architecture; add the smallest new surface. Direction (not final steps):

1. **Server fns — new module `app/src/lib/reading.ts`** (mirrors `lessons.ts`/`quiz.ts` style, `createServerFn`, DB via `sql()`):
   - `getLessonCards({ data: id })` → reads `sr_lessons.content` + `sr_lesson_i18n(locale='zh').overlay`; returns an ordered array of cards, each: `{ id, num, anchor, bodyHtml, readChecks: [{ id, mode, prompt, options }] }`. **KEY-projected out** — `read_check[].key` is never read into the response shape; `options` for choice are resolved overlay strings, `input` sends no accept list. Prose+svg assembled into `bodyHtml` in `body` order.
   - Also expose the shared **card `<head>` styling shell** so the card body iframe reuses the 課文's own KaTeX + DESIGN tokens + element classes (D8 "携 head"). Cleanest source without hand-duplicating the generator's stylesheet: extract the `<head>` inner from the lesson's own derived `sr_lessons.html` cache (read once per lesson, same row as content). Return it alongside cards (e.g. `getLessonReading` returns `{ head, cards }`). Card **bodies** come from JSONB SSOT; only the presentation shell is borrowed from the derived html — no content SSOT drift.
   - `recordReadCheck({ data: { lessonId, nodeId, chosen?, text? } })` → mirrors `recordAnswer`: loads the card tree, finds the `read_check` by `nodeId`, judges server-side (`choice`: `chosen === key.correct_index`; `input`: `normalizeMathAnswer` against `key.accept`, reusing `answer-normalize.ts`). If logged in, insert into `sr_content_answer_events` (`kind='read_check'`, `locale='zh'`). Returns `{ isCorrect }` only (no key leak). Logged-out → judged, no insert.
2. **Component — new `app/src/components/card-reader.tsx`**: owns the per-card 精读 state machine (current index, passed-set, per-read-check verdicts, retry). Renders the card body in a single sandboxed iframe (reuse the existing `LessonFrame` measure/ResizeObserver lifecycle — swap `srcDoc` per card, D8 single-iframe) and the read-check panel in the app DOM (reuse `.sr-quiz-*` option/verdict/input classes + `renderMath` for prompt/options KaTeX). On all-passed → completion state + emit unlock.
3. **Route wiring — `app/src/routes/_app/lesson.$id.tsx`**: replace the single full-lesson `LessonFrame` with `CardReader`; loader fetches `getLessonReading` instead of `getLessonHtml`. Keep the top bar, PDF download, prev/next footer. Gate the practice button: disabled until `CardReader` reports all-cards-read (then it opens the existing `QuizDrawer`). Lessons with no `content` (none currently, but defensive) fall back to the existing full `html` view.
4. **CSS — `app/src/styles/app.css`**: add `.sr-card-*` classes for the reader chrome (card number badge, progress "第 n / N 张", read-check panel, re-read prompt, completion card, prev/next-card controls) using only `--sr-*` tokens and mirroring `.sr-quiz-*`. Verify the existing `@media (max-width:1199px)`/`(max-width:860px)` breakpoints cover the reader; the iframe already sets `width:100%`.
5. **Tests — `.intentmill/tickets/STEMROBIN-22-card-reading-flow/tests/`** + colocated vitest: a server-side judging/KEY-projection unit test (projection strips key; choice/input judged correctly) and a card-assembly test (body order, overlay resolution). Vitest via `app/vitest.config.ts`.

## Code And Evodocs Findings

No substantive `.evodocs` module bodies were available in the injection; targeted code inspection (files listed in `## Source`) is the authority.

**JSONB content contract (verified live, read-only) — `ssot-schemas/db-schemas/stemrobin.sql:196–295` + real rows:**
- All 16 lessons have non-null `content` and `exercises`. Card counts 1–6 (`math-s2-08` practice-lesson has 1 card).
- `content = { cards: [ { id, num, anchor, rev, body:[…], read_check:[…] } ] }`. Cards are ordered by array position; `num` is the learner-visible 编号.
- `body[]` node kinds observed across all lessons: `prose` (`role:"html"`, text lives in overlay under the node `id`) and `svg` (neutral inline `svg` string, optional `caption_id` → a prose node). No other kinds exist.
- `read_check[]` modes observed: `choice` (has `options:[node-id…]` + `key.correct_index`) and `input` (`key.accept:[…]`). Counts across all lessons: 90 choice + 40 input read-checks. Every substantial card carries ≥2 read-checks (T3 delivered this).
- `sr_lesson_i18n(locale='zh').overlay = { "<node_id>": { t, src_rev } }`. **Coverage check passed: 0 missing** — every prose body id, svg `caption_id`, read_check id, and choice option id resolves in the `zh` overlay across all 16 lessons. So the projection cannot hit a missing-node hole.
- Formulas are `$…$` / `$$…$$` inside prose HTML; the existing lesson `<head>` wires KaTeX auto-render on `$`/`$$`/`\(`/`\[` (identical to the app root's global auto-render).
- Prose fragments use lesson-CSS element classes (`sr-term`, `sr-table`, `sr-step`, `sr-pitfall`, `sr-oral`, `sr-note`, `sr-map`, `sr-example`, `sr-eg`, `sr-answer`, `sr-links`) — 222/2626 prose nodes. These are defined in the lesson's own `<head>` stylesheet (mostly top-level or `.sr-lesson`-scoped, not `section`-scoped), so wrapping card body in `.sr-lesson` + reusing that head reproduces styling faithfully. This is why the card iframe must carry the lesson head (D8), not a hand-written CSS subset.
- `sr_content_answer_events` (`stemrobin.sql:280`) already exists with exactly the columns needed (`kind` CHECK includes `'read_check'`, `node_id`, `is_correct`, `chosen`, `answer_text`, `locale`). No schema change this ticket.

**R-UI (best-practice + touched surfaces).** Card-at-a-time gated reading is the standard "micro-learning / guided reading" pattern (Duolingo lesson steps, Khan article checkpoints, Brilliant): one chunk + an immediate low-stakes check, forward-gated but freely reviewable backward, no punitive scoring on the read-check — matches the soft-gate spec exactly. Existing UI surfaces this touches or must stay consistent with:
- `app/src/routes/_app/lesson.$id.tsx` top bar (返回 / 卡片答题 / PDF), the full-lesson iframe (being replaced by the reader), and `LessonNavFooter` prev/next.
- `app/src/components/quiz-drawer.tsx` — the read-check UI must look like a sibling of the practice deck (reuse `.sr-quiz-verdict`/`.sr-quiz-opt`/`.sr-quiz-input`), and the practice drawer itself is the post-read unlock target.
- Catalog `_app/index.tsx` — unchanged (availability still by `listLessonIds`).
- Naming collision to avoid: the top-bar button today is labeled "卡片答题" for the *practice* deck. The new *reading* cards are also "卡片". Copy must disambiguate (e.g. reading = "精读"/"课文卡片"; practice stays "练习/答题") — flagged for grill.

**R-EXT.** No new/unfamiliar external interface. KaTeX (already loaded, same CDN/version pattern), Postgres via existing `sql()`, HMAC session via existing `currentUserId`. Nothing to fetch.

**Evodocs/code disagreement:** none surfaced (no substantive evodocs body). Code treated as authoritative.

## Assumptions

- **A1** Card order = `content.cards[]` array order; learner-visible number = `card.num`. (Verified shape; low risk.)
- **A2** "All cards" for completion includes every card in `content.cards`, including cards that happen to have zero read-checks (rare) — a card with no read-check auto-passes on view. (Low risk; matches "走完全部卡片".)
- **A3** Judge-always / record-only-if-logged-in is the correct reading of "沿用登录门槛…未登录不记录作答" — logged-out learners can still step through (unrecorded). Alternative (hard login gate blocking logged-out at card 1) is possible → raised in grill.
- **A4** Practice unlock is per-page-visit client state (progress not persisted — D6 explicitly out of scope). A returning learner re-reads within a fresh visit. (Matches D6; UX tradeoff raised in grill.)
- **A5** Borrowing the lesson `<head>` from the derived `sr_lessons.html` cache (for the card iframe styling shell) is acceptable and not a content-SSOT violation, because card *content* comes from JSONB and only *presentation* is borrowed from the same lesson row's derived cache (D8 "携 head"). Raised in grill as the one design call.
- **A6** Read-checks have no explanation/reveal field (only `key`); on wrong we only prompt re-read + allow retry (no answer reveal), unlike practice which reveals `answer`. (Verified: read_check objects have no `answer`.)

## Risks

- **UI/R-UI:** "卡片" label collision (reading vs practice) could confuse; mitigate with distinct copy (grill).
- **Rendering:** Per-card iframe height must re-measure on `srcDoc` swap; reuse the proven `LessonFrame` ResizeObserver + delayed re-measure (KaTeX reflows after async CDN load). Mobile no-overflow must be checked empirically (acceptance) — SVGs have fixed `viewBox` widths (e.g. 560) and must scale to `max-width:100%`; the lesson head already handles this but verify on narrow width.
- **DB:** `recordReadCheck` reads the whole `content` JSONB to find one read_check by `nodeId` — fine at this scale (≤6 cards). No schema change; only INSERTs into the disposable `sr_content_answer_events`. Must never write `sr_users` or migrated content/overlays.
- **State machine:** soft-gate correctness — forward blocked until current card's *all* read-checks correct; backward always free; a passed card stays passed; retry after wrong must not lock. Edge: multi-read-check card needs *all* correct before advancing.
- **Answer-key secrecy (G5):** the projection must be verified to omit `key`/`correct_index`/`accept` in the actual browser network payload (acceptance-impacting; will inspect network in cap6).
- **Compatibility:** replacing the loader field (`html` → reading payload) must keep PDF/nav/practice intact; keep a fallback to full `html` for any `content`-null lesson.
- **R-TEST (dev-time test obstacles for cap6):**
  - Server fns need the shared Azure DB + `.env`; unit tests that hit `sql()` need DB access. Mitigate by unit-testing the **pure projection/judging logic** (extract KEY-strip + judge into pure functions testable without DB), and doing the DB-backed path in browser verification.
  - Browser verification requires a **logged-in** learner to exercise event recording + KEY secrecy. Use the dedicated test learner (user_id 2, `edwinbiz+clerk_test@hotmail.com`) via a **minted HMAC session cookie** (no password handling): `sr_session = "2." + hmac_sha256('stemrobin-dev-session-secret','2')`. The repo playwright-test MCP has a version conflict per memory — drive a standalone Playwright script using `app/node_modules/playwright`, or the playwright-test MCP if it works. Clean up any test `sr_content_answer_events` rows for user 2 afterward (disposable, authorized).
  - KaTeX/CDN load timing can make assertions flaky — assert on DOM structure + re-render, not on pixel timing.

## Grill Required

completed

> All blocking decisions adjudicated in `im-grill.md` under full delegation (prodfarm cap13, no human):
> D-LOGIN-GATE (judge-always / record-if-logged-in), D-PRACTICE-UNLOCK (per-visit hard gate, D6),
> D-CARD-HEAD-SOURCE (borrow lesson `<head>` from derived html, bodies from JSONB — D8),
> D-READING-COPY (精读 vs 练习 wording). Assumptions A1–A6 above are confirmed by those decisions;
> no genuine product decision remained that the charter could not settle, so no grill-leak.
