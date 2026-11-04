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

// 令牌注入路径（ADR-0004）：桌面端由壳注入 window.__OLIVIA_BOOT__；
// web 开发期由 vite 代理读 core.json，并把令牌经 define 注入本常量。
declare const __OLIVIA_CORE_TOKEN__: string | null;

function authHeaders(extra?: HeadersInit): HeadersInit {
  if (!__OLIVIA_CORE_TOKEN__) return extra ?? {};
  return { Authorization: `Bearer ${__OLIVIA_CORE_TOKEN__}`, ...extra };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: authHeaders(init?.headers) });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // 非 JSON 错误体：保留状态码信息
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export async function probeCore(): Promise<boolean> {
  try {
    return (await fetchJson<{ ok: boolean }>("/api/health")).ok === true;
  } catch {
    return false;
  }
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return fetchJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function wsHardwareUrl(): string {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const q = __OLIVIA_CORE_TOKEN__ ? `?token=${encodeURIComponent(__OLIVIA_CORE_TOKEN__)}` : "";
  return `${proto}://${location.host}/api/ws/hardware${q}`;
}

export class HttpCore implements CoreApi {
  getInstance(): Promise<InstanceInfo> {
    return fetchJson<InstanceInfo>("/api/instance");
  }

  registerInstance(req: RegisterRequest): Promise<void> {
    return post<void>("/api/instance/register", req);
  }

  unregisterInstance(): Promise<void> {
    return post<void>("/api/instance/unregister");
  }

  getChecklist(): Promise<CheckItem[]> {
    return fetchJson<CheckItem[]>("/api/checklist");
  }

  getQueue(): Promise<QueueData> {
    return fetchJson<QueueData>("/api/comfy/queue");
  }

  // 归因需要实例 /ws 事件流（M1.2）；现在返回空数组，页面显示空态
  getAttribution(): Promise<AttributionRow[]> {
    return Promise.resolve([]);
  }

  getDisks(): Promise<DiskInfo[]> {
    return fetchJson<DiskInfo[]>("/api/disks");
  }

  listAssets(): Promise<AssetThumb[]> {
    return fetchJson<AssetThumb[]>("/api/assets");
  }

  subscribeHardware(cb: (sample: HardwareSample) => void): () => void {
    let closed = false;
    let gotFrame = false;
    let pollId: number | null = null;
    let ws: WebSocket | null = null;

    const startPoll = () => {
      if (closed || pollId !== null) return;
      pollId = window.setInterval(() => {
        fetchJson<HardwareSample>("/api/hardware").then(cb).catch(() => {
          // 断连期间保留最后一帧，不冒充数据
        });
      }, 1000);
    };

    try {
      ws = new WebSocket(wsHardwareUrl());
      ws.onmessage = (ev: MessageEvent) => {
        gotFrame = true;
        try {
          cb(JSON.parse(ev.data as string) as HardwareSample);
        } catch {
          // 坏帧丢弃，不冒充数据
        }
      };
      ws.onclose = () => {
        if (!closed) startPoll();
      };
      // WS 2.5s 内没吐帧（连不上/被拒）就退化成轮询
      window.setTimeout(() => {
        if (!closed && !gotFrame) startPoll();
      }, 2500);
    } catch {
      startPoll();
    }

    return () => {
      closed = true;
      if (pollId !== null) clearInterval(pollId);
      ws?.close();
    };
  }

  setRunning(v: boolean): Promise<void> {
    return post<void>(v ? "/api/instance/start" : "/api/instance/stop");
  }

  setAssetFolder(path: string | null): Promise<void> {
    return post<void>("/api/settings/asset-folder", { path });
  }

  pollLogs(): Promise<LogLine[]> {
    return fetchJson<{ lines: LogLine[] }>("/api/logs").then((r) => r.lines);
  }
}

export const core: CoreApi = new HttpCore();
