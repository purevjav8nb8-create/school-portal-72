from io import BytesIO
from urllib.parse import urljoin, urlparse, urlunparse

import httpx
import numpy as np
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
    pixels = np.asarray(image, dtype=np.uint16)
    colors = pixels[:, :, :3]
    existing_alpha = pixels[:, :, 3]
    background = np.min(colors, axis=2)
    ink_alpha = 255 - background
    visible = (ink_alpha > _BACKGROUND_ALPHA_CUTOFF) & (existing_alpha > 0)
    safe_alpha = np.where(visible, ink_alpha, 1)
    normalized_colors = np.where(
        visible[:, :, None],
        (colors - background[:, :, None]) * 255 // safe_alpha[:, :, None],
        0,
    )
    alpha = np.where(visible, ink_alpha * existing_alpha // 255, 0)
    transparent = Image.fromarray(
        np.dstack((normalized_colors, alpha)).astype(np.uint8),
    )
    output = BytesIO()
    transparent.save(output, format="PNG", optimize=True)
    return output.getvalue()


def create_approval_composite(signature_url: str, stamp_url: str) -> bytes:
    signature = _remove_light_background(_download_cloudinary_asset(signature_url, "image"))
    stamp = _remove_light_background(_download_cloudinary_asset(stamp_url, "image"))
    try:
        with Image.open(BytesIO(signature)) as signature_source, Image.open(BytesIO(stamp)) as stamp_source:
            signature_image = signature_source.convert("RGBA")
            stamp_image = stamp_source.convert("RGBA")
            signature_image.thumbnail((460, 160), Image.Resampling.LANCZOS)
            stamp_image.thumbnail((240, 240), Image.Resampling.LANCZOS)
            composite = Image.new("RGBA", (512, 300), (0, 0, 0, 0))
            composite.alpha_composite(
                signature_image,
                ((composite.width - signature_image.width) // 2, 112),
            )
            composite.alpha_composite(
                stamp_image,
                ((composite.width - stamp_image.width) // 2, 45),
            )
            output = BytesIO()
            composite.save(output, format="PNG", optimize=True)
            return output.getvalue()
    except (OSError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=422, detail="Гарын үсэг, тамганы нийлмэл зураг үүсгэж чадсангүй.") from error


def get_approval_assets(user) -> dict[str, str]:
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    try:
        result = (
            supabase.table("program_plan_approval_assets")
            .select("signature_url,stamp_url,composite_url")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        assets = result.data or {}
    except Exception as error:
        raise HTTPException(status_code=503, detail="Гарын үсэг, тамганы тохиргоог уншиж чадсангүй.") from error
    return {
        "signature_url": str(assets.get("signature_url") or ""),
        "stamp_url": str(assets.get("stamp_url") or ""),
        "composite_url": str(assets.get("composite_url") or ""),
    }


def list_manager_approval_assets() -> list[dict[str, str]]:
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    try:
        profiles = (
            supabase.table("teacher_profiles")
            .select("user_id,email,first_name,last_name")
            .eq("role", "manager")
            .order("last_name")
            .execute()
            .data
            or []
        )
        if not profiles:
            return []
        assets = (
            supabase.table("program_plan_approval_assets")
            .select("user_id,composite_url")
            .in_("user_id", [profile["user_id"] for profile in profiles])
            .execute()
            .data
            or []
        )
    except Exception as error:
        raise HTTPException(status_code=503, detail="Менежерүүдийн гарын үсэг, тамганы тохиргоог уншиж чадсангүй.") from error
    assets_by_user = {str(item["user_id"]): str(item.get("composite_url") or "") for item in assets}
    return [
        {
            "user_id": str(profile["user_id"]),
            "email": str(profile.get("email", "")),
            "name": f'{profile.get("last_name", "")} {profile.get("first_name", "")}'.strip(),
            "composite_url": assets_by_user.get(str(profile["user_id"]), ""),
        }
        for profile in profiles
    ]


def save_approval_assets(user, signature_url: str, stamp_url: str, composite_url: str) -> dict[str, str]:
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    assets = {
        "signature_url": signature_url,
        "stamp_url": stamp_url,
        "composite_url": composite_url,
    }
    try:
        (
            supabase.table("program_plan_approval_assets")
            .upsert({"user_id": user.id, **assets}, on_conflict="user_id")
            .execute()
        )
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


def create_approved_pdf(document_url: str, composite_url: str) -> bytes:
    pdf_content = _download_cloudinary_asset(document_url, "pdf")
    composite = _download_cloudinary_asset(composite_url, "image")
    document = composite_image = None
    try:
        document = pymupdf.open(stream=pdf_content, filetype="pdf")
        if not document.page_count:
            raise HTTPException(status_code=422, detail="PDF хоосон байна.")
        page = document[0]
        top_right = pymupdf.Rect(page.rect.width * 0.5, 0, page.rect.width, page.rect.height * 0.4)
        label_rect = next(
            (
                match
                for label in ("Батлав", "БАТЛАВ", "Баталсан", "БАТАЛСАН")
                for match in page.search_for(label, clip=top_right)
            ),
            None,
        )
        if label_rect is None:
            raise HTTPException(status_code=422, detail="PDF дотор “Батлав” эсвэл “Баталсан” гэсэн хэсэг олдсонгүй.")

        words = page.get_text("words", clip=top_right)
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
        position_row = [word for word in name_row if abs(word[1] - row_top) <= 2]
        center_x = (label_rect.x0 + label_rect.x1) / 2
        name_x0 = next((word[0] for word in sorted(position_row, key=lambda word: word[0]) if word[0] > center_x), None)
        if name_x0 is None:
            raise HTTPException(status_code=422, detail="“Батлав” хэсгийн доор нэрийн хажууд гарын үсэг, тамга байрлуулах зай олдсонгүй.")
        left_text_end = max((word[2] for word in position_row if word[2] <= center_x), default=label_rect.x0)
        center_y = (min(word[1] for word in position_row) + max(word[3] for word in position_row)) / 2
        available_width = name_x0 - left_text_end
        if available_width < 1:
            raise HTTPException(status_code=422, detail="“Батлав” хэсгийн доор гарын үсэг, тамга байрлуулах зай олдсонгүй.")
        image_width, image_height = min(150, available_width), 72
        image_rect = pymupdf.Rect(
            (left_text_end + name_x0 - image_width) / 2,
            center_y - image_height / 2,
            (left_text_end + name_x0 + image_width) / 2,
            center_y + image_height / 2,
        )
        composite_image = pymupdf.open(stream=composite, filetype="image")
        page.insert_image(image_rect, pixmap=composite_image[0].get_pixmap(alpha=True), keep_proportion=True, overlay=True)
        output = BytesIO()
        document.save(output, garbage=0, deflate=True, clean=False)
        return output.getvalue()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=422, detail="PDF-д гарын үсэг, тамга нэгтгэж чадсангүй.") from error
    finally:
        for opened_document in (document, composite_image):
            if opened_document is not None:
                opened_document.close()
