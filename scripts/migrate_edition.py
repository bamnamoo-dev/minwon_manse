"""민원편람 새 판으로 data/ 옮기기 (2025판 → 2026판에서 처음 사용)

사용법 (예: 2025 → 2026):
  py scripts/extract_minwon.py --md source/민원편람.md --pdf source/민원편람.pdf --out tmp/base   # 옛 판 자동 추출
  py scripts/extract_minwon.py --out tmp/new                                                       # 새 판 자동 추출
  py scripts/migrate_edition.py --old-pdf source/민원편람.pdf --base tmp/base --new tmp/new

하는 일
1) 옛 민원 ↔ 새 민원을 제목으로 짝짓는다(새 번호 = 새 판 번호). 없어진 민원·새 민원을 가려낸다.
2) 두 판의 PDF 글자를 민원별로 비교한다.
   - 같으면: 사람이 검수한 옛 데이터를 그대로 쓰고 쪽 번호만 새 판에 맞춘다(reviewed 유지).
   - 다르면: 필드별 3자 비교 — 옛 자동추출(base) · 검수본(ours) · 새 자동추출(new)
       base == new  → 판에서 안 바뀐 필드 → 검수본 값 유지
       base == ours → 사람이 손대지 않은 필드 → 새 판 값
       둘 다 다름   → 새 판 값 + 확인 요청
     reviewed=false 로 두고 _todo 에 바뀐 필드를 적는다(사람 검수 필요).
3) 민원 ID 를 쓰는 연결 파일(forms_files·manuals/links·rules/issuance_years)의 ID 를 새 번호로 바꾼다.
   없어진 민원 연결은 지우고 보고서에 적는다.
4) 업무안내(data/guides)는 새 판 추출본으로 바꾼다(사람이 고친 파일이 있으면 멈춤).
보고서: docs/편람_이관보고_<새 판>.md, 짝 목록: data/edition_map.json
"""
from __future__ import annotations

import argparse
import difflib
import json
import pathlib
import re
from datetime import date

import fitz  # PyMuPDF

ROOT = pathlib.Path(__file__).resolve().parent.parent
EDITION = json.loads((ROOT / "data" / "edition.json").read_text(encoding="utf-8"))
MINWON = ROOT / "data" / "minwon"
GUIDES = ROOT / "data" / "guides"
PAGE_FIELDS = ("sourcePages", "forms", "infoPages", "pdfTextPages")
SKIP = {"id", "no", "category", "rawMarkdown", "reviewed", "updatedAt", "_genHash", "_todo", "yearRuleIds"} | set(PAGE_FIELDS)
HEADER_RE = re.compile(r"^(\d{1,3}|\d{1,3}\s*서울특별시교육청|서울특별시교육청(\s*\d{1,3})?|[IVX]+\.\s.{0,40}|\d{1,2}\.\s.{0,20}\s*\d{0,3})$")


