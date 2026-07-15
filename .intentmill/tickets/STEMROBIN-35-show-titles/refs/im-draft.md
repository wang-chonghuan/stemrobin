# IntentMill Draft

## Source

- ticket key: STEMROBIN-35-show-titles
- ticket id: STEMROBIN-35
- `meta.json` read (`.intentmill/tickets/STEMROBIN-35-show-titles/meta.json`).
- `intent.md` read as the raw original user input (`.intentmill/tickets/STEMROBIN-35-show-titles/intent.md`).
- `AGENTS.md` route read and obeyed (routes to `.prodfarm/charter/` intent + `.evodocs/modules/` understanding).
- `.prodfarm/charter/` read (goal, redlines, engineering-rules, architecture, runbook — injected verbatim in `intent.md`).
- `.evodocs/modules/module-index.json` route consulted; substantive module docs read: `mod--app--learner-experience` and `mod--app--domain-services` (both injected in `intent.md`).
- Code areas inspected:
  - `app/src/lib/reading.ts` (`getLessonReading`, `projectCards`, `buildFullTextHtml`, neutral/overlay shapes)
  - `app/src/lib/quiz.ts` (`getLessonQuestions` — browser-safe, KEY-free)
  - `app/src/routes/_app/lesson.$id.tsx` (loader, `mode` toggle 精读/全文速览, `LessonFrame`, `QuizDrawer` wiring)
  - `app/src/components/card-reader.tsx` (card 精读 head + KaTeX MutationObserver typeset pattern from STEMROBIN-27)
  - `app/src/lib/curriculum.ts` (`getLessonLabel` — locale-aware lesson title source)
  - `app/src/lib/locale.server.ts` (default locale `zh`)
  - `ssot-schemas/db-schemas/stemrobin.sql` (JSONB content contract; `content.cards[].name`, `sr_lessons.title`)
  - `resources/reference/DESIGN.md` (three-color palette, compact school-serious hierarchy)
- External docs (`find-docs` / Context7): none needed. No new external library/SDK/API/service is introduced. KaTeX (CDN auto-render), the `postgres` client, and TanStack Start server functions are all already established in this repo (STEMROBIN-24/27/28). See R-EXT below.
- `nf-db` usage: the repo-local `nf-db` skill is not installed. This ticket performs **no** schema change and **no** new write; it only reads already-selected columns (`sr_lessons.content`, `.title`) and an existing browser-safe server fn (`getLessonQuestions`). Read-only grounding of the target lesson (`math-s3-07`) was done via `psql` against `EASYAPP_DATABASE_URL` (server-only URL from root `.env`), recorded under Findings.
- Frontend `DESIGN.md`: `resources/reference/DESIGN.md` read. New UI (section-title element in the card head, section/title headings and a 课后题 block in the 全文速览 iframe) will follow its tokens/typography (see Findings).

## Draft Spec

What must be true after delivery (draft):

- **Card 精读 view** shows both the **lesson title** and the **current card's section title (中文名, `card.name`)**.
  - The lesson title is already rendered in the card head (`sr-card-lesson` = `getLessonLabel(id, locale)`, e.g. `3.7 去分母解方程`). Delivery adds the current card's `name` (e.g. `为什么学这个` / `讲解` / `例题`) to the card head.
- **全文速览 (full-text) view** shows, in traditional-textbook order inside the existing sandboxed iframe:
  1. the **lesson title** at the top,
  2. **each section's title** (`card.name`) as a heading before that section's content,
  3. the full text (unchanged card bodies),
  4. the **课后题 (post-lesson exercises)** listed after the full text — prompt + options visible, read as a static list.
- **课后题 in 全文速览 are display-only** (seed grill G-3): not answerable, not judged, record no events, and do not change 练习 (practice) progress or 课文 (reading) progress. They are rendered as static HTML with no submit control, no click handler, and no server call — structurally incapable of recording. The real answering/scoring path stays the `QuizDrawer` practice flow (unchanged).
- Section titles come from `content.cards[].name` (STEMROBIN-34 JSONB), **not** the stale `sr_lessons.html` cache. The 课后题 come from the browser-safe `getLessonQuestions` source (no answer KEY).
- **Compatibility / non-regression:** the card 精读 read-check flow (`recordReadCheck`), the practice drawer answering/scoring, per-locale availability, KaTeX formula rendering, the login gate, and mobile (no horizontal overflow at 375px) all keep working. Only `app/` changes; no new dependency; no schema change.
- Non-scope: no answering/scoring/progress in 速览; no localization of `card.name`/lesson-title into non-source locales (they stay source-authored — see Assumptions/Risks); no change to the practice drawer contract; no change to the derived `html` cache.

## Draft Plan

Rough direction (reuse existing pieces; smallest effective change), all in `app/`:

1. **Surface `name` in the reading payload** (`app/src/lib/reading.ts`):
   - Add `name: string` to the neutral `NeutralCard` type and to the browser `ReadingCard` type; map `name: card.name` in `projectCards`. `card.name` is already present in every card of `sr_lessons.content` (verified). Purely additive; the read-check KEY projection is untouched.
