# IntentMill Handoff

## Actual Changes

- `src/lib/curriculum.ts` — added exported pure function `getLessonNav(id)`: looks up `id` in `AVAILABLE_LESSONS` and returns `{ prev, next }` adjacent entries (`{}` for unknown ids). No existing export changed.
- `src/lib/curriculum.test.ts` — new vitest file (7 tests): getLessonNav middle/first/last/unknown/purity + AVAILABLE_LESSONS order-contract regression.
- `src/routes/_app/lesson.$id.tsx` — added `LessonNavFooter` component rendered inside `.sr-d-scroll` after the lesson content (iframe or placeholder): 上一课 left / 下一课 right; active side is a router `Link` showing "上一课/下一课 · {getLessonLabel(target)}" with lucide Chevron icons; boundary side is a disabled ghost button showing the direction label only; unknown ids render nothing. Imports extended (ChevronLeft/ChevronRight, getLessonNav).
- `src/styles/app.css` — added `.sr-lesson-nav` block (flex row, space-between, wrap, top hairline `--sr-line-soft`, self-padding since the lesson page zeroes `.sr-d-scroll` padding; `.sr-btn` inline-flex + disabled opacity 0.55 matching the `.sr-icontool:disabled` precedent). Existing tokens only.
- `.intentmill/tickets/SR-3-lesson-nav/tests/` — `browser-nav-check.mjs` (headed Playwright script), `screenshots/` (8 images), `test-results.md`.

## Spec And Plan Alignment

No deviations. Implementation follows im-plan.md phases 1–3 as written and satisfies im-spec.md R1–R9:

- Spec obligations: R1 sequence from `AVAILABLE_LESSONS` (single SSOT); R2/R3 visible prev/next links navigating to adjacent page-bearing lessons (browser-verified clicks); R4 disabled boundary controls (layout-stable); R5 unknown ids nav-free; R6 bottom footer row, prev left/next right; R7 direction + `getLessonLabel` title on active sides, direction-only on disabled sides; R8 Chinese copy, `.sr-btn ghost`, lucide chevrons, existing tokens, global focus-visible; R9 `Link to="/lesson/$id" params` (loader-driven).
- Plan obligations: helper + tests first (green), then component + CSS (tsc/build green), then headed Playwright verification (40/40) — all verification points met.
- Critical existing contracts preserved: `AVAILABLE_LESSONS`/`getLessonLabel`/`CURRICULUM` exports untouched in shape and behavior (order-contract test + home page verified live); loader contract respected (no HTML fetch bypass); `LessonFrame`, `QuizDrawer`, top-bar controls, `vitest.config.ts` untouched.
- Non-scope/rejected options absent: no catalog/home/story/login changes (git diff touches only the four product files above), no keyboard shortcuts, no progress tracking, no top-bar nav, no hidden-boundary treatment, no new dependency/color/token/config.
- Test obligations: every im-plan Unit Test Plan item mapped in `tests/test-results.md ## Coverage Map`.
- Grill G1–G4 (cap13 proxy decisions) all obeyed; gate5 minor note adopted (G3's "·" separator format).

Playwright verified UI contracts: control visibility and target labels, bottom placement (nav box below iframe box), click navigation both directions, disabled first/last states, unknown-id absence, top-bar and home-page regression, desktop + mobile viewports. No unresolved visual fidelity gaps observed.

## User Review Points

None.

## Residual Issues And Future Improvements

- 跨学科连续导航:当其他学科/阶段的课文页上线后,"下一课"会按 CURRICULUM 展平顺序从数学末课直接跨到下一个有页面的课(可能是另一学科)。这是 intent 规定的顺序语义;若届时产品想按学科分段导航,需另立工单(grill Future/Conditional 已记录)。
- 传记章节页(/story/$id)没有上一章/下一章导航,与课文页形成轻度不一致(grill G4 确认留在工单外);如需要应另立工单。
- 有页面但 DB 中 html 为空的课会在占位文案下方照常显示导航(spec R6 语义);当前 6 课均有内容,浏览器验证未能覆盖该活体场景(gate5 minor #2,已知不可测)。
- `src/lib/curriculum.test.ts` 的顺序契约测试与 `AVAILABLE_LESSONS` 的实现表达式同构(flattening 等式),防结构漂移有效、防"实现与测试同时错"无效——纯函数场景风险很低,记录备查。
- DESIGN.md 未随本工单更新:导航行完全复用既有 ghost 按钮/图标/token 约定,未引入新设计规则(spec Scope 也未含 DESIGN.md);若希望把"课文底部 pager"沉淀为 Components 一节的正式约定,可在后续文档工单补一条。
