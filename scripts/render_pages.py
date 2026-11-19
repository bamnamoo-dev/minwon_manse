"""민원편람 PDF → 페이지 이미지(webp) 변환.

사용법: py scripts/render_pages.py [--width 1200]
출력: public/pages/p{n}.webp  (n = PDF 물리 쪽수, 1부터 시작 = MD의 <!-- PAGE: n --> 와 동일)
편람 PDF 는 data/edition.json 의 pdf. 새 판이 옛 판보다 짧으면 남는 옛 쪽 이미지는 지운다.
"""
import argparse
import json
import pathlib

import fitz  # PyMuPDF  (py -m pip install pymupdf pillow)
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
PDF = ROOT / json.loads((ROOT / "data" / "edition.json").read_text(encoding="utf-8"))["pdf"]
OUT = ROOT / "public" / "pages"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--width", type=int, default=1200)
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)
    for i, page in enumerate(doc, start=1):
        zoom = args.width / page.rect.width
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        img.save(OUT / f"p{i}.webp", "WEBP", quality=80)
    stale = [p for p in OUT.glob("p*.webp") if p.stem[1:].isdigit() and int(p.stem[1:]) > len(doc)]
    for p in stale:
        p.unlink()
    print(f"{len(doc)} pages -> {OUT}" + (f" (옛 쪽 {len(stale)}장 지움)" if stale else ""))


if __name__ == "__main__":
    main()
