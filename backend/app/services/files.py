"""File utilities: PDF page rendering, splitting, evidence crops."""
from pathlib import Path

from pypdf import PdfReader
from PIL import Image


def page_count(pdf_path: str) -> int:
    return len(PdfReader(pdf_path).pages)


def render_pages_to_images(pdf_path: str, out_dir: str) -> list[str]:
    """Render each PDF page to a PNG for the vision LLM.

    TODO: implement with pdf2image (poppler) or pymupdf.
    Returns list of image paths, one per page.
    """
    raise NotImplementedError


def crop_evidence(image_path: str, bbox: tuple[int, int, int, int], out_path: str) -> str:
    """Crop a field's bounding box from a page image — shown in the review UI
    so every extracted value has visible evidence."""
    img = Image.open(image_path)
    img.crop(bbox).save(out_path)
    return out_path
