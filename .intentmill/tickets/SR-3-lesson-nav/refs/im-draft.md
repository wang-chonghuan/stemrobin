# IntentMill Draft

## Source

- ticket key: SR-3-lesson-nav
- ticket id: SR-3
- `.intentmill/tickets/SR-3-lesson-nav/meta.json` read; ticket-key/branch/worktree confirmed.
- `.intentmill/tickets/SR-3-lesson-nav/intent.md` read as the raw original user input.
- `AGENTS.md` read (simplicity-first, surgical changes, SSOT rules apply).
- `.evodocs/constitution.md` read (stack + Operations Runbook). `.evodocs/index.json` read: `modules` is empty — no substantive module docs exist; targeted code inspection used instead.
- Code areas inspected:
  - `src/routes/_app/lesson.$id.tsx` (lesson page: top bar, `.sr-d-scroll` content area with `LessonFrame` iframe, QuizDrawer)
  - `src/lib/curriculum.ts` (`CURRICULUM`, `getLessonLabel`, `AVAILABLE_LESSONS` — flat, in-order list of lessons that have pages)
  - `src/components/catalog.tsx` (catalog sidebar; lesson links via `Link to="/lesson/$id"`)
  - `src/routes/_app/index.tsx` (uses `AVAILABLE_LESSONS` for the home list)
  - `src/styles/app.css` (`.sr-detail`, `.sr-d-top`, `.sr-d-scroll`, `.sr-btn`/`.ghost`, `.sr-icontool`, focus-visible rules)
  - `vitest.config.ts` + `src/lib/answer-normalize.test.ts` (existing pure-module unit test layout)
- External docs: none needed — the change uses only `@tanstack/react-router` `Link` and `lucide-react` icons, both already established patterns in this repo (`catalog.tsx`, `lesson.$id.tsx`). No new/unfamiliar external interface.
- `nf-db`: not used — no database operation; navigation is derived from the static `CURRICULUM` constant.
- Frontend design: `DESIGN.guide.md` and `DESIGN.md` read; `DESIGN.md` (with `src/styles/app.css` `--sr-*` tokens as CSS source of truth) is binding for all UI in this ticket.

## Draft Spec

What must be true after delivery (per intent 完成判据):

- The lesson page (`/lesson/$id`) shows "上一课 / 下一课" navigation that moves between lessons **that have pages**, in `CURRICULUM` order. The existing `AVAILABLE_LESSONS` flat list in `src/lib/curriculum.ts` is exactly that order and is the SSOT for the sequence.
- On any lesson page that is not the first entry of `AVAILABLE_LESSONS`, a visible "上一课" control navigates to the previous entry's `/lesson/$id`.
- On any lesson page that is not the last entry, a visible "下一课" control navigates to the next entry's `/lesson/$id`.
- The first entry shows "上一课" as a disabled control (kept in layout, non-clickable, dimmed — grill G2 final); the last entry shows "下一课" disabled symmetrically.
- Outline-only lessons (no `id` in `CURRICULUM`) never participate: they have no pages, get no routes, and never appear as a prev/next target. (Assumption A3 covers ids not present in `AVAILABLE_LESSONS`.)
- UI copy is Chinese ("上一课" / "下一课"), per intent and DESIGN.md content tone.
- UI follows DESIGN.md: ghost-button pattern (`.sr-btn.ghost` — transparent, `--sr-line` border, `--sr-panel` hover), lucide stroke icons (ChevronLeft/ChevronRight family), compact spacing, focus-visible teal outline (already global in app.css). No new colors, tokens, or component archetypes.

Non-scope (from intent Out of scope): lesson content rendering unchanged; catalog/目录页 unchanged; no keyboard shortcuts; no progress tracking; no pages for outline-only lessons. Story pages (`/story/$id`, 名人传记) are a separate content family outside CURRICULUM and are untouched (see Out-of-Scope note in findings).

Grill-settled UI requirements (final decisions G1–G4 in im-grill.md):

- Placement (G1): a footer navigation row at the bottom of the lesson content — inside `.sr-d-scroll`, after `LessonFrame` — 上一课 on the left, 下一课 on the right.
- Boundary treatment (G2): first/last entries render the corresponding control in a disabled state (layout-stable), following the `.sr-icontool:disabled` precedent.
- Control content (G3): direction label plus the target lesson's numbered title via `getLessonLabel` (e.g. "下一课 · 2.5 同类项与合并").
- Story pages (G4): `/story/$id` chapter pages stay untouched; story-chapter navigation is a separate future ticket.

## Draft Plan

Rough direction (not final steps):

