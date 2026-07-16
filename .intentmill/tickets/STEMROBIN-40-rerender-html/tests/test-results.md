# Test Results — STEMROBIN-40 rerender-html

## Development Test Log

Focused checks run as implementation slices completed (chronological):

1. DB inspection (`db.mjs` path): 16 math lessons, all with `content`/`exercises` JSONB + `zh` overlay + stage ledger. Confirmed the render inputs exist.
2. Staleness probe (math-s3-07): stored html §1 = "为什么需要它" vs `content.cards[0].name` = "为什么学这个" → confirmed stale cache (root cause).
3. Fresh render (pre-mutation, in-memory) of math-s3-07: §1 = "为什么学这个", 练习 = §6, 0 answer-key DATA tokens. Confirmed the renderer fixes the staleness.
4. `rerender-lessons.mjs --check` (dry-run, no writes): all 16 lessons reported "WOULD CHANGE". Confirmed all 16 stale.
5. Mutating re-render (html + best-effort pdf), all 16: report = 16 html updated + 16 pdf rendered (988KB–2128KB each); 16 html snapshots written to `refs/html-snapshot/`.
6. Idempotence: re-run `rerender-lessons.mjs --check` → "0 html changed (nothing written)".
7. Empirical acceptance over 16 stored rows (psql/grep): each has ≥1 numbered section label, a `data-sr-section="practice"` 练习 section, section names equal to the `content` JSONB names, and 0 answer-key DATA tokens. ALL 16 PASS. Spot-check math-s3-07 labels: 1 为什么学这个 / 2 讲解 / 3 例题 / 4 与其他知识点的联系 / 5 概念口试 / 6 练习.
8. Sample-generation proof: `render-lesson.mjs` CLI on a fresh disposable sample (deck carried `key.correct_index`) → labels "1 为什么学这个 / 2 讲解 / 3 练习", practice section present, 0 answer-key DATA tokens leaked. Non-destructive (no shared-DB write).
9. JSONB/`sr_users` untouched: all 16 lessons' cards still named; card + exercise counts intact.
10. Ticket-scoped unit test: `node --test .intentmill/tickets/STEMROBIN-40-rerender-html/tests/render-invariants.test.mjs` → 5 pass / 0 fail.

## Coverage Map

| Plan Unit-Test obligation | Covered by | Result |
| --- | --- | --- |
| Each card renders sr-sec-num + sr-sec-name (R1) | `render-invariants.test.mjs` "每个 card 渲染序号 + 中文名" | pass |
| Styled numbered practice (练习) after teaching sections (R1) | `render-invariants.test.mjs` "练习区渲染为带样式的编号 section" | pass |
| No answer KEY even when deck carries key (R3, secrecy) | `render-invariants.test.mjs` "答案 KEY 结构性缺席…即使 deck 携带 key" | pass |
| Practice options = prompt + overlay option text only | `render-invariants.test.mjs` "渲染练习选项时只出 prompt+选项" | pass |
| Missing 中文名 fails fast (un-stale guard) | `render-invariants.test.mjs` "缺少 section 中文名的 card 会 fail-fast" | pass |
| All 16 stored html: numbered names + practice + 0 KEY (R1–R3) | Empirical DB verify (log #7) | pass, 16/16 |
| math-s3-07 spot-check §1 = 为什么学这个 (R2) | Empirical DB verify (log #7) | pass |
| Sample lesson renders same way, no KEY (R4) | render-lesson.mjs CLI sample (log #8) | pass |
| Deterministic + idempotent (R5) | `--check` re-run (log #6) | pass, 0 changed |
| Snapshot before mutate (R6) | 16 files in refs/html-snapshot; math-s3-07 snapshot holds stale "为什么需要它" | pass |
| pdf refreshed best-effort (R7) | Mutating run (log #5): 16 pdf rendered | pass |
| content/exercises JSONB + sr_users untouched | JSONB integrity check (log #9) | pass |

Note: the 16-lesson DB mutation is verified empirically (it writes shared production rows) rather than unit-tested. The app vitest suite was not run — no `app/**` code is touched.

## Test Commands

- `node .agents/skills/sr-math-lesson/scripts/rerender-lessons.mjs --check`
- `node .agents/skills/sr-math-lesson/scripts/rerender-lessons.mjs`
- `node --test .intentmill/tickets/STEMROBIN-40-rerender-html/tests/render-invariants.test.mjs`
