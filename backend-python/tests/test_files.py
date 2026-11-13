import random
import unittest
from io import BytesIO
from zipfile import ZIP_STORED, ZipFile

import pymupdf
from PIL import Image

from routers.files import _compress_office_file, _compress_pdf


class FileCompressionTests(unittest.TestCase):
    def test_compresses_large_pdf_images_and_keeps_searchable_text(self):
        rng = random.Random(12)
        pixels = bytes(rng.randrange(256) for _ in range(1200 * 1600 * 3))
        image = Image.frombytes("RGB", (1200, 1600), pixels)
        jpeg = BytesIO()
        image.save(jpeg, format="JPEG", quality=95)

        document = pymupdf.open()
        page = document.new_page(width=612, height=792)
        page.insert_image(page.rect, stream=jpeg.getvalue())
        page.insert_text((36, 36), "Searchable document text")
        original = BytesIO()
        document.save(original, garbage=4, deflate=True)
        document.close()

        compressed = _compress_pdf(original.getvalue())

        self.assertLess(len(compressed), len(original.getvalue()))
        with pymupdf.open(stream=compressed, filetype="pdf") as result:
            self.assertIn("Searchable document text", result[0].get_text())

    def test_does_not_increase_pdf_size(self):
        document = pymupdf.open()
        document.new_page().insert_text((36, 36), "Plain text")
        original = BytesIO()
        document.save(original, garbage=4, deflate=True)
        document.close()

        compressed = _compress_pdf(original.getvalue())

        self.assertLessEqual(len(compressed), len(original.getvalue()))

    def test_compresses_office_archive_without_changing_contents(self):
        content = b"Repeated office document content " * 20000
        original = BytesIO()
        with ZipFile(original, "w", ZIP_STORED) as archive:
            archive.writestr("word/document.xml", content)

        compressed = _compress_office_file(original.getvalue())

        self.assertLess(len(compressed), len(original.getvalue()))
        with ZipFile(BytesIO(compressed)) as archive:
            self.assertEqual(archive.read("word/document.xml"), content)


if __name__ == "__main__":
    unittest.main()
