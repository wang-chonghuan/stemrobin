# IntentMill Grill

> Release mode: **full delegation** (prodfarm cap13 seed STEMROBIN-18, D11). No human in the loop.
> Each blocking decision below is **self-adjudicated from the injected charter, the seed design docs
> (`.tmp/seed-drafts.md` G1–G8 / 草案4, `.tmp/plan-card-reading.md` D1–D15/§11), and the ticket
> acceptance criteria**. `final_decision` values are declarative adjudications, not open questions.
> No decision required a genuine product choice the charter could not settle, so none is left as a
> grill-leak / STOP.

## Blocking Decisions

1.
- id: D-LOGIN-GATE
- question: When a learner is NOT logged in, should the per-card read-check block progress (hard login gate, like the practice deck), or judge-and-advance without recording?
- recommendation: Judge server-side for everyone and let the learner advance; record the attempt in `sr_content_answer_events` ONLY when logged in. Reading the 課文 is not itself login-gated; the login threshold governs *recording*, not *reading*.
- final_decision: Judge always, record only when logged in. This is the literal reading of the ticket constraint "沿用登录门槛与答案保密：未登录不记录作答" (login threshold = recording is skipped when logged out, not that reading is blocked). Matches the existing answer-secrecy posture (`app/src/lib/quiz.ts recordAnswer` returns a verdict server-side; only the INSERT is gated). Adjudicated under full delegation.

2.
- id: D-PRACTICE-UNLOCK
- question: Is the existing practice deck hard-gated behind finishing the card reading, and is that gate per-page-visit or persisted?
- recommendation: Practice is locked until all cards are passed *within the current page visit*; on completion show a "读完 / 可进入练习" state and enable opening the existing `QuizDrawer`. Do not persist/consume reading progress this ticket.
- final_decision: Per-visit client-state hard gate. Dictated by the acceptance ("走完全部卡片后……随后能打开现有练习题") and by D6 which puts progress persistence explicitly out of scope (`sr_content_answer_events` is recorded but not consumed this ticket). A returning learner re-reads within a fresh visit; that is acceptable for this ticket's scope. Adjudicated under full delegation.

