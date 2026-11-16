"""민원편람.md (+PDF 보조) → data/minwon/*.json (민원 96건) + data/guides/*.json (업무안내)

사용법: py scripts/extract_minwon.py [--force]
- 자동 추출 결과는 "초안"이다(reviewed=false). 사람이 PDF와 대조해 검수한다.
- 덮어쓰기 보호: 아래 파일은 다시 돌려도 건드리지 않는다(--force 시에만 덮어씀)
    1) reviewed=true 인 파일
    2) 사람이 손으로 고친 파일 (저장 당시 지문 _genHash 와 현재 내용이 다르면 '수정됨'으로 판단)
- MD 변환에서 내용이 통째로 빠진 쪽은 PDF 텍스트로 보충한다(pdfTextPages 에 기록).
- 결과 요약: docs/extract_report.md
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
from datetime import date

import fitz  # PyMuPDF

ROOT = pathlib.Path(__file__).resolve().parent.parent
MD = ROOT / "source" / "민원편람.md"
PDF = ROOT / "source" / "민원편람.pdf"
OUT_MINWON = ROOT / "data" / "minwon"
OUT_GUIDES = ROOT / "data" / "guides"
REPORT = ROOT / "docs" / "extract_report.md"
RULES = ROOT / "data" / "rules" / "issuance_years.json"

PAGE_RE = re.compile(r"<!--\s*PAGE:\s*(\d+)\s*-->")
ENTRY_RE = re.compile(r"^(?:#+\s*)?(\d{1,2})\)\s*(.+?)\s*$")
FOOTER_RE = re.compile(r"^(\d{1,3}|서울특별시교육청|■*\s*민\s*원\s*편\s*람|http://www\.sen\.go\.kr.*|[IVX]+\.\s*.{0,30})$")
TOC_RE = re.compile(r"(···|…|\.{4,})\s*\d+\s*$")

CATEGORIES = [
    (1, 14, "학생"), (15, 28, "교직원"), (29, 40, "검정고시"), (41, 47, "유치원"),
    (48, 61, "법인"), (62, 73, "학원"), (74, 81, "교습소·교습자"), (82, 87, "평생교육"),
    (88, 90, "대안교육기관"), (91, 95, "기타"), (96, 96, "외국어(영문) 발급"),
]

LABELS = {
    "사무내용": "summary", "민원내용": "summary", "접수처": "receivers", "수수료": "fee",
    "신청방법": "methods", "구비서류": "documents", "처리과": "dept", "공부대조": "ledger",
    "최종결재": "approval", "처리기간": "period", "법정처리기간": "period",
    "관련근거": "laws", "처리과정": "process", "참고사항": "notes",
}
GROUP_LABELS = {"민원인", "행정기관"}
BULLET_RE = re.compile(r"^(○|o\s|ㅇ\s|※|-|•|·|▪|■|□|\d{1,2}[.)]|[가-하][.)]|[①-⑳]|\(\d{1,2}\))")


# ---------------- 공통 유틸 ----------------
def norm_label(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "", s)
    s = re.sub(r"\(.*?\)", "", s)  # 처리과(협조기관) → 처리과
    s = re.sub(r"[\s*_·]", "", s)
    if s.startswith("구비서류"):  # 구비서류<br>담당공무원확인<br>민원인제출생략
        return "구비서류"
    return s


def compact(s: str) -> str:
    """비교용: 공백·기호 제거"""
    return re.sub(r"[\s·ㆍ•*#|()\[\]「」『』<>.,:;'\"`_\-]", "", s)


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


def gen_hash(obj: dict) -> str:
    body = {k: v for k, v in obj.items() if k != "_genHash"}
    return hashlib.sha1(json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:16]


def load_rule_map() -> dict[str, list[str]]:
    if not RULES.exists():
        return {}
    m: dict[str, list[str]] = {}
    for rid, r in json.loads(RULES.read_text(encoding="utf-8"))["rules"].items():
        for mid in r.get("minwonIds", []):
            m.setdefault(mid, []).append(rid)
    return m


RULE_MAP = load_rule_map()


# ---------------- 쪽(페이지) 단위 텍스트 ----------------
class Pages:
    """쪽 번호 → 텍스트. MD에 내용이 없으면 PDF 텍스트로 보충."""

    def __init__(self, lines: list[str], line_pages: list[int]):
        self.md: dict[int, list[str]] = {}
        for ln, p in zip(lines, line_pages):
            if PAGE_RE.search(ln) or "PAGE BREAK" in ln:
                continue
            self.md.setdefault(p, []).append(ln)
        self.doc = fitz.open(PDF)
        self.fallback: set[int] = set()

    def text(self, p: int) -> str:
        t = "\n".join(self.md.get(p, [])).strip()
        if len(t) >= 15:
            return t
        pt = self.doc[p - 1].get_text() if 1 <= p <= len(self.doc) else ""
        pt = "\n".join(l for l in pt.splitlines() if l.strip() and not FOOTER_RE.match(l.strip())).strip()
        if len(pt) >= 15:
            self.fallback.add(p)
            return pt
        return t

    def is_blank(self, p: int) -> bool:
        return len(self.text(p)) < 15

    def is_toc(self, p: int) -> bool:
        """분류 표지·목차 쪽 (점선+쪽번호 줄이 2개 이상)"""
        return sum(1 for l in self.text(p).splitlines() if TOC_RE.search(l)) >= 2


# ---------------- 민원 블록 ----------------
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
    """(시작줄, 번호, 제목) — 목차(점선) 제외, 1→96 순서로만 채택."""
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
    # 줄바꿈이 있으면 줄 단위로만 나눈다(줄 안의 "2021. 8. 9." 같은 날짜를 번호로 오인하지 않도록)
    inline = r"|(?<![\d.])(?=\b\d{1,2}[.)]\s)" if "\n" not in text else ""
    parts = re.split(r"\n|(?=[①-⑳])" + inline, text)
    numbered = sum(1 for p in parts if re.match(r"^\s*(\d{1,2}[.)]|[①-⑳])", p)) >= 2
    out = []
    for p in parts:
        is_item = bool(re.match(r"^\s*(\d{1,2}[.)]|[①-⑳]|[-•○])", p))
        p = re.sub(r"^(\d{1,2}[.)]|[①-⑳]|[-•○])\s*", "", p.strip())
        if re.match(r"^삭제\s*<[^>]*>\s*\.?$", p):  # 법령상 삭제된 항목
            continue
        if p:
            # 하위 항목(가.) 또는 번호 목록 안에서 번호 없이 이어지는 줄은 앞 항목에 붙임
            if out and (re.match(r"^[가-하][.)]\s", p) or (numbered and not is_item)):
                out[-1] += " " + p
            else:
                out.append(p)
    return out


def parse_process(text: str) -> list[dict]:
    chunks = [c.strip() for c in re.split(r"○", text) if c.strip()]
    res = []
    for c in chunks:
        c = c.replace("\n", " ")
        m = re.match(r"^([^:：→]{1,20})[:：]\s*(.+)$", c)
        channel, body = (m.group(1).strip(), m.group(2)) if m else ("", c)
        steps = [s.strip() for s in re.split(r"→|->|⇒", body) if s.strip()]
        res.append({"channel": channel, "steps": steps})
    return res


def merge_wrapped(lines: list[str]) -> list[str]:
    """글머리표가 없는 줄은 앞 항목의 이어지는 문장으로 합친다."""
    out: list[str] = []
    for raw in lines:
        s = raw.strip()
        if not s:
            continue
        if out and not BULLET_RE.match(s):
            out[-1] += " " + s
        else:
            out.append(s)
    return out


def split_outside_parens(text: str) -> list[str]:
    out, depth, cur = [], 0, ""
    for ch in text:
        if ch in "(（":
            depth += 1
        elif ch in ")）":
            depth = max(0, depth - 1)
        if ch in ",，" and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return [x for x in out if x.strip()]


def parse_notes(text: str) -> tuple[list[str], list[str]]:
    """참고사항 → (notes, 붙임 서식명 목록)"""
    notes, attach = [], []
    for s in merge_wrapped(re.split(r"\n|(?=○)", text)):
        m = re.search(r"붙임\s*\d*\s*[:：.]?\s*(.+)", s)
        if m:
            body = re.sub(r"붙임\s*\d+\s*[.:：]", ",", m.group(1))
            body = re.sub(r"^\s*\d+\.\s*", "", body)
            for f in split_outside_parens(body):
                f = re.sub(r"\s*각?\s*\d+\s*부.*$", "", f.strip())
                f = re.sub(r"^\d+\.\s*", "", f).strip(" .")
                if f:
                    attach.append(f)
            continue
        s = re.sub(r"^(○|o\s|ㅇ\s)\s*", "", s)
        notes.append(s.lstrip("※ ").strip() if s.startswith("※") else s)
    return notes, attach


def extract_fields(block: list[str]) -> tuple[dict, int, list[str]]:
    """요약표 라벨-값 추출. (fields, 마지막 라벨 줄 인덱스, 담당공무원 확인사항)"""
    fields: dict[str, str] = {}
    officer: list[str] = []
    last_idx = -1
    for idx, line in enumerate(block):
        if not line.strip().startswith("|"):
            continue
        cells = split_cells(line)
        if is_sep_row(cells):
            continue
        j = 0
        while j < len(cells):
            raw_lab = re.sub(r"[\s*_·]|<br\s*/?>", "", cells[j])
            if raw_lab.startswith("담당공무원확인") and "구비서류" not in raw_lab and j + 1 < len(cells) and last_idx >= 0 and "notes" not in fields:
                officer += parse_documents(clean(cells[j + 1]))
                j += 2
                continue
            lab = norm_label(cells[j])
            if lab in GROUP_LABELS:
                j += 1
                continue
            key = LABELS.get(lab)
            if key and key not in fields:
                val = cells[j + 1] if j + 1 < len(cells) else ""
                if norm_label(val) in LABELS:
                    val = ""
                    j += 1
                else:
                    j += 2
                fields[key] = clean(val)
                last_idx = idx
                continue
            j += 1
    return fields, last_idx, officer


SUBMIT_LABELS = ("제출서류", "신청인제출서류", "구비서류", "첨부서류")


def find_submit_documents(block: list[str], start: int) -> tuple[list[str], list[str]]:
    """요약표 이후(신청서 서식·참고 본문)에서 제출서류·담당공무원 확인사항을 찾는다."""
    docs: list[str] = []
    officer: list[str] = []
    for line in block[start:]:
        if not line.strip().startswith("|"):
            continue
        cells = split_cells(line)
        for j, c in enumerate(cells[:-1]):
            lab = re.sub(r"\(.*?\)", "", re.sub(r"[\s*_·]|<br\s*/?>", "", c))  # 신청인(설립자)제출서류 → 신청인제출서류
            val = clean(cells[j + 1])
            if (not docs and lab.endswith(SUBMIT_LABELS) and len(lab) <= 10 and len(val) >= 6
                    and not re.search(r"같음|참조|^수수료", val)
                    and not re.fullmatch(r".{0,12}(확인사항|제출서류|구비서류|첨부서류)", val.replace("\n", ""))):
                docs = parse_documents(val)
            elif not officer and lab.startswith("담당공무원") and val:
                officer = parse_documents(val)
    if not docs:  # 표가 아닌 "구 비 서 류" 제목 + 번호 목록
        for i in range(start, len(block)):
            if compact(block[i]) in ("구비서류", "제출서류", "2구비서류") or re.fullmatch(r"#*\s*\d?\.?\s*구\s*비\s*서\s*류", block[i].strip("#※ ").strip()):
                items = []
                for l in block[i + 1:]:
                    s = l.strip()
                    if not s:  # 빈 줄 뒤에도 번호가 이어질 수 있어 계속 본다
                        continue
                    item_re = r"^(\d{1,2}[.)]|[가-하][.)]|[①-⑳]|[*•▪-])\s*"
                    if re.match(item_re, s):
                        items.append(re.sub(item_re, "", s))
                    elif items:
                        break
                if items:
                    docs = items
                    break
    return docs, officer


def split_forms(no: int, attach: list[str], cand: list[int], P: Pages) -> tuple[list[dict], list[int]]:
    """후보 쪽들을 서식별로 나눈다. (forms, 서식 앞에 있는 참고 안내 쪽)"""
    if not cand:
        return ([{"name": n, "pdfPages": [], "hwp": None} for n in attach], [])

    # 1) "(n) 제목" 으로 시작하는 쪽 = 서식 시작 (영문 발급 등)
    numbered: list[tuple[int, str]] = []
    for p in cand:
        head = [l.strip().lstrip("#").strip() for l in P.text(p).splitlines() if l.strip()][:3]
        for h in head:
            m = re.match(r"^\((\d{1,2})\)\s*(.{2,40})$", h)
            if m and not TOC_RE.search(h):
                numbered.append((p, f"({m.group(1)}) {m.group(2).strip()}"))
                break
            if re.search(r"(표기법|Subjects and Extracurricular)", h):
                numbered.append((p, f"[참고] {h}"))
                break
    starts: list[tuple[int, str]] = []
    if len(numbered) >= 2:
        starts = numbered
    else:
        # 2) 붙임 서식명이 쪽 앞부분에 나오는 곳 = 서식 시작
        for name in attach:
            core = compact(re.sub(r"(서식|양식)$", "", name).strip())
            for p in cand:
                if p in [s[0] for s in starts]:
                    continue
                head = compact("".join(P.text(p).splitlines()[:12]))
                if core and core[:12] in head:
                    starts.append((p, name))
                    break
        starts.sort()
        matched = {n for _, n in starts}
        for name in attach:  # 못 찾은 서식은 시작점 없이 남김
            if name not in matched:
                starts.append((-1, name))

    real = sorted([s for s in starts if s[0] > 0])
    forms: list[dict] = []
    for k, (p0, name) in enumerate(real):
        p1 = real[k + 1][0] if k + 1 < len(real) else cand[-1] + 1
        forms.append({"name": name, "pdfPages": [p for p in cand if p0 <= p < p1], "hwp": None})
    unmatched = [n for p, n in starts if p < 0]
    info_pages = [p for p in cand if not real or p < real[0][0]]
    # 붙임 순서상 첫 매칭 서식보다 앞선 미매칭 서식 → 그 앞쪽 페이지를 배정 (공문 서식은 제목이 쪽 중간에 있음)
    if real and unmatched and info_pages:
        first_idx = min(attach.index(n) for _, n in real if n in attach)
        before = [n for n in unmatched if attach.index(n) < first_idx]
        if before:
            forms.insert(0, {"name": before[0], "pdfPages": info_pages, "hwp": None})
            unmatched.remove(before[0])
            info_pages = []
    if unmatched:
        # 위치를 못 찾은 서식: 참고 안내 쪽이 아닌 남은 쪽 전체를 후보로 표시
        rest = [p for p in cand if p not in info_pages] or cand
        forms += [{"name": n, "pdfPages": rest if not real else [], "hwp": None} for n in unmatched]
        if not real:
            info_pages = []
    if not attach and not real:
        forms = [{"name": "관련 서식", "pdfPages": cand, "hwp": None}]
        info_pages = []
    return forms, info_pages


def build_entry(no: int, title: str, block: list[str], pages: list[int], P: Pages, issues: list[str]) -> dict:
    f, last_idx, officer1 = extract_fields(block)
    missing = [k for k in ("summary", "receivers", "fee", "methods", "documents", "period", "process") if not f.get(k)]
    if missing:
        issues.append(f"| {no} | {title} | 누락: {', '.join(missing)} |")

    notes, attach = parse_notes(f.get("notes", ""))

    src_pages = sorted({p for ln, p in zip(block, pages)
                        if ln.strip() and not PAGE_RE.search(ln) and "PAGE BREAK" not in ln and not FOOTER_RE.match(ln.strip())})
    # 줄이 하나도 없는 중간 쪽(MD 누락·빈 쪽)도 범위 안이면 포함
    src_pages = list(range(src_pages[0], src_pages[-1] + 1))
    main_last = pages[last_idx] if last_idx >= 0 else src_pages[0]
    cand = [p for p in src_pages if p > main_last and not P.is_blank(p) and not P.is_toc(p)]
    forms, info_pages = split_forms(no, attach, cand, P)

    docs_text = f.get("documents", "")
    documents = parse_documents(docs_text)
    todo = None
    docs_src = "요약표"
    found_docs, officer2 = find_submit_documents(block, last_idx + 1)
    if re.search(r"(참고사항|신청서|본문|붙임).{0,15}(같음|참조)", docs_text) or not documents:
        if found_docs:
            documents = found_docs
            docs_src = "신청서/참고사항에서 자동 추출"
        else:
            # 편람에 별도 목록이 없음 → 붙임 신청서(신고서) 자체를 구비서류로 두고 확인 요청
            documents = [re.sub(r"\s*(서식|양식)$", "", n) for n in attach] or documents
            docs_src = "편람에 별도 목록 없음 — 신청서(신고서)만 기재"
            todo = "편람에 구비서류 목록이 따로 없음(신청서만) → 실무상 추가 서류 있는지 확인"

    documents = [d for d in documents if not re.match(r"^삭제\s*<", d)]  # 법령상 삭제된 항목 제외

    # MD에서 빠져 PDF 텍스트로 보충한 쪽
    lost = [p for p in src_pages if not "\n".join(P.md.get(p, [])).strip() and not P.is_blank(p)]
    raw = "\n".join(block).strip()
    if lost:
        raw += "".join(f"\n\n<!-- PDF 텍스트 보충: {p}쪽 (MD 변환 누락) -->\n{P.text(p)}" for p in lost)

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
        "documents": documents,
        "documentsSource": docs_src,
        "officerChecks": officer1 or officer2,
        "dept": f.get("dept", ""),
        "ledger": f.get("ledger", ""),
        "approval": f.get("approval", ""),
        "period": f.get("period", ""),
        "laws": parse_list(f.get("laws", ""), r"\n"),
        "process": parse_process(f.get("process", "")),
        "notes": notes,
        "guideScript": "",
        "yearRuleIds": RULE_MAP.get(f"M{no:02d}", []),
        "forms": forms,
        "infoPages": info_pages,
        "sourcePages": src_pages,
        "pdfTextPages": lost,
        "rawMarkdown": raw,
        "reviewed": False,
        "updatedAt": date.today().isoformat(),
    }
    if todo:
        entry["_todo"] = todo
    return entry


# ---------------- 업무안내(II·III·IV·VI장) ----------------
GUIDE_HEAD_RE = re.compile(r"^#{1,2}\s*(0[1-9]|[12][0-9])\.?\s+(.+?)\s*$")


def extract_guides(lines: list[str], pages: list[int], P: Pages) -> list[dict]:
    def idx_of(pred, start=0):
        return next(i for i in range(start, len(lines)) if pred(lines[i].strip()))

    ch2 = idx_of(lambda l: l == "# CHAPTER II")
    ch3 = idx_of(lambda l: l == "# III", ch2)
    ch4 = idx_of(lambda l: l.startswith("# 01 교원자격 무시험검정"))
    ch5 = idx_of(lambda l: l == "# CHAPTER V")
    ch6 = idx_of(lambda l: l == "# CHAPTER VI")

    toc4 = []
    for l in lines[:120]:
        m = re.match(r"^(\d{1,2})\.\s*(.+?에 관한 사항)", l.strip())
        if m:
            toc4.append((int(m.group(1)), m.group(2)))

    def key(s: str) -> str:
        return re.sub(r"[\s·ㆍ•*#|0-9]", "", s)

    starts: list[tuple[int, str, str]] = []
    for i in range(ch2, ch4):
        m = GUIDE_HEAD_RE.match(lines[i].strip())
        if m:
            chap = "II. 민원처리 일반" if i < ch3 else "III. 민원신청 안내"
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
    guides = []
    for k, (i, chap, title) in enumerate(starts):
        end = bounds[k + 1]
        for cut in (ch3, ch4, ch5):  # 장이 바뀌는 곳에서 끊는다
            if i < cut <= end:
                end = cut
        sp = sorted({p for p in pages[i:end] if not P.is_blank(p) and not P.is_toc(p)}) or [pages[i]]
        md = "\n".join(lines[i:end]).strip()
        lost = [p for p in sp if not "\n".join(P.md.get(p, [])).strip()]
        md += "".join(f"\n\n<!-- PDF 텍스트 보충: {p}쪽 (MD 변환 누락) -->\n{P.text(p)}" for p in lost)
        guides.append({
            "id": f"G{k + 1:02d}",
            "chapter": chap,
            "title": re.sub(r"\s+", " ", title),
            "sourcePages": sp,
            "pdfTextPages": lost,
            "markdown": md,
            "reviewed": False,
        })
    return guides


# ---------------- 저장(덮어쓰기 보호) ----------------
def save(path: pathlib.Path, obj: dict, force: bool, protected: list[str]) -> bool:
    if path.exists() and not force:
        old = json.loads(path.read_text(encoding="utf-8"))
        if old.get("reviewed"):
            protected.append(f"{path.name} (검수완료)")
            return False
        if old.get("_genHash") and gen_hash(old) != old["_genHash"]:
            protected.append(f"{path.name} (사람이 수정함)")
            return False
    obj["_genHash"] = gen_hash(obj)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="검수완료·수정된 파일도 덮어씀(주의)")
    args = ap.parse_args()

    lines, line_pages = load_lines()
    P = Pages(lines, line_pages)
    entries = find_entries(lines)
    ch6 = next(i for i, l in enumerate(lines) if l.strip() == "# CHAPTER VI")
    issues: list[str] = []
    protected: list[str] = []
    OUT_MINWON.mkdir(parents=True, exist_ok=True)
    OUT_GUIDES.mkdir(parents=True, exist_ok=True)

    written = 0
    for k, (start, no, title) in enumerate(entries):
        end = entries[k + 1][0] if k + 1 < len(entries) else ch6
        e = build_entry(no, title, lines[start:end], line_pages[start:end], P, issues)
        written += save(OUT_MINWON / f"{e['id']}.json", e, args.force, protected)

    guides = extract_guides(lines, line_pages, P)
    g_written = sum(save(OUT_GUIDES / f"{g['id']}.json", g, args.force, protected) for g in guides)

    todo, lost_rows, form_rows = [], [], []
    for p in sorted(OUT_MINWON.glob("M*.json")):
        e = json.loads(p.read_text(encoding="utf-8"))
        if "_todo" in e:
            todo.append(f"| {e['no']} | {e['title']} | {e['_todo']} |")
        if e.get("pdfTextPages"):
            lost_rows.append(f"| {e['no']} | {e['title']} | {', '.join(map(str, e['pdfTextPages']))} |")
        if e.get("documentsSource", "").startswith("신청서"):
            todo.append(f"| {e['no']} | {e['title']} | 구비서류를 신청서/참고사항에서 자동 추출함 → PDF와 대조 |")
        fs = "; ".join(f"{f['name']}: {','.join(map(str, f['pdfPages'])) or '쪽 못 찾음'}" for f in e["forms"])
        info = f" / 참고안내 {','.join(map(str, e['infoPages']))}" if e.get("infoPages") else ""
        form_rows.append(f"| {e['id']} | {e['title']} | {fs}{info} |")

    REPORT.write_text(
        "# 추출 리포트\n\n"
        f"- 생성일: {date.today().isoformat()}\n"
        f"- 민원 {len(entries)}건 발견 / {written}건 저장 · 업무안내 {len(guides)}건 / {g_written}건 저장\n"
        f"- 덮어쓰기 보호로 건너뜀: {len(protected)}건 {('— ' + ', '.join(protected)) if protected else ''}\n"
        f"- MD 변환 누락 → PDF 텍스트로 보충한 쪽: {', '.join(map(str, sorted(P.fallback))) or '없음'}\n\n"
        "## 필수 필드 누락\n\n| 번호 | 민원 | 내용 |\n|---|---|---|\n" + ("\n".join(issues) or "| - | 없음 | |") +
        "\n\n## 추가 확인 필요\n\n| 번호 | 민원 | 내용 |\n|---|---|---|\n" + ("\n".join(todo) or "| - | 없음 | |") +
        "\n\n## MD 변환 누락 쪽이 포함된 민원 (PDF 텍스트로 보충, 표 구조 없음)\n\n| 번호 | 민원 | 쪽 |\n|---|---|---|\n" + ("\n".join(lost_rows) or "| - | 없음 | |") +
        "\n\n## 서식 쪽 배정 (확인용)\n\n| ID | 민원 | 서식: 쪽 |\n|---|---|---|\n" + "\n".join(form_rows) +
        "\n\n## 업무안내 문서 목록\n\n" + "\n".join(f"- {g['id']} [{g['chapter']}] {g['title']} (p.{g['sourcePages'][0]}~{g['sourcePages'][-1]})" for g in guides) + "\n",
        encoding="utf-8",
    )
    print(f"민원 {len(entries)}건(저장 {written}), 업무안내 {len(guides)}건(저장 {g_written}), 보호 {len(protected)}건, 누락 {len(issues)}건")
    print(f"PDF 보충 쪽: {sorted(P.fallback)}")
    print(f"리포트: {REPORT}")


if __name__ == "__main__":
    main()
