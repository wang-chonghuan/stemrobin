# Soviet ten-year school textbooks — source of truth

The authoritative transcription of the printed series. Everything downstream —
the app's catalog, content generation, lesson provenance — reads from here and
never writes back.

## Layout

```
toc/<bookId>/zh.json     the printed table of contents, extracted from the scan
toc/<bookId>/en.json     a translation of zh.json
```

`<bookId>` is the PDF's own id (`6a`, `9c`, `6-8g`, `10p`, …) — the text before
the first space in its filename under `resources/soviet10years/pdf/`.

## The two files are not peers

`zh.json` carries `"authority": "extracted"`. It is what the book prints, read
off the scanned contents pages; it is the file a dispute is settled against.

`en.json` carries `"authority": "translated"`. Its structure, ids, `number`s and
`source` refs must match `zh.json` field for field — **only titles differ**. A
new language is a new file beside these two, never a change to the structure.

## Two numbering systems, deliberately

- `number` (`2.3`) is what the interface shows: a hierarchical number fixed by
  the position encoded in the id. The series is a set of finished editions, so a
  position never moves.
- `source` points back to whatever uniquely identifies the entry in the printed
  contents — `printedSection` where the book numbers it (continuous across the
  whole volume, so §6 is 2.3 in book `6a`), otherwise `printedName`, the printed
  heading, kept in Chinese in both files because it is a pointer into the book.

`page` is the printed page number, for locating the scan. Neither `source` nor
`page` is displayed.

## What is not here

Exercise answers, and nothing else. The books print them as back matter,
separated from the exercises themselves; they enter as an input when a lesson's
practice is built, bound to the exercise they answer — never as a browsable
entry, which would hand over a master key to every read-check in the deck.

Everything else the contents print is here, including the back matter that is
not answers: appendices, symbol lists, term indexes, formula tables. They are
part of the book.
