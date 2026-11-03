import type {
  AssetThumb,
  AttributionRow,
  CheckItem,
  DiskInfo,
  HardwareSample,
  InstanceInfo,
  LogLine,
  OomInfo,
  QueueTask,
} from "./types";

// M1.1 起由 127.0.0.1:<core>/api 的真实实现替换；前端只依赖本接口形状（ADR-0004）。
// mock 的职责是让三态（加载/空/错误）在真实后端存在之前就能被开发和验收。
export interface CoreApi {
  getInstance(): Promise<InstanceInfo>;
  getChecklist(): Promise<CheckItem[]>;
  getQueue(): Promise<{ running: QueueTask[]; done: QueueTask[]; oom: OomInfo | null }>;
  getAttribution(): Promise<AttributionRow[]>;
  getDisks(): Promise<DiskInfo[]>;
  listAssets(): Promise<AssetThumb[]>;
  /** 返回退订函数；真实实现是 WebSocket 订阅 */
  subscribeHardware(cb: (sample: HardwareSample) => void): () => void;
  setRunning(v: boolean): void;
  setAssetFolder(path: string | null): void;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const THUMB_NAMES = [
  "00042_.png", "00041_.png", "00040_.png", "00039_.png",
  "00038_.png", "00037_.png", "00036_.png", "00035_.png",
];
const THUMB_WFS = ["olive_landscape", "character_sheet", "olive_portrait", "upscale_batch"];

export class MockCore implements CoreApi {
  private running = false;
  private assetFolder: string | null = null;
  private listeners = new Set<(s: HardwareSample) => void>();
  private timer: number | null = null;

  /** 构造 true 可验收「NVML 不可用」的错误态渲染路径 */
  constructor(private nvmlAvailable = true) {}

  async getInstance(): Promise<InstanceInfo> {
    await delay(300);
    return {
      name: "ComfyUI · 默认实例",
      version: "v0.3.58",
      commit: "b7a1c92",
      torch: "2.6.0+cu124",
      cuda: "12.4",
      port: 8188,
      diskGb: 11.4,
      path: "…\\instances\\default\\ComfyUI",
    };
  }

  async getChecklist(): Promise<CheckItem[]> {
    await delay(450);
    return [
      { level: "ok", text: "显卡驱动 566.36 · 支持 CUDA 12.4" },
      { level: "ok", text: "Python 3.12.7 · uv 托管运行时" },
      { level: "ok", text: "torch 2.6.0+cu124 · 已验证可用" },
      { level: "warn", text: "模型目录缺少 1 个 checkpoint（见「模型」页）" },
      { level: "idle", text: "端口 8188 空闲" },
    ];
  }

  async getQueue(): Promise<{ running: QueueTask[]; done: QueueTask[]; oom: OomInfo | null }> {
    await delay(400);
    return {
      running: this.running
        ? [{ workflow: "olive_portrait_v3.json", node: "KSampler", step: 12, stepTotal: 20, elapsedSec: 41, peakVramGb: 9.8 }]
        : [],
      done: [
        { workflow: "olive_landscape.json", node: "VAEDecode", step: null, stepTotal: null, elapsedSec: 72, peakVramGb: 8.4 },
        { workflow: "character_sheet.json", node: "VAEDecode", step: null, stepTotal: null, elapsedSec: 58, peakVramGb: 7.9 },
        { workflow: "upscale_batch.json", node: "VAEDecode", step: null, stepTotal: null, elapsedSec: 23, peakVramGb: 15.6 },
      ],
      oom: {
        workflow: "upscale_batch.json",
        stage: "VAE Decode",
        peakVramGb: 15.6,
        hint: "在 VAE Decode 阶段达到 15.6 GB，超过可用上限。",
      },
    };
  }

  async getAttribution(): Promise<AttributionRow[]> {
    await delay(500);
    return [
      { workflow: "olive_portrait_v3.json", running: this.running, peakVramGb: 9.8, avgUtil: 94, peakTempC: 68, elapsedSec: 41 },
      { workflow: "olive_landscape.json", running: false, peakVramGb: 8.4, avgUtil: 91, peakTempC: 66, elapsedSec: 72 },
      { workflow: "character_sheet.json", running: false, peakVramGb: 7.9, avgUtil: 88, peakTempC: 64, elapsedSec: 58 },
      { workflow: "upscale_batch.json", running: false, peakVramGb: 15.6, avgUtil: 97, peakTempC: 72, elapsedSec: 23 },
    ];
  }

  async getDisks(): Promise<DiskInfo[]> {
    await delay(350);
    return [
      { label: "D: 实例与缓存", freeGb: 412, totalGb: 1000 },
      { label: "E: 资产目录", freeGb: 1800, totalGb: 2000 },
    ];
  }

  async listAssets(): Promise<AssetThumb[]> {
    await delay(350);
    if (!this.assetFolder) return [];
    return THUMB_NAMES.map((file, i) => ({
      file,
      workflow: THUMB_WFS[i % THUMB_WFS.length],
      seed: 1000 + i * 37,
    }));
  }

  subscribeHardware(cb: (s: HardwareSample) => void): () => void {
    this.listeners.add(cb);
    if (this.timer === null) {
      // 1s 一帧与 PLAN §3.1 一致；插值交给前端
      this.timer = window.setInterval(() => this.emit(), 1000);
      this.emit();
    }
    return () => {
      this.listeners.delete(cb);
      if (this.listeners.size === 0 && this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  setRunning(v: boolean): void {
    this.running = v;
  }

  setAssetFolder(path: string | null): void {
    this.assetFolder = path;
  }

  private emit(): void {
    const t = Date.now();
    const gpu = this.nvmlAvailable
      ? {
          name: "RTX 4070 Ti SUPER",
          driver: "566.36",
          utilization: this.running ? clamp(88 + Math.sin(t / 900) * 7 + rand(3), 0, 100) : Math.max(0, rand(1)),
          vramUsedGb: this.running ? 16 * (clamp(58 + Math.sin(t / 1700) * 3 + rand(1), 0, 100) / 100) : 0.4,
          vramTotalGb: 16.0,
          temperatureC: this.running ? 58 + 12 * 0.9 : 44,
          fanPercent: this.running ? 52 + 14 * 0.9 : 28,
          powerW: this.running ? 120 + 70 * 1.3 : 12,
          powerLimitW: 285,
        }
      : {
          name: null, driver: null, utilization: null, vramUsedGb: null, vramTotalGb: null,
          temperatureC: null, fanPercent: null, powerW: null, powerLimitW: null,
        };
    const sample: HardwareSample = {
      ts: t,
      gpu,
      system: {
        cpuPercent: 18 + Math.random() * 14,
        ramUsedGb: 14.2 + Math.random() * 2,
        ramTotalGb: 32,
      },
    };
    for (const cb of this.listeners) cb(sample);
  }
}

function rand(scale: number): number {
  return (Math.random() - 0.5) * 2 * scale;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

// 单例：页面与 App 共享同一份 mock 状态；接真实 Core 时只换这里
export const core: CoreApi = new MockCore();

// 初始日志的示例内容；真实接入后由 Core 的环形缓冲替换（PLAN §2）
export const BOOT_LOG: LogLine[] = [
  { ts: "20:41:02", level: "ok", text: "环境自检通过" },
  { ts: "20:41:03", level: "ok", text: "前端资源已缓存（本地，不走 GitHub）" },
  { ts: "20:41:04", level: "ok", text: "端口探测：8188 可用" },
  { ts: "20:41:04", level: "info", text: "等待启动实例…" },
];
