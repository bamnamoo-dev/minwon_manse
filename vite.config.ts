import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 상대 경로 빌드: GitHub Pages(…/minwon_manse/)·nginx·하위 폴더 어디에 올려도 동작 (해시 라우팅이라 서버 설정 불필요)
  base: "./",
});
