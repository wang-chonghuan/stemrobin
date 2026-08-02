from __future__ import annotations

import json
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1] / "tools"
sys.path.insert(0, str(TOOLS))

import lesson_answers


def dump(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


class LessonAnswersTest(unittest.TestCase):
    def test_prepare_writes_only_to_selected_edition(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            lesson_id = "math5-c1-s1-n1"
            dump(root / "5m" / "answers.json", {
                "answers": [{"exercise": 1, "raw": "42"}],
            })
            lesson_dir = (
                root / "5m" / "editions" / "modern-us-neutral"
                / "lessons" / lesson_id
            )
            dump(lesson_dir / "exercises.json", {
                "exercises": [{
                    "number": "1",
                    "text": "求答案.",
                    "figure_refs": ["fig-01"],
                }],
            })
            dump(lesson_dir / "figures.json", {
                "figures": [{
                    "id": "fig-01",
                    "svg": "figures/fig-01.svg",
                    "spec": "figures/fig-01.spec.json",
                }],
            })
            args = Namespace(
                root=str(root),
                book="5m",
                edition="modern-us-neutral",
                lesson=[lesson_id],
            )

            self.assertEqual(lesson_answers.cmd_prepare(args), 0)
            template = lesson_answers.load(
                lesson_dir / "answer-keys.template.json"
            )
            self.assertEqual(template["edition"], "modern-us-neutral")
            self.assertEqual(template["answers"][0]["bookRaw"], "42")
            evidence = template["answers"][0]["figureEvidence"][0]
            self.assertTrue(evidence["originalPng"].endswith("figures/fig-01.png"))
            self.assertTrue(evidence["editionAsset"].endswith("figures/fig-01.svg"))
            self.assertTrue(evidence["figureSpec"].endswith("figures/fig-01.spec.json"))
            self.assertFalse(
                (root / "5m" / "lessons" / lesson_id / "answer-keys.template.json").exists()
            )


if __name__ == "__main__":
    unittest.main()
