import unittest
from io import BytesIO
from unittest.mock import patch

from PIL import Image, ImageDraw

from services.program_plan_approval import _remove_light_background, create_approval_composite


def _ink_image(color: tuple[int, int, int]) -> bytes:
    image = Image.new("RGB", (512, 512), "white")
    ImageDraw.Draw(image).rectangle((180, 180, 330, 330), fill=color)
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class ProgramPlanApprovalTests(unittest.TestCase):
    def test_background_removal_is_vectorized_and_respects_alpha_cutoff(self):
        image = Image.new("RGBA", (4, 1))
        image.putdata([
            (255, 255, 255, 255),
            (255, 0, 0, 255),
            (255, 200, 200, 128),
            (255, 225, 225, 255),
        ])
        source = BytesIO()
        image.save(source, format="PNG")

        with Image.open(BytesIO(_remove_light_background(source.getvalue()))) as result:
            pixels = list(result.getdata())

        self.assertEqual(pixels[0][3], 0)
        self.assertEqual(pixels[1], (255, 0, 0, 255))
        self.assertEqual(pixels[2], (255, 0, 0, 27))
        self.assertEqual(pixels[3][3], 0)

    def test_composite_png_is_transparent_and_places_stamp_over_signature(self):
        assets = {
            "signature": _ink_image((0, 0, 255)),
            "stamp": _ink_image((255, 0, 0)),
        }

        with patch(
            "services.program_plan_approval._download_cloudinary_asset",
            side_effect=lambda url, _: assets[url],
        ):
            content = create_approval_composite("signature", "stamp")

        with Image.open(BytesIO(content)) as composite:
            self.assertEqual(composite.mode, "RGBA")
            self.assertEqual(composite.getpixel((0, 0))[3], 0)
            self.assertGreater(composite.getpixel((256, 185))[0], composite.getpixel((256, 185))[2])


if __name__ == "__main__":
    unittest.main()
