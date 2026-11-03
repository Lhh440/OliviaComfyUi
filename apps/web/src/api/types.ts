// 与未来 Python Core（M1.1）对齐的数据形状。
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

export interface InstanceInfo {
  name: string;
  version: string;
  commit: string;
  torch: string;
  cuda: string;
  port: number;
  diskGb: number;
  path: string;
}

export interface CheckItem {
  level: "ok" | "warn" | "idle";
  text: string;
}

export interface QueueTask {
  workflow: string;
  node: string;
  /** null = 无进度信息 */
  step: number | null;
  stepTotal: number | null;
  elapsedSec: number;
  peakVramGb: number | null;
}

export interface OomInfo {
  workflow: string;
  stage: string;
  peakVramGb: number;
  hint: string;
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
  workflow: string;
  seed: number;
}

export interface DiskInfo {
  label: string;
  freeGb: number;
  totalGb: number;
}

export interface LogLine {
  ts: string;
  level: "ok" | "warn" | "info";
  text: string;
}
