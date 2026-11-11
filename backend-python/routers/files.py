from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

import pymupdf
from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from urllib.parse import quote


router = APIRouter(prefix="/api/files", tags=["Files"])
OFFICE_EXTENSIONS = {".docx", ".xlsx", ".pptx"}


@router.post("/compress")
async def compress_file(file: UploadFile):
    filename = file.filename or "file"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Хоосон файл upload хийх боломжгүй.")

    try:
        extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if file.content_type == "application/pdf" or extension == ".pdf":
            source = pymupdf.open(stream=content, filetype="pdf")
            output = BytesIO()
            source.save(output, garbage=0, deflate=True, clean=False)
            source.close()
        elif extension in OFFICE_EXTENSIONS:
            output = BytesIO()
            with ZipFile(BytesIO(content)) as source, ZipFile(output, "w", ZIP_DEFLATED, compresslevel=9) as target:
                for item in source.infolist():
                    target.writestr(item, source.read(item.filename))
            if output.tell() >= len(content):
                output = BytesIO(content)
        else:
            raise HTTPException(status_code=415, detail="Энэ файлын төрлийг шахах боломжгүй.")
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=422, detail="Файлыг шахаж чадсангүй.") from error

    output.seek(0)
    media_type = "application/pdf" if extension == ".pdf" else file.content_type or "application/octet-stream"
    return StreamingResponse(
        output,
        media_type=media_type,
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(filename, safe='')}"},
    )
