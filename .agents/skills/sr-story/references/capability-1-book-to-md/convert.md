# Capability 1 — Book → markdown (markitdown)

Convert a **public-domain** source book (PDF / EPUB / HTML) into clean markdown for later capabilities. Deterministic tool work — Microsoft `markitdown`.

## Steps

1. **Confirm the source is public domain** (Gutenberg, or pre-1929 Internet Archive). Record the source URL — it becomes `sr_stories.source_url`. If unsure, stop and ask; do not convert copyrighted books.
2. **Get the file.** Prefer Gutenberg's plain-text/EPUB/HTML or Archive's PDF/EPUB. Download to a scratch path (not committed).
3. **Convert** from the repo root:
   ```bash
   node .agents/skills/sr-story/scripts/book-to-md.mjs <input-file-or-url> <output.md>
   ```
   The helper shells out to `markitdown` (install once: `pip install markitdown` or `pipx install markitdown`). It writes UTF-8 markdown. For a Gutenberg plain-text `.txt`, markitdown still normalizes it; for a `.txt` it may be simplest to keep as-is.
4. **Sanity-check** the output: it parses as text, has the book's chapters/headings, and isn't truncated. Note the rough length (books are long — later caps read it in slices, not whole).

## Boundaries

- markitdown output is the raw book text — do NOT hand-edit its content. Adaptation happens in cap2/cap3, not here.
- Keep the `.md` in a scratch/authoring location; it is source material, not a committed artifact (the persisted product is the chapter HTML + questions in the DB).
- If markitdown is unavailable and cannot be installed, stop and report; do not fake the conversion.
