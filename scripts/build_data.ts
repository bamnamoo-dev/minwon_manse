/**
 * data/*.json → public/data/bundle.json (앱이 한 번에 불러오는 데이터 묶음)
 * - rawMarkdown 은 검색용 평문(body)으로 바꿔 넣고 원문은 뺀다(용량 절감, 원문은 PDF 이미지로 확인)
 * - npm run dev / build 전에 자동 실행(predev, prebuild)
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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

const bundle = {
  version: "2025 개정판 민원편람",
  builtAt: new Date().toISOString().slice(0, 10),
  minwon,
  guides,
  rules: { channels: rulesFile.channels, rules: rulesFile.rules, reviewed: !!rulesFile._meta?.reviewed },
  identity,
  synonyms,
};

mkdirSync(join(ROOT, "public/data"), { recursive: true });
const out = join(ROOT, "public/data/bundle.json");
writeFileSync(out, JSON.stringify(bundle));
console.log(`bundle.json: 민원 ${minwon.length} · 업무안내 ${guides.length} · ${(JSON.stringify(bundle).length / 1024).toFixed(0)}KB`);