2. **Card 精读 section title** (`app/src/components/card-reader.tsx`): render `card.name` as a section title element in `sr-card-head` (kept next to the existing lesson label + `num/total` progress). No behavior change to read-check submit.
3. **全文速览 title + section headings + 课后题** (`buildFullTextHtml` + `lesson.$id.tsx`):
   - Extend `buildFullTextHtml` (pure, unit-tested) to also take the lesson title and the browser-safe questions, and emit inside `<article class="sr-lesson">`: an `<h1>` lesson title, then per card an `<h2>` section title (`name`) followed by its `bodyHtml`, then a trailing 课后题 block (heading + ordered list of prompt/options) as **static** markup. Headings sit inside `.sr-lesson` so the lesson's own stylesheet (already in `head`) styles them; the head's `renderMathInElement(document.body,…)` (verified) typesets the appended 课后题 formulas too.
   - Fetch questions in the lesson route loader via the existing `getLessonQuestions` and pass them (with `getLessonLabel(id, locale)` as the title) into `buildFullTextHtml`. The `QuizDrawer` keeps its own independent fetch (unchanged) so the practice path is untouched.
4. **i18n + CSS**: add a `课后题`/`Exercises` label key (`app/src/lib/i18n.ts`) for the 课后题 block heading; add a compact `.sr-card-section` style in `app/src/styles/app.css` for the card-head section title using existing `--sr-*` tokens (no new hue/spacing scale). 全文速览 headings reuse the lesson stylesheet inside the iframe.
5. **Tests**: extend `projectCards` unit test for `name`; add `buildFullTextHtml` unit tests asserting the title, each `name` heading, and the 课后题 prompts/options appear and that no interactive/submit markup is emitted. Browser-verify per gate6.

This preserves the module boundary (learner-experience renders; domain-services stays the KEY-free producer), reuses `getLessonQuestions`/`getLessonLabel`/the lesson-head KaTeX, and adds no query beyond one already-existing server-fn call in the loader.

## Code And Evodocs Findings

