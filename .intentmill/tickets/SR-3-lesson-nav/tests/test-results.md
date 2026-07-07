# Unit Test Results

## Commands Run

- `npm run test` (worktree) — vitest run. Result: **pass — 14/14** (2 files: existing `answer-normalize.test.ts` 7 + new `curriculum.test.ts` 7).
- `npx tsc --noEmit` — typecheck. Result: **pass** (0 errors).
- `npm run build` — production build. Result: **pass**.
- `node .intentmill/tickets/SR-3-lesson-nav/tests/browser-nav-check.mjs http://127.0.0.1:3100` — ticket-scoped Playwright browser verification (headed Chromium via `playwright-core`, repo dependency; no `npx playwright install` needed — cached Chromium present). Result: **PASS — 40/40 checks** (20 desktop + 20 mobile).
- Dev server for browser run: `npm run dev -- --port 3100 --host 127.0.0.1` (port 3000 potentially occupied by sibling projects; actual port **3100**, recorded per playwright-browser-verification.md).

## Results

- `src/lib/curriculum.test.ts` — 7 passed (getLessonNav middle/first/last/unknown + purity; AVAILABLE_LESSONS order contract + shape).
- `src/lib/answer-normalize.test.ts` — 7 passed (pre-existing, regression floor).
- Browser: 40/40 assertions passed across desktop (1280×800) and mobile (390×844).
- Total: **0 failures.**

## Development Test Log

Slices completed, with the focused check run as each landed:

1. **Baseline** — fresh worktree `npm install`, then `npm run test` → 7/7 (answer-normalize) green before any change.
2. **Slice 1: `getLessonNav` helper (src/lib/curriculum.ts)** — wrote helper + `src/lib/curriculum.test.ts` together; ran `npm run test` → 14/14 immediately after the slice (order contract, boundaries, unknown ids, purity).
3. **Slice 2: lesson-page footer nav (lesson.$id.tsx + app.css)** — added `LessonNavFooter` + `.sr-lesson-nav` styles; ran `npx tsc --noEmit` → clean, `npm run build` → pass immediately after the slice.
4. **Slice 3: browser verification** — started dev server on 3100, ran the ticket Playwright script (headed) → 40/40 PASS first run; screenshots reviewed by eye for DESIGN.md conformance (ghost buttons, chevron icons, disabled dim state, prev-left/next-right, mobile wrap).

## Coverage Map

Every `im-plan.md ## Unit Test Plan` item:

- **中间条目 prev/next (R1/R2/R3)** → `curriculum.test.ts` "middle entry"; corroborated in browser (2.5 shows 2.4/2.6 targets, clicks navigate).
- **首条目 (R4)** → `curriculum.test.ts` "first entry"; browser: math-s2-03 renders 上一课 disabled, 下一课 link.
- **末条目 (R4)** → `curriculum.test.ts` "last entry"; browser: math-s2-08 renders 下一课 disabled, 上一课 link.
- **未知 id (R5)** → `curriculum.test.ts` "unknown ids" (`math-s2-99`, `''`); browser: math-s2-99 has no nav row and keeps the 课程内容尚未生成 placeholder.
- **顺序契约回归 (R1 / 第二顺序源守卫)** → `curriculum.test.ts` "AVAILABLE_LESSONS order contract" (exact flattening equality + non-empty id/title/subject).
- **消费者回归(纯函数无副作用)** → `curriculum.test.ts` "does not mutate AVAILABLE_LESSONS" (reference/length/id-sequence unchanged); home-page consumer verified live in browser (新上线课程 count renders).
- **组件渲染/点击跳转(vitest 不可测,配置契约禁改)** → covered by the ticket Playwright script (R2/R3/R4/R5/R6/R7/R8 UI side): visibility, target titles, bottom placement (nav box below iframe box), loader-driven URL changes, disabled semantics, top-bar regression, both viewports, screenshots.

Backend not touched (no DB/API/schema change) — no backend-focused tests applicable beyond the existing regression floor.

## Failures

None. (Playwright passed on the first run; no failure/fix cycles to record.)

## Notes

- Browser evidence per `playwright-browser-verification.md`: dev server `npm run dev -- --port 3100 --host 127.0.0.1` (port 3100); headed Chromium launch (`headless: false`); script `.intentmill/tickets/SR-3-lesson-nav/tests/browser-nav-check.mjs`; viewports desktop 1280×800 + mobile 390×844; screenshots under `.intentmill/tickets/SR-3-lesson-nav/tests/screenshots/` (`middle|first|last|unknown` × `desktop|mobile`, 8 files); result PASS.
- Unit tests live at `src/lib/curriculum.test.ts` (source-adjacent, per im-plan — required to hit the repo vitest glob `src/**/*.test.ts` with zero config change); ticket-scoped browser script + screenshots + this file live under the ticket `tests/` path.
- Gate5 minor note adopted: control text uses the "·" separator from grill G3's example ("上一课 · 2.4 项的身份证:系数与次数").
