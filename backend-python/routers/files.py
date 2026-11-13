from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

import pymupdf
from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from urllib.parse import quote


router = APIRouter(prefix="/api/files", tags=["Files"])
OFFICE_EXTENSIONS = {".docx", ".xlsx", ".pptx"}


def _compress_pdf(content: bytes) -> bytes:
    source = pymupdf.open(stream=content, filetype="pdf")
    try:
        if source.is_encrypted or source.get_sigflags() > 0:
            return content
        source.rewrite_images(dpi_threshold=180, dpi_target=150, quality=75)
        output = BytesIO()
        source.save(
            output,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
            compression_effort=100,
        )
        compressed = output.getvalue()
        return compressed if len(compressed) < len(content) else content
    finally:
        source.close()


def _compress_office_file(content: bytes) -> bytes:
    output = BytesIO()
    with ZipFile(BytesIO(content)) as source, ZipFile(
        output, "w", ZIP_DEFLATED, compresslevel=9
    ) as target:
        for item in source.infolist():
            target.writestr(item, source.read(item.filename), compress_type=ZIP_DEFLATED, compresslevel=9)
    compressed = output.getvalue()
    return compressed if len(compressed) < len(content) else content


@router.post("/compress")
async def compress_file(file: UploadFile):
    filename = file.filename or "file"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Хоосон файл upload хийх боломжгүй.")

    try:
        extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if file.content_type == "application/pdf" or extension == ".pdf":
            compressed = _compress_pdf(content)
        elif extension in OFFICE_EXTENSIONS:
            compressed = _compress_office_file(content)
        else:
            raise HTTPException(status_code=415, detail="Энэ файлын төрлийг шахах боломжгүй.")
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=422, detail="Файлыг шахаж чадсангүй.") from error

    media_type = "application/pdf" if extension == ".pdf" else file.content_type or "application/octet-stream"
    return StreamingResponse(
        BytesIO(compressed),
        media_type=media_type,
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(filename, safe='')}"},
    )