- Add a small pure helper in `src/lib/curriculum.ts` (e.g. `getLessonNav(id)` returning `{ prev, next }` entries from `AVAILABLE_LESSONS`), keeping the sequence logic testable and out of the component. Reuses `AVAILABLE_LESSONS` — no second source of truth.
- Render the nav controls in `src/routes/_app/lesson.$id.tsx` as a footer row inside `.sr-d-scroll` after the `LessonFrame` (grill G1 final). Use `@tanstack/react-router` `Link to="/lesson/$id" params={{ id }}` exactly like `catalog.tsx`; loader refetches HTML per navigation as today.
- Style with existing `.sr-btn ghost` + lucide icons; at most a tiny additive CSS rule in `src/styles/app.css` for the footer row layout if inline flex styles (the file's existing pattern) do not suffice.
- Tests: vitest pure-module unit tests for the nav helper at `src/lib/curriculum.test.ts` (matches `vitest.config.ts` include `src/**/*.test.ts`), covering middle/first/last/unknown-id cases against `AVAILABLE_LESSONS`. Component-level JSX is covered by real-browser verification (playwright), not vitest (see Risks).
- Untouched: `catalog.tsx`, `index.tsx`, `story.$id.tsx`, lesson HTML rendering (`LessonFrame`), quiz, PDF download, DB, routes structure.

Simplest effective path: one helper + one component edit + one test file; preserves existing architecture (static curriculum SSOT, file routes, design tokens).

## Code And Evodocs Findings

- `.evodocs/index.json` has no modules; constitution gives stack + runbook only. Code is the evidence base (authoritative anyway).
- `src/lib/curriculum.ts:172` already exports `AVAILABLE_LESSONS`: `CURRICULUM.flatMap(stages).flatMap(lessons.filter(l => l.id))` — precisely "有课文页的课, 按课程表顺序". Currently 6 entries (`math-s2-03`…`math-s2-08`); order spans subjects (math stages → physics stages), so when physics pages appear later, "下一课" from the last math page would cross into physics. Intent mandates "按课程表(CURRICULUM)顺序在有课文页的课之间切换", which this flat order implements literally.
- `src/routes/_app/lesson.$id.tsx`: content column is `.sr-d-scroll` (padding overridden to 0) containing only the iframe; a bottom nav row would sit after `LessonFrame` inside this scroll container so it appears at the end of the 课文 — matching the intent's bottom-placement suggestion. The top bar already holds 返回 / 卡片答题 / PDF; adding two more controls there would crowd it on mobile (`.sr-navtoggle` shows below 860px).
- The route loads any `$id`; unknown ids render "课程内容尚未生成。". `getLessonLabel` falls back to the id. A nav helper returning `{prev: undefined, next: undefined}` for ids not in `AVAILABLE_LESSONS` keeps such pages nav-free with no new failure mode.
- R-UI research (peer patterns, named):
  - **MDN Web Docs / docs sites (Docusaurus, GitBook, VitePress)**: a footer "Previous / Next" pager at the end of the article — two links, previous left / next right, each showing direction label + target page title; the missing side is simply not rendered. This is the dominant sequential-reading pattern.
  - **Khan Academy / 学习类 app lesson players**: "Next lesson" style forward emphasis at content end, prev de-emphasized; titles of the target lesson shown so the learner knows what's coming.
  - **Kindle/微信读书 chapter nav**: prev/next at chapter boundaries, disabled state at book ends (layout-stable).
  - Takeaway: bottom-of-content pager with target titles is best practice for "读完进入下一课"; both "hide missing side" (MDN) and "disabled state" (readers) are accepted boundary treatments.
- R-UI touched/affected surfaces (complete list):
  - `src/routes/_app/lesson.$id.tsx` — the only surface gaining controls.
  - Catalog sidebar and home lesson list — unchanged; they already link into lessons and stay consistent (nav uses the same order they display).
  - `src/routes/_app/story.$id.tsx` (名人传记 chapter pages) — has **no** prev/next nav today and gains none; stories are not in `CURRICULUM` so the intent's ordering rule cannot apply to them. Leaving them untouched creates a mild cross-feature inconsistency ("lessons have a pager, story chapters don't") — recorded for grill as a scope confirmation.
- R-EXT: no new or unfamiliar external interface. `@tanstack/react-router` `Link` + params usage is copied from `catalog.tsx` (established in-repo contract); no find-docs fetch needed, no external service, no schema/permission implications.
- R-TEST findings: `vitest.config.ts` deliberately isolates vitest from the TanStack Start vite plugin and includes only `src/**/*.test.ts` — pure TS modules. There is no jsdom/react-testing-library setup, so the route component cannot be unit-tested as JSX without adding test infrastructure (out of proportion for this ticket). Precedent: `src/lib/answer-normalize.test.ts`.

## Assumptions

- A1: `AVAILABLE_LESSONS` (flat CURRICULUM order across stages and subjects) is the navigation sequence — directly stated by the intent's "按课程表(CURRICULUM)顺序"; low risk.
- A2: Navigation uses client-side `Link` navigation (same as catalog), with the existing route loader fetching the new lesson's HTML; low risk, existing contract.
- A3: For an id not present in `AVAILABLE_LESSONS` (hand-typed URL / not-yet-registered lesson), both controls are absent. Low risk: such lessons "不参与导航" per Out of scope.
- A4: No CSS token or DESIGN.md rule changes are needed; the ghost button + inline flex layout pattern already used in `lesson.$id.tsx` covers the visual need. If a small `.sr-*` rule is added it stays within existing tokens.

## Risks

- UI: control placement, boundary treatment, and control content were product-visible choices; all settled by grill final decisions G1–G3 (bottom footer row / disabled at boundaries / direction + target title).
- Cross-feature consistency: story chapter pages keep having no pager — confirmed out of scope by grill G4 (separate feature, future ticket if wanted).
- Future content: when new lesson pages are added to other stages/subjects, prev/next silently spans stage/subject boundaries (e.g. last math page → first physics page). Follows from the intent's CURRICULUM-order rule; flagged so it is a conscious default, not a surprise.
- R-TEST (dev-time obstacles, concrete):
  - No jsdom/RTL test infra → the React component's rendering cannot be vitest-tested; mitigation: extract pure `getLessonNav` helper (unit-testable under existing `vitest run`) + mandatory playwright real-browser verification for the UI, per cap6 rules. No user-supplied account/credential needed (login exists but dev flow is local; browser verification will use the local dev server — if the app requires a session for `/_app` routes, the local `.env`-backed login flow is available; see `src/lib/session.server.ts` if an obstacle appears).
  - `npm run test` currently passes only `answer-normalize.test.ts`; adding `curriculum.test.ts` fits the include glob with zero config change.
- No DB/schema/prompt/state-machine/external-API/dependency/config/deployment risk: change is a static-data-derived UI addition.

## Grill Required

completed
