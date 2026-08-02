import importlib.util
import unittest
from pathlib import Path


SKILL = Path(__file__).resolve().parents[1]
MODULE_SPEC = importlib.util.spec_from_file_location(
    "build_context",
    SKILL / "scripts" / "build_context.py",
)
MODULE = importlib.util.module_from_spec(MODULE_SPEC)
MODULE_SPEC.loader.exec_module(MODULE)


class ProseContextTests(unittest.TestCase):
    def test_direct_reference_is_kept_outside_nearby_window(self):
        blocks = [
            {
                "kind": "p",
                "text": "Machines with propellers are centrally symmetric (图 47).",
            },
            *[
                {"kind": "cap", "text": f"图 {number}"}
                for number in range(40, 47)
            ],
            {"kind": "fig", "id": "fig-47", "label": "图 47"},
            {"kind": "cap", "text": "图 47"},
        ]

        context = MODULE.prose_context(blocks, "fig-47")

        self.assertEqual(len(context), 1)
        self.assertIn(blocks[0]["text"], context[0]["nearbyText"])


if __name__ == "__main__":
    unittest.main()
