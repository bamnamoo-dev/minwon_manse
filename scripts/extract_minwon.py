"""민원편람.md → data/minwon/*.json (민원 96건) + data/guides/*.json (업무안내 문서)

사용법: py scripts/extract_minwon.py
- 자동 추출 결과는 "초안"이다. reviewed=false 로 저장되며 사람이 PDF와 대조해 검수한다.
- 이미 reviewed=true 인 파일은 덮어쓰지 않는다(검수 결과 보호). 강제 재생성: --force
- 파싱 실패 필드는 docs/extract_report.md 에 기록된다.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
from datetime import date

ROOT = pathlib.Path(__file__).resolve().parent.parent
MD = ROOT / "source" / "민원편람.md"
OUT_MINWON = ROOT / "data" / "minwon"
OUT_GUIDES = ROOT / "data" / "guides"
REPORT = ROOT / "docs" / "extract_report.md"
RULES = ROOT / "data" / "rules" / "issuance_years.json"


def load_rule_map() -> dict[str, list[str]]:
    """연도표 규칙(수작업) → 민원ID별 규칙ID 목록"""
    if not RULES.exists():
        return {}
    m: dict[str, list[str]] = {}
    for rid, r in json.loads(RULES.read_text(encoding="utf-8"))["rules"].items():
        for mid in r.get("minwonIds", []):
            m.setdefault(mid, []).append(rid)
    return m


RULE_MAP = load_rule_map()

PAGE_RE = re.compile(r"<!--\s*PAGE:\s*(\d+)\s*-->")
ENTRY_RE = re.compile(r"^(?:#+\s*)?(\d{1,2})\)\s*(.+?)\s*$")

# 번호 범위 → 분류 (편람 V장 목차 기준)
CATEGORIES = [
    (1, 14, "학생"), (15, 28, "교직원"), (29, 40, "검정고시"), (41, 47, "유치원"),
    (48, 61, "법인"), (62, 73, "학원"), (74, 81, "교습소·교습자"), (82, 87, "평생교육"),
    (88, 90, "대안교육기관"), (91, 95, "기타"), (96, 96, "외국어(영문) 발급"),
]

# 표 라벨(공백 제거 후) → 필드명
LABELS = {
    "사무내용": "summary", "민원내용": "summary", "법정처리기간": "period", "접수처": "receivers", "수수료": "fee", "신청방법": "methods",
    "구비서류": "documents", "처리과": "dept", "공부대조": "ledger", "최종결재": "approval",
    "처리기간": "period", "관련근거": "laws", "처리과정": "process", "참고사항": "notes",
}
GROUP_LABELS = {"민원인", "행정기관"}


def norm_label(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "", s)
    s = re.sub(r"\(.*?\)", "", s)  # 처리과(협조기관) → 처리과
    s = re.sub(r"[\s*_·]", "", s)
    if s.startswith("구비서류"):  # 구비서류 담당공무원확인 민원인제출생략
        return "구비서류"
    return s


def clean(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = s.replace("&nbsp;", " ")
    s = re.sub(r"\$\\rightarrow\$", "→", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"[ \t]+", " ", s)
    return "\n".join(line.strip() for line in s.split("\n")).strip()


def category_of(no: int) -> str:
    for a, b, name in CATEGORIES:
        if a <= no <= b:
            return name
    return "기타"


def split_cells(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


def is_sep_row(cells: list[str]) -> bool:
    return all(re.fullmatch(r":?-{2,}:?", c) or c == "" for c in cells)


def load_lines() -> tuple[list[str], list[int]]:
    lines = MD.read_text(encoding="utf-8").splitlines()
    pages, cur = [], 1
    for ln in lines:
        m = PAGE_RE.search(ln)
        if m:
            cur = int(m.group(1))
        pages.append(cur)
    return lines, pages


def find_entries(lines: list[str]) -> list[tuple[int, int, str]]:
    """(시작줄, 번호, 제목) — 목차(점선 포함) 제외, 1→96 순서로만 채택."""
    start_ch5 = next(i for i, l in enumerate(lines) if l.strip() == "# CHAPTER V")
    found, expect = [], 1
    for i in range(start_ch5, len(lines)):
        l = lines[i].strip()
        if "···" in l or "…" in l or "...." in l:
            continue
        m = ENTRY_RE.match(l)
        if m and int(m.group(1)) == expect:
            found.append((i, expect, m.group(2).strip()))
            expect += 1
            if expect > 96:
                break
    return found


def parse_list(text: str, seps=r"[,，、\n]") -> list[str]:
    return [x.strip(" -•○") for x in re.split(seps, text) if x.strip(" -•○")]


def parse_documents(text: str) -> list[str]:
    parts = re.split(r"\n|(?=\b\d{1,2}[.)]\s)|(?=[①-⑳])", text)
    out = []
    for p in parts:
        p = re.sub(r"^(\d{1,2}[.)]|[①-⑳]|[-•○])\s*", "", p.strip())
        if p:
            out.append(p)
    return out


def parse_process(text: str) -> list[dict]:
    chunks = [c.strip() for c in re.split(r"○", text) if c.strip()]
    if not chunks:
        return []
    res = []
    for c in chunks:
        c = c.replace("\n", " ")
        m = re.match(r"^([^:：→]{1,20})[:：]\s*(.+)$", c)
        channel, body = (m.group(1).strip(), m.group(2)) if m else ("", c)
        steps = [s.strip() for s in re.split(r"→|->|⇒", body) if s.strip()]
        res.append({"channel": channel, "steps": steps})
    return res


def parse_notes(text: str) -> tuple[list[str], list[str]]:
    """참고사항 → (notes, 붙임 서식명 목록)"""
    notes, attach = [], []
    for raw in re.split(r"\n|(?=○)", text):
        s = raw.strip().lstrip("○").strip()
        if not s:
            continue
        m = re.search(r"붙임\s*[:：]?\s*(.+)", s)
        if m:
            for f in re.split(r"[,，]", m.group(1)):
                f = re.sub(r"\s*\d+\s*부\.?\s*$", "", f.strip()).strip(" .")
                if f:
                    attach.append(f)
            continue
        notes.append(s.lstrip("※ ").strip() if s.startswith("※") else s)
    return notes, attach


def extract_fields(block: list[str]) -> tuple[dict, int]:
    """블록 안의 표에서 라벨-값 추출. (fields, 마지막 라벨이 나온 줄 인덱스)"""
    fields: dict[str, str] = {}
    last_idx = -1
    for idx, line in enumerate(block):
        if not line.strip().startswith("|"):
            continue
        cells = split_cells(line)
        if is_sep_row(cells):
            continue
        j = 0
        while j < len(cells):
            lab = norm_label(cells[j])
            if lab in GROUP_LABELS:
                j += 1
                continue
            key = LABELS.get(lab)
            if key and key not in fields:
                val = cells[j + 1] if j + 1 < len(cells) else ""
                if norm_label(val) in LABELS:  # 값 칸이 비고 바로 다음 라벨
                    val = ""
                    j += 1
                else:
                    j += 2
                fields[key] = clean(val)
                last_idx = idx
                continue
            j += 1
    return fields, last_idx


def build_entry(no: int, title: str, block: list[str], pages: list[int], issues: list[str]) -> dict:
    f, last_idx = extract_fields(block)
    missing = [k for k in ("summary", "receivers", "fee", "methods", "documents", "period", "process") if not f.get(k)]
    if missing:
        issues.append(f"| {no} | {title} | 누락: {', '.join(missing)} |")

    notes, attach = parse_notes(f.get("notes", ""))
    src_pages = sorted(set(pages))
    main_last_page = pages[last_idx] if last_idx >= 0 else src_pages[0]
    form_pages = [p for p in src_pages if p > main_last_page]

    docs_text = f.get("documents", "")
    entry = {
        "id": f"M{no:02d}",
        "no": no,
        "title": title,
        "category": category_of(no),
        "aliases": [],
        "summary": f.get("summary", ""),
        "receivers": parse_list(f.get("receivers", "")),
        "fee": f.get("fee", ""),
        "methods": parse_list(f.get("methods", "")),
        "documents": parse_documents(docs_text),
        "dept": f.get("dept", ""),
        "ledger": f.get("ledger", ""),
        "approval": f.get("approval", ""),
        "period": f.get("period", ""),
        "laws": parse_list(f.get("laws", ""), r"\n"),
        "process": parse_process(f.get("process", "")),
        "notes": notes,
        "guideScript": "",
        "yearRuleIds": RULE_MAP.get(f"M{no:02d}", []),
        "forms": [{"name": n, "pdfPages": form_pages, "hwp": None} for n in attach]
                 or ([{"name": f"{title} 관련 서식", "pdfPages": form_pages, "hwp": None}] if form_pages else []),
        "sourcePages": src_pages,
        "rawMarkdown": "\n".join(block).strip(),
        "reviewed": False,
        "updatedAt": date.today().isoformat(),
    }
    if re.search(r"(참고사항|신청서|본문)\s*구비서류와\s*같음", docs_text):
        entry["_todo"] = "구비서류가 신청서/참고사항에 따로 있음 → rawMarkdown 보고 documents 채우기"
    return entry


# ---------------- 업무안내(II·III·IV·VI장) ----------------
GUIDE_HEAD_RE = re.compile(r"^#{1,2}\s*(0[1-9]|[12][0-9])\.?\s+(.+?)\s*$")


def extract_guides(lines: list[str], pages: list[int]) -> list[dict]:
    def idx_of(pred, start=0):
        return next(i for i in range(start, len(lines)) if pred(lines[i].strip()))

    ch2 = idx_of(lambda l: l == "# CHAPTER II")
    ch4 = idx_of(lambda l: l.startswith("# 01 교원자격 무시험검정"))
    ch5 = idx_of(lambda l: l == "# CHAPTER V")
    ch6 = idx_of(lambda l: l == "# CHAPTER VI")

    # IV장 제목은 목차에서 가져와 본문에서 찾는다(헤딩 표기가 제각각이라)
    toc4 = []
    for l in lines[:120]:
        m = re.match(r"^(\d{1,2})\.\s*(.+?에 관한 사항)", l.strip())
        if m:
            toc4.append((int(m.group(1)), m.group(2)))

    def key(s: str) -> str:
        return re.sub(r"[\s·ㆍ•*#|0-9]", "", s)

    starts: list[tuple[int, str, str]] = []  # (line, chapter, title)
    for i in range(ch2, ch4):
        m = GUIDE_HEAD_RE.match(lines[i].strip())
        if m:
            chap = "II. 민원처리 일반" if i < idx_of(lambda l: l == "# III", ch2) else "III. 민원신청 안내"
            starts.append((i, chap, m.group(2).strip()))
    pos = ch4
    for n, t in toc4:
        k = key(t)
        for i in range(pos, ch5):
            if k and k == key(lines[i])[-len(k):] and len(key(lines[i])) <= len(k) + 4:
                starts.append((i, "IV. 주요 민원처리 업무 안내", t))
                pos = i + 1
                break
    for i in range(ch6, len(lines)):
        m = GUIDE_HEAD_RE.match(lines[i].strip())
        if m:
            starts.append((i, "VI. 기타", m.group(2).strip()))

    starts.sort()
    bounds = [s[0] for s in starts] + [len(lines)]
    # IV장 마지막 항목은 V장 시작 전에서 끊는다
    guides = []
    for k, (i, chap, title) in enumerate(starts):
        end = bounds[k + 1]
        if i < ch5 <= end:
            end = ch5
        if i < ch4 <= end:
            end = ch4
        block = lines[i:end]
        guides.append({
            "id": f"G{k + 1:02d}",
            "chapter": chap,
            "title": re.sub(r"\s+", " ", title),
            "sourcePages": sorted(set(pages[i:end])),
            "markdown": "\n".join(block).strip(),
            "reviewed": False,
        })
    return guides


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="reviewed=true 파일도 덮어씀")
    args = ap.parse_args()

    lines, pages = load_lines()
    entries = find_entries(lines)
    ch6 = next(i for i, l in enumerate(lines) if l.strip() == "# CHAPTER VI")
    issues: list[str] = []
    OUT_MINWON.mkdir(parents=True, exist_ok=True)
    OUT_GUIDES.mkdir(parents=True, exist_ok=True)

    written = skipped = 0
    for k, (start, no, title) in enumerate(entries):
        end = entries[k + 1][0] if k + 1 < len(entries) else ch6
        e = build_entry(no, title, lines[start:end], pages[start:end], issues)
        path = OUT_MINWON / f"{e['id']}.json"
        if path.exists() and not args.force:
            old = json.loads(path.read_text(encoding="utf-8"))
            if old.get("reviewed"):
                skipped += 1
                continue
        path.write_text(json.dumps(e, ensure_ascii=False, indent=2), encoding="utf-8")
        written += 1

    guides = extract_guides(lines, pages)
    for g in guides:
        (OUT_GUIDES / f"{g['id']}.json").write_text(json.dumps(g, ensure_ascii=False, indent=2), encoding="utf-8")

    todo = []
    for p in sorted(OUT_MINWON.glob("M*.json")):
        e = json.loads(p.read_text(encoding="utf-8"))
        flags = [x for x in ("_todo",) if x in e]
        if flags:
            todo.append(f"| {e['no']} | {e['title']} | {'; '.join(e[x] for x in flags)} |")

    REPORT.write_text(
        "# 추출 리포트\n\n"
        f"- 생성일: {date.today().isoformat()}\n"
        f"- 민원: {len(entries)}건 발견 / {written}건 저장 / {skipped}건 검수완료라 건너뜀\n"
        f"- 업무안내 문서: {len(guides)}건\n\n"
        "## 필수 필드 누락 (자동 파싱 실패 → rawMarkdown 보고 직접 채우기)\n\n"
        "| 번호 | 민원 | 내용 |\n|---|---|---|\n" + ("\n".join(issues) or "| - | 없음 | |") +
        "\n\n## 추가 확인 필요\n\n| 번호 | 민원 | 내용 |\n|---|---|---|\n" + ("\n".join(todo) or "| - | 없음 | |") +
        "\n\n## 업무안내 문서 목록\n\n" + "\n".join(f"- {g['id']} [{g['chapter']}] {g['title']} (p.{g['sourcePages'][0]}~{g['sourcePages'][-1]})" for g in guides) + "\n",
        encoding="utf-8",
    )
    print(f"민원 {len(entries)}건 (저장 {written}, 보호 {skipped}), 업무안내 {len(guides)}건, 누락 {len(issues)}건")
    print(f"리포트: {REPORT}")


if __name__ == "__main__":
    main()
