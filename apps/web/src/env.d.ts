/// <reference types="vite/client" />

// vite.config 的 define 注入：开发期来自 core.json，生产构建为 null（令牌走壳注入）
declare const __OLIVIA_CORE_TOKEN__: string | null;