- **`content.cards[].name` is real and populated (STEMROBIN-34).** Verified for `math-s3-07`: `title = 去分母解方程`; card names `["为什么学这个","讲解","例题","与其他知识点的联系","概念口试"]` (5 cards); 20 `sr_questions` (ord 1–20, choice/`辨认` etc, prompts carry KaTeX `$\frac{x}{4}$…`). The schema contract documents `name` at `ssot-schemas/db-schemas/stemrobin.sql` line ~224.
- **Current 全文速览 shows no titles at all.** `buildFullTextHtml` today emits only `<article class="sr-lesson">${cards.map(c=>c.bodyHtml).join('\n')}</article>` — no lesson `<h1>`, no section headings. Card `bodyHtml` is overlay prose with no headings. The lesson route top bar comment even says "no title in the top bar — the 課文's own numbered h1 carries it", but the JSONB-derived full text no longer contains that h1. This is exactly the gap STEMROBIN-35 fixes; it is the concrete "existing UI surface the change touches / makes stale".
- **Lesson-title source (SSOT nuance).** The app already has a locale-aware title path: `getLessonLabel(id, locale)` → `localizeLessonTitle(id, outlineTitle, locale)`, used in the card head and the nav footer. For `math-s3-07` it yields `3.7 去分母解方程`, containing `sr_lessons.title` verbatim. The intent says "lesson title from `sr_lessons.title`"; its binding concern (constraints) is "do NOT rely on the stale `html` cache's generic labels". `getLessonLabel` is **not** the html cache — it is the current authored outline, and it is the established locale-aware title renderer. Draft direction: use `getLessonLabel(id, locale)` as the displayed lesson title in both views (already in the card head; passed into `buildFullTextHtml` for 速览). This is one source, locale-correct, and satisfies the constraint. (Recorded as a grill recommended-default, not a silent choice.)
- **R-UI best practice / peer patterns.** The intent asks for "traditional textbook style". Peer patterns for a read-through lesson page: a printed-textbook layout puts the lesson title as the page `<h1>`, each 节/section under its own heading, and the section's exercises ("本节练习"/"课后题") printed at the end of the lesson text for reading — this is the layout of Chinese 义务教育 textbooks and matches how Khan Academy separates an article's read view from its practice. Distinguishing it from the practice drawer (interactive, graded) is deliberate: the 速览 list is for reading, the drawer is for answering. UI surfaces touched/affected: (a) card 精读 head `sr-card-head` (gains section title); (b) 全文速览 iframe via `buildFullTextHtml` (gains title + section headings + 课后题 block); (c) the practice `QuizDrawer` — **reused as the read source only, not modified**, so the two ways of seeing exercises (read-only 速览 vs graded drawer) must stay visually/behaviorally distinct. No other learner surface (overview, story, login, catalog) is touched.
- **R-EXT: no new external interface.** KaTeX is loaded by the lesson's own `<head>` (CDN `katex@0.16.11` + auto-render); the verified head calls `renderMathInElement(document.body,{delimiters:[$$,$ ,\\[,\\(],throwOnError:false})` on load, so any static 课后题 markup appended inside the iframe `<body>` is typeset with no extra wiring (same mechanism STEMROBIN-28 relies on for card-body formulas). App-DOM math in the card head (if the section name ever carried `$…$` — `card.name` here is plain Chinese) would use the existing STEMROBIN-27 `renderMathInElement` MutationObserver already in `card-reader.tsx`. `getLessonQuestions` is an existing TanStack Start server fn that already omits `correct_index`/`accept`/`answer` (answer-key secrecy, mod--app--domain-services). No provider, quota, auth, or side-effect posture changes.
- **Evodocs/code agreement.** `mod--app--learner-experience` and `mod--app--domain-services` describe the iframe-sandbox reading model, KEY-free question reads, and "renderer changes must be tested with real persisted lessons". The reading model in code is the STEMROBIN-24 neutral-JSONB + per-locale overlay (newer than the modules' prose, which predates the JSONB migration); code is treated as authoritative. No contradiction affecting this ticket.
- **DESIGN.md rules the new UI follows:** display type (`Bricolage Grotesque`) for the section/lesson titles; `--sr-ink` / `--sr-ink-soft` / `--sr-ink-dim` ink scale; no new hue (three-color palette); compact dense hierarchy (section gaps ~14px); serious teacher tone for the `课后题` label. 全文速览 headings inherit the lesson stylesheet inside the iframe (already DESIGN-aligned generated CSS).

## Assumptions

- `content.cards[].name` is present for every card of every readable lesson (STEMROBIN-34 restored it repo-wide). Verified for `math-s3-07`; low risk. If a card lacked `name`, the heading for that section would be empty — mitigate by omitting an empty heading rather than rendering a blank one.
- The displayed lesson title in both views is `getLessonLabel(id, locale)` (which carries `sr_lessons.title`), not the raw column, per the SSOT nuance above. Flagged for grill confirmation (recommended default).
- `card.name` and the lesson title stay in the source language (zh) even under a non-source locale (en), because STEMROBIN-34 only restored zh `name`s and no translation node exists for them; the 课后题 text itself IS locale-aware via `getLessonQuestions`. Low product risk given the default/primary locale is zh; flagged for grill as a known limit / out-of-scope guardrail.
- Rendering 课后题 as static iframe markup (no handlers) is sufficient to guarantee G-3 "no answer/judge/record/progress in 速览". Low risk — there is literally no code path from the static list to a server fn.

## Risks

- **UI:** 全文速览 could grow long with 20 questions; must not introduce horizontal overflow on 375px (options with long KaTeX). Mitigate by letting options wrap/stack (reuse lesson stylesheet list styles; no fixed widths). Verify at 375px per gate6.
- **UI consistency:** the 速览 课后题 must read as review-only and not look like the answerable drawer (no option buttons that imply clicking). Render options as a plain list, not `sr-quiz-opt` buttons.
- **Non-source locale text mix:** under en, section names + lesson title show zh while 课后题 + body show en. Acceptable per scope (zh is default/primary); recorded as a known limit for grill, not silently shipped.
- **KEY secrecy:** must keep using `getLessonQuestions` (KEY-free) for the 速览 list; never read `sr_questions.correct_index/accept/answer` into the iframe. No change to the secrecy boundary.
- **Practice/reading progress isolation:** must not mount any component or fetch that records events when viewing 速览; the loader's `getLessonQuestions` is a GET that writes nothing, and the static list has no submit — confirm no `recordAnswer`/`recordReadCheck`/`recordPracticeAttempt`/attempt fires from 速览 (browser network assertion in gate6).
- **Dev-time testing obstacles (R-TEST):** the pure functions (`projectCards` `name` mapping, `buildFullTextHtml` title/section/课后题 emission and absence of interactive markup) are unit-testable with `vitest` (existing `app/vitest.config.ts`), no external dependency. The end-to-end assertions (section title visible in card head; title + section headings + 课后题 visible in 速览; formulas typeset; no record event on 速览; 375px no overflow) require a running dev server + a logged-in learner. Obstacle: the login gate — needs a session cookie. Handled per the ticket's stated approach: mint a `sr_session` cookie for the dedicated test learner (user 2) using `SESSION_SECRET` (dev fallback `stemrobin-dev-session-secret`), standalone Playwright from `app/node_modules/playwright`; no password typed. No new test account or credential to request from the user.

## Grill Required

completed

Grill decisions D1–D4 are recorded and adjudicated in `im-grill.md` under full delegation
(cap13, no human) from `.prodfarm/charter/` + seed grill G-2/G-3:
- D1 lesson-title source → `getLessonLabel(id, locale)` (locale-aware, carries `sr_lessons.title`, not the stale html cache).
- D2 全文速览 layout → traditional-textbook order (lesson `<h1>`, per-section `<h2>` `name`, trailing 课后题 block).
- D3 速览 课后题 → display-only, static, no answer/judge/record/progress (G-3); drawer stays the answering path.
- D4 non-source locale → title + section names in source language (zh) this ticket; 课后题 text stays locale-aware; translating names/title is out of scope (known limit).
