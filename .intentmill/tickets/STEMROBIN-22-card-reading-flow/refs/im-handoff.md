# IntentMill Handoff

## Actual Changes

Card-by-card 精读 (close-reading) flow for migrated math lessons, `zh`-only. All in `app/`:

- **`app/src/lib/reading.ts`** (new): server module for the reading flow.
  - Pure `projectCards(content, overlay)` — turns the neutral `sr_lessons.content` card tree + the `zh` `sr_lesson_i18n` overlay into a browser-facing, **KEY-free** card list (`{ id, num, anchor, bodyHtml, readChecks:[{ id, mode, prompt, options }] }`). Prose body nodes → overlay `t`; svg nodes → `<figure class="sr-fig">svg + figcaption</figure>` (matches the generator's markup); order preserved; fails fast on a missing overlay node.
  - Pure `judgeReadCheck(readCheck, submission)` — server-side judging; choice `chosen === correct_index`, input via `normalizeMathAnswer` against `accept` (reuses `answer-normalize.ts`).
  - `getLessonReading` (GET server fn) — returns `{ head, cards }` where `head` is the lesson's own `<head>` inner HTML extracted from its derived `sr_lessons.html` cache (D8 — KaTeX + DESIGN tokens + element-class stylesheet), `cards = projectCards(...)`. Returns `null` when `content` is NULL (route falls back to full html). KEY is never read into the response.
  - `recordReadCheck` (POST server fn) — judges server-side, and INSERTs into `sr_content_answer_events` (`kind='read_check'`, `locale='zh'`) **only when logged in** (`currentUserId()` non-null); logged-out is judged but not recorded. Returns `{ isCorrect }` only.
- **`app/src/components/card-reader.tsx`** (new): the per-card 精读 state machine. One sandboxed iframe per card (srcDoc = lesson head + card body; reuses the full-lesson iframe height/ResizeObserver lifecycle, re-measured on card swap). Read-check panel in the app DOM reusing `.sr-quiz-*` styles + global `renderMathInElement` for prompt/option KaTeX. Soft gate: a card passes when all its read-checks are correct; wrong → inline "回到本卡再读一遍" + retry (no lock, correct answer never revealed on wrong); "下一张卡片" appears only when the current card passes; "上一张卡片" always available; completion "读完/可进入练习" shows only on the last card when all are passed (so a trailing no-read-check card, e.g. `oral`, is walked, not skipped).
- **`app/src/routes/_app/lesson.$id.tsx`** (edited): loader now fetches `getLessonReading` (and only fetches full `html` as a fallback when there is no card tree). Renders `<CardReader>` when a reading payload exists, else the previous full `LessonFrame`. Top-bar practice button is gated — disabled with a lock icon and "读完全部卡片后解锁练习" title until `CardReader` reports all cards read, then it opens the existing `QuizDrawer` unchanged. Relabeled "卡片答题" → "练习题" to disambiguate reading cards from practice.
- **`app/src/styles/app.css`** (edited, appended): `.sr-card-*` reader-chrome classes (header + counter, read-check panel, per-check verdict, re-read prompt, prev/next-card nav, completion card) using only `--sr-*` tokens + a mobile `@media (max-width:860px)` block. No new hues/components.
- **Tests**: `app/src/lib/reading.test.ts` (new, 9 vitest cases); ticket Playwright script `.intentmill/tickets/STEMROBIN-22-card-reading-flow/tests/browser-render-check.mjs` + screenshots.

No schema change, no new dependency, no change to migrated content/overlays, the generator, the migration skill, the practice deck internals, or `sr_users`.

## Spec And Plan Alignment

Implementation matches `im-spec.md` and `im-plan.md`. Internal contract coverage:

- **Spec obligations R1–R9:** all delivered and browser-verified — one card at a time with `card.num` (R1), body fidelity incl. KaTeX + lesson classes via the reused head (R2), server-judged choice/input read-checks (R3), soft gate with re-read/retry (R4), completion → practice unlock (R5), KEY projected out of the fetch payload (R6, verified on the real client-RPC data payload), judge-always/record-if-logged-in (R7, verified via recorded events + logged-out still usable), mobile no-overflow + formulas (R8), non-regression of PDF/catalog/practice/nav + NULL-content fallback (R9).
- **Plan obligations:** four code areas per plan; pure logic factored out and unit-tested; phases + verification points executed (unit → tsc → build → browser).
- **Critical existing contracts preserved:** answer-key secrecy (KEY server-only, projected out — unit + browser verified), DB-only via `sql()`, session via `currentUserId()`, iframe measure/ResizeObserver lifecycle, JSONB content contract, KaTeX rendering (app-DOM for prompts, iframe head for body), DESIGN.md palette (`--sr-*` only).
- **Non-scope / rejected options absent:** no locale switch UI (locale param defaulted to `'zh'`), no progress persistence (events recorded, not consumed), practice deck internals unchanged (only entry gated), logged-out not hard-blocked, no card auto-jump, no schema/dependency changes.
- **Test obligations:** every `## Unit Test Plan` item covered — see `tests/test-results.md ## Coverage Map`.

Deviation: none material. One minor design refinement made during dev and reflected in `im-spec.md` R5 wording ("completion appears on the last card"): the completion UI is gated on `allRead && isLast` so a trailing card with no read-check is still shown rather than skipped the instant the previous card passes. This strengthens R1/R4 ("走完全部卡片") and does not change any confirmed decision.

## Browser Verification Evidence

Headed Chromium, logged-in test learner (user_id 2, minted HMAC session cookie — no password handled), 20/20 assertions passed. Screenshots in `tests/screenshots/`:

- `card1-desktop.png` — one numbered card ("第 1 / 5 张卡片") with KaTeX formulas + read-check options; top-bar practice button shows a lock.
- `card1-wrong-reread.png` — a wrong pick marked with an X, correct answer NOT revealed, "答得不对——回到本卡再读一遍，然后重答。" guidance, next card still locked.
- `all-read-desktop.png` — "这一课读完了" completion after walking all 5 cards; practice unlocked.
- `practice-open-desktop.png` — the existing practice `QuizDrawer` opens after reading.
- `card1-mobile.png` — 375px: no horizontal overflow (documentElement.scrollWidth == innerWidth == 375; card body scrollWidth == clientWidth), formulas render.

Answer-key secrecy: the actual client-RPC reading data payload (captured over the wire) carries card data (`bodyHtml` + read-check prompts) but contains no `correct_index`, no `"accept"`, and no `"key"`. Which UI contracts Playwright verified: one-card gating, soft-gate wrong/right, completion→practice unlock, mobile no-overflow. No unresolved visual-fidelity gaps.

DB side effects: `sr_content_answer_events` correctly recorded the logged-in attempts (wrong then correct, choice + input, `kind='read_check'`, `locale='zh'`); the 18 disposable test rows were deleted afterward (0 remaining for user 2). `sr_users` untouched (count 2).

## User Review Points

None. All blocking decisions were adjudicated in `im-grill.md` under full delegation and honored; no missed grill point surfaced during development.

## Residual Issues And Future Improvements

- Reading progress is per-page-visit only (D6 out of scope): a returning learner re-reads within a fresh visit, and the catalog shows no persistent "已读" state. A future ticket can consume the already-recorded `sr_content_answer_events` to persist/resume progress and drive the catalog progress bar.
- Locale is a parameter defaulted to `'zh'`; English end-to-end + a language switch are STEMROBIN-24. `getLessonReading` reads the overlay by locale in a way that generalizes.
- The card iframe reuses the lesson's derived-`html` `<head>` for styling (D8). If a future change makes `sr_lessons.html` a non-authoritative/absent cache, the card head source should be revisited (the card bodies would be unaffected — they come from JSONB).
