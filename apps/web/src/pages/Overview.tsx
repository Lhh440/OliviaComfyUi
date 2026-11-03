import { useCallback, useEffect, useRef, useState } from "react";
import { BOOT_LOG, core } from "../api/mock";
import type { AssetThumb, CheckItem, LogLine } from "../api/types";
import { FruitIcon, MiniTreeArt, AbstractThumb } from "../components/art";
import { Chart } from "../components/Chart";
import { ErrorCard, Loading, PageHead } from "../components/states";
import { readSponsorHidden, writeSponsorHidden } from "../storage";
import { useApp } from "../state";

interface OverviewData {
  checklist: CheckItem[];
  queueWaiting: number;
  doneCount: number;
}

function nowTs(): string {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, "0")).join(":");
}

export function OverviewPage() {
  const { running, assetFolder, setAssetFolder, sample, utilHist, vramHist } = useApp();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetThumb[] | null>(null);
  const [log, setLog] = useState<LogLine[]>(BOOT_LOG);
  const [sponsorHidden, setSponsorHidden] = useState(readSponsorHidden);

  const load = useCallback(() => {
    setError(null);
    Promise.all([core.getChecklist(), core.getQueue()])
      .then(([checklist, queue]) =>
        setData({
          checklist,
          queueWaiting: queue.running.length,
          doneCount: queue.done.length + 12,
        }),
      )
      .catch((err: unknown) => setError(String(err)));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!assetFolder) {
      setAssets(null);
      return;
    }
    core.listAssets().then(setAssets).catch(() => setAssets([]));
  }, [assetFolder]);

  const prevRunning = useRef(running);
  useEffect(() => {
    if (prevRunning.current === running) return;
    prevRunning.current = running;
    setLog((prev) => [
      ...prev,
      running
        ? { ts: nowTs(), level: "ok" as const, text: "实例已启动 · http://127.0.0.1:8188" }
        : { ts: nowTs(), level: "warn" as const, text: "实例已停止" },
    ]);
  }, [running]);

  const vramUsed = sample?.gpu.vramUsedGb;
  const vramTotal = sample?.gpu.vramTotalGb;
  const vramPct = vramUsed != null && vramTotal ? (vramUsed / vramTotal) * 100 : 0;

  return (
    <section className="page active">
      <PageHead page="overview" />
      <div className="grid">
        {assetFolder === null && (
          <div className="banner">
            <div className="ico" />
            <div className="txt">
              <b>未指定资产存放位置</b>
              <span>产物将写入实例目录内部，重启或迁移后难以检索。请指定一个独立的资产文件夹。</span>
            </div>
            <button className="btn" onClick={() => setAssetFolder("E:\\ComfyOutput")}>选择文件夹</button>
          </div>
        )}

        <div className="card c3">
          <div className="card-title">实例状态</div>
          <div className="metric">{running ? "运行中" : "已停止"}</div>
          <div className="metric-sub">{running ? "ComfyUI v0.3.58 · 端口 8188" : "ComfyUI v0.3.58 · 独立环境"}</div>
        </div>
        <div className="card c3">
          <div className="card-title">队列</div>
          <div className="metric">
            {data ? data.queueWaiting : <Loading text="—" />} <small>等待</small>
          </div>
          <div className="metric-sub">运行中 0 · 已完成 {data ? data.doneCount : "—"}</div>
        </div>
        <div className="card c3">
          <div className="card-title">显存占用</div>
          <div className="metric">
            {sample === null ? (
              <Loading text="—" />
            ) : vramUsed != null ? (
              <>
                {vramUsed.toFixed(1)} <small>GB</small>
              </>
            ) : (
              <span className="unavailable">不可用</span>
            )}
          </div>
          <div className="metric-sub">共 16.0 GB</div>
          <div className="bar">
            <i style={{ width: `${vramPct}%` }} />
          </div>
        </div>
        <div className="card c3">
          <div className="card-title">资产目录</div>
          {assetFolder === null ? (
            <>
              <div className="metric" style={{ fontSize: 17, color: "var(--danger)" }}>未指定</div>
              <div className="metric-sub">产物无处可寻</div>
            </>
          ) : (
            <>
              <div className="metric" style={{ fontSize: 17, color: "var(--ok)" }}>已指定</div>
              <div className="metric-sub num">{assetFolder}</div>
            </>
          )}
        </div>

        <div className="card c7">
          <div className="card-title">
            <span>GPU 实时负载</span>
            <span className="more">近 60 秒</span>
          </div>
          {sample === null ? <Loading text="正在等待第一帧采样…" /> : <Chart values={utilHist} subValues={vramHist} />}
          <div className="chart-legend">
            <span><i />利用率</span>
            <span><i className="thin" />显存</span>
          </div>
        </div>

        <div className="card c5">
          <div className="card-title">
            <span>最近产物</span>
            <span className="more">{assetFolder === null ? "尚未指定目录" : `${assets?.length ?? 0} 个文件`}</span>
          </div>
          {assetFolder === null ? (
            <div className="empty" style={{ padding: "22px 0" }}>
              <MiniTreeArt w={120} h={72} seed={42} />
              <p>指定资产文件夹后，这里会显示最近生成的作品与对应工作流。</p>
            </div>
          ) : assets === null ? (
            <Loading />
          ) : (
            <div className="thumbs">
              {assets.slice(0, 4).map((a) => (
                <div className="thumb" key={a.file}>
                  <AbstractThumb seed={a.seed} />
                  <div className="cap">{a.file} · {a.workflow}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card flat c6">
          <div className="card-title">环境自检</div>
          {error ? (
            <ErrorCard message={error} onRetry={load} />
          ) : data === null ? (
            <Loading />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {data.checklist.map((item) => (
                <div className={`st ${item.level}`} key={item.text}>
                  <i />
                  {item.text}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card flat c6">
          <div className="card-title">启动日志</div>
          <div className="log" id="bootLog">
            {log.map((line, i) => (
              <span key={i}>
                <span className="t">[{line.ts}]</span>{" "}
                <span className={line.level}>{line.level === "ok" ? "✓" : line.level === "warn" ? "·" : "·"}</span>{" "}
                {line.text}
                {"\n"}
              </span>
            ))}
          </div>
        </div>

        {!sponsorHidden && (
          <div className="sponsor-card">
            <FruitIcon />
            <div className="txt">
              <b>Olivia 是开源项目</b>
              <span>如果它帮你省下了折腾环境的时间，可以在爱发电支持后续开发。</span>
            </div>
            <a href="#" onClick={(e) => e.preventDefault()}>爱发电 →</a>
            <button
              className="x"
              title="关闭（可在设置中重新开启）"
              onClick={() => {
                writeSponsorHidden(true);
                setSponsorHidden(true);
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
