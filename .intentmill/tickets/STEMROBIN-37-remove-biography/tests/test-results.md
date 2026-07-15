# test-results — STEMROBIN-37 · remove-biography

## Unit + build

- `cd app && npm run test` → **68 passed (8 files)**. Clean.
- `cd app && npm run build` → **built OK**; `routeTree.gen.ts` regenerated with
  no `/story/$id` route (grep for `story` in `routeTree.gen.ts` → none).

## Browser (standalone Playwright, `app/node_modules/playwright`)

Server: `node .output/server/index.mjs` on :3111 (env sourced from root `.env`).
Auth: minted test-learner `sr_session` cookie for user 2 (per memory
`sr-test-account`; HMAC of default dev secret; no password typed), set via
`context.addCookies`.

Biography term set checked: `名人传记, Biographies, 创造者档案, Creator Profiles,
富兰克林, 爱迪生, Franklin, Edison, Carnegie, Ford`.

| Check | Result |
|---|---|
| Home (en) biography-term hits | `[]` (none) |
| Home (en) `a[href^="/story/"]` count | `0` |
| Home (en) catalog groups | `["Curriculum"]` |
| Home (zh) biography-term hits | `[]` (none) |
| Home (zh) `a[href^="/story/"]` count | `0` |
| Home (zh) catalog groups | `["课程大纲"]` (no 名人传记) |
| `/story/ford-c01` HTTP status | **404** |
| `/story/ford-c01` renders `article.sr-reading` | `0` |
| `/story/ford-c01` body | `"页面不存在"` (not-found) |
| `/lesson/math-s2-01` (logged in) | **200** (math intact) |
| `/` (logged in) | **200** |

Screenshots: `home-sidebar-en.png`, `home-sidebar-zh.png`, `story-url-notfound.png`.

## Preserved artifacts (untouched)

- Skill: `.agents/skills/sr-story/` present (SKILL.md + references + scripts);
  `git status .agents/` clean.
- DB (schema `stemrobin-schema`, read-only): `sr_stories`=1, `sr_story_chapters`=6,
  `sr_story_questions`=77, `sr_story_answer_events`=0. All rows intact; no DB write.
