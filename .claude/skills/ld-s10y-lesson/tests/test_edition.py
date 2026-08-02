from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path

from PIL import Image, ImageDraw

TOOLS = Path(__file__).resolve().parents[1] / "tools"
PROFILE = Path(__file__).resolve().parents[1] / "profiles" / "modern-us-neutral.json"
sys.path.insert(0, str(TOOLS))

import edition


def dump(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


class EditionTest(unittest.TestCase):
    def test_hybrid_png_requires_aspect_ratio_report(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source_path = root / "source.png"
            image_path = root / "figure.png"
            metadata_path = root / "figure.png.json"
            spec_path = root / "figure.spec.json"
            Image.new("RGB", (1024, 1024), "#0f766e").save(source_path)
            Image.new("RGB", (1024, 1024), "#0f766e").save(image_path)
            spec = {
                "schema": edition.IMAGE_FIGURE_SPEC_SCHEMA,
                "id": "fig-01",
                "mode": "hybrid",
                "description": "Generated artwork with an exact overlay.",
                "source": {
                    "image": {
                        "path": source_path.as_posix(),
                        "sha256": edition.sha256(source_path),
                    },
                    "authoritativeText": [{"text": "Place the figure on a grid."}],
                },
                "canvas": {
                    "width": 1024,
                    "height": 1024,
                    "boundingBox": [0, 10, 10, 0],
                },
                "assets": [{
                    "id": "art",
                    "path": image_path.as_posix(),
                    "role": "artwork",
                }],
                "objects": [{
                    "id": "artwork",
                    "type": "image",
                    "asset": "art",
                    "at": [1, 1],
                    "size": [8, 8],
                }],
                "assertions": [{
                    "type": "objectCount",
                    "objectType": "image",
                    "count": 1,
                }],
                "review": {"status": "pass"},
            }
            dump(spec_path, spec)
            metadata = {
                "schema": "ld-s10y-image/render@1",
                "mode": "hybrid",
                "renderer": {"name": "JSXGraph"},
                "status": "pass",
                "imageFits": [{
                    "id": "artwork",
                    "status": "pass",
                    "preserveAspectRatio": "xMidYMid meet",
                }],
                "output": {"png": {"sha256": edition.sha256(image_path)}},
                "spec": {"sha256": edition.sha256(spec_path)},
            }
            dump(metadata_path, metadata)
            figure = {"id": "fig-01"}
            self.assertEqual(
                edition.validate_png(
                    image_path,
                    metadata_path,
                    spec_path,
                    figure,
                ),
                [],
            )

            metadata.pop("imageFits")
            dump(metadata_path, metadata)
            errors = edition.validate_png(
                image_path,
                metadata_path,
                spec_path,
                figure,
            )
            self.assertTrue(any("比例保护报告" in error for error in errors))

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

    def test_fullwidth_numbered_subparts_are_sorted_and_line_broken(self) -> None:
        source = "选择：1）甲； 4）丁；2）乙； 3）丙."
        self.assertEqual(
            edition.normalize_numbered_subparts(source),
            "选择：\n1）甲；\n2）乙；\n3）丙.\n4）丁；",
        )

    def test_numbered_subparts_touching_chinese_text_are_line_broken(self) -> None:
        source = "用什么数字代替星号才能使所得的数1) 被 3 整除？和 2) 被 5 整除？"
        self.assertEqual(
            edition.normalize_numbered_subparts(source),
            "用什么数字代替星号才能使所得的数\n"
            "1) 被 3 整除？和\n"
            "2) 被 5 整除？",
        )

    def test_figure_number_is_not_treated_as_a_subpart(self) -> None:
        source = "观察图 72），回答：\n1) 第一问；\n2) 第二问."
        self.assertEqual(edition.normalize_numbered_subparts(source), source)

    def test_numbered_subpart_layout_validator_rejects_unnormalized_text(self) -> None:
        self.assertTrue(
            edition.validate_numbered_subpart_layout("计算：1）甲；2）乙.")
        )
        self.assertEqual(
            edition.validate_numbered_subpart_layout("计算：\n1）甲；\n2）乙."),
            [],
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

        errors = edition.validate_text(
            "阿廖沙和别佳是同学.",
            "阿廖沙和别佳是同学.",
            [],
            [],
            "exercise",
            ["阿廖沙", "别佳"],
        )
        self.assertTrue(any("俄文人名" in error for error in errors))

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
            Image.new("RGB", (120, 80), "white").save(
                book / "figures" / "fig-01.png"
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
            figures = edition.load(target / "figures.json")
            figures["figures"][0].update({
                "png": "figures/fig-01.png",
                "generation": "figures/fig-01.png.json",
            })
            dump(target / "figures.json", figures)
            exercises = edition.load(target / "exercises.json")
            exercises["exercises"][0]["text"] = "一个社区农场有 10 棵树."
            exercises["exercises"][0]["changes"] = ["setting"]
            dump(target / "exercises.json", exercises)

            figure_dir = book / "editions" / args.edition / "figures"
            figure_dir.mkdir(parents=True)
            image_path = figure_dir / "fig-01.png"
            image = Image.new("RGB", (1024, 1024), "white")
            draw = ImageDraw.Draw(image)
            draw.rectangle((120, 430, 904, 594), fill="#0f766e")
            image.save(image_path)
            source_sha = edition.sha256(book / "figures" / "fig-01.png")
            dump(figure_dir / "fig-01.png.json", {
                "schema": "n-azure/image-generation@1",
                "model": "gpt-image-2",
                "mode": "edit",
                "prompt": "Create a full-color horizontal line diagram.",
                "references": [{"sha256": source_sha}],
                "output": {"sha256": edition.sha256(image_path)},
            })
            dump(figure_dir / "fig-01.spec.json", {
                "schema": edition.FIGURE_SPEC_SCHEMA,
                "id": "fig-01",
                "description": "A generated full-color line diagram.",
                "constraints": ["The line is horizontal."],
                "visualReview": {"status": "pass"},
            })

            self.assertEqual(edition.cmd_finalize(args), 0)
            self.assertEqual(edition.load(target / "lesson.json")["status"], "ready")
            self.assertEqual(
                edition.load(target / "adaptation.audit.json")["status"],
                "pass",
            )


if __name__ == "__main__":
    unittest.main()
