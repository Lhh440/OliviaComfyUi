import type {
  AssetThumb,
  AttributionRow,
  CheckItem,
  CoreApi,
  DiskInfo,
  HardwareSample,
  InstanceInfo,
  LogLine,
  QueueData,
  RegisterRequest,
} from "./types";

// 演示实现：无 Core 时的视觉/交互样例，不参与真实链路（App 使用 api/http.ts）。
// 保留它是为了在纯前端改动时随时能看到"数据理想态"。
export class MockCore implements CoreApi {
  private running = false;
  private assetFolder: string | null = null;
  private listeners = new Set<(s: HardwareSample) => void>();
  private timer: number | null = null;

  constructor(private nvmlAvailable = true) {}

  async getInstance(): Promise<InstanceInfo> {
    return {
      deployed: true,
      running: this.running,
      status: this.running ? "running" : "stopped",
      name: "ComfyUI · 默认实例",
      path: "…\\instances\\default\\ComfyUI",
      python: "python",
      port: 8188,
      pid: null,
      version: null,
      torch: null,
      cuda: null,
      diskGb: null,
      exitCode: null,
    };
  }

  async registerInstance(_req: RegisterRequest): Promise<void> {
    // 演示实现不落盘
  }

  async unregisterInstance(): Promise<void> {}

  async getChecklist(): Promise<CheckItem[]> {
    return [
      { level: "ok", text: "显卡驱动 566.36 · 支持 CUDA 12.4" },
      { level: "ok", text: "Python 3.12.7 · uv 托管运行时" },
      { level: "ok", text: "torch 2.6.0+cu124 · 已验证可用" },
      { level: "warn", text: "模型目录缺少 1 个 checkpoint（见「模型」页）" },
      { level: "idle", text: "端口 8188 空闲" },
    ];
  }

  async getQueue(): Promise<QueueData> {
    return {
      running: this.running
        ? [{ workflow: "olive_portrait_v3.json", node: "KSampler", step: 12, stepTotal: 20, elapsedSec: 41, peakVramGb: 9.8 }]
        : [],
      pending: [],
      done: [
        { workflow: "olive_landscape.json", node: "VAEDecode", step: null, stepTotal: null, elapsedSec: 72, peakVramGb: 8.4 },
        { workflow: "character_sheet.json", node: "VAEDecode", step: null, stepTotal: null, elapsedSec: 58, peakVramGb: 7.9 },
        { workflow: "upscale_batch.json", node: "VAEDecode", step: null, stepTotal: null, elapsedSec: 23, peakVramGb: 15.6 },
      ],
      oom: null,
      note: "mock",
    };
  }

  async getAttribution(): Promise<AttributionRow[]> {
    return [
      { workflow: "olive_portrait_v3.json", running: this.running, peakVramGb: 9.8, avgUtil: 94, peakTempC: 68, elapsedSec: 41 },
      { workflow: "olive_landscape.json", running: false, peakVramGb: 8.4, avgUtil: 91, peakTempC: 66, elapsedSec: 72 },
      { workflow: "character_sheet.json", running: false, peakVramGb: 7.9, avgUtil: 88, peakTempC: 64, elapsedSec: 58 },
      { workflow: "upscale_batch.json", running: false, peakVramGb: 15.6, avgUtil: 97, peakTempC: 72, elapsedSec: 23 },
    ];
  }

  async getDisks(): Promise<DiskInfo[]> {
    return [
      { label: "D: 实例与缓存", freeGb: 412, totalGb: 1000 },
      { label: "E: 资产目录", freeGb: 1800, totalGb: 2000 },
    ];
  }

  async listAssets(): Promise<AssetThumb[]> {
    if (!this.assetFolder) return [];
    return ["00042_.png", "00041_.png", "00040_.png"].map((file) => ({
      file,
      sizeMb: 2.1,
      mtime: "2026-11-03T08:00:00",
    }));
  }

  subscribeHardware(cb: (s: HardwareSample) => void): () => void {
    this.listeners.add(cb);
    if (this.timer === null) {
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

  async setRunning(v: boolean): Promise<void> {
    this.running = v;
  }

  async setAssetFolder(path: string | null): Promise<void> {
    this.assetFolder = path;
  }

  async pollLogs(): Promise<LogLine[]> {
    return [`[mock] 运行中：${this.running}`];
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
          temperatureC: this.running ? 68 : 44,
          fanPercent: this.running ? 64 : 28,
          powerW: this.running ? 210 : 12,
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
