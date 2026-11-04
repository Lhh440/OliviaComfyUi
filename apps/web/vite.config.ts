import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// dev 源（localhost:5173）已在 Core 的 Origin 白名单内（ADR-0004）。
// Core 先启动（写 core.json），再 pnpm dev；Core 换端口需重启 vite（端口在
// 启动时读取），但换令牌不用——代理对每个请求重读 core.json 注入当前令牌。
// define 注入的令牌仅供前端直连兜底；生产（Tauri 壳）由壳注入 window.__OLIVIA_BOOT__。
function readCoreJson(): { port: number; token: string } | null {
  try {
    const base =
      process.env.OLIVIA_DATA_ROOT ??
      path.join(process.env.LOCALAPPDATA ?? "", "OliviaComfyUI");
    const raw = fs.readFileSync(path.join(base, "core.json"), "utf-8");
    const parsed = JSON.parse(raw) as { port?: number; token?: string };
    if (parsed.port && parsed.token) return { port: parsed.port, token: parsed.token };
  } catch {
    // Core 未启动：不挂代理，前端显示「本地服务未连接」
  }
  return null;
}

const core = readCoreJson();

export default defineConfig({
  plugins: [react()],
  define: {
    __OLIVIA_CORE_TOKEN__: JSON.stringify(core?.token ?? null),
  },
  server: core
    ? {
        proxy: {
          "/api": {
            target: `http://127.0.0.1:${core.port}`,
            ws: true,
            changeOrigin: false,
            configure: (proxy) => {
              // http-proxy 的 router 选项在 vite 下不生效，逐请求注入令牌走事件钩子
              const inject = (proxyReq: { setHeader: (k: string, v: string) => void }) => {
                const c = readCoreJson();
                if (c) proxyReq.setHeader("Authorization", `Bearer ${c.token}`);
              };
              proxy.on("proxyReq", inject);
              proxy.on("proxyReqWs", inject);
            },
          },
        },
      }
    : {},
});
