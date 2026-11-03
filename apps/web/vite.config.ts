import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// dev 源（localhost:5173）必须显式加入 Core 的 Origin 白名单，见 PLAN §0 / ADR-0004
export default defineConfig({
  plugins: [react()],
});
