# im-plan — STEMROBIN-37 · remove-biography

Ordered steps; each ends with a verify check. `app/` only.

## Step 1 — Delete the story route + lib (dead surfaces)

- `git rm app/src/routes/_app/story.$id.tsx`
- `git rm app/src/lib/stories.ts`
- Verify: no other file imports from `~/lib/stories` except the removed callers
  (grep).

## Step 2 — Drop the story catalog from the shell

- `_app.tsx`: remove `getStoryCatalog` import, `stories` from the loader, and the
  `stories` prop passed to `<CatalogSidebar>`; drop `/story/$id` from the gate
  comment.
- Verify: `_app.tsx` compiles; loader returns `{ lessonIds, locale }`.

## Step 3 — Remove the sidebar biography section

- `catalog.tsx`: remove the `StoryCatalogEntry` import, the `stories` prop, the
  `名人传记` section JSX, and the orphaned `StoryOutline` / `StoryChapterLink`
  components. Keep `Link` (still used by lessons).
- Verify: catalog renders only the curriculum outline.

## Step 4 — Remove the homepage biography pillar

- `_app/index.tsx`: remove the `创造者档案 / Creator Profiles` pillar; keep the
  Science & Engineering pillar. Remove the orphaned `Rocket` import.
- Verify: overview renders progress + one pillar + lesson grid.

## Step 5 — Remove dead i18n keys

- `i18n.ts`: remove `cat.group.stories` and `ov.pillar2.*` (zh + en). `t()` takes
  untyped string keys, so no type fallout.
- Verify: `npm run test` (i18n.test.ts) passes.

## Step 6 — Clean up orphaned CSS + comments

- `app.css`: remove the `.sr-reading` block (only the deleted story route used it).
- `quiz-drawer.tsx` / `quiz.ts`: trim now-inaccurate story-specific comments;
  keep the generic drawer logic (optional-attempts path still serves logged-out
  lesson learners).
- Verify: `npm run build` clean.

## Step 7 — Empirical verify

- `npm run test` + `npm run build` clean; build regenerates `routeTree.gen.ts`
  without the story route.
- Browser (standalone Playwright): home/sidebar have no biography; former story
  URL not-found; a math lesson still renders. Screenshots.
- psql (read-only) + ls: `sr_story*` tables/rows + `sr-story` skill present.
