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

## The files are not peers

Exactly one locale per volume carries `"authority": "extracted"`. It is what the
book prints, read off the contents pages; it is the file a dispute is settled
against. Every other locale carries `"authority": "translated"`, and its
structure, ids, `number`s and `source` refs must match the extracted file field
for field — **only titles differ**. A new language is a new file beside the
others, never a change to the structure.

Which locale that is depends on the edition transcribed, and every file in the
volume names it in `extractedLocale`:

- The Soviet ten-year series was read off its **printed Chinese editions**
  (人民教育出版社), so `zh` is the authority. The field may be omitted there; it
  defaults to `zh`.
- The probability pair (`7-9pr`, `10-11pr`) has no Chinese edition, so `ru` is
  the authority and both `zh.json` and `en.json` are translations. Marking `zh`
  as extracted there would dress a translation up as the printed page.

## Grades are the shelf's, not the edition's

`grade` is where a volume sits in **this** ladder, and the ladder is the Soviet
ten-year school: a 1—3 primary school, algebra starting in grade 6. Modern Russia
runs a 1—4 primary, so its whole secondary sequence is a year later than the same
content here — Алгебра 7—9 класс covers what 代数 6/7/8年级 covers, and Алгебра и
начала анализа 10—11 covers 代数和分析初步 9/10年级. The correspondence is exact,
three volumes to three grades and two to two.

So a book printed for the 11-year system is shelved one grade earlier, and its
`grade` and its translated titles say the shelf's grade. The extracted file keeps
the printed title untouched — `7-9pr/ru.json` still reads «7—9 классы» — and every
locale carries a `gradeAlignment` note stating the printed band, the shelf band,
and why they differ. Nothing is renamed in the transcription; only the placement
is the shelf's to decide.

## More than one printed series

The shelf is not only the Soviet set. Probability and statistics is the one
branch that series never carried, and it is filled by Ю. Н. Тюрин et al.,
*Теория вероятностей и статистика* (7—9 and 10—11), transcribed under the same
rules. The directory keeps its name for the sake of stable paths; the volumes
say which book they came from in `source.series`, and `reconcile.py` checks each
series against its own printed-contents file.

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

Two things, for two different reasons.

**Exercise answers.** The books print them as back matter, separated from the
exercises themselves; they enter as an input when a lesson's practice is built,
bound to the exercise they answer — never as a browsable entry, which would hand
over a master key to every read-check in the deck.

**The authors' foreword** (`От авторов`, and any preface a future volume prints).
It addresses the teacher about the edition, not the learner about the subject, so
it is the one printed heading that would become a card with nothing to learn on
it. Excluded at the outline, not lost: it stays in the printed-contents file, and
`reconcile.py` skips it by name the way it skips answers.

Everything else the contents print is here, including the back matter that is
neither of those: appendices, symbol lists, term indexes, formula tables,
glossaries, assessment sets. They are part of the book.
