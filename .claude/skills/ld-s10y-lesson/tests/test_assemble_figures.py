from __future__ import annotations

import sys
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1] / "tools"
sys.path.insert(0, str(TOOLS))

import assemble


def block(kind: str, ref: str, *, label: str | None = None,
          text: str = "", figure_id: str | None = None) -> dict:
    return {
        "kind": kind,
        "ref": ref,
        "page": int(ref[1:5]),
        "printed_page": int(ref[1:5]),
        "label": label,
        "id": figure_id,
        "lines": [text] if text else [],
    }


def exercise(number: str, ref: str, text: str) -> dict:
    return {
        "number": number,
        "group": None,
        "text": text,
        "lines": [text],
        "pages": [ref],
        "figure_refs": [],
        "figures": [],
    }


class ClaimFiguresTest(unittest.TestCase):
    def test_exercise_only_shared_figure_leaves_prose_and_renders_once(self) -> None:
        ex105 = exercise("105", "p0032#9", "见图 29")
        ex106 = exercise("106", "p0033#1", "仍见图 29")
        figure = block("fig", "p0033#2", label="图 29", figure_id="fig-29")
        caption = block("cap", "p0033#3", label="图 29", text="图 29")
        lesson = {
            "title": "向右或向左",
            "blocks": [figure, caption],
            "prose": [figure, caption],
            "exercises": [ex105, ex106],
        }

        warnings = assemble.claim_figures([lesson], [figure, caption])

        self.assertEqual(warnings, [])
        self.assertEqual(lesson["prose"], [])
        self.assertEqual(ex105["figure_refs"], ["fig-29"])
        self.assertEqual(ex106["figure_refs"], ["fig-29"])
        self.assertEqual(ex105["figures"], [])
        self.assertEqual(ex106["figures"], [{"id": "fig-29", "label": "图 29"}])

    def test_figure_before_questions_is_owned_by_nearest_following_question(self) -> None:
        figure = block("fig", "p0033#4", label="图 30", figure_id="fig-30")
        caption = block("cap", "p0033#5", label="图 30", text="图 30")
        ex107 = exercise("107", "p0033#6", "见图 30")
        ex108 = exercise("108", "p0033#7", "仍见图 30")
        lesson = {
            "title": "向右或向左",
            "blocks": [figure, caption],
            "prose": [figure, caption],
            "exercises": [ex107, ex108],
        }

        assemble.claim_figures([lesson], [figure, caption])

        self.assertEqual(ex107["figures"], [{"id": "fig-30", "label": "图 30"}])
        self.assertEqual(ex108["figures"], [])

    def test_real_prose_reference_keeps_figure_in_text_and_exercises(self) -> None:
        paragraph = block("p", "p0010#1", text="观察图 6")
        figure = block("fig", "p0010#2", label="图 6", figure_id="fig-06")
        caption = block("cap", "p0010#3", label="图 6", text="图 6")
        ex20 = exercise("20", "p0010#4", "再看图 6")
        lesson = {
            "title": "集合",
            "blocks": [paragraph, figure, caption],
            "prose": [paragraph, figure, caption],
            "exercises": [ex20],
        }

        assemble.claim_figures([lesson], [paragraph, figure, caption])

        self.assertEqual(lesson["prose"], [paragraph, figure, caption])
        self.assertEqual(ex20["figures"], [{"id": "fig-06", "label": "图 6"}])


if __name__ == "__main__":
    unittest.main()
