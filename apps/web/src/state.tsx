import { createContext, useContext } from "react";
import type { HardwareSample, InstanceInfo } from "./api/types";

export type PageKey =
  | "overview"
  | "instances"
  | "queue"
  | "hardware"
  | "assets"
  | "models"
  | "settings";

export const PAGE_ORDER: PageKey[] = [
  "overview",
  "instances",
  "queue",
  "hardware",
  "assets",
  "models",
  "settings",
];

export const PAGE_META: Record<PageKey, { title: string; hint: string }> = {
  overview: { title: "总览", hint: "当前实例能否出图？还差什么？" },
  instances: { title: "实例", hint: "每个实例有独立的 venv 与端口" },
  queue: { title: "队列", hint: "节点级进度来自 ComfyUI 的 /ws 事件" },
  hardware: { title: "硬件", hint: "500ms 采样 · NVML 直读" },
  assets: { title: "资产", hint: "产物统一存放，可反向追溯工作流" },
  models: { title: "模型", hint: "扫描 models 目录，标记缺失依赖" },
  settings: { title: "设置", hint: "所有镜像源均可切回官方" },
};

export interface AppState {
  page: PageKey;
  navigate: (page: PageKey) => void;
  running: boolean;
  toggleRunning: () => void;
  assetFolder: string | null;
  setAssetFolder: (path: string | null) => void;
  /** null = 探活中；false = Core 不可达（全局横幅 + 各页错误态） */
  coreOnline: boolean | null;
  /** 最近一帧实例信息（3s 轮询）；null = 尚未取到 */
  instance: InstanceInfo | null;
  /** null = 硬件订阅尚未吐出第一帧（加载态） */
  sample: HardwareSample | null;
  utilHist: number[];
  vramHist: number[];
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(AppContext);
  if (!v) throw new Error("useApp 必须在 AppContext.Provider 内使用");
  return v;
}
