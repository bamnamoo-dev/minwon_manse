"""나이스 민원 사용자매뉴얼 PDF → 화면 캡처(크롭) + 번호 표식 위치 + 번호별 설명 추출.

사용법: py scripts/render_neis.py          (npm run render-manuals 에 포함)
읽기: data/manuals/links.json 의 민원별 "neis" 쪽 목록 → 그 쪽들만 추출
출력: data/manuals/neis.json (자동 생성 — 직접 고치지 않는다)
      public/neis/n{쪽}.webp (git 제외, 다시 만들 수 있음)

- 쪽 번호 = 매뉴얼 PDF 물리 쪽수
- 캡처 영역 = 쪽 안의 큰 이미지(가로 1000px 이상)들을 합친 사각형
- 번호 표식 = 캡처 영역 안의 MalgunGothicBold 숫자 글자 위치(캡처 기준 % 좌표)
- 설명 = 본문의 ❶❷… 항목. 다음 쪽으로 이어지면 이어서 읽는다
"""
import json
import pathlib
import re
import sys

import fitz  # PyMuPDF
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
PDF = ROOT / "source" / "2025 나이스 민원 사용자매뉴얼(일반행정-민원).pdf"
OUT = ROOT / "public" / "neis"
LINKS = ROOT / "data" / "manuals" / "links.json"
DATA = ROOT / "data" / "manuals" / "neis.json"
CIRCLED = "❶❷❸❹❺❻❼❽❾❿"
TARGET_WIDTH = 1600


def shot_rect(page: fitz.Page) -> fitz.Rect | None:
    r = None
    for info in page.get_image_info():
        if info["width"] >= 1000:
            b = fitz.Rect(info["bbox"])
            r = b if r is None else r | b
    return r


def markers(page: fitz.Page, rect: fitz.Rect) -> list[dict]:
    found = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for s in line["spans"]:
                t = s["text"].strip()
                if t.isdigit() and "Bold" in s["font"] and fitz.Rect(s["bbox"]).intersects(rect):
                    b = fitz.Rect(s["bbox"])
                    cx, cy = (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2
                    found.append({
                        "n": int(t),
                        "x": round((cx - rect.x0) / rect.width * 100, 2),
                        "y": round((cy - rect.y0) / rect.height * 100, 2),
                    })
    return sorted(found, key=lambda m: m["n"])


def items(text: str) -> list[dict]:
    """본문에서 ❶… 항목을 뽑는다. 하위 줄('- …')은 같은 항목에 붙인다."""
    body = text
    out: list[dict] = []
    for m in re.finditer(rf"([{CIRCLED}])(.*?)(?=[{CIRCLED}]\s|참고사항|$)", body, re.S):
        lines = [re.sub(r"\s+", " ", x).strip() for x in m.group(2).strip().splitlines()]
        lines = [x for x in lines if x]
        if not lines:
            continue
        main, subs, cur = [], [], None
        for x in lines:
            if x.startswith("-"):
                cur = x.lstrip("- ").strip()
                subs.append(cur)
            elif subs:
                subs[-1] += " " + x
            else:
                main.append(x)
        out.append({"n": CIRCLED.index(m.group(1)) + 1, "text": " ".join(main), "subs": subs})
    return out


def meta(text: str) -> dict:
    get = lambda key: (re.search(rf"{key}\s*:\s*(.+)", text) or [None, ""])[1].strip()
    title = ""
    for line in text.splitlines()[3:8]:
        line = line.strip()
        if re.match(r"^(\d+\)|\d+\.)\s*\S", line):
            title = re.sub(r"^(\d+\)|\d+\.)\s*", "", line)
            break
    path = [p.strip() for p in re.split(r"[>〉]", get("메뉴경로")) if p.strip()]
    return {"title": title, "overview": get("메뉴개요"), "menuPath": path}


def body_after_shot(page: fitz.Page, rect: fitz.Rect) -> str:
    clip = fitz.Rect(0, rect.y1, page.rect.width, page.rect.height - 20)
    return page.get_text(clip=clip)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    links = json.loads(LINKS.read_text(encoding="utf-8"))["minwon"]
    pages = sorted({n for v in links.values() for n in v.get("neis", [])})
    OUT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)
    result = []
    for n in pages:
        page = doc[n - 1]
        rect = shot_rect(page)
        if rect is None:
            print(f"p{n}: 캡처 이미지 없음 — 건너뜀")
            continue
        zoom = TARGET_WIDTH / rect.width
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=rect, alpha=False)
        Image.frombytes("RGB", (pix.width, pix.height), pix.samples).save(OUT / f"n{n}.webp", "WEBP", quality=85)

        mk = markers(page, rect)
        its = items(body_after_shot(page, rect))
        # 설명이 다음 쪽으로 이어지는 경우
        if mk and its and its[-1]["n"] < mk[-1]["n"] and n < len(doc):
            nxt = [i for i in items(doc[n].get_text()) if i["n"] > its[-1]["n"]]
            its += nxt
        result.append({
            "page": n,
            **meta(page.get_text()),
            "image": f"neis/n{n}.webp",
            "width": pix.width,
            "height": pix.height,
            "markers": mk,
            "items": its,
        })
        print(f"p{n}: 표식 {len(mk)}개, 설명 {len(its)}개, {pix.width}x{pix.height}")
    DATA.write_text(json.dumps({"source": PDF.name, "pages": result}, ensure_ascii=False, indent=1) + chr(10), encoding="utf-8")
    print(f"-> {DATA.relative_to(ROOT)} ({len(result)}쪽)")


if __name__ == "__main__":
    main()
