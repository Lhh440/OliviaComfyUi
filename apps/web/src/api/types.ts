// 与 Olivia Core（services/core）对齐的数据形状，字段名与 Core 返回一致。
// 约定：可采集硬件字段一律可空——null 表示「拿不到」，UI 必须显示「不可用」而不是 0（AGENTS.md）。

export interface GpuInfo {
  /** null = 未检测到 NVML/适配器 */
  name: string | null;
  driver: string | null;
  utilization: number | null;
  vramUsedGb: number | null;
  vramTotalGb: number | null;
  temperatureC: number | null;
  fanPercent: number | null;
  powerW: number | null;
  powerLimitW: number | null;
}

export interface SystemInfo {
  cpuPercent: number | null;
  ramUsedGb: number | null;
  ramTotalGb: number | null;
}

export interface HardwareSample {
  ts: number;
  gpu: GpuInfo;
  system: SystemInfo;
}

export type InstanceStatus = "starting" | "running" | "stopping" | "stopped" | "failed";

export interface InstanceInfo {
  deployed: boolean;
  running: boolean;
  status: InstanceStatus | null;
  name: string;
  path: string | null;
  python: string | null;
  port: number | null;
  pid: number | null;
  /** 以下字段由 M1.1b 部署引擎填充；现在没有就是 null → 显示「不可用」 */
  version: string | null;
  torch: string | null;
  cuda: string | null;
  diskGb: number | null;
  exitCode: number | null;
}

export interface RegisterRequest {
  path: string;
  python: string;
}

export interface CheckItem {
  level: "ok" | "warn" | "idle";
  text: string;
}

export interface QueueTask {
  workflow: string;
  node: string | null;
  step: number | null;
  stepTotal: number | null;
  elapsedSec: number | null;
  peakVramGb: number | null;
}

export interface OomInfo {
  workflow: string;
  stage: string;
  peakVramGb: number;
  hint: string;
}

export interface QueueData {
  running: QueueTask[];
  pending: QueueTask[];
  done: QueueTask[];
  oom: OomInfo | null;
  note?: string;
}

export interface AttributionRow {
  workflow: string;
  running: boolean;
  peakVramGb: number;
  avgUtil: number;
  peakTempC: number;
  elapsedSec: number;
}

export interface AssetThumb {
  file: string;
  sizeMb: number;
  mtime: string;
}

export interface DiskInfo {
  label: string;
  freeGb: number;
  totalGb: number;
}

export type LogLine = string;

// 前端只依赖本接口形状（ADR-0004）；M1.1a 有两个实现：HttpCore（真）与 MockCore（演示）
export interface CoreApi {
  getInstance(): Promise<InstanceInfo>;
  registerInstance(req: RegisterRequest): Promise<void>;
  unregisterInstance(): Promise<void>;
  getChecklist(): Promise<CheckItem[]>;
  getQueue(): Promise<QueueData>;
  /** M1.2 前恒为空数组：归因需要实例 /ws 事件流 */
  getAttribution(): Promise<AttributionRow[]>;
  getDisks(): Promise<DiskInfo[]>;
  listAssets(): Promise<AssetThumb[]>;
  /** 真实实现是 WS 订阅 + 轮询兜底 */
  subscribeHardware(cb: (sample: HardwareSample) => void): () => void;
  setRunning(v: boolean): Promise<void>;
  setAssetFolder(path: string | null): Promise<void>;
  pollLogs(): Promise<LogLine[]>;
}
