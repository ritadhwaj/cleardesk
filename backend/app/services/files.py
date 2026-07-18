"""File utilities: page preparation, PDF rendering, evidence crops."""
from pathlib import Path

from PIL import Image

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def prepare_pages(file_path: str, out_dir: str) -> list[str]:
    """Return a list of page-image paths for any upload.
    Images pass through; PDFs are rendered per page (via pymupdf)."""
    path = Path(file_path)
    ext = path.suffix.lower()
    if ext in IMAGE_EXTS:
        return [str(path)]
    if ext == ".pdf":
        try:
            import fitz  # pymupdf
        except ImportError:
            return []
        out = Path(out_dir)
        out.mkdir(parents=True, exist_ok=True)
        pages = []
        doc = fitz.open(file_path)
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=150)
            p = out / f"{path.stem}_p{i + 1}.png"
            pix.save(str(p))
            pages.append(str(p))
        doc.close()
        return pages
    return []


def crop_evidence(image_path: str, bbox: list | None, out_path: str) -> str | None:
    """Crop a field's bounding box from a page image — the visible evidence
    shown in the review UI. LLM bboxes can be junk, so clamp and validate;
    fall back to None (UI then shows the full page)."""
    if not bbox or len(bbox) != 4:
        return None
    try:
        img = Image.open(image_path)
        w, h = img.size
        x1, y1, x2, y2 = (max(0, int(bbox[0])), max(0, int(bbox[1])),
                          min(w, int(bbox[2])), min(h, int(bbox[3])))
        if x2 - x1 < 10 or y2 - y1 < 5:
            return None
        # pad a little context around the value
        pad = 12
        box = (max(0, x1 - pad), max(0, y1 - pad), min(w, x2 + pad), min(h, y2 + pad))
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        img.crop(box).save(out_path)
        return out_path
    except Exception:
        return None
