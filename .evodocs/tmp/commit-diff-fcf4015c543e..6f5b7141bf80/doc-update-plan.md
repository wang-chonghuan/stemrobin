# Commit-diff update plan: fcf4015c..6f5b7141 (SR-3-lesson-nav merge)

## Impact selection
Changed product paths: src/lib/curriculum.ts (+getLessonNav), src/lib/curriculum.test.ts (new), src/routes/_app/lesson.$id.tsx (+LessonNavFooter), src/styles/app.css (+.sr-lesson-nav), plus ticket artifacts under .intentmill/ (excluded: workflow artifacts).

Module ownership: app/lib, app/routes (declared in index.json). Neither module has a final doc yet (cap3/cap4 never run on this repo — all modules doc_exists: false).

## Actions
All changed paths → **skip** for final-doc updates: there are no existing module docs to patch, and commit-diff updates do not create first-time docs (that is cap3/cap4's regeneration loop, out of scope for cap7). The change is additive UI/behavior within already-declared module boundaries; index unchanged.

## Completion review
- Index: unchanged, still valid (validate below).
- Final docs: none exist, none touched.
- Meta: advanced to target commit 6f5b7141.
