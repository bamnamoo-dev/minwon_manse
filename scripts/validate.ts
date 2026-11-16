/**
 * data/ 폴더 JSON 검증 — 형식 오류·참조 오류를 빌드 전에 잡는다.
 * 사용법: npm run validate
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf-8"));

const Minwon = z.object({
  id: z.string().regex(/^M\d{2}$/),
  no: z.number().int().min(1).max(96),
  title: z.string().min(2),
  category: z.string().min(1),
  aliases: z.array(z.string()),
  summary: z.string(),
  receivers: z.array(z.string()),
  fee: z.string(),
  methods: z.array(z.string()),
  documents: z.array(z.string()),
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
  sourcePages: z.array(z.number().int().min(1).max(467)).min(1),
  rawMarkdown: z.string().min(10),
  reviewed: z.boolean(),
  updatedAt: z.string(),
  _todo: z.string().optional(),
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
  if (e._todo) warn.push(`${e.id} ${e.title}: ${e._todo}`);
}
if (files.length !== 96) errors.push(`민원 파일 수 ${files.length} (96이어야 함)`);

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

const reviewed = files.filter((f) => read(`data/minwon/${f}`).reviewed).length;
console.log(`민원 ${files.length}건 (검수 완료 ${reviewed}건) · 경고 ${warn.length}건 · 오류 ${errors.length}건`);
if (warn.length) console.log("\n[경고 — 검수 시 채울 것]\n" + warn.map((w) => " - " + w).join("\n"));
if (errors.length) {
  console.error("\n[오류]\n" + errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}
