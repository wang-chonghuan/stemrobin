# im-spec — STEMROBIN-41 · 全文速览改用 skill 渲染 html 对齐 PDF

## Requirement
The 全文速览 tab of a math lesson must render the stored skill-produced course HTML
(`sr_lessons.html`, the same render as the PDF), instead of the home-grown
`buildFullTextHtml` renderer. There must be exactly one full-text HTML source.

## Behavioral requirements
1. Switching to 全文速览 shows the whole lesson exactly like the PDF:
   - each section prefixed with its number (`.sr-sec-num` + `.sr-sec-label`,
     e.g. "1 为什么学这个"), with restored 中文名;
   - a nicely-styled 课后题/练习 section (numbered, per-item category tags, options).
   - It is NOT the old bare `.sr-fulltext-*` list.
2. The 课后题 shown in 速览 are display-only: not answerable, no scoring, no progress,
   no server call (no interactive `<button>/<input>/<form>`, no answer KEY in markup).
3. Formulas render (the stored html's own KaTeX) in 速览.
4. Mobile 375px: no horizontal overflow (outer page and iframe body).
5. 逐卡精读 (card reading) flow is unchanged: section titles, read-checks, formulas,
   read-check recording/progress all still work.
6. Login gate unchanged. No new dependency. Only `app/` changes.

## Non-scope / rejected
- Do NOT keep a second full-text renderer.
- Do NOT reintroduce answer keys into 速览.
- Do NOT change the card-reading flow, the practice QuizDrawer, PDF download, or
  catalog/nav behavior.
- Do NOT re-render or touch DB content (that was STEMROBIN-40).

## Critical existing contracts to preserve
- `LessonFrame` sandboxed iframe + height lifecycle (load + delayed + ResizeObserver).
- `getLessonReading` KEY-free card projection and `recordReadCheck` server judging.
- Answer-key secrecy (charter engineering-rules): no `correct_index`/`accept`/`answer`
  in any client payload or 速览 markup.
- The practice QuizDrawer's own independent `getLessonQuestions` fetch stays intact.
