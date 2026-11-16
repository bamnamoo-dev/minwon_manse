/**
 * data/*.json → public/data/bundle.json (앱이 한 번에 불러오는 데이터 묶음)
 * - rawMarkdown 은 검색용 평문(body)으로 바꿔 넣고 원문은 뺀다(용량 절감, 원문은 PDF 이미지로 확인)
 * - npm run dev / build 전에 자동 실행(predev, prebuild)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf-8"));

/** 마크다운·표 기호를 걷어낸 검색용 평문 */
function plain(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\$\\rightarrow\$/g, "→")
    .replace(/\|?\s*:?-{3,}:?\s*/g, " ")
    .replace(/[|#*`_>]/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const minwon = readdirSync(join(ROOT, "data/minwon"))
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => {
    const { rawMarkdown, _genHash, _todo, updatedAt, ...rest } = read(`data/minwon/${f}`);
    void _genHash; void _todo; void updatedAt;
    return { ...rest, body: plain(rawMarkdown) };
  });

/* 서식 파일(public/forms) 연결 — data/forms_files.json. 원본 data/minwon 은 고치지 않고 묶음에서만 합친다 */
const formFiles = read("data/forms_files.json");
type FormFile = { form?: string; label?: string; file: string };
for (const m of minwon) {
  for (const f of (formFiles.minwon[m.id] ?? []) as FormFile[]) {
    const files = { hwp: `${f.file}.hwpx`, pdf: `${f.file}.pdf` };
    const hit = f.form ? m.forms.find((x: { name: string }) => x.name === f.form) : undefined;
    if (hit) Object.assign(hit, files);
    else m.forms.push({ name: f.label ?? f.form, pdfPages: [], ...files, extra: true });
  }
}
const formsCommon = Object.fromEntries(
  Object.entries(formFiles.common as Record<string, FormFile>).map(([k, f]) => [k, { name: f.label ?? k, hwp: `${f.file}.hwpx`, pdf: `${f.file}.pdf` }]),
);

/* 서식함 — public/forms 폴더를 그대로 읽는다(파일을 넣기만 하면 나타남).
   분류·키워드는 폴더 안 forms_catalog.json·forms_index.json 이 있으면 쓰고, 없으면 폴더 이름으로 묶는다 */
function formsLibrary() {
  const base = join(ROOT, "public/forms");
  if (!existsSync(base)) return { groups: [], items: [] };
  const tryRead = (f: string) => (existsSync(join(base, f)) ? JSON.parse(readFileSync(join(base, f), "utf-8")) : null);
  const catalog = tryRead("forms_catalog.json");
  const index = tryRead("forms_index.json");
  const catName = new Map<string, string>();
  for (const c of catalog?.categories ?? []) if (c.id !== "all") catName.set(c.id, String(c.name).replace(/^[^\p{L}]+/u, "").trim());
  const groupOf = new Map<string, string>();
  for (const it of catalog?.items ?? []) if (catName.has(it.category_id)) groupOf.set(it.hwp_file, catName.get(it.category_id)!);
  const keywordsOf = new Map<string, string[]>();
  for (const it of index?.forms ?? []) keywordsOf.set(it.hwp_file, it.keywords ?? []);

  // 민원 연결(data/forms_files.json) — 파일 → 민원 ID
  const linked = new Map<string, string[]>();
  for (const [mid, list] of Object.entries(formFiles.minwon as Record<string, FormFile[]>))
    for (const f of list) linked.set(f.file, [...new Set([...(linked.get(f.file) ?? []), mid])]);
  const common = new Set(Object.values(formFiles.common as Record<string, FormFile>).map((f) => f.file));

  const items = [];
  for (const folder of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    for (const file of readdirSync(join(base, folder)).filter((f) => f.endsWith(".hwpx") || f.endsWith(".hwp")).sort((a, b) => a.localeCompare(b, "ko", { numeric: true }))) {
      const stem = file.replace(/\.hwpx?$/, "");
      const rel = `${folder}/${stem}`;
      const pdf = existsSync(join(base, folder, `${stem}.pdf`)) ? `${rel}.pdf` : null;
      items.push({
        name: stem.replace(/^\[서식 [\d-]+\]\s*/, ""),
        no: (/^\[(서식 [\d-]+)\]/.exec(stem) ?? [])[1] ?? null,
        folder,
        group: groupOf.get(file) ?? folder,
        hwp: `${folder}/${file}`,
        pdf,
        keywords: keywordsOf.get(file) ?? [],
        minwon: linked.get(rel) ?? [],
        common: common.has(rel),
      });
    }
  }
  // 분류 순서: 민원 폴더 서식 분류 먼저(창구에서 많이 씀), 그 밖(공무원 인사 등) 뒤로. 같은 폴더 안에서는 분류표 순서
  const groups = [...new Set([...catName.values(), ...items.map((i) => i.group)])].filter((g) => items.some((i) => i.group === g));
  const folderOf = (g: string) => items.find((i) => i.group === g)!.folder;
  const order = [...groups.filter((g) => folderOf(g) === "민원"), ...groups.filter((g) => folderOf(g) !== "민원")];
  return { groups: order, items };
}

const guides = readdirSync(join(ROOT, "data/guides"))
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => {
    const { _genHash, ...g } = read(`data/guides/${f}`);
    void _genHash;
    return { ...g, body: plain(g.markdown) };
  });

const rulesFile = read("data/rules/issuance_years.json");
const synonyms = read("data/synonyms.json").terms;
const idFile = read("data/rules/identity.json");
const identity = {
  basis: idFile._meta.basis,
  cases: idFile.cases,
  unmatched: idFile.unmatched,
  reviewed: !!idFile._meta.reviewed,
};

const manualLinks = read("data/manuals/links.json");
const manuals = {
  order: manualLinks._meta.systemOrder,
  reviewed: !!manualLinks._meta.reviewed,
  links: manualLinks.minwon,
  neis: read("data/manuals/neis.json"),
  certsys: read("data/manuals/certsys.json"),
};

const bundle = {
  version: "2025 개정판 민원편람",
  builtAt: new Date().toISOString().slice(0, 10),
  minwon,
  guides,
  rules: { channels: rulesFile.channels, rules: rulesFile.rules, reviewed: !!rulesFile._meta?.reviewed },
  identity,
  synonyms,
  manuals,
  formsCommon,
  formsLibrary: formsLibrary(),
};

mkdirSync(join(ROOT, "public/data"), { recursive: true });
const out = join(ROOT, "public/data/bundle.json");
writeFileSync(out, JSON.stringify(bundle));
console.log(`bundle.json: 민원 ${minwon.length} · 업무안내 ${guides.length} · ${(JSON.stringify(bundle).length / 1024).toFixed(0)}KB`);
