import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SKILL = Path(__file__).resolve().parents[1]
FIXTURE = SKILL / "tests" / "fixtures" / "number-line.json"
MODULE_SPEC = importlib.util.spec_from_file_location(
    "validate_spec",
    SKILL / "scripts" / "validate_spec.py",
)
MODULE = importlib.util.module_from_spec(MODULE_SPEC)
MODULE_SPEC.loader.exec_module(MODULE)


class ValidateSpecTests(unittest.TestCase):
    def setUp(self):
        self.payload = json.loads(FIXTURE.read_text(encoding="utf-8"))

    def write(self, payload):
        handle = tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            encoding="utf-8",
            delete=False,
        )
        json.dump(payload, handle)
        handle.close()
        return Path(handle.name)

    def test_valid_geometry_passes(self):
        path = self.write(self.payload)
        self.assertEqual(MODULE.validate(path, "draft"), [])

    def test_wrong_distance_fails(self):
        payload = copy.deepcopy(self.payload)
        payload["objects"][2]["at"] = [4, 0]
        errors = MODULE.validate(self.write(payload), "draft")
        self.assertTrue(any("distance" in error for error in errors))

    def test_non_english_label_fails(self):
        payload = copy.deepcopy(self.payload)
        payload["objects"][-1]["text"] = "点B"
        errors = MODULE.validate(self.write(payload), "draft")
        self.assertTrue(any("visible text must be English" in error for error in errors))

    def test_generated_mode_rejects_geometry(self):
        payload = copy.deepcopy(self.payload)
        payload["mode"] = "generated"
        errors = MODULE.validate(self.write(payload), "draft")
        self.assertTrue(
            any("must not contain deterministic objects" in error for error in errors)
        )

    def test_image_rotation_requires_center(self):
        payload = copy.deepcopy(self.payload)
        payload["mode"] = "hybrid"
        payload["assets"] = [
            {"id": "art", "path": "art.png", "role": "artwork"}
        ]
        payload["objects"] = [
            {
                "id": "image-1",
                "type": "image",
                "asset": "art",
                "at": [0, 0],
                "size": [1, 1],
                "rotation": {"angleDegrees": 180},
            }
        ]
        payload["assertions"] = []
        errors = MODULE.validate(self.write(payload), "draft")
        self.assertTrue(
            any("rotation.center must be [x, y]" in error for error in errors)
        )

    def test_central_symmetry_pairs_pass(self):
        payload = copy.deepcopy(self.payload)
        payload["description"] = "A half-turn symmetric segment."
        payload["assertions"].append({
            "type": "centralSymmetry",
            "center": [2, 0],
            "pairs": [{"a": [0, 0], "b": [4, 0]}],
        })
        self.assertEqual(MODULE.validate(self.write(payload), "draft"), [])

    def test_wrong_central_symmetry_pair_fails(self):
        payload = copy.deepcopy(self.payload)
        payload["description"] = "A half-turn symmetric segment."
        payload["assertions"].append({
            "type": "centralSymmetry",
            "center": [2, 0],
            "pairs": [{"a": [0, 0], "b": [3, 0]}],
        })
        errors = MODULE.validate(self.write(payload), "draft")
        self.assertTrue(any("midpoint" in error for error in errors))

    def test_central_symmetry_claim_requires_assertion(self):
        payload = copy.deepcopy(self.payload)
        payload["description"] = "A central symmetry example."
        errors = MODULE.validate(self.write(payload), "draft")
        self.assertTrue(any("requires a centralSymmetry" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
