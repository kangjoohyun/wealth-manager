import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages 배포 시 repo 이름으로 base 변경
// 예: https://username.github.io/wealth-manager/ → base: "/wealth-manager/"
export default defineConfig({
  plugins: [react()],
  base: "/wealth-manager/",   // ← 본인 GitHub 저장소 이름으로 수정
});
