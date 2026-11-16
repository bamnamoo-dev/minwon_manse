// git 기록 전체를 파일 하나(minwon_manse.bundle)로 묶어 백업 폴더에 저장한다.
// 사용: npm run backup                → 기본 폴더(구글 드라이브)
//       npm run backup -- "D:\백업"   → 지정 폴더
// 복원: git clone minwon_manse.bundle minwon_manse
// 주의: 커밋된 내용만 들어간다. 저장 안 한 수정·node_modules·public/pages 는 빠진다.
import { execFileSync } from "node:child_process";
import { existsSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_DIR = "E:\\내 드라이브\\antigravity\\minwon_manse";
const dir = process.argv[2] || DEFAULT_DIR;

if (!existsSync(dir)) {
  console.error(`백업 폴더가 없습니다: ${dir}`);
  console.error('다른 폴더에 저장하려면: npm run backup -- "폴더경로"');
  process.exit(1);
}

const dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (dirty) {
  console.warn("⚠ 커밋 안 된 변경이 있습니다. 백업에는 마지막 커밋까지만 들어갑니다.\n");
}

const out = join(dir, "minwon_manse.bundle");
const tmp = out + ".tmp";
// 임시 파일에 먼저 쓰고 바꿔치기 → 도중에 실패해도 이전 백업은 그대로 남는다
execFileSync("git", ["bundle", "create", tmp, "--all"], { stdio: "inherit" });
execFileSync("git", ["bundle", "verify", tmp], { stdio: "ignore" });
renameSync(tmp, out);

const last = execFileSync("git", ["log", "-1", "--format=%h %s"], { encoding: "utf8" }).trim();
const mb = (statSync(out).size / 1024 / 1024).toFixed(1);
console.log(`\n✅ 백업 완료: ${out} (${mb}MB)\n   마지막 커밋: ${last}`);
