import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 정적 호스팅(VPS nginx)용: 해시 라우팅이라 base 는 "/" 그대로
});
