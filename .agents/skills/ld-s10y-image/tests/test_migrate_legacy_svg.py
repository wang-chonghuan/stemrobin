import importlib.util
import unittest
from pathlib import Path


SCRIPT = (
    Path(__file__).parents[1] / "scripts" / "migrate_legacy_svg.py"
)
SPEC = importlib.util.spec_from_file_location("migrate_legacy_svg", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DeclaredPointTests(unittest.TestCase):
    def test_reuses_nearby_visible_point(self):
        objects = [
            {"id": "point-1", "type": "point", "at": [10, 10]},
            {"id": "text-1", "type": "text", "at": [12, 12], "text": "K",
             "fontSize": 14},
        ]

        MODULE.add_declared_points(
            objects, "A labeled point K.", 100, 100, 1
        )

        self.assertEqual(
            [item["id"] for item in objects if item["type"] == "point"],
            ["point-1"],
        )
        self.assertEqual(objects[1]["at"], [10, 10])

    def test_short_tick_prevents_synthetic_point(self):
        objects = [
            {
                "id": "segment-1",
                "type": "segment",
                "from": [10, 20],
                "to": [10, 30],
            },
            {"id": "text-1", "type": "text", "at": [10, 10], "text": "P",
             "fontSize": 14},
        ]

        MODULE.add_declared_points(
            objects, "A road with labeled point P.", 100, 100, 1
        )

        self.assertEqual(
            [item for item in objects if item["type"] == "point"],
            [],
        )
        self.assertEqual(objects[1]["at"], [10, 10])

    def test_closed_region_still_receives_declared_point(self):
        objects = [
            {
                "id": "polygon-1",
                "type": "polygon",
                "points": [[0, 0], [30, 0], [30, 30], [0, 30]],
            },
            {"id": "text-1", "type": "text", "at": [15, 15], "text": "P",
             "fontSize": 14},
        ]

        MODULE.add_declared_points(
            objects, "A set containing labeled point P.", 100, 100, 1
        )

        points = [item for item in objects if item["type"] == "point"]
        self.assertEqual(len(points), 1)
        self.assertEqual(points[0]["at"], [15, 15])

    def test_dense_grid_prevents_synthetic_point(self):
        objects = [
            {
                "id": f"segment-{index}",
                "type": "segment",
                "from": [index * 10, 0],
                "to": [index * 10, 100],
            }
            for index in range(6)
        ]
        objects.append(
            {"id": "text-1", "type": "text", "at": [20, 40], "text": "C",
             "fontSize": 14}
        )

        MODULE.add_declared_points(
            objects, "A coordinate strip with labeled point C.", 100, 100, 1
        )

        self.assertEqual(
            [item for item in objects if item["type"] == "point"],
            [],
        )


if __name__ == "__main__":
    unittest.main()
