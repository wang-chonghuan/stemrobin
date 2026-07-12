# Capability 3 — Author one lesson's exercise deck

From the ledger + the lesson's 課文, author the deck JSON the card-quiz renders. Read `references/common/lesson-contract.md` (Exercise deck) first — item shape, modes, composition rules, review tail.

**Execution:** after gate-2 passes, the lesson author may author the deck, given the ledger JSON, the approved lesson HTML, and the contract. Multiple decks may run in parallel. The orchestrator runs `scripts/check-exercises.mjs`, then the fast gate-3, then persists via cap4. A separate semantic deck reviewer is not part of the default path.

## What makes a deck good (in priority order)

1. **Every item is a choice question.** Preserve the cognitive act in the prompt, then offer a compact set of answer candidates with exactly one correct choice.
2. **指认 items are fast and many.** "$-x$ 的系数是？" "$x-2y+1$ 的第二项是？" "在 $2(a-1)$ 里，$(a-1)$ 站在加法层还是乘法层？" Short prompt, short answer, varied surface forms so surface pattern-matching fails.
3. **Boundary cases as items.** Every ledger `boundary_cases` entry for this lesson appears in at least one item — these are the items that build real categories.
4. **复习 tail.** Per the review tail rule, ≥3 items with `layer:"复习"` + `review_of` targeting earlier-lesson terms (1-back ×2, 2-back ×1–2, 3-back ×1 as available). Review items are *new* items about *old* terms — not repeats.
5. **说理 items test reasons by comparison.** Keep questions such as "为什么去括号时每一项都要变号？" but offer explanations that distinguish the real rule from named misconceptions. The hidden `answer` still models the full reasoning after a response.
6. **Distractors are diagnoses.** Every `choice` distractor must be wrong for a nameable, common reason (漏变第二项符号 / 把因数当项 / 系数忘了带符号)。 If you cannot name why a child would pick it, replace it.
7. **Answers teach.** `answer` explains WHY, in one or two sentences — it is the feedback the learner reads after answering.

## Steps

1. Read the ledger entry (introduces/boundary_cases) + earlier entries (review targets) + the 課文.
2. Draft 16–24 items across the layers per the composition rules; set `type` tags (辨认/表示/操作/反推/辨错/说理) as the learner-facing label.
3. Give every item at least three non-empty, distinct options. Use five or more when the lesson genuinely has that many plausible misconception paths.
4. Solve every item before saving the JSON. Confirm each `correct_index` matches the solved answer and each `answer` teaches why.
5. Run `node .agents/skills/sr-math-lesson/scripts/check-exercises.mjs <deck.json> --ledger resources/content/math-ledger/stage-<n>.json --id <lesson-id>` — must pass.
6. Write to `<scratch>/<id>.questions.json`. Report: item count, layer/mode split, boundary coverage, review targets, and that answer keys were self-checked.
