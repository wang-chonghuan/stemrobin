from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1] / "tools"
PROFILE = Path(__file__).resolve().parents[1] / "profiles" / "modern-us-neutral.json"
sys.path.insert(0, str(TOOLS))

import edition


def dump(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


class EditionTest(unittest.TestCase):
    def test_numbered_subparts_are_sorted_and_line_broken(self) -> None:
        source = (
            "下列每两个数之间包括哪些整数："
            "1) $-8.8$ 和 $3.85$；　　　　3) $-9.2$ 和 $4.73$；"
            "2) $-3.11$ 和 $3.11$；　　　4) $-3.22$ 和 $3.22$."
        )
        self.assertEqual(
            edition.normalize_numbered_subparts(source),
            "下列每两个数之间包括哪些整数：\n"
            "1) $-8.8$ 和 $3.85$；\n"
            "2) $-3.11$ 和 $3.11$；\n"
            "3) $-9.2$ 和 $4.73$；\n"
            "4) $-3.22$ 和 $3.22$.",
        )

    def test_layout_reordering_preserves_math_and_numbers(self) -> None:
        source = "计算：1) $a+1$；3) $c+3$；2) $b+2$；4) $d+4$."
        modern = edition.normalize_numbered_subparts(source)
        self.assertEqual(
            edition.validate_text(
                source,
                modern,
                ["layout"],
                [],
                "exercise",
                [],
            ),
            [],
        )

    def test_coordinate_values_are_not_treated_as_subparts(self) -> None:
        source = (
            "作折线，顶点为 $A(-6,2),B(-4,6),C(1,1),D(2,-5)$，"
            "再求交点坐标."
        )
        self.assertEqual(edition.normalize_numbered_subparts(source), source)

    def test_text_validation_preserves_math_and_rejects_old_culture(self) -> None:
        errors = edition.validate_text(
            "苏联的产量从 10 增加到 12，求增长率 $r=2/10$.",
            "一个地区的产量从 10 增加到 12，求增长率 $r=2/10$.",
            ["setting"],
            [],
            "exercise",
            ["苏联"],
        )
        self.assertEqual(errors, [])

        errors = edition.validate_text(
            "苏联的产量为 10.",
            "苏联的产量为 10.",
            [],
            [],
            "exercise",
            ["苏联"],
        )
        self.assertTrue(any("旧文化词" in error for error in errors))

    def test_context_numbers_must_be_declared_exactly(self) -> None:
        errors = edition.validate_text(
            "数据来自 1970—1974 年.",
            "数据来自 2020—2024 年.",
            ["setting", "context-number"],
            [
                {"from": "1970", "to": "2020", "reason": "Update the period."},
                {"from": "1974", "to": "2024", "reason": "Update the period."},
            ],
            "exercise",
            [],
        )
        self.assertEqual(errors, [])

        errors = edition.validate_text(
            "数据来自 1970—1974 年.",
            "数据来自 2020—2024 年.",
            ["setting"],
            [],
            "exercise",
            [],
        )
        self.assertTrue(any("非公式数字变化未被准确声明" in error for error in errors))

    def test_svg_figure_text_must_be_english(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            svg = root / "fig-01.svg"
            spec = root / "fig-01.spec.json"
            dump(spec, {
                "schema": edition.FIGURE_SPEC_SCHEMA,
                "id": "fig-01",
                "description": "A newly authored tree.",
                "constraints": ["The tree has one trunk."],
            })
            svg.write_text(
                '<svg viewBox="0 0 100 60">'
                '<title>一棵树</title>'
                '<text x="10" y="20">Tree</text>'
                "</svg>"
            )

            errors = edition.validate_svg(
                svg,
                spec,
                {"id": "fig-01"},
                "English",
            )
            self.assertTrue(any("必须使用英文" in error for error in errors))

            svg.write_text(
                '<svg viewBox="0 0 100 60">'
                '<title>One tree</title>'
                '<text x="10" y="20">Tree 1</text>'
                "</svg>"
            )
            self.assertEqual(
                edition.validate_svg(
                    svg,
                    spec,
                    {"id": "fig-01"},
                    "English",
                ),
                [],
            )

    def test_prepare_and_finalize_modern_edition(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            book = root / "5m"
            lesson_id = "math5-c1-s1-n1"
            raw_dir = book / "lessons" / lesson_id
            raw_lesson = {
                "id": lesson_id,
                "card_id": lesson_id,
                "chapter": "第一章",
                "section": "第一节",
                "number": "1",
                "title": "测试",
                "printed_title": "1. 测试",
                "start_page": 1,
                "start_printed": 1,
                "figures": [{"id": "fig-01", "label": "图 1", "page": 1}],
                "exercise_count": 1,
                "prose": [
                    {
                        "kind": "p",
                        "text": "观察图 1.",
                        "id": None,
                        "label": None,
                        "printed_page": 1,
                    },
                    {
                        "kind": "fig",
                        "text": "",
                        "id": "fig-01",
                        "label": "图 1",
                        "printed_page": 1,
                    },
                ],
            }
            raw_exercises = {
                "lesson": lesson_id,
                "count": 1,
                "exercises": [
                    {
                        "number": "1",
                        "group": None,
                        "text": "苏联农场有 10 棵树.",
                        "lines": ["苏联农场有 10 棵树."],
                        "pages": ["p0001#1"],
                        "figure_refs": [],
                        "figures": [],
                    }
                ],
            }
            dump(raw_dir / "lesson.json", raw_lesson)
            dump(raw_dir / "exercises.json", raw_exercises)
            (book / "figures").mkdir(parents=True)
            (book / "figures" / "fig-01.svg").write_text(
                '<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>'
            )
            args = Namespace(
                root=str(root),
                book="5m",
                edition="modern-us-neutral",
                lesson=[lesson_id],
                profile=str(PROFILE),
                force=False,
            )
            self.assertEqual(edition.cmd_prepare(args), 0)

            target = book / "editions" / args.edition / "lessons" / lesson_id
            shutil.copy2(target / "lesson.template.json", target / "lesson.json")
            shutil.copy2(target / "exercises.template.json", target / "exercises.json")
            shutil.copy2(target / "figures.template.json", target / "figures.json")
            exercises = edition.load(target / "exercises.json")
            exercises["exercises"][0]["text"] = "一个社区农场有 10 棵树."
            exercises["exercises"][0]["changes"] = ["setting"]
            dump(target / "exercises.json", exercises)

            figure_dir = book / "editions" / args.edition / "figures"
            figure_dir.mkdir(parents=True)
            (figure_dir / "fig-01.svg").write_text(
                '<svg viewBox="0 0 100 60" role="img">'
                '<line x1="10" y1="30" x2="90" y2="30" stroke="currentColor"/>'
                "</svg>"
            )
            dump(figure_dir / "fig-01.spec.json", {
                "schema": edition.FIGURE_SPEC_SCHEMA,
                "id": "fig-01",
                "description": "A newly authored line diagram.",
                "constraints": ["The line is horizontal."],
            })

            self.assertEqual(edition.cmd_finalize(args), 0)
            self.assertEqual(edition.load(target / "lesson.json")["status"], "ready")
            self.assertEqual(
                edition.load(target / "adaptation.audit.json")["status"],
                "pass",
            )


if __name__ == "__main__":
    unittest.main()
