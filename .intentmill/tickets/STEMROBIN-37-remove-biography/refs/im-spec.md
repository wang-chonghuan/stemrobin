# im-spec — STEMROBIN-37 · remove-biography

Final spec from `im-draft.md` + self-adjudicated `im-grill.md`.

## Goal

Completely remove the 名人传记 (biography) feature from the **app code**: the
sidebar/catalog biography section, the homepage biography block, and the story
route/components/lib. **Keep** the `sr-story` generation skill and the biography
DB tables/data. Math features (lessons, card reading, practice, progress, login)
keep working; the app builds clean.

## Behavior spec

1. **Sidebar/catalog.** No 名人传记 section or entries render. The catalog shows
   only the curriculum outline group (课程大纲 / Curriculum).
2. **Homepage.** No biography block. The overview keeps its progress panel, the
   single 科学与工程 (Science & Engineering) pillar, and the live-lesson grid; the
   "创造者档案 / Creator Profiles" pillar is gone.
3. **Story routes.** No story route is reachable. A former story URL
   (`/story/<chapterId>`) does not render a biography — it hits the app's
   not-found view.
4. **Preserved.** `.agents/skills/sr-story/` and the `sr_stories`,
   `sr_story_chapters`, `sr_story_questions`, `sr_story_answer_events` tables (and
   their rows) are untouched.
5. **Math unchanged.** Lesson pages, card reading, quiz-drawer, progress, locale
   switch, and login behave exactly as before.

## Acceptance criteria (black-box)

- AC1: The sidebar/catalog shows no biography section or entries.
- AC2: The homepage has no biography block.
- AC3: No story route is reachable (a former story URL does not render a story).
- AC4: The `sr-story` skill and the biography DB tables/data still exist.
- AC5: The app builds; `npm run test` passes; math features work.

## Constraints / invariants

- Only `app/` code changes; **no** DB/schema/data change, **no** skill change.
- No new dependency, no new env var, no Dockerfile/deploy change.
- Never touch `sr_users`. Answer-key secrecy and all other module contracts intact.
- Remove orphaned imports/dead code the deletion creates (SSOT / surgical).

## Verification

- `cd app && npm run test` (vitest) clean; `cd app && npm run build` clean
  (build regenerates `routeTree.gen.ts` without the story route).
- Empirical browser (standalone Playwright, `app/node_modules/playwright`; minted
  test-learner `sr_session` cookie for user 2 per memory `sr-test-account`, no
  password typed): home + sidebar (zh and en) show no biography terms/links; a
  former story URL returns not-found. Screenshots.
- Confirm (psql read-only + ls) `sr_story*` tables/rows and
  `.agents/skills/sr-story/` still present.
