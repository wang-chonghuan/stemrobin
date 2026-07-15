# im-grill — STEMROBIN-37 · remove-biography

Grill decisions self-adjudicated from the charter (cap13, full delegation, no
human). Charter refs: engineering-rules §2 Simplicity, §3 Surgical Changes,
§5 SSOT; acceptance criteria in `intent.md`.

## G-A · Homepage "创造者档案 / Creator Profiles" pillar — in scope?

**Decision: REMOVE.** The homepage's second pillar (`ov.pillar2.*`: 创造者档案 /
Creator Profiles, "即将上线 / Coming soon", "富兰克林、爱迪生、卡内基、福特…读
发明家如何把创造变成事业") is exactly the 名人传记 feature advertised. Acceptance
requires "the homepage has NO biography block", so this pillar is removed and the
first pillar (科学与工程 / Science & Engineering) is kept. The `sr-pillars` grid
now holds a single pillar.

## G-B · Quiz-drawer — refactor or keep generic?

**Decision: KEEP GENERIC (surgical).** `quiz-drawer.tsx` takes injected
`fetchQuestions` / `record` and an **optional** `attempts` API; its `!attempts`
branch also serves logged-out lesson learners (`if (!attempts || !isIn)`), so it
is not dead after removing stories. Ripping out the optional path would be a
speculative refactor beyond the request (violates §2/§3). Only the now-inaccurate
story-specific **comments** are trimmed; all drawer logic is untouched.

## G-C · Orphaned `.sr-reading` CSS — remove?

**Decision: REMOVE.** `.sr-reading` was used only by the deleted story route
(grep confirms no other `.sr-reading` consumer; the STEMROBIN-28 lesson full-text
reading uses different classes). Under §3 ("clean up only your own mess" — remove
what the change orphaned), the block is deleted.

## G-D · sr-story skill + biography DB tables/data — keep?

**Decision: KEEP, untouched.** Explicit constraint + redline §2 (no destructive
DB ops). This is app-code-only removal: `.agents/skills/sr-story/` and
`sr_stories` / `sr_story_*` tables and rows are never touched. Verified present
after the change.

## No open leaks

Every draft question is adjudicated above; no UI/interface/dev-test decision was
left for a human.