def load(p: pathlib.Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def tkey(t: str) -> str:
    return re.sub(r"[\s·ㆍ()（）\[\]「」]", "", t)


def pdf_text(doc, pages: list[int]) -> str:
    """두 판 비교용 PDF 글자 — 머리말·쪽 번호 줄(그 쪽 인쇄 쪽수가 든 짧은 줄)은 뺀다."""
    out = []
    for p in pages:
        printed = re.compile(rf"(?<!\d){p - EDITION['printedPageOffset']}(?!\d)")
        for l in doc[p - 1].get_text().splitlines():
            l = l.strip()
            if l and not HEADER_RE.match(l) and not (len(l) < 40 and printed.search(l)) and not re.search(r"···|…|\.{4,}", l):
                out.append(l)
    text = re.sub(r"\s+", "", "".join(out))
    return re.sub(r"(■■■|민원편람|안내∙[^■]{1,20})\d{1,2}\)", r"\1", text)  # 민원 번호(59) → 55))는 비교에서 뺌


def shift_pages(o: dict, d: int) -> dict:
    o = dict(o)
    o["sourcePages"] = [p + d for p in o["sourcePages"]]
    o["infoPages"] = [p + d for p in o["infoPages"]]
    o["pdfTextPages"] = [p + d for p in o["pdfTextPages"]]
    o["forms"] = [{**f, "pdfPages": [p + d for p in f["pdfPages"]]} for f in o["forms"]]
    return o


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--old-pdf", required=True)
    ap.add_argument("--base", required=True, help="옛 판 자동 추출 폴더(extract --out)")
    ap.add_argument("--new", required=True, help="새 판 자동 추출 폴더(extract --out)")
    ap.add_argument("--dry", action="store_true", help="쓰지 않고 결과만 출력")
    args = ap.parse_args()
    base_dir, new_dir = pathlib.Path(args.base), pathlib.Path(args.new)
    old_doc, new_doc = fitz.open(args.old_pdf), fitz.open(ROOT / EDITION["pdf"])
    today = date.today().isoformat()

    ours = {p.stem: load(p) for p in sorted(MINWON.glob("M*.json"))}
    base = {p.stem: load(p) for p in sorted((base_dir / "minwon").glob("M*.json"))}
    new = {p.stem: load(p) for p in sorted((new_dir / "minwon").glob("M*.json"))}
    assert set(ours) == set(base), "검수본과 옛 판 자동추출의 민원 목록이 다름"

    # 1) 짝짓기: 제목이 같으면 바로, 아니면 비슷한 제목(0.85 이상)
    idmap: dict[str, str] = {}
    left_new = dict(new)
    for oid, o in ours.items():
        hit = next((nid for nid, n in left_new.items() if tkey(n["title"]) == tkey(o["title"])), None)
        if hit:
            idmap[oid] = hit
            left_new.pop(hit)
    for oid, o in ours.items():
        if oid in idmap:
            continue
        best = max(left_new, key=lambda nid: difflib.SequenceMatcher(None, tkey(o["title"]), tkey(left_new[nid]["title"])).ratio(), default=None)
        if best and difflib.SequenceMatcher(None, tkey(o["title"]), tkey(left_new[best]["title"])).ratio() >= 0.85:
            idmap[oid] = best
            left_new.pop(best)
    for oid, o in ours.items():  # 같은 번호·같은 분류이고 제목이 꽤 비슷하면(0.8) 이름만 바뀐 것
        n = left_new.get(oid)
        if oid not in idmap and n and n["category"] == o["category"] and \
                difflib.SequenceMatcher(None, tkey(o["title"]), tkey(n["title"])).ratio() >= 0.8:
            idmap[oid] = oid
            left_new.pop(oid)
    removed = [oid for oid in ours if oid not in idmap]
    added = sorted(left_new)

    # 2) 민원별 병합
    rows_same, rows_changed, rows_new = [], [], []
    result: dict[str, dict] = {}
    for oid, nid in idmap.items():
        o, b, n = ours[oid], base[oid], new[nid]
        same_text = pdf_text(old_doc, o["sourcePages"]) == pdf_text(new_doc, n["sourcePages"])
        d = n["sourcePages"][0] - o["sourcePages"][0]
        if same_text:
            m = shift_pages(o, d)
            if m["sourcePages"] != n["sourcePages"]:  # 쪽 수가 달라졌으면 쪽 정보는 새 판 것
                for k in PAGE_FIELDS:
                    m[k] = n[k]
            m.update(id=nid, no=n["no"], category=n["category"], rawMarkdown=n["rawMarkdown"], updatedAt=today)
            m["_genHash"] = n["_genHash"]
            result[nid] = m
            rows_same.append(f"| {oid} → {nid} | {n['title']} | {o['sourcePages'][0]}→{n['sourcePages'][0]}쪽 | {'검수완료 유지' if m['reviewed'] else '미검수'} |")
            continue
        m = dict(n)
        kept, took, conflict = [], [], []
        for k in sorted(set(o) | set(n)):
            if k in SKIP:
                continue
            ov, bv, nv = o.get(k), b.get(k), n.get(k)
            if ov == nv:
                if k in o:
                    m[k] = ov
                continue
            if bv == nv:  # 판에서 그대로, 사람이 고침 → 검수본 유지
                m[k] = ov
                kept.append(k)
            elif bv == ov:  # 사람은 안 고침, 판이 바뀜 → 새 판
                took.append(k)
            else:
                conflict.append(k)
        # 사람이 고친 서식 쪽(forms)은 판에서 쪽 수가 같으면 옮겨 준다
        if o["forms"] != b["forms"] and len(o["sourcePages"]) == len(n["sourcePages"]):
            sf = shift_pages(o, d)["forms"]
            if [f["name"] for f in sf] == [f["name"] for f in n["forms"]] or b["forms"] == shift_pages(b, d)["forms"]:
                m["forms"] = sf
                kept.append("forms(쪽 이동)")
        m["updatedAt"] = today
        m["_genHash"] = n["_genHash"]  # 새 판 자동추출 지문 — 옛 검수값이 섞였으면 '사람이 수정함'으로 보호됨
        if not took and not conflict:  # 요약표 등 칸은 그대로, 서식 쪽 글자만 바뀜 → 검수 상태 유지
            m["reviewed"] = o["reviewed"]
            m.pop("_todo", None)
            if o.get("_todo"):
                m["_todo"] = o["_todo"]
            result[nid] = m
            rows_same.append(f"| {oid} → {nid} | {n['title']} | {o['sourcePages'][0]}→{n['sourcePages'][0]}쪽 · 서식 쪽 글자만 바뀜(원문 이미지로 확인) | {'검수완료 유지' if m['reviewed'] else '미검수'} |")
            continue
        todo =f"{EDITION['label']}에서 내용이 바뀜 → PDF와 대조해 검수"
        if took:
            todo += f" · 새 판 값으로 바뀐 칸: {', '.join(took)}"
        if conflict:
            todo += f" · 옛 검수값과 새 판 값이 모두 달라 새 판 값으로 둔 칸(특히 확인): {', '.join(conflict)}"
        if kept:
            todo += f" · 옛 검수 때 고친 값 유지: {', '.join(kept)}"
        if n.get("_todo"):
            todo += f" · {n['_todo']}"
        m["_todo"] = todo
        m["reviewed"] = False
        result[nid] = m
        rows_changed.append(f"| {oid} → {nid} | {n['title']} | {', '.join(took + conflict) or '(글자만 다름)'} | {', '.join(conflict) or '-'} |")
    for nid in added:
        m = dict(new[nid])
        m["_todo"] = f"{EDITION['label']}에서 새로 생긴 민원 → 검수 필요" + (f" · {m['_todo']}" if m.get("_todo") else "")
        result[nid] = m
        rows_new.append(f"| {nid} | {m['title']} | {m['sourcePages'][0]}~{m['sourcePages'][-1]}쪽 |")

    # 3) 연결 파일 ID 바꾸기
    dropped = []

    def remap_keys(d: dict, where: str) -> dict:
        out = {}
        for k, v in d.items():
            if k in idmap:
                out[idmap[k]] = v
            else:
                dropped.append(f"{where}: {k} {ours[k]['title'] if k in ours else ''} → 삭제(새 판에 없는 민원) — 옛 값 {json.dumps(v, ensure_ascii=False)}")
        return dict(sorted(out.items()))

    ff_p = ROOT / "data" / "forms_files.json"  # 사람이 줄 맞춰 쓴 파일 → 글자 그대로 두고 ID만 바꾼다
    for k in load(ff_p)["minwon"]:
        if k not in idmap:
            raise SystemExit(f"forms_files.json 에 없어진 민원 {k} 이 있음 → 손으로 정리 후 다시 실행")
    ff_text = re.sub(r'^(\s*)"(M\d{2})":', lambda mm: f'{mm.group(1)}"{idmap[mm.group(2)]}":', ff_p.read_text(encoding="utf-8"), flags=re.M)
    links_p = ROOT / "data" / "manuals" / "links.json"
    links = load(links_p)
    links["minwon"] = remap_keys(links["minwon"], "manuals/links.json")
    rules_p = ROOT / "data" / "rules" / "issuance_years.json"
    rules = load(rules_p)
    for rid, r in rules["rules"].items():
        ids = []
        for mid in r["minwonIds"]:
            if mid in idmap:
                ids.append(idmap[mid])
            else:
                dropped.append(f"rules/issuance_years.json {rid}: {mid} → 삭제(새 판에 없는 민원)")
        r["minwonIds"] = ids
    rule_map: dict[str, list[str]] = {}
    for rid, r in rules["rules"].items():
        for mid in r["minwonIds"]:
            rule_map.setdefault(mid, []).append(rid)
    for nid, m in result.items():
        m["yearRuleIds"] = rule_map.get(nid, [])

    if args.dry:
        print(f"[dry] 그대로 {len(rows_same)}, 바뀜 {len(rows_changed)}, 새로 {len(rows_new)}, 없어짐 {removed}")
        print("\n".join(rows_changed + rows_new))
        return
    # 쓰기
    for p in MINWON.glob("M*.json"):
        p.unlink()
    for nid, m in sorted(result.items()):
        (MINWON / f"{nid}.json").write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding="utf-8")
    ff_p.write_text(ff_text, encoding="utf-8")
    links_p.write_text(json.dumps(links, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    rules_p.write_text(json.dumps(rules, ensure_ascii=False, indent=2), encoding="utf-8")

    # 4) 업무안내 — 사람이 고친 파일이 없을 때만 새 판으로 교체
    import hashlib

    def gh(o):
        b = {k: v for k, v in o.items() if k != "_genHash"}
        return hashlib.sha1(json.dumps(b, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:16]
    edited = [p.name for p in GUIDES.glob("G*.json") if (lambda o: o.get("reviewed") or o.get("_genHash") != gh(o))(load(p))]
    if edited:
        raise SystemExit(f"업무안내 중 사람이 고친 파일이 있어 멈춤: {edited}")
    for p in GUIDES.glob("G*.json"):
        p.unlink()
    for p in sorted((new_dir / "guides").glob("G*.json")):
        (GUIDES / p.name).write_bytes(p.read_bytes())
    (ROOT / "docs" / "extract_report.md").write_bytes((new_dir / "extract_report.md").read_bytes())

    (ROOT / "data" / "edition_map.json").write_text(json.dumps({
        "_comment": f"민원 ID 바뀜 기록(옛 판 → {EDITION['label']}). 옛 검수 기록·문서의 번호를 새 번호로 읽을 때 쓴다. 값 null = 새 판에서 없어진 민원",
        "edition": EDITION["year"],
        "minwon": {**{k: v for k, v in idmap.items()}, **{k: None for k in removed}},
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    rep = [f"# 민원편람 {EDITION['label']} 이관 보고", "",
           f"- 날짜: {today} · 민원 {len(ours)}건 → {len(result)}건 (그대로 {len(rows_same)} · 바뀜 {len(rows_changed)} · 새로 생김 {len(rows_new)} · 없어짐 {len(removed)})",
           "- 판단 기준: 두 판 PDF의 해당 쪽 글자(머리말·쪽 번호 제외)가 완전히 같으면 '그대로'", "",
           "## 없어진 민원", "", "| 옛 ID | 민원 |", "|---|---|", *[f"| {k} | {ours[k]['title']} |" for k in removed], "",
           "## 새로 생긴 민원 (검수 필요)", "", "| 새 ID | 민원 | 쪽 |", "|---|---|---|", *rows_new, "",
           "## 내용이 바뀐 민원 (검수 필요, reviewed=false)", "", "| ID | 민원 | 새 판 값으로 바뀐 칸 | 특히 확인할 칸 |", "|---|---|---|---|", *rows_changed, "",
           "## 연결 파일에서 지운 항목", "", *([f"- {x}" for x in dropped] or ["- 없음"]), "",
           "## 내용이 그대로인 민원 (쪽 번호만 바뀜)", "", "| ID | 민원 | 첫 쪽 | 검수 |", "|---|---|---|---|", *rows_same, ""]
    (ROOT / "docs" / f"편람_이관보고_{EDITION['year']}.md").write_text("\n".join(rep), encoding="utf-8")
    print(f"민원 {len(result)}건 (그대로 {len(rows_same)}, 바뀜 {len(rows_changed)}, 새로 {len(rows_new)}, 없어짐 {len(removed)})")
    print("짝:", {k: v for k, v in idmap.items() if k != v})
    print("없어짐:", removed, "새로:", added)
    print("연결 삭제:", dropped)


if __name__ == "__main__":
    main()
