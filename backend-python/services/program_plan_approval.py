from io import BytesIO
from urllib.parse import urljoin, urlparse, urlunparse

import httpx
import pymupdf
from fastapi import HTTPException
from PIL import Image

from database import supabase

_CLOUDINARY_HOST = "res.cloudinary.com"
_MAX_ASSET_BYTES = 20 * 1024 * 1024
_MAX_IMAGE_PIXELS = 25_000_000
_BACKGROUND_ALPHA_CUTOFF = 32


def _remove_light_background(image_content: bytes) -> bytes:
    try:
        with Image.open(BytesIO(image_content)) as source:
            if source.width * source.height > _MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="Гарын үсэг, тамганы зураг хэт өндөр нягтаршилтай байна.")
            image = source.convert("RGBA")
    except HTTPException:
        raise
    except (OSError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=422, detail="Гарын үсэг, тамганы зураг нээгдсэнгүй.") from error

    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
    pixels = bytearray(image.tobytes())
    for offset in range(0, len(pixels), 4):
        red, green, blue, existing_alpha = pixels[offset:offset + 4]
        background = min(red, green, blue)
        ink_alpha = 255 - background
        if ink_alpha <= _BACKGROUND_ALPHA_CUTOFF or existing_alpha == 0:
            pixels[offset + 3] = 0
            continue
        pixels[offset] = min(255, (red - background) * 255 // ink_alpha)
        pixels[offset + 1] = min(255, (green - background) * 255 // ink_alpha)
        pixels[offset + 2] = min(255, (blue - background) * 255 // ink_alpha)
        pixels[offset + 3] = ink_alpha * existing_alpha // 255

    transparent = Image.frombytes("RGBA", image.size, bytes(pixels))
    output = BytesIO()
    transparent.save(output, format="PNG", optimize=True)
    return output.getvalue()


def get_approval_assets(user) -> dict[str, str]:
    assets = (user.app_metadata or {}).get("program_plan_approval_assets", {})
    return {
        "signature_url": str(assets.get("signature_url", "")),
        "stamp_url": str(assets.get("stamp_url", "")),
    }


def save_approval_assets(user, signature_url: str, stamp_url: str) -> dict[str, str]:
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    app_metadata = dict(user.app_metadata or {})
    assets = {
        "signature_url": signature_url,
        "stamp_url": stamp_url,
    }
    app_metadata["program_plan_approval_assets"] = assets
    try:
        supabase.auth.admin.update_user_by_id(user.id, {"app_metadata": app_metadata})
    except Exception as error:
        raise HTTPException(status_code=503, detail="Гарын үсэг, тамганы тохиргоог хадгалж чадсангүй.") from error
    return assets


def _download_cloudinary_asset(url: str, expected_kind: str) -> bytes:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != _CLOUDINARY_HOST or not parsed.path.startswith("/"):
        raise HTTPException(status_code=422, detail="Зөвхөн Cloudinary-д байршуулсан PDF болон зураг ашиглана уу.")
    if expected_kind == "image" and "/image/upload/" not in parsed.path:
        raise HTTPException(status_code=422, detail="Гарын үсэг, тамга зураг хэлбэртэй байх шаардлагатай.")
    if expected_kind == "pdf" and "/image/upload/" not in parsed.path:
        raise HTTPException(status_code=422, detail="Хөтөлбөрийн эх файл Cloudinary PDF байх шаардлагатай.")
    if expected_kind == "image":
        parsed = parsed._replace(path=parsed.path.replace("/image/upload/", "/image/upload/f_png/", 1))
        url = urlunparse(parsed)
    try:
        chunks = []
        size = 0
        with httpx.Client(timeout=20, follow_redirects=False) as client:
            for _ in range(6):
                with client.stream("GET", url) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise HTTPException(status_code=422, detail="Cloudinary файл татах үед буруу redirect хариу ирлээ.")
                        redirected_url = urljoin(url, location)
                        redirected = urlparse(redirected_url)
                        if redirected.scheme != "https" or redirected.hostname != _CLOUDINARY_HOST:
                            raise HTTPException(status_code=422, detail="Cloudinary файл Cloudinary бус хаяг руу шилжсэн тул татаж чадсангүй.")
                        url = redirected_url
                        continue

                    response.raise_for_status()
                    content_length = response.headers.get("content-length")
                    if content_length and int(content_length) > _MAX_ASSET_BYTES:
                        raise HTTPException(status_code=413, detail="PDF болон зураг тус бүр 20 MB-аас бага байх шаардлагатай.")
                    for chunk in response.iter_bytes():
                        size += len(chunk)
                        if size > _MAX_ASSET_BYTES:
                            raise HTTPException(status_code=413, detail="PDF болон зураг тус бүр 20 MB-аас бага байх шаардлагатай.")
                        chunks.append(chunk)
                    break
            else:
                raise HTTPException(status_code=422, detail="Cloudinary файл хэт олон redirect хийсэн тул татаж чадсангүй.")
    except httpx.HTTPStatusError as error:
        raise HTTPException(status_code=422, detail=f"Cloudinary файл татахад HTTP {error.response.status_code} алдаа гарлаа.") from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=422, detail="PDF эсвэл зураг татаж чадсангүй.") from error
    content = b"".join(chunks)
    if not content:
        raise HTTPException(status_code=413, detail="PDF болон зураг тус бүр 20 MB-аас бага байх шаардлагатай.")
    return content


def create_approved_pdf(document_url: str, signature_url: str, stamp_url: str) -> bytes:
    pdf_content = _download_cloudinary_asset(document_url, "pdf")
    signature = _remove_light_background(_download_cloudinary_asset(signature_url, "image"))
    stamp = _remove_light_background(_download_cloudinary_asset(stamp_url, "image"))
    document = signature_image = stamp_image = None
    try:
        document = pymupdf.open(stream=pdf_content, filetype="pdf")
        signature_image = pymupdf.open(stream=signature, filetype="image")
        stamp_image = pymupdf.open(stream=stamp, filetype="image")
        signature_pixmap = signature_image[0].get_pixmap(alpha=True)
        stamp_pixmap = stamp_image[0].get_pixmap(alpha=True)
        anchor = None
        for page in document:
            for label in ("Батлав", "БАТЛАВ", "Баталсан", "БАТАЛСАН"):
                matches = page.search_for(label)
                if matches:
                    anchor = (page, matches[0])
                    break
            if anchor:
                break
        if not anchor:
            raise HTTPException(status_code=422, detail="PDF дотор “Батлав” эсвэл “Баталсан” гэсэн хэсэг олдсонгүй.")

        page, label_rect = anchor
        words = page.get_text("words")
        rows: dict[tuple[int, int], list[tuple]] = {}
        for word in words:
            if word[1] >= label_rect.y1 - 1:
                rows.setdefault((word[5], word[6]), []).append(word)
        name_row = next(
            (
                sorted(row, key=lambda word: word[0])
                for row in sorted(rows.values(), key=lambda row: min(word[1] for word in row))
                if any(word[0] > label_rect.x0 for word in row)
            ),
            None,
        )
        if not name_row:
            raise HTTPException(status_code=422, detail="“Батлав” хэсгийн доор нэрийн хажууд гарын үсэг, тамга байрлуулах зай олдсонгүй.")
        row_top = min(word[1] for word in name_row)
        position_row = [
            word for word in words
            if word[1] >= label_rect.y1 - 1 and abs(word[1] - row_top) <= 2
        ]
        center_x = (label_rect.x0 + label_rect.x1) / 2
        name_x0 = next((word[0] for word in sorted(position_row, key=lambda word: word[0]) if word[0] > center_x), None)
        if name_x0 is None:
            raise HTTPException(status_code=422, detail="“Батлав” хэсгийн доор нэрийн хажууд гарын үсэг, тамга байрлуулах зай олдсонгүй.")
        left_text_end = max((word[2] for word in position_row if word[2] <= center_x), default=label_rect.x0)
        signature_width, signature_height = 140, 50
        stamp_size = 112
        signature_x0 = (left_text_end + name_x0 - signature_width) / 2
        center_y = (min(word[1] for word in position_row) + max(word[3] for word in position_row)) / 2
        page.insert_image(
            pymupdf.Rect(signature_x0, center_y - signature_height / 2, signature_x0 + signature_width, center_y + signature_height / 2),
            pixmap=signature_pixmap,
            keep_proportion=True,
            overlay=True,
        )
        stamp_x0 = signature_x0 + (signature_width - stamp_size) / 2
        page.insert_image(
            pymupdf.Rect(stamp_x0, center_y - stamp_size / 2, stamp_x0 + stamp_size, center_y + stamp_size / 2),
            pixmap=stamp_pixmap,
            keep_proportion=True,
            overlay=True,
        )
        output = BytesIO()
        document.save(output, garbage=0, deflate=True, clean=False)
        return output.getvalue()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=422, detail="PDF-д гарын үсэг, тамга нэгтгэж чадсангүй.") from error
    finally:
        for opened_document in (document, signature_image, stamp_image):
            if opened_document is not None:
                opened_document.close()
