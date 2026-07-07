# Capability 2 — Author one lesson's 課文 HTML

From the ledger entry, author ONE lesson as self-contained HTML. Read `references/common/lesson-contract.md` (Lesson genres) first — it defines the section anchors per genre and the vocabulary contract.

**Execution:** an independent subagent authors, given: the ledger JSON (its own entry + all earlier entries, so it knows exactly which terms are speakable), the contract, and `assets/lesson-template.html`. The orchestrator runs gate-2, then persists via cap4.

## Steps

1. Read your ledger entry: `genre`, `core_idea`, `introduces`, `consumes`, `boundary_cases`. These are commitments, not suggestions.
2. Compose the sections for your genre (概念课: motivation/model/anatomy/boundary/connections/oral; 方法课: motivation/explain/examples/connections/oral) inside the template's `<article class="sr-lesson">`, using the template's classes (`.sr-example/.sr-step/.sr-eg/.sr-pitfall/.sr-note/ol.sr-oral/.sr-answer/figure.sr-fig`). Fill `{{TITLE}} {{EYEBROW}} {{CONCEPT}} {{CHIPS}}`; leave no `{{}}`.
3. **Speak only taught language.** Terms you may use freely: your `consumes` + earlier `introduces` + `assumed`. Terms you must TEACH (define via the model, `<span class="sr-term">`, 正例/反例): your `introduces`. Any other technical term is forbidden — if you need one, stop and report a ledger problem instead of using it.
4. **Teach every `boundary_cases` entry** where it belongs (boundary section for 概念课, pitfalls for 方法课).
5. 概念课 `model` section: include one hand-drawn inline SVG showing the structure (e.g. the expression tree with layers labeled). 方法课 `explain`: derive the move from the principle — the learner must be able to answer "为什么可以这么做".
6. Self-check against the first cause: after this text, can the learner name parts fast, do the move, and say why? Is any paragraph a lecture with no instance? Is anything defined once and never shown?

Write to a scratch path (`<scratch>/<id>.html`). Do not author exercises here (cap3). Report: sections present, terms introduced/consumed used, boundary cases covered.
