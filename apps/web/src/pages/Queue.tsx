import { useCallback, useEffect, useState } from "react";
import { core } from "../api/http";
import type { QueueData } from "../api/types";
import { ErrorCard, Loading, PageHead } from "../components/states";

// M1.1a 只有队列快照透传；节点级进度与运行历史(/history)在 M1.2 接入
function fmt(sec: number | null): string {
  if (sec == null) return "不可用";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function QueuePage() {
  const [data, setData] = useState<QueueData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    core.getQueue().then(setData).catch((err: unknown) => setError(String(err)));
  }, []);
  useEffect(load, [load]);

  // 实例运行时 3s 轮询，让队列变化自动出现
  useEffect(() => {
    const id = window.setInterval(() => {
      core.getQueue().then(setData).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="page active">
      <PageHead page="queue" />
      <div className="grid">
        {error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : data === null ? (
          <div className="card c12"><Loading /></div>
        ) : (
          <>
            <div className="card c12">
              <div className="card-title">
                <span>运行中</span>
                <span className="pill run">{data.running.length} 个任务</span>
              </div>
              {data.running.length === 0 ? (
                <div className="loading">队列为空。在嵌入画布或历史工作流中提交任务后，这里会显示节点级进度。</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "34%" }}>工作流</th>
                      <th>当前节点</th>
                      <th>进度</th>
                      <th>耗时</th>
                      <th>峰值显存</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.running.map((t) => (
                      <tr key={t.workflow}>
                        <td>{t.workflow}</td>
                        <td className="mono">{t.node ?? "不可用"}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="bar" style={{ flex: 1, margin: 0 }}>
                              <i style={{ width: `${t.step != null && t.stepTotal ? (t.step / t.stepTotal) * 100 : 0}%` }} />
                            </div>
                            <span className="mono" style={{ fontSize: 11 }}>
                              {t.step != null && t.stepTotal ? `${t.step}/${t.stepTotal}` : "不可用"}
                            </span>
                          </div>
                        </td>
                        <td className="mono">{fmt(t.elapsedSec)}</td>
                        <td className="mono">{t.peakVramGb != null ? `${t.peakVramGb} GB` : "不可用"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {data.pending.length > 0 && (
              <div className="card c12">
                <div className="card-title">
                  <span>待处理</span>
                  <span className="pill">{data.pending.length} 个任务</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "34%" }}>工作流</th>
                      <th>当前节点</th>
                      <th>耗时</th>
                      <th>峰值显存</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pending.map((t, i) => (
                      <tr key={`${t.workflow}-${i}`}>
                        <td>{t.workflow}</td>
                        <td className="mono">{t.node ?? "不可用"}</td>
                        <td className="mono">{fmt(t.elapsedSec)}</td>
                        <td className="mono">{t.peakVramGb != null ? `${t.peakVramGb} GB` : "不可用"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="card c12">
              <div className="card-title">
                <span>已完成</span>
                <span className="more">今天 {data.done.length} 个</span>
              </div>
              {data.done.length === 0 ? (
                <div className="loading">运行历史将在 M1.2 接入实例 /history 后展示。</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "34%" }}>工作流</th>
                      <th>状态</th>
                      <th>耗时</th>
                      <th>峰值显存</th>
                      <th>产物</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.done.map((t) => {
                      const oom = t.peakVramGb != null && t.peakVramGb > 15;
                      return (
                        <tr key={t.workflow}>
                          <td>{t.workflow}</td>
                          <td>
                            <span className={oom ? "pill bad" : "pill"}>{oom ? "OOM" : "成功"}</span>
                          </td>
                          <td className="mono">{fmt(t.elapsedSec)}</td>
                          <td className="mono" style={oom ? { color: "var(--danger)" } : undefined}>
                            {t.peakVramGb != null ? `${t.peakVramGb} GB` : "不可用"}
                          </td>
                          <td className="mono" style={{ fontSize: 11 }}>—</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {data.oom && (
              <div className="card flat c12" style={{ border: "1px solid var(--danger)", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: "12.5px", color: "var(--danger)", fontWeight: 600, marginBottom: 3 }}>上一条任务显存不足</div>
                <div style={{ fontSize: "11.5px", color: "var(--ink2)", marginBottom: 9 }}>
                  {data.oom.workflow} {data.oom.hint}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" style={{ height: 30, fontSize: 12 }}>降低分辨率</button>
                  <button className="btn" style={{ height: 30, fontSize: 12 }}>改用 fp8</button>
                  <button className="btn" style={{ height: 30, fontSize: 12 }}>加 --lowvram</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
