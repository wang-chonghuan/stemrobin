"""cap3 的推导判据必须是纯函数式的、可复算的。这些用例锁住那些判据本身。"""
import importlib.util
import sys
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "lesson_interactions",
    Path(__file__).resolve().parents[1] / "tools" / "lesson_interactions.py",
)
li = importlib.util.module_from_spec(SPEC)
sys.modules["lesson_interactions"] = li
SPEC.loader.exec_module(li)


def test_part_label_reads_both_spellings():
    # 语料里小问名有 label（文档规定）与更早的 id 两种写法，语义相同。
    assert li.part_label({"label": "M 向右"}) == "M 向右"
    assert li.part_label({"id": "1"}) == "1"
    assert li.part_label({"label": "", "id": "2"}) == "2"
    assert li.part_label({"judge": "numeric"}) is None


def test_plain_number_admits_only_bare_decimals():
    assert li.is_plain_number("8")
    assert li.is_plain_number("-7.4")
    assert li.is_plain_number("0.8")
    assert not li.is_plain_number("{52164,11218}")
    assert not li.is_plain_number("是")
    assert not li.is_plain_number("14.5 公里/小时")


def test_axis_ignores_the_zero_label_and_reports_stragglers():
    # 值为 0 的刻度按印刷惯例挪到原点旁边，不参与拟合。
    ticks = [(0.0, 999.0), (1.0, 100.0), (2.0, 150.0), (3.0, 200.0)]
    zero, unit, warnings = li._axis_from_ticks(ticks)
    assert (round(zero), round(unit)) == (50, 50)
    assert warnings == []

    # 一个画歪的刻度不该让整张图不可用，但必须被记下来。
    ticks = [(1.0, 100.0), (2.0, 150.0), (3.0, 200.0), (4.0, 240.0)]
    zero, unit, warnings = li._axis_from_ticks(ticks)
    assert (round(zero), round(unit)) == (50, 50)
    assert len(warnings) == 1 and "刻度 4" in warnings[0]


def test_axis_needs_at_least_three_usable_ticks():
    assert li._axis_from_ticks([(1.0, 10.0), (2.0, 20.0)]) is None


def _spec_with(points):
    """一张最小的 deterministic 坐标图：横纵各 4 个刻度，外加若干具名点。"""
    objects = []
    for value in (1, 2, 3, 4):
        objects.append({"type": "text", "text": str(value), "at": [50 + 50 * value, 400]})
        objects.append({"type": "text", "text": str(value), "at": [20, 300 - 50 * value]})
    for name, (gx, gy) in points.items():
        at = [50 + 50 * gx, 300 - 50 * gy]
        objects.append({"type": "point", "at": at})
        objects.append({"type": "text", "text": name, "at": at})
    return {"mode": "deterministic", "objects": objects}


def test_recover_frame_reads_named_points_as_grid_coordinates():
    frame = li.recover_frame(_spec_with({"M": [3, 5], "K": [4, 1]}))
    assert frame["points"] == {"M": [3, 5], "K": [4, 1]}
    assert frame["warnings"] == []


def test_recover_frame_refuses_non_deterministic_figures():
    spec = _spec_with({"M": [1, 1], "K": [2, 2]})
    spec["mode"] = "generated"
    assert li.recover_frame(spec) is None


def test_derive_routes_by_the_answer_key_alone():
    exercise = {"number": "9", "figureRefs": []}

    free = li.derive(exercise, {"grading": "ungraded", "parts": []}, {}, Path("."))
    assert free["widget"] == "free" and free["derivation"]

    number = li.derive(
        exercise,
        {"grading": "auto", "parts": [{"judge": "numeric", "expected": ["8"], "unit": "吨"}]},
        {},
        Path("."),
    )
    assert number["widget"] == "number"
    assert number["parts"] == [{"unit": "吨"}]

    expression = li.derive(
        exercise,
        {"grading": "auto", "parts": [{"judge": "expression", "expected": ["x+1"]}]},
        {},
        Path("."),
    )
    assert expression["widget"] == "math" and "needsAuthoring" not in expression

    # exact 的正确形态多半是点选，但选项形状还没人定 —— 维持现状且必须标记待补。
    exact = li.derive(
        exercise,
        {"grading": "auto", "parts": [{"judge": "exact", "expected": ["是"]}]},
        {},
        Path("."),
    )
    assert exact["widget"] == "math" and exact["needsAuthoring"]


def test_number_needs_every_expected_to_be_a_bare_number():
    # 带单位或集合写法的 expected 不算「一个数」，不能给数字键盘。
    mixed = li.derive(
        {"number": "8", "figureRefs": []},
        {
            "grading": "auto",
            "parts": [
                {"judge": "numeric", "expected": ["14.5"]},
                {"judge": "numeric", "expected": ["11.1 公里/小时"]},
            ],
        },
        {},
        Path("."),
    )
    assert mixed["widget"] == "math"


def _grid_case(expected_pairs):
    """一道引用 fig-x 的坐标题：两个具名点、四个小问。"""
    exercise = {"number": "262", "figureRefs": ["fig-x"]}
    parts = []
    for label, value in expected_pairs:
        parts.append({"label": label, "judge": "numeric", "expected": [value], "unit": "格"})
    return exercise, parts


def test_grid_point_declares_ordered_part_to_point_mapping(tmp_path=None):
    import json as _json

    frame_spec = _spec_with({"M": [3, 5], "K": [4, 1]})
    directory = Path(__file__).resolve().parent / "_tmp_specs"
    directory.mkdir(exist_ok=True)
    (directory / "fig-x.spec.json").write_text(
        _json.dumps(frame_spec), encoding="utf-8"
    )
    figures = {"fig-x": {"id": "fig-x", "spec": "figures/fig-x.spec.json"}}

    exercise, parts = _grid_case(
        [("M 向右", "3"), ("M 向上", "5"), ("K 向右", "4"), ("K 向上", "1")]
    )
    out = li.try_grid_point(exercise, parts, figures, directory)
    assert out is not None
    assert out["parts"] == [
        {"point": "M", "axis": "x", "label": "M 向右", "unit": "格"},
        {"point": "M", "axis": "y", "label": "M 向上", "unit": "格"},
        {"point": "K", "axis": "x", "label": "K 向右", "unit": "格"},
        {"point": "K", "axis": "y", "label": "K 向上", "unit": "格"},
    ]

    # 把两个小问的 expected 互换：集合里的值一个没变，只有顺序错了。
    # 旧的成员关系校验发现不了，有序校验必须发现。
    exercise, swapped = _grid_case(
        [("M 向右", "5"), ("M 向上", "3"), ("K 向右", "4"), ("K 向上", "1")]
    )
    assert li.try_grid_point(exercise, swapped, figures, directory) is None

    (directory / "fig-x.spec.json").unlink()
    directory.rmdir()
