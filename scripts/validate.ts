/**
 * data/ 폴더 JSON 검증 — 형식 오류·참조 오류를 빌드 전에 잡는다.
 * 사용법: npm run validate
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf-8"));

const Minwon = z.object({
  id: z.string().regex(/^M\d{2}$/),
  no: z.number().int().min(1),
  title: z.string().min(2),
  category: z.string().min(1),
  aliases: z.array(z.string()),
  summary: z.string(),
  receivers: z.array(z.string()),
  fee: z.string(),
  methods: z.array(z.string()),
  documents: z.array(z.string()),
  documentsSource: z.string(),
  officerChecks: z.array(z.string()),
  dept: z.string(),
  ledger: z.string(),
  approval: z.string(),
  period: z.string(),
  laws: z.array(z.string()),
  process: z.array(z.object({ channel: z.string(), steps: z.array(z.string()) })),
  notes: z.array(z.string()),
  guideScript: z.string(),
  yearRuleIds: z.array(z.string()),
  forms: z.array(z.object({ name: z.string(), pdfPages: z.array(z.number().int()), hwp: z.string().nullable() })),
  infoPages: z.array(z.number().int()),
  sourcePages: z.array(z.number().int().min(1)).min(1),
  pdfTextPages: z.array(z.number().int()),
  rawMarkdown: z.string().min(10),
  reviewed: z.boolean(),
  updatedAt: z.string(),
  _todo: z.string().optional(),
  _genHash: z.string().optional(),
});

const Ym = z.string().regex(/^\d{4}(-\d{2})?$/);
const Cell = z.object({
  s: z.enum(["yes", "no", "partial", "from", "range", "status", "text"]),
  from: Ym.optional(),
  to: Ym.optional(),
  status: z.array(z.string()).optional(),
  note: z.string().optional(),
});
const Rules = z.object({
  channels: z.array(z.object({ id: z.string(), label: z.string(), group: z.string() })),
  rules: z.record(z.string(), z.object({
    label: z.string(), group: z.string(), basis: z.string(),
    minwonIds: z.array(z.string()),
    cells: z.record(z.string(), Cell),
    notes: z.array(z.string()),
  })),
});

/* 발급 시스템 매뉴얼 (data/manuals) — links.json 은 사람이 관리, neis.json·certsys.json 은 npm run render-manuals 자동 생성 */
const Links = z.object({
  _meta: z.object({ systemOrder: z.array(z.enum(["neis", "certSystem"])), reviewed: z.boolean() }).passthrough(),
  minwon: z.record(
    z.string().regex(/^M\d{2}$/),
    z.object({
      neis: z.array(z.number().int().min(1)).optional(),
      neisRefs: z.array(z.number().int().min(1)).optional(),
      neisRefNote: z.string().optional(),
      certSystem: z.string().optional(),
      checked: z.string().optional(),
    }).strict(),
  ),
});
const NeisManual = z.object({
  source: z.string(),
  pages: z.array(z.object({
    page: z.number().int(), title: z.string().min(1), overview: z.string(), menuPath: z.array(z.string()),
    image: z.string(), width: z.number(), height: z.number(),
    markers: z.array(z.object({ n: z.number().int(), x: z.number().min(0).max(100), y: z.number().min(0).max(100) })),
    items: z.array(z.object({ n: z.number().int(), text: z.string(), subs: z.array(z.string()) })),
  })),
});
const CertManual = z.object({
  source: z.string(),
  sections: z.record(z.string(), z.object({
    title: z.string(),
    steps: z.array(z.object({
      title: z.string().min(1), lines: z.array(z.string()),
      shots: z.array(z.object({ image: z.string(), width: z.number(), height: z.number() })),
      pages: z.array(z.number().int()), printed: z.array(z.number().int().nullable()),
    })).min(1),
  })),
});

const errors: string[] = [];
const warn: string[] = [];

