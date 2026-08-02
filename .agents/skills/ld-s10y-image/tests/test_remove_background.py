import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image


SCRIPT = Path(__file__).parents[1] / "scripts" / "remove_background.py"
SPEC = importlib.util.spec_from_file_location("remove_background", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class RemoveBackgroundTests(unittest.TestCase):
    def test_removes_border_background_but_keeps_enclosed_white(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.png"
            output = Path(directory) / "output.png"
            image = Image.new("RGBA", (20, 20), "#f4f4f4")
            for x in range(5, 15):
                for y in range(5, 15):
                    image.putpixel((x, y), (20, 120, 90, 255))
            for x in range(8, 12):
                for y in range(8, 12):
                    image.putpixel((x, y), (255, 255, 255, 255))
            image.save(source)

            MODULE.remove_background(source, output)

            result = Image.open(output).convert("RGBA")
            self.assertEqual(result.getpixel((0, 0))[3], 0)
            self.assertEqual(result.getpixel((9, 9)), (255, 255, 255, 255))


if __name__ == "__main__":
    unittest.main()
