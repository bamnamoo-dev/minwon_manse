// Windows에서 드라이브 문자가 소문자(c:, h:)로 열리면 Vitest가 모듈을 두 번 불러와
// "failed to find the runner" 오류가 난다. 드라이브 문자를 대문자로 맞춰서 실행한다.
import { spawnSync } from "node:child_process";

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const args = ["vitest", "run", ...process.argv.slice(2)];
const r = spawnSync("npx", args, { cwd, stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