const files = readdirSync(join(ROOT, "data/minwon")).filter((f) => f.endsWith(".json"));
const ids = new Set<string>();
for (const f of files) {
  const r = Minwon.safeParse(read(`data/minwon/${f}`));
  if (!r.success) {
    errors.push(`${f}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    continue;
  }
  const e = r.data;
  ids.add(e.id);
  for (const k of ["summary", "fee", "period"] as const) if (!e[k]) warn.push(`${e.id} ${e.title}: ${k} 비어 있음`);
  if (e.documents.length === 0) warn.push(`${e.id} ${e.title}: documents 비어 있음`);
  for (const f of e.forms) if (f.pdfPages.length === 0) warn.push(`${e.id} ${e.title}: 서식 '${f.name}' 쪽 번호 없음`);
  const pages = new Set(e.sourcePages);
  for (const f of e.forms) for (const p of f.pdfPages) if (!pages.has(p)) errors.push(`${e.id}: 서식 쪽 ${p}가 sourcePages 밖`);
  if (e._todo) warn.push(`${e.id} ${e.title}: ${e._todo}`);
}
/* 민원 번호는 편람 번호와 같고 1부터 빠짐없이 이어져야 한다(개수는 판마다 다름 — data/edition.json) */
const nums = files.map((f) => read(`data/minwon/${f}`) as { id: string; no: number }).sort((a, b) => a.no - b.no);
nums.forEach((m, i) => {
  if (m.no !== i + 1) errors.push(`민원 번호가 이어지지 않음: ${i + 1}번 자리에 ${m.id}(no ${m.no})`);
  if (m.id !== `M${String(m.no).padStart(2, "0")}`) errors.push(`${m.id}: id 와 no(${m.no})가 맞지 않음`);
});
const edition = read("data/edition.json") as { md: string; pdf: string; label: string; printedPageOffset: unknown };
if (!Number.isInteger(edition.printedPageOffset) || (edition.printedPageOffset as number) < 0)
  errors.push(`data/edition.json printedPageOffset: 0 이상의 정수여야 함 (${String(edition.printedPageOffset)})`);
for (const k of ["md", "pdf"] as const) if (!existsSync(join(ROOT, edition[k]))) errors.push(`data/edition.json ${k}: ${edition[k]} 없음`);

const rules = Rules.safeParse(read("data/rules/issuance_years.json"));
if (!rules.success) errors.push(`issuance_years.json: ${rules.error.message}`);
else {
  const chIds = new Set(rules.data.channels.map((c) => c.id));
  for (const [rid, r] of Object.entries(rules.data.rules)) {
    for (const ch of chIds) if (!r.cells[ch]) errors.push(`규칙 ${rid}: 채널 ${ch} 칸 없음`);
    for (const mid of r.minwonIds) if (!ids.has(mid)) errors.push(`규칙 ${rid}: 없는 민원 ${mid}`);
    for (const [ch, c] of Object.entries(r.cells)) {
      if ((c.s === "from" || c.s === "range") && !c.from) errors.push(`규칙 ${rid}.${ch}: from 필요`);
      if (c.s === "range" && !c.to) errors.push(`규칙 ${rid}.${ch}: to 필요`);
      if (c.s === "status" && !c.status?.length) errors.push(`규칙 ${rid}.${ch}: status 필요`);
    }
  }
}

{
  const links = Links.safeParse(read("data/manuals/links.json"));
  const neis = NeisManual.safeParse(read("data/manuals/neis.json"));
  const cert = CertManual.safeParse(read("data/manuals/certsys.json"));
  if (!links.success) errors.push(`manuals/links.json: ${links.error.message}`);
  if (!neis.success) errors.push(`manuals/neis.json: ${neis.error.message}`);
  if (!cert.success) errors.push(`manuals/certsys.json: ${cert.error.message}`);
  if (links.success && neis.success && cert.success) {
    const neisPages = new Set(neis.data.pages.map((p) => p.page));
    for (const p of neis.data.pages) {
      if (p.markers.length !== p.items.length) warn.push(`나이스 매뉴얼 ${p.page}쪽: 화면 표식 ${p.markers.length}개 ≠ 설명 ${p.items.length}개`);
    }
    for (const [mid, l] of Object.entries(links.data.minwon)) {
      if (!ids.has(mid)) errors.push(`manuals/links.json: 없는 민원 ${mid}`);
      for (const p of l.neis ?? []) if (!neisPages.has(p)) errors.push(`manuals/links.json ${mid}: 나이스 ${p}쪽이 neis.json에 없음 → npm run render-manuals`);
      for (const p of l.neisRefs ?? []) if (!l.neis?.includes(p)) errors.push(`manuals/links.json ${mid}: neisRefs ${p}쪽이 neis 목록에 없음`);
      if (l.neisRefs?.length && !l.neisRefNote) errors.push(`manuals/links.json ${mid}: neisRefs 가 있으면 neisRefNote(참고 화면 안내) 필요`);
      if (l.certSystem && !cert.data.sections[l.certSystem]) errors.push(`manuals/links.json ${mid}: certsys.json 에 절차 '${l.certSystem}' 없음`);
    }
  }
}

{
  /* 서식 파일 연결 (data/forms_files.json → public/forms) */
  const ff = read("data/forms_files.json") as {
    common: Record<string, { label?: string; file: string }>;
    minwon: Record<string, { form?: string; label?: string; file: string }[]>;
  };
  const checkFile = (where: string, file: string) => {
    for (const ext of [".hwpx", ".pdf"]) {
      if (!existsSync(join(ROOT, "public/forms", file + ext))) errors.push(`forms_files.json ${where}: public/forms/${file}${ext} 없음`);
    }
  };
  for (const [k, f] of Object.entries(ff.common)) checkFile(`common.${k}`, f.file);
  for (const [mid, list] of Object.entries(ff.minwon)) {
    if (!ids.has(mid)) { errors.push(`forms_files.json: 없는 민원 ${mid}`); continue; }
    const names = new Set((read(`data/minwon/${mid}.json`).forms as { name: string }[]).map((x) => x.name));
    for (const f of list) {
      checkFile(mid, f.file);
      if (!f.form && !f.label) errors.push(`forms_files.json ${mid}: form(편람 서식 이름) 또는 label(추가 서식 이름) 필요`);
      if (f.form && !names.has(f.form)) errors.push(`forms_files.json ${mid}: 편람 서식 '${f.form}' 없음 (추가 서식이면 label 사용)`);
    }
  }
}

const reviewed = files.filter((f) => read(`data/minwon/${f}`).reviewed).length;
console.log(`민원 ${files.length}건 (검수 완료 ${reviewed}건) · 경고 ${warn.length}건 · 오류 ${errors.length}건`);
if (warn.length) console.log("\n[경고 — 검수 시 채울 것]\n" + warn.map((w) => " - " + w).join("\n"));
if (errors.length) {
  console.error("\n[오류]\n" + errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}
