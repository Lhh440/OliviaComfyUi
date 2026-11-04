import { useCallback, useEffect, useRef, useState } from "react";
import { core } from "../api/http";
import type { AssetThumb, CheckItem, LogLine } from "../api/types";
import { FruitIcon, MiniTreeArt, AbstractThumb, seedFromFile } from "../components/art";
import { AssetPathInput } from "../components/AssetPathInput";
import { Chart } from "../components/Chart";
import { ErrorCard, Loading, PageHead } from "../components/states";
import { readSponsorHidden, writeSponsorHidden } from "../storage";
import { useApp } from "../state";

interface OverviewData {
  checklist: CheckItem[];
  queueWaiting: number;
  doneCount: number;
  port: number | null;
}

export function OverviewPage() {
  const { running, assetFolder, setAssetFolder, sample, utilHist, vramHist } = useApp();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetThumb[] | null>(null);
  const [logs, setLogs] = useState<LogLine[] | null>(null);
  const [sponsorHidden, setSponsorHidden] = useState(readSponsorHidden);
  const logBoxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([core.getChecklist(), core.getQueue(), core.getInstance()])
      .then(([checklist, queue, instance]) =>
        setData({
          checklist,
          queueWaiting: queue.running.length,
          doneCount: queue.done.length,
          port: instance.port,
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

  // 启动日志 = Core 的实例环形缓冲；无实例时为空数组（空态，不是错误）
  useEffect(() => {
    let alive = true;
    const poll = () =>
      core
        .pollLogs()
        .then((lines) => {
          if (!alive) return;
          setLogs(lines);
          const box = logBoxRef.current;
          if (box) box.scrollTop = box.scrollHeight;
        })
        .catch(() => {});
    poll();
    const id = window.setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

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
            <AssetPathInput current={null} onSave={(p) => setAssetFolder(p)} />
          </div>
        )}

        <div className="card c3">
          <div className="card-title">实例状态</div>
          <div className="metric">{running ? "运行中" : "已停止"}</div>
          <div className="metric-sub">{data?.port != null ? `端口 ${data.port}` : "未注册实例"}</div>
        </div>
        <div className="card c3">
          <div className="card-title">队列</div>
          <div className="metric">
            {data ? data.queueWaiting : <Loading text="—" />} <small>等待</small>
          </div>
          <div className="metric-sub">已完成 {data ? data.doneCount : "—"}</div>
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
          <div className="metric-sub">{sample ? (vramTotal != null ? `共 ${vramTotal.toFixed(1)} GB` : "总量不可用") : "—"}</div>
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
          ) : assets.length === 0 ? (
            <div className="empty" style={{ padding: "22px 0" }}>
              <p>目录已就绪，还没有产物。生成第一张图后这里会自动出现。</p>
            </div>
          ) : (
            <div className="thumbs">
              {assets.slice(0, 4).map((a) => (
                <div className="thumb" key={a.file}>
                  <AbstractThumb seed={seedFromFile(a.file)} />
                  <div className="cap">{a.file} · {a.sizeMb} MB</div>
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
          <div className="card-title">
            <span>启动日志</span>
            <span className="more">实例输出 · 3s 刷新</span>
          </div>
          <div className="log" ref={logBoxRef}>
            {logs === null ? (
              <Loading text="读取日志…" />
            ) : logs.length === 0 ? (
              "实例尚未启动，暂无日志。"
            ) : (
              logs.map((line, i) => <span key={i}>{line + "\n"}</span>)
            )}
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