3.
- id: D-CARD-HEAD-SOURCE
- question: Where does the per-card iframe get its styling shell (KaTeX + DESIGN tokens + the lesson's element classes like `.sr-term`/`.sr-example`) without hand-duplicating the generator's stylesheet?
- recommendation: Reuse the lesson's own `<head>` (extracted server-side from the same `sr_lessons.html` derived cache row) as the card iframe `<head>`; assemble card *bodies* from the JSONB SSOT. Single sandboxed iframe, swap `srcDoc` per card (D8).
- final_decision: Borrow the `<head>` from the lesson's derived `html` cache; bodies come from JSONB. This honors D8 ("携 head + 内联样式") and the SSOT engineering rule — content SSOT stays the JSONB (the card body text/formulas/svg come from `content` + `zh` overlay), and only the presentation shell is borrowed from the *same lesson row's* derived cache, so there is no content drift and no second hand-maintained copy of the ~11KB lesson stylesheet. Adjudicated under full delegation.

4.
- id: D-READING-COPY
- question: The current top-bar button "卡片答题" opens the *practice* deck; the new *reading* cards are also "卡片". How is the wording disambiguated so the two "卡片" surfaces do not confuse?
- recommendation: Reading flow uses 精读 wording ("精读" / "第 n / N 张卡片" / "本卡"); the practice entry keeps 练习/答题 wording and is shown locked until reading completes. Reuse the product's own term "卡片式精读" from `charter/goal.md`.
- final_decision: Reading = 精读 vocabulary (card counter "第 n / N 张", re-read prompt "回到本卡再读一遍"); practice entry relabeled to a 练习 term and gated. Grounded in the goal statement's own naming ("课文页采用卡片式精读") and the existing `.sr-quiz-*` copy conventions. Adjudicated under full delegation.

## Recommended Defaults

- Card order = `content.cards[]` array order; learner-visible number = `card.num` (verified shape; matches T3 migration output).
- Advance rule: a card is "passed" when **every** `read_check` in it has been answered correctly this visit; a card with zero read-checks auto-passes on view (rare — only degenerate cards). Soft gate blocks only forward past an unpassed current card; backward navigation to any already-passed card is always free and passed cards stay passed (spec S2/S3).
- Wrong answer: show an inline "回到本卡再读一遍" prompt and keep the item answerable for retry; no penalty, no reveal of the answer (read_check JSONB carries no explanation field — verified). Correct answer advances / enables next.
- Server fns live in a new `app/src/lib/reading.ts` mirroring `lessons.ts`/`quiz.ts` (`createServerFn`, `sql()`); input-mode judging reuses `app/src/lib/answer-normalize.ts normalizeMathAnswer` exactly as `recordAnswer` does. read-check events use `kind='read_check'`, `locale='zh'`.
- KEY projection (G5): the card-fetch server fn never reads `read_check[].key` into its response shape; choice `options` are resolved to overlay strings, input sends no accept list. Verified against `sr_content_answer_events` shape — no schema change needed.
- read-check prompt/options render KaTeX in the app DOM via the existing global `renderMathInElement` (same as `quiz-drawer.tsx renderMath`); card body renders KaTeX inside the iframe via the borrowed lesson head.
- UI reuses `--sr-*` tokens and the `.sr-quiz-*` option/verdict/input classes (`resources/reference/DESIGN.md` three-color palette); new `.sr-card-*` classes only for reader chrome. No new hues/components.
- Reader iframe reuses the proven `LessonFrame` height-measure + ResizeObserver lifecycle, re-measured on `srcDoc` swap.
- Defensive fallback: a lesson row with NULL `content` (none today) falls back to the existing full `html` view so the page never breaks.
- Advance affordance: after the current card's read-checks are all correct, reveal a "下一张卡片" control the learner clicks (learner-paced) rather than auto-jumping — less jarring, and it keeps the just-passed verdict visible. A "上一张" control is always available once past card 1. Follows spec S2/S3; implementation-latitude default.
- Lesson title: the 課文 title (e.g. "2.1 用字母表示数") is not a card node — show it once in the reader header via the existing `getLessonLabel(id)` (`app/src/lib/curriculum.ts`), matching how the top bar comment says the numbered title carries the lesson identity. Card chrome then shows only the per-card number "第 n / N 张".
- Dev-time tests (R-TEST): unit-test the pure KEY-strip/projection + judging logic (no DB); do the DB-backed + secrecy path in cap6 browser verification using a minted HMAC session cookie for the dedicated test learner (user_id 2) — no password handling — and clean up the test's `sr_content_answer_events` rows (disposable, authorized by D3/G3). Ordinary vitest via `app/vitest.config.ts`.

## Future Or Conditional Decisions

- Locale switching / English end-to-end: out of scope here (STEMROBIN-24). Read from the `zh` overlay in a way STEMROBIN-24 can generalize (locale is a parameter, defaulted to `zh`), but build no switch UI.
- Persisting/consuming reading progress across visits (real "已读" state on the catalog / resume): deferred (D6). Events are recorded now for a future ticket to consume.
- Whether read-check attempts should feed the catalog progress bar (currently a mockup in `_app/index.tsx`): later phase.

## Out-of-Scope Guardrails

- Do NOT modify migrated content, `sr_lessons.content`/`exercises`, `sr_lesson_i18n` overlays, the generator, or the migration skill — READ only.
- Do NOT touch `sr_users` (redline D12) or delete anything but this ticket's own disposable test `sr_content_answer_events` rows.
- Do NOT change the practice deck (`sr_questions`/`sr_answer_events`/`quiz.ts`/`QuizDrawer` internals) beyond gating its entry point behind reading completion.
- Do NOT add new dependencies (charter iron law) — KaTeX/Postgres/TanStack Start only.
- Do NOT change the DB schema — `sr_content_answer_events` already has every needed column.
- No push / PR / merge / deploy (executor stops at a verified worktree).
