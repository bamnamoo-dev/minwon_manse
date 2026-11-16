"""학교증명발급시스템 사용자 매뉴얼 PDF → 단계별 설명 + 화면 캡처 추출.

사용법: py scripts/render_certsys.py [민원ID ...]   (기본: M02 M07 — 이 절차를 보여줄 민원. 시안용)
출력: public/certsys/c{쪽}_{순번}.webp, public/certsys/flow.json   (git 제외, 다시 만들 수 있음)

- 범위: 「1. 증명서 발급방법(졸업증명서, 생활기록부)」 ~ 다음 큰 제목(「2. …」) 직전
- 단계 = '가.' '나.' … 소제목. 그 아래 글 줄과 캡처를 읽는 순서대로 붙인다
- 캡처 = 가로 300px·세로 150px 이상 이미지. 맞닿거나 겹치는 이미지는 한 장으로 합친다
- 쪽 = PDF 물리 쪽수(page), 매뉴얼 인쇄 쪽수(printed, 쪽 아래 '- n -')
※ 지금은 디자인 시안용. 실제 기능에서는 스키마를 정하고 검수 절차를 거친다.
"""
import json
import pathlib
import re
import sys

import fitz  # PyMuPDF
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
PDF = ROOT / "source" / "학교증명발급시스템+사용자+매뉴얼(최종).pdf"
OUT = ROOT / "public" / "certsys"
START = re.compile(r"^1\.\s*증명서 발급방법")
STOP = re.compile(r"^\d+\.\s*증명서 발급방법")
STEP = re.compile(r"^([가-하])\.\s*(.+)$")
BULLET = re.compile(r"^(-|※|□|예\)|[①-⑳](?!번)|▶)")  # "①번 이미지"는 앞 줄에 이어지는 말
TARGET_WIDTH = 1400


def shots(page: fitz.Page) -> list[fitz.Rect]:
    rects = [fitz.Rect(i["bbox"]) for i in page.get_image_info() if i["width"] >= 300 and i["height"] >= 150]
    merged: list[fitz.Rect] = []
    for r in sorted(rects, key=lambda r: (r.y0, r.x0)):
        for i, m in enumerate(merged):
            if (m + (-12, -12, 12, 12)).intersects(r):
                merged[i] = m | r
                break
        else:
            merged.append(r)
    return merged


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    OUT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)
    steps: list[dict] = []
    title = ""
    started = False
    before_start: list = []  # 시작 제목과 같은 쪽, 제목보다 위에 있는 캡처 → 첫 단계에 붙인다

    for pno in range(len(doc)):
        page = doc[pno]
        footer = re.search(r"^-\s*(\d+)\s*-$", page.get_text(), re.M)
        printed = int(footer.group(1)) if footer else None
        elems = []
        for b in page.get_text("blocks"):
            t = re.sub(r"\s*\n\s*", " ", b[4]).strip()
            if t and not re.fullmatch(r"-\s*\d+\s*-", t) and "···" not in t:  # 쪽 번호·목차 줄 제외
                elems.append((b[1], "text", t))
        for k, r in enumerate(shots(page)):
            elems.append((r.y0, "img", (k, r)))

        for _, kind, val in sorted(elems, key=lambda e: e[0]):
            if kind == "text":
                if not started:
                    if START.match(val):
                        started, title = True, val
                    continue
                if STOP.match(val):
                    started = False
                    break
                m = STEP.match(val)
                if m:
                    steps.append({"title": m.group(2).strip(), "lines": [], "shots": before_start, "pages": [pno + 1], "printed": [printed]})
                    before_start = []
                elif steps:
                    if BULLET.match(val) or not steps[-1]["lines"]:
                        steps[-1]["lines"].append(val)
                    else:
                        steps[-1]["lines"][-1] += " " + val
            elif kind == "img" and (started and steps or not started and not title):
                k, r = val
                zoom = TARGET_WIDTH / page.rect.width * (page.rect.width / r.width) ** 0.5
                pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=r, alpha=False)
                name = f"c{pno + 1}_{k}.webp"
                Image.frombytes("RGB", (pix.width, pix.height), pix.samples).save(OUT / name, "WEBP", quality=85)
                shot = {"image": f"certsys/{name}", "width": pix.width, "height": pix.height}
                if started:
                    steps[-1]["shots"].append(shot)
                else:
                    before_start = [shot]  # 같은 쪽에서 시작 제목 바로 앞의 캡처만 남긴다
            if started and steps and pno + 1 not in steps[-1]["pages"]:
                steps[-1]["pages"].append(pno + 1)
                steps[-1]["printed"].append(printed)
        if title and not started:
            break
        before_start = [] if not started else before_start

    data = {"source": PDF.name, "title": title, "links": sys.argv[1:] or ["M02", "M07"], "steps": steps}
    (OUT / "flow.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    for i, s in enumerate(steps, 1):
        print(f"{i}. {s['title']} — 줄 {len(s['lines'])}, 캡처 {len(s['shots'])}, PDF {s['pages']} (인쇄 {s['printed']})")


if __name__ == "__main__":
    main()
