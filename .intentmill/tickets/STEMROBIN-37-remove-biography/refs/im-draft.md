# im-draft — STEMROBIN-37 · remove-biography

Developer draft from `intent.md` (seed STEMROBIN-32, grill decision G-5: fully
remove the 名人传记 feature from **app code**; keep the `sr-story` skill and the
biography DB data).

## Understanding

The app ships a biography (名人传记) reading feature layered on top of the math
courseware, reusing the same catalog + quiz-drawer machinery:

- **Route**: `app/src/routes/_app/story.$id.tsx` — one chapter reader (prose +
  card quiz + PDF).
- **Lib**: `app/src/lib/stories.ts` — `getStoryCatalog`, `getChapterView`,
  `getStoryPdf`, `getStoryQuestions`, `recordStoryAnswer` (all server fns over
  `sr_stories` / `sr_story_chapters` / `sr_story_questions` / `sr_story_answer_events`).
- **Sidebar**: `catalog.tsx` renders a "名人传记" section (`StoryOutline` /
  `StoryChapterLink`) fed by the `_app.tsx` loader's `getStoryCatalog()`.
- **Homepage**: `_app/index.tsx` pillar #2 "创造者档案 / Creator Profiles"
  ("即将上线 / Coming soon" — Franklin, Edison, Carnegie, Ford) advertises the
  biography feature.
- **i18n**: `cat.group.stories` and `ov.pillar2.*` keys.
- **Shared**: `quiz-drawer.tsx` is content-agnostic (injected fetch/record); it
  was documented as serving both lessons and stories.

## Plan sketch

Delete the story route + lib; drop the sidebar story section and its two
components; remove the homepage biography pillar; remove the now-dead i18n keys,
`Rocket` import, and orphaned `.sr-reading` CSS. Keep the quiz-drawer generic.

## Open questions (→ im-grill)

- G-A: Is the homepage "创造者档案" pillar in scope? (It is biography content.)
- G-B: Refactor the quiz-drawer to drop its optional-attempts path now that only
  lessons use it, or leave it generic?
- G-C: Remove the orphaned `.sr-reading` CSS block?
- G-D: Confirm the sr-story skill + biography DB tables/data are strictly out of
  scope (keep).
