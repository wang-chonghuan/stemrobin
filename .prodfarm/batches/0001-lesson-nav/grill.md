# Batch 0001-lesson-nav — Grill Record (cap7, archived by cap3)

Draft: 1 story — 课文页上一课/下一课导航。Ruling context: experiment batch defined and ruled under the user's standing experiment mandate (goal directive 2026-07-07); rulings recorded as the human proxy.

## Interrogation results (cap11)
- Feasibility (probed live): no existing prev/next in src/routes/_app/lesson.$id.tsx (grep empty); CURRICULUM in src/lib/curriculum.ts is an ordered structure (subjects→stages→lessons, page exists iff lesson has id). No external deps, no paid API, no data acquisition. PASS.
- Consistency: aligns with product-goal (sequential learning); no deferred items, no unconsumed notes, no duplicate in features/ (lesson-page has no navigation). PASS.
- Completeness: 3 acceptance criteria pass the dual test (black-box via browser; false until delivered). One correction adopted during grill: criteria scoped to "lessons that have pages" (outline-only lessons have no id/page). PASS after correction.
- Constraint challenge: no constraints declared (None) — full machine freedom on placement/implementation. PASS.
- Batch risk: single small story, no single-point dependency. PASS.

## Rulings
- Finalized with the criteria correction above. No forced passes. No items deferred.
